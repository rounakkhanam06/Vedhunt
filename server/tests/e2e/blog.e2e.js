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
  const cms = await Role.create({ name: 'CMS_EDITOR', permissions: ['cms.manage', 'pricing.manage'] });
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
  // On a brand-new DB the unique slug index is built in the background; wait
  // for it (production already has it) so the duplicate-slug test is reliable.
  await require('../../models/Blog').init();
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

describe('Home page pricing cards: at most 3 on the homepage', () => {
  const tier = { price: '₹9,999', period: '/mo', features: ['One'] };
  const card = (title, showOnHome) => ({
    title, icon: 'Globe', description: 'd', color: '#FF6B00', showOnHome,
    tiers: { starter: tier, growth: tier, enterprise: tier },
  });
  const made = {};

  test('the first 3 home cards save', async () => {
    // start-up seeds the 3 default cards into an empty DB — start clean
    await mongoose.connection.db.collection('homepricingcards').deleteMany({});
    for (const t of ['Website', 'Social', 'Performance']) {
      const r = await call('cms', 'POST', '/home-pricing', card(t, true));
      assert.equal(r.status, 201, JSON.stringify(r.body));
      made[t] = r.body.data._id;
    }
  });

  test('a 4th home card is refused with a clear message', async () => {
    const r = await call('cms', 'POST', '/home-pricing', card('SEO', true));
    assert.equal(r.status, 400);
    assert.match(r.body.message, /Only 3 pricing cards/);
  });

  test('a card that is not on the home page still saves (used by landing pages)', async () => {
    const r = await call('cms', 'POST', '/home-pricing', card('SEO', false));
    assert.equal(r.status, 201, JSON.stringify(r.body));
    made.SEO = r.body.data._id;
  });

  test('switching an extra card ON is refused; editing a home card is not', async () => {
    const on = await call('cms', 'PUT', `/home-pricing/${made.SEO}`, card('SEO', true));
    assert.equal(on.status, 400);
    const edit = await call('cms', 'PUT', `/home-pricing/${made.Social}`, card('Social Media', true));
    assert.equal(edit.status, 200, JSON.stringify(edit.body));
  });

  test('freeing a slot lets another card in', async () => {
    assert.equal((await call('cms', 'PUT', `/home-pricing/${made.Website}`, card('Website', false))).status, 200);
    assert.equal((await call('cms', 'PUT', `/home-pricing/${made.SEO}`, card('SEO', true))).status, 200);
  });

  test('the homepage list is capped at 3 even if older data marks more', async () => {
    await mongoose.connection.db.collection('homepricingcards').updateMany({}, { $set: { showOnHome: true } });
    const r = await fetch(`${base}/home-pricing?showOnHome=true`).then((x) => x.json());
    assert.equal(r.data.length, 3);
    assert.deepEqual(r.data.map((c) => c.title), ['Website', 'Social Media', 'Performance'], 'oldest first');
  });
});
