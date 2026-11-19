/**
 * Server uploads (utils/storage.js) through the REAL server against an in-memory
 * MongoDB and a temp uploads folder: upload an image, fetch it back the way the
 * website (another domain) would, and check the safety headers.
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const { spawn } = require('child_process');
const { MongoMemoryServer } = require('mongodb-memory-server');

const SERVER_DIR = path.resolve(__dirname, '../..');
const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vh-up-e2e-'));
let mongo;
let server;
let log = '';
let origin;

const freePort = () => new Promise((resolve) => {
  const s = net.createServer().listen(0, () => { const { port } = s.address(); s.close(() => resolve(port)); });
});

before(async () => {
  mongo = await MongoMemoryServer.create();
  const port = await freePort();
  origin = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ['server.js'], {
    cwd: SERVER_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env, NODE_ENV: 'development', PORT: String(port), MONGODB_URI: mongo.getUri('vh_uploads_e2e'),
      JWT_SECRET: 'e2e', JWT_REFRESH_SECRET: 'e2e-r', RESEND_API_KEY: '', FIREBASE_SERVICE_ACCOUNT_JSON: '',
      ENCRYPTION_KEY: 'a'.repeat(64), UPLOAD_DIR: uploadDir, UPLOADS_PUBLIC_URL: origin,
    },
  });
  server.stdout.on('data', (d) => { log += d; });
  server.stderr.on('data', (d) => { log += d; });
  const started = Date.now();
  while (!log.includes('Server running')) {
    if (server.exitCode !== null || Date.now() - started > 90_000) throw new Error(`Server did not start:\n${log.slice(-3000)}`);
    await new Promise((r) => setTimeout(r, 250));
  }
}, { timeout: 120_000 });

after(async () => {
  server?.kill();
  await mongo?.stop();
  fs.rmSync(uploadDir, { recursive: true, force: true });
});

const png = () => require('sharp')(require('crypto').randomBytes(800 * 400 * 3), { raw: { width: 800, height: 400, channels: 3 } }).png().toBuffer();
const send = async (buf, name, type) => {
  const form = new FormData();
  form.append('image', new Blob([buf], { type }), name);
  const res = await fetch(`${origin}/api/upload/public`, { method: 'POST', body: form });
  return { status: res.status, body: await res.json() };
};

test('a public image upload is saved as WebP and served cross-origin with long caching', async () => {
  const up = await send(await png(), 'review.png', 'image/png');
  assert.equal(up.status, 200, JSON.stringify(up.body));
  assert.match(up.body.url, new RegExp(`^${origin}/uploads/public/images/[0-9a-f]{32}\\.webp$`));
  assert.ok(fs.existsSync(path.join(uploadDir, up.body.publicId)));

  const res = await fetch(up.body.url);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/webp');
  assert.equal(res.headers.get('cross-origin-resource-policy'), 'cross-origin');
  assert.match(res.headers.get('cache-control'), /immutable/);
});

test('a file pretending to be an image is refused with a clear 400', async () => {
  const up = await send(Buffer.from('<?php echo 1; ?>'), 'shell.png', 'image/png');
  assert.equal(up.status, 400);
  assert.match(up.body.message, /not allowed/);
});

test('missing files are a 404, never the website, and paths cannot escape the uploads folder', async () => {
  assert.equal((await fetch(`${origin}/uploads/private/nothing.pdf`)).status, 404);
  // refused either way (403 for a path trick / folder, 404 for nothing there) — never served
  for (const url of ['/uploads/..%2fserver.js', '/uploads/%2e%2e/server.js', '/uploads/', '/uploads/public/']) {
    const res = await fetch(origin + url);
    assert.ok([403, 404].includes(res.status), `${url} → ${res.status}`);
    assert.doesNotMatch(await res.text(), /require\(/, url); // no server source leaked
  }
});

test('private files are not cached by proxies or indexed', async () => {
  fs.mkdirSync(path.join(uploadDir, 'private/attachments'), { recursive: true });
  fs.writeFileSync(path.join(uploadDir, 'private/attachments/abc.pdf'), '%PDF-1.4');
  const res = await fetch(`${origin}/uploads/private/attachments/abc.pdf`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('cache-control'), /^private/);
  assert.match(res.headers.get('x-robots-tag'), /noindex/);
});
