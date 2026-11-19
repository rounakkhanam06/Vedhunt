// utils/storage.js — server uploads that replaced Cloudinary. Uses a temp folder.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vh-uploads-'));
process.env.UPLOAD_DIR = tmp;
process.env.UPLOADS_PUBLIC_URL = 'https://api.example.test/';
const sharp = require('sharp');
const storage = require('../utils/storage');

let bigPng;
before(async () => {
  // random pixels behave like a photo: PNG stays big, lossy WebP is much smaller
  const raw = require('crypto').randomBytes(3000 * 200 * 3);
  bigPng = await sharp(raw, { raw: { width: 3000, height: 200, channels: 3 } }).png().toBuffer();
});
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

test('images are converted to WebP and capped at 1920px wide', async () => {
  const out = await storage.prepare(bigPng, 'photo.png', ['image']);
  assert.equal(out.mime, 'image/webp');
  assert.equal(out.ext, '.webp');
  const meta = await sharp(out.buffer).metadata();
  assert.equal(meta.format, 'webp');
  assert.equal(meta.width, 1920);
  assert.ok(out.buffer.length < bigPng.length);
});

test('an image that would only grow is kept as it was', async () => {
  const tiny = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#ff6b00' } }).png().toBuffer();
  const out = await storage.prepare(tiny, 'dot.png', ['image']);
  assert.ok(out.buffer.length <= tiny.length);
});

test('the real type comes from the bytes, not the file name', async () => {
  await assert.rejects(storage.prepare(Buffer.from('MZ\x90\x00 fake exe'), 'cv.pdf', ['pdf']), /not allowed/);
  await assert.rejects(storage.prepare(bigPng, 'resume.pdf', ['pdf', 'office']), /Images are not allowed/);
  const pdf = await storage.prepare(Buffer.from('%PDF-1.4\n...'), 'cv.pdf', ['pdf']);
  assert.equal(pdf.mime, 'application/pdf');
});

test('Office files must be zip/OLE bytes with an allowed extension', async () => {
  const zip = Buffer.from('504b030414000000', 'hex');
  assert.equal((await storage.prepare(zip, 'cv.docx', ['office'])).ext, '.docx');
  await assert.rejects(storage.prepare(zip, 'evil.zip', ['office']), /not allowed/);
});

test('SVG is allowed only where asked, and never with script', async () => {
  const clean = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><circle r="4"/></svg>');
  assert.equal((await storage.prepare(clean, 'a.svg', ['image', 'svg'])).mime, 'image/svg+xml');
  await assert.rejects(storage.prepare(clean, 'a.svg', ['image']), /SVG files are not allowed/);
  const bad = Buffer.from('<svg><script>alert(1)</script></svg>');
  await assert.rejects(storage.prepare(bad, 'a.svg', ['svg']), /scripts/);
  const onload = Buffer.from('<svg onload="alert(1)"></svg>');
  await assert.rejects(storage.prepare(onload, 'a.svg', ['svg']), /scripts/);
});

test('generated PDFs get a stable, unguessable private name and a full URL', async () => {
  const a = await storage.uploadBuffer(Buffer.from('%PDF-1.4'), { folder: 'vedhunt-payslips', public_id: 'Payslip_EMP1_2026-10' });
  const b = await storage.uploadBuffer(Buffer.from('%PDF-1.4 v2'), { folder: 'vedhunt-payslips', public_id: 'Payslip_EMP1_2026-10' });
  assert.equal(a.public_id, b.public_id); // regenerating overwrites
  assert.match(a.public_id, /^private\/payslips\/Payslip_EMP1_2026-10-[0-9a-f]{20}\.pdf$/);
  assert.ok(a.secure_url.startsWith('https://api.example.test/uploads/private/payslips/'));
  assert.equal(fs.readFileSync(path.join(tmp, a.public_id), 'utf8'), '%PDF-1.4 v2');
});

test('delete works by id or URL, ignores old Cloudinary ids and never leaves the uploads folder', async () => {
  const f = await storage.uploadBuffer(Buffer.from('%PDF-1.4'), { folder: 'x', public_id: 'del' });
  assert.equal((await storage.deleteUpload(f.secure_url)).result, 'ok');
  assert.equal(fs.existsSync(path.join(tmp, f.public_id)), false);
  assert.equal((await storage.deleteUpload('vedhunt-cms/abc123')).result, 'skipped');
  assert.equal((await storage.deleteUpload('public/../../etc/passwd')).result, 'invalid');
});
