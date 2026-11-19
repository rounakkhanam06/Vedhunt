// One-time move of every Cloudinary file into server uploads (utils/storage.js).
//
// RUN THIS ON THE VPS (files are written to that machine's uploads folder), from
// the project root, after UPLOADS_PUBLIC_URL is set in server/.env:
//
//   node server/scripts/migrations/cloudinaryToLocal.js            # dry run: lists what it would do
//   node server/scripts/migrations/cloudinaryToLocal.js --apply    # backup → download → rewrite links
//
// Every string in every collection that contains a res.cloudinary.com URL is
// handled, wherever it sits (nested fields, arrays, rich-text HTML). Each URL is
// downloaded once, optimised like a new upload (images → WebP), saved under
// uploads/public (website images) or uploads/private (documents, payslips …),
// and the link in the database is replaced. Before changing anything, every
// document that will change is written to server/backups/. Safe to re-run: URLs
// already moved are no longer in the database.
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { EJSON } = require('bson');
const { prepare, writeFile, urlFor, randomName, UPLOAD_ROOT } = require('../../utils/storage');

const APPLY = process.argv.includes('--apply');
const URL_RE = /https?:\/\/res\.cloudinary\.com\/[^\s"'<>)\\]+/g;
// Cloudinary folders whose files are shown on the website; everything else is private
const PUBLIC_FOLDERS = ['vedhunt-cms', 'vedhunt-public'];

// Only plain objects/arrays are walked — Dates, ObjectIds, Decimals etc. are left exactly as they are
const isPlain = (v) => v !== null && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype;
const isPublic = (url) => PUBLIC_FOLDERS.some((f) => url.includes(`/${f}/`));
const folderOf = (url) => (url.match(/\/(vedhunt-[a-z-]+)\//) || [])[1] || 'misc';

function collectUrls(value, out) {
  if (typeof value === 'string') { for (const m of value.match(URL_RE) || []) out.add(m); return; }
  if (Array.isArray(value)) { value.forEach((v) => collectUrls(v, out)); return; }
  if (isPlain(value)) {
    Object.values(value).forEach((v) => collectUrls(v, out));
  }
}

function replaceUrls(value, map) {
  if (typeof value === 'string') return value.replace(URL_RE, (u) => map.get(u) || u);
  if (Array.isArray(value)) return value.map((v) => replaceUrls(v, map));
  if (isPlain(value)) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, replaceUrls(v, map)]));
  }
  return value;
}

async function moveOne(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const name = decodeURIComponent(url.split('?')[0].split('/').pop() || '');
  // Old uploads may be PDFs/Office files (resumes, documents) or images; accept what the old uploader accepted
  const prepared = await prepare(buf, name, ['image', 'svg', 'pdf', 'office']);
  const dir = `${isPublic(url) ? 'public' : 'private'}/${folderOf(url).replace(/^vedhunt-/, '')}`;
  const id = `${dir}/${randomName()}${prepared.ext}`;
  if (APPLY) await writeFile(id, prepared.buffer);
  return { newUrl: urlFor(id), before: buf.length, after: prepared.buffer.length };
}

async function rebuildProposalPdf(doc, proforma) {
  if (proforma) {
    const { buildProformaPdfBuffer } = require('../../services/proformaPdf');
    return buildProformaPdfBuffer({ ...doc, proformaNumber: doc.proformaNumber || 'DRAFT' });
  }
  const { buildProposalPdfBuffer } = require('../../services/proposalPdf');
  const Proposal = require('../../models/Proposal');
  const Admin = require('../../models/Admin');
  const Employee = require('../../models/Employee');
  const proposal = await Proposal.findById(doc._id);
  // "Prepared by" = whoever created it (as services/proposals.js does)
  const author = await Admin.findById(proposal.createdBy, { firstName: 1, lastName: 1, email: 1 }).lean();
  const employee = author ? await Employee.findOne({ adminId: author._id }, { designation: 1, roleDept: 1 }).lean() : null;
  return buildProposalPdfBuffer(proposal, {
    name: author ? `${author.firstName || ''} ${author.lastName || ''}`.trim() : '',
    email: author?.email || '',
    designation: employee?.designation || employee?.roleDept || '',
  });
}

(async () => {
  if (!process.env.UPLOADS_PUBLIC_URL) {
    console.error('Set UPLOADS_PUBLIC_URL in server/.env first (e.g. https://api.vedhunt.in) — new links are built from it.');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const db = mongoose.connection.db;
  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} · uploads folder: ${UPLOAD_ROOT} · links will start with ${urlFor('x').replace(/\/x$/, '')}`);

  // 1. Find every document holding a Cloudinary URL
  const hits = []; // { coll, doc }
  const urls = new Set();
  for (const { name } of await db.listCollections().toArray()) {
    if (name === 'auditlogs') continue; // history stays as it was
    for await (const doc of db.collection(name).find({})) {
      const found = new Set();
      collectUrls(doc, found);
      if (found.size) { hits.push({ coll: name, doc }); found.forEach((u) => urls.add(u)); }
    }
  }
  console.log(`${urls.size} Cloudinary file(s) in ${hits.length} document(s)`);
  if (!urls.size) return process.exit(0);

  // 2. Back up the documents that will change
  if (APPLY) {
    fs.mkdirSync(path.join(__dirname, '../../backups'), { recursive: true });
    const file = path.join(__dirname, '../../backups', `cloudinary-migration-${new Date().toISOString().slice(0, 19).replace(/:/g, '')}.json`);
    fs.writeFileSync(file, EJSON.stringify(hits, null, 1, { relaxed: false }));
    console.log('backup:', file);
  }

  // 3. Move each file once
  const map = new Map();
  const failed = [];
  let before = 0;
  let after = 0;
  for (const url of urls) {
    try {
      const r = await moveOne(url);
      map.set(url, r.newUrl);
      before += r.before;
      after += r.after;
      console.log(`  ok  ${(r.before / 1024).toFixed(0)}KB → ${(r.after / 1024).toFixed(0)}KB  ${url}`);
    } catch (err) {
      failed.push(url);
      console.log(`  FAIL ${err.message}  ${url}`);
    }
  }
  // 3b. Proposal / proforma PDFs Cloudinary refuses to deliver (401 — its PDF delivery block):
  //     build them again from the saved proposal, the same way the app does
  for (const url of [...failed]) {
    const hit = hits.find(({ coll, doc }) => coll === 'proposals' && (doc.pdfUrl === url || doc.proformaPdfUrl === url));
    if (!hit) continue;
    try {
      const buffer = await rebuildProposalPdf(hit.doc, hit.doc.proformaPdfUrl === url);
      const id = `private/proposals/${randomName()}.pdf`;
      if (APPLY) await writeFile(id, buffer);
      map.set(url, urlFor(id));
      failed.splice(failed.indexOf(url), 1);
      console.log(`  rebuilt ${(buffer.length / 1024).toFixed(0)}KB  ${url}`);
    } catch (err) {
      console.log(`  REBUILD FAIL ${err.message}  ${url}`);
    }
  }

  console.log(`moved ${map.size}/${urls.size} · ${(before / 1048576).toFixed(1)}MB → ${(after / 1048576).toFixed(1)}MB`);

  // 4. Rewrite the links (only files that were saved; failures keep their Cloudinary link)
  if (APPLY) {
    let changed = 0;
    for (const { coll, doc } of hits) {
      // $set only the top-level fields that changed; nothing else in the document is rewritten
      const set = {};
      for (const [k, v] of Object.entries(doc)) {
        if (k === '_id') continue;
        const found = new Set();
        collectUrls(v, found);
        if (found.size) set[k] = replaceUrls(v, map);
      }
      if (Object.keys(set).length) {
        await db.collection(coll).updateOne({ _id: doc._id }, { $set: set });
        changed += 1;
      }
    }
    console.log(`updated ${changed} document(s)`);
  }
  if (failed.length) console.log(`${failed.length} file(s) could not be moved and still point to Cloudinary — re-run later, or fix by hand.`);
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
