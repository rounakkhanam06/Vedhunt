/**
 * Blog create/update through the REAL server (server.js: every middleware,
 * auth and route) against a throwaway in-memory MongoDB (never the database
 * in server/.env):
 *
 *   npm run test:e2e
 */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { spawn } = require('child_process');
const net = require('net');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const SERVER_DIR = path.resolve(__dirname, '../..');
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'a'.repeat(64);
const JWT_SECRET = 'e2e-test-secret';

let mongo;
let server;
let serverLog = '';
let base;
const ids = {};

const freePort = () => new Promise((resolve) => {
  const s = net.createServer().listen(0, () => { const { port } = s.address(); s.close(() => resolve(port)); });
});

const call = async (who, method, url, body) => {
  const token = jwt.sign({ id: ids[who] }, JWT_SECRET, { expiresIn: '1h' });
  const res = await fetch(base + url, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, body: json };
};

// What the admin "Create blog" form sends
const form = (extra = {}) => ({
  title: 'How to Grow with Meta Ads',
  slug: '',
  excerpt: 'A short guide',
  category: 'Marketing',
  author: 'Vedhunt Team',
  thumbnail: 'https://res.cloudinary.com/demo/image/upload/thumb.jpg',
  isPublished: false,
  contentBlocks: [{ type: 'paragraph', data: { text: 'Hello' }, id: '1731900000000' }],
  ...extra,
});

before(async () => {
  mongo = await MongoMemoryServer.create();
  const uri = mongo.getUri();
  await mongoose.connect(uri);
  const Role = require('../../models/Role');
  const Admin = require('../../models/Admin');
  const Settings = require('../../models/Settings');
  const { DEFAULT_EMPLOYEE_ROLES } = require('../../utils/employeeRoles');
  await Settings.create([
    { key: 'employee_roles_seeded', value: DEFAULT_EMPLOYEE_ROLES.map((r) => r.name) },
    { key: 'permission_migration', value: { version: 1 } },
  ]);
  const cms = await Role.create({ name: 'CMS_EDITOR', permissions: ['cms.manage'] });
  const a = await Admin.create({ firstName: 'Cms', lastName: 'Editor', email: 'cms@e2e.test', password: 'Passw0rd!e2e', roles: [cms._id] });
  ids.cms = String(a._id);

  const port = await freePort();
  base = `http://127.0.0.1:${port}/api`;
  server = spawn(process.execPath, ['server.js'], {
    cwd: SERVER_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env, NODE_ENV: 'development', PORT: String(port), MONGODB_URI: uri,
      JWT_SECRET, JWT_REFRESH_SECRET: `${JWT_SECRET}-refresh`,
      RESEND_API_KEY: '', EMAIL_FROM: '', HR_EMAIL: '',
      CLOUDINARY_CLOUD_NAME: '', CLOUDINARY_API_KEY: '', CLOUDINARY_API_SECRET: '',
      FB_APP_SECRET: '', FB_VERIFY_TOKEN: '', FB_PAGE_ACCESS_TOKEN: '', FIREBASE_SERVICE_ACCOUNT_JSON: '',
    },
  });
  server.stdout.on('data', (d) => { serverLog += d; });
  server.stderr.on('data', (d) => { serverLog += d; });
  const started = Date.now();
  for (;;) {
    if (serverLog.includes('Server running')) break;
    if (server.exitCode !== null || Date.now() - started > 90_000) throw new Error(`Server did not start:\n${serverLog.slice(-3000)}`);
    await new Promise((r) => setTimeout(r, 250));
  }
}, { timeout: 300_000 });

after(async () => {
  server?.kill();
  await mongoose.disconnect();
  await mongo?.stop();
});

describe('Creating a blog from the admin form', () => {
  test('a draft saves, and an empty slug is made from the title', async () => {
    const r = await call('cms', 'POST', '/blogs', form());
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.data.slug, 'how-to-grow-with-meta-ads');
    assert.equal(r.body.data.category, 'MARKETING');
  });

  test('a published blog saves (the newsletter job must not break the save)', async () => {
    const r = await call('cms', 'POST', '/blogs', form({ title: 'Published one', isPublished: true }));
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.data.isPublished, true);
  });

  test('a slug typed with spaces or capitals becomes a clean URL', async () => {
    const r = await call('cms', 'POST', '/blogs', form({ title: 'Another', slug: '  My SEO Tips & Tricks ' }));
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.data.slug, 'my-seo-tips-and-tricks');
  });

  test('missing fields give a 400 that names them, not a server error', async () => {
    const r = await call('cms', 'POST', '/blogs', form({ title: 'No pic', thumbnail: '', category: '' }));
    assert.equal(r.status, 400, JSON.stringify(r.body));
    assert.match(r.body.message, /thumbnail/i);
    assert.match(r.body.message, /category/i);
  });

  test('a duplicate slug says so', async () => {
    const r = await call('cms', 'POST', '/blogs', form());
    assert.equal(r.status, 400);
    assert.match(r.body.message, /slug already exists/i);
  });

  test('editing keeps working, and the edited slug is cleaned too', async () => {
    const r = await call('cms', 'PUT', '/blogs/my-seo-tips-and-tricks', form({ title: 'Another (edited)', slug: 'Another Edited' }));
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.data.slug, 'another-edited');
  });
});
