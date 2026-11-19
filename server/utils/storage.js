// File uploads stored on this server's disk (replaces Cloudinary).
//
//   uploads/public/<folder>/…   images shown on the website (CMS, logos, photos)
//   uploads/private/<folder>/…  resumes, lead documents, ticket attachments,
//                               payment proofs, payslips, proposals
//
// Both are served under /uploads (server.js). Private files get stricter headers
// (no caching by proxies, no search indexing) and long random names, so a link
// can't be guessed — the same protection the Cloudinary links had.
//
// Images (jpg/png/webp) are optimised with sharp: auto-rotated, resized to at
// most 1920px wide, metadata (incl. GPS) stripped, saved as WebP (~80% quality).
// The real file type is checked from its first bytes, not the name the uploader
// gave it. Exported names match the old utils/cloudinary.js so routes barely change:
// multer instances put the public URL in req.file.path and the file id in
// req.file.filename.
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const sharp = require('sharp');
const logger = require('./logger');

const UPLOAD_ROOT = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads'));
const MAX_IMAGE_WIDTH = 1920;
const WEBP_QUALITY = 80;

/** Public address of this server, e.g. https://api.vedhunt.in — links saved in the DB use it. */
const publicBase = () =>
  (process.env.UPLOADS_PUBLIC_URL || process.env.SERVER_PUBLIC_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/+$/, '');

const urlFor = (id) => `${publicBase()}/uploads/${id.split('/').map(encodeURIComponent).join('/')}`;
const randomName = () => crypto.randomBytes(16).toString('hex'); // 128-bit, unguessable

// ── File type from the first bytes (magic numbers) ───────────────────────────
function sniff(buf) {
  const hex = buf.subarray(0, 12).toString('hex');
  if (hex.startsWith('ffd8ff')) return { mime: 'image/jpeg', ext: '.jpg', image: true };
  if (hex.startsWith('89504e470d0a1a0a')) return { mime: 'image/png', ext: '.png', image: true };
  if (hex.startsWith('52494646') && buf.subarray(8, 12).toString() === 'WEBP') return { mime: 'image/webp', ext: '.webp', image: true };
  if (buf.subarray(0, 5).toString() === '%PDF-') return { mime: 'application/pdf', ext: '.pdf' };
  if (hex.startsWith('504b0304')) return { mime: 'application/zip', ext: '.zip', office: true }; // docx / xlsx
  if (hex.startsWith('d0cf11e0a1b11ae1')) return { mime: 'application/x-ole', ext: '.ole', office: true }; // doc / xls
  const head = buf.subarray(0, 1024).toString('utf8').trimStart().toLowerCase();
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))) return { mime: 'image/svg+xml', ext: '.svg', svg: true };
  return null;
}

// SVG can carry script; only admins can upload one, and anything active is refused.
const unsafeSvg = (text) => /<script|on[a-z]+\s*=|javascript:|<foreignobject|<iframe|<embed|<object|xlink:href\s*=\s*["']\s*(?!#)/i.test(text);

/**
 * Validate and (for images) optimise a file. Returns { buffer, mime, ext } or throws.
 * `kinds` lists what this upload accepts: 'image', 'svg', 'pdf', 'office'.
 */
async function prepare(buf, originalName, kinds) {
  const type = sniff(buf);
  const nameExt = path.extname(originalName || '').toLowerCase();
  const fail = (msg) => Object.assign(new Error(msg), { statusCode: 400 });
  if (!type) throw fail('This file type is not allowed.');

  if (type.image) {
    if (!kinds.includes('image')) throw fail('Images are not allowed here.');
    // honour the camera's orientation, cap the width; metadata (EXIF/GPS) is dropped on output
    const base = () => sharp(buf, { failOn: 'error' }).rotate().resize({ width: MAX_IMAGE_WIDTH, withoutEnlargement: true });
    const webp = await base().webp({ quality: WEBP_QUALITY }).toBuffer();
    if (webp.length <= buf.length) return { buffer: webp, mime: 'image/webp', ext: '.webp' };
    // An already-optimised WebP that re-encoding would only make bigger: keep it as it is
    if (type.mime === 'image/webp') return { buffer: buf, mime: 'image/webp', ext: '.webp' };
    // Already well compressed (WebP came out bigger): keep the original format, still resized and stripped
    const same = type.mime === 'image/png'
      ? await base().png({ compressionLevel: 9, palette: true }).toBuffer()
      : await base().jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    const best = same.length < webp.length
      ? { buffer: same, mime: type.mime, ext: type.ext }
      : { buffer: webp, mime: 'image/webp', ext: '.webp' };
    // Nothing beat the upload itself (already small and within the width cap): keep it
    return best.buffer.length > buf.length ? { buffer: buf, mime: type.mime, ext: type.ext } : best;
  }
  if (type.svg) {
    if (!kinds.includes('svg')) throw fail('SVG files are not allowed here.');
    if (unsafeSvg(buf.toString('utf8'))) throw fail('This SVG contains scripts or links and cannot be uploaded.');
    return { buffer: buf, mime: type.mime, ext: '.svg' };
  }
  if (type.mime === 'application/pdf') {
    if (!kinds.includes('pdf')) throw fail('PDF files are not allowed here.');
    return { buffer: buf, mime: type.mime, ext: '.pdf' };
  }
  if (type.office) {
    // The bytes only say "zip" / "old Office"; the declared extension decides which, within the allowed set
    const zipExts = ['.docx', '.xlsx'];
    const oleExts = ['.doc', '.xls'];
    const ok = kinds.includes('office') && (type.ext === '.zip' ? zipExts : oleExts).includes(nameExt);
    if (!ok) throw fail('This file type is not allowed.');
    const mime = {
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.doc': 'application/msword',
      '.xls': 'application/vnd.ms-excel',
    }[nameExt];
    return { buffer: buf, mime, ext: nameExt };
  }
  throw fail('This file type is not allowed.');
}

/** Write atomically (temp file + rename) so a half-written file is never served. */
async function writeFile(id, buffer) {
  const full = path.join(UPLOAD_ROOT, id);
  await fsp.mkdir(path.dirname(full), { recursive: true });
  const tmp = `${full}.${process.pid}.${Date.now()}.tmp`;
  await fsp.writeFile(tmp, buffer);
  await fsp.rename(tmp, full);
}

/** Resolve a stored id to a path inside UPLOAD_ROOT, or null if it would escape it. */
function safePath(id) {
  const full = path.resolve(UPLOAD_ROOT, String(id || ''));
  return full.startsWith(UPLOAD_ROOT + path.sep) ? full : null;
}

// ── multer storage engine ────────────────────────────────────────────────────
class DiskOptimizedStorage {
  constructor({ dir, kinds }) {
    this.dir = dir; // e.g. 'public/cms'
    this.kinds = kinds;
  }

  _handleFile(_req, file, cb) {
    const chunks = [];
    file.stream.on('data', (c) => chunks.push(c));
    file.stream.on('error', cb);
    file.stream.on('end', async () => {
      try {
        const prepared = await prepare(Buffer.concat(chunks), file.originalname, this.kinds);
        const id = `${this.dir}/${randomName()}${prepared.ext}`;
        await writeFile(id, prepared.buffer);
        cb(null, { path: urlFor(id), filename: id, size: prepared.buffer.length, mimetype: prepared.mime });
      } catch (err) {
        cb(err);
      }
    });
  }

  _removeFile(_req, file, cb) {
    const full = safePath(file.filename);
    if (!full) return cb(null);
    fs.unlink(full, () => cb(null));
  }
}

const makeUpload = ({ dir, kinds, limits, fileFilter }) =>
  multer({ storage: new DiskOptimizedStorage({ dir, kinds }), limits, fileFilter });

// The browser's declared type is a first filter (fast, friendly message); the bytes are checked again in prepare()
const byMime = (allowed, message) => (_req, file, cb) =>
  (allowed.includes(file.mimetype) ? cb(null, true) : cb(Object.assign(new Error(message), { statusCode: 400 }), false));
const byMimeAndExt = (types, message) => (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  return (types[file.mimetype] || []).includes(ext) ? cb(null, true) : cb(Object.assign(new Error(message), { statusCode: 400 }), false);
};

const IMG = { 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'], 'image/webp': ['.webp'] };
const DOCS = {
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
};
const SHEETS = {
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
};

// CMS / admin images (SVG allowed — admins only)
const upload = makeUpload({
  dir: 'public/cms',
  kinds: ['image', 'svg'],
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: byMime(['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'], 'Only image files (jpg, png, webp, svg) are allowed'),
});

// Uploads anyone can make without logging in (review photos, logos): raster only, 3MB, one file
const publicImageUpload = makeUpload({
  dir: 'public/images',
  kinds: ['image'],
  limits: { fileSize: 3 * 1024 * 1024, files: 1 },
  fileFilter: byMime(['image/jpeg', 'image/png', 'image/webp'], 'Only jpg, png or webp images are allowed'),
});

const uploadResume = makeUpload({
  dir: 'private/resumes',
  kinds: ['pdf', 'office'],
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: byMimeAndExt(DOCS, 'Only PDF, DOC, and DOCX files are allowed'),
});

const uploadLeadDocument = makeUpload({
  dir: 'private/lead-documents',
  kinds: ['pdf', 'office', 'image'],
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: byMimeAndExt({ ...DOCS, ...SHEETS, ...IMG }, 'Only PDF, DOC/DOCX, XLS/XLSX, and image files are allowed'),
});

// Support ticket attachments, payment proofs, correction proofs (screenshots / PDFs)
const uploadTicketAttachment = makeUpload({
  dir: 'private/attachments',
  kinds: ['pdf', 'image'],
  limits: { fileSize: 5 * 1024 * 1024, files: 3 },
  fileFilter: byMimeAndExt({ 'application/pdf': ['.pdf'], ...IMG }, 'Only PDF, JPG, PNG and WEBP files are allowed'),
});

/**
 * Save a generated file (payslip / proposal PDF). The name is stable for the same
 * public_id (regenerating overwrites it) but unguessable: it carries an HMAC.
 * Returns { secure_url, public_id } like Cloudinary did.
 */
async function uploadBuffer(buffer, { folder, public_id }) {
  const base = String(public_id || randomName()).replace(/\.pdf$/i, '').replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 80);
  const secret = process.env.UPLOAD_SIGNING_SECRET || process.env.JWT_SECRET || 'vedhunt-uploads';
  const tag = crypto.createHmac('sha256', secret).update(`${folder}/${base}`).digest('hex').slice(0, 20);
  const dir = `private/${String(folder || 'files').replace(/^vedhunt-/, '').replace(/[^A-Za-z0-9_-]+/g, '_')}`;
  const id = `${dir}/${base}-${tag}.pdf`;
  await writeFile(id, buffer);
  return { secure_url: urlFor(id), public_id: id };
}

/** Delete a stored file by its id (req.file.filename) or its full URL. Old Cloudinary ids are ignored. */
async function deleteUpload(idOrUrl) {
  let id = String(idOrUrl || '');
  const marker = '/uploads/';
  if (id.includes(marker)) id = decodeURIComponent(id.slice(id.indexOf(marker) + marker.length).split('?')[0]);
  if (!/^(public|private)\//.test(id)) {
    logger.info(`Upload delete skipped (not a local file): ${idOrUrl}`);
    return { result: 'skipped' };
  }
  const full = safePath(id);
  if (!full) return { result: 'invalid' };
  try {
    await fsp.unlink(full);
    return { result: 'ok' };
  } catch (err) {
    if (err.code === 'ENOENT') return { result: 'not found' };
    logger.error('Upload delete error:', err);
    throw err;
  }
}

module.exports = {
  UPLOAD_ROOT,
  upload,
  publicImageUpload,
  uploadResume,
  uploadLeadDocument,
  uploadTicketAttachment,
  uploadBuffer,
  deleteUpload,
  // used by the one-time Cloudinary migration script
  prepare,
  writeFile,
  urlFor,
  randomName,
};
