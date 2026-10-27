// Advertiser KYC: GST, PAN, Aadhaar, photo and (optional) brand authorisation.
// The client submits each item; staff verify or reject it, one by one.
//
// What is kept, and how:
//   GSTIN        — stored as entered (it is public information)
//   PAN          — stored encrypted; the client only ever sees it masked
//   Aadhaar      — the number is checked and then DISCARDED; only the last 4
//                  digits are kept. The uploaded copy is the evidence.
//   documents    — raw bytes in ClientKycFile, served only through
//                  authenticated endpoints (never a public link)
const path = require('path');
const crypto = require('crypto');
const ClientKyc = require('../models/ClientKyc');
const { UPLOAD_SOURCES } = require('../models/ClientKyc');
const ClientKycFile = require('../models/ClientKycFile');
const { encrypt, decrypt } = require('../utils/encryption');
const v = require('./kycValidators');

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ANY_TYPES = [...IMAGE_TYPES, 'application/pdf'];
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ADMIN_SOURCES = UPLOAD_SOURCES.filter((s) => s !== 'Client portal');

const ITEMS = [
  {
    key: 'gst', label: 'GST registration', required: true, types: ANY_TYPES,
    number: { label: 'GSTIN', placeholder: '27AALCV0172E1ZD', required: true },
    help: 'Your 15-character GSTIN and a copy of the GST registration certificate.',
  },
  {
    key: 'pan', label: 'PAN', required: true, types: ANY_TYPES,
    number: { label: 'PAN', placeholder: 'ABCDE1234F', required: true },
    help: 'The PAN of the business or proprietor, with a copy of the PAN card.',
  },
  {
    // Optional (Client Journey SOP §7: Aadhaar only where genuinely needed, never a universal
    // requirement). When it is given, the number is still checked and only its last 4 kept.
    key: 'aadhaar', label: 'Aadhaar', required: false, types: ANY_TYPES,
    number: { label: 'Aadhaar number', placeholder: '1234 5678 9012', required: true },
    help: 'Optional — only if Vedhunt asks for it. Of the authorised person. Cover the first 8 digits on the copy you upload — we keep only the last 4 digits of the number.',
  },
  {
    key: 'photo', label: 'Photo', required: true, types: IMAGE_TYPES, number: null,
    help: 'A clear, recent photo of the authorised person with the face fully visible (JPG, PNG or WEBP).',
  },
  {
    key: 'brand_authorisation', label: 'Brand authorisation', required: false, types: ANY_TYPES,
    number: { label: 'Brand name', placeholder: 'The brand the letter covers', required: false, kind: 'text' },
    help: 'Optional. If you advertise a brand you do not own, upload the brand owner’s letter authorising you to run ads for it.',
  },
];
const ITEM_BY_KEY = Object.fromEntries(ITEMS.map((i) => [i.key, i]));
const REQUIRED_KEYS = ITEMS.filter((i) => i.required).map((i) => i.key);

const fail = (status, message) => ({ ok: false, status, message });
const cleanName = (n) => path.basename(String(n || 'document')).replace(/[^\w .()-]/g, '_').slice(0, 120) || 'document';

async function getOrCreate(clientId) {
  const query = () => ClientKyc.findOne({ client_ref: clientId }).select('+items.pan.valueEnc');
  let doc = await query();
  if (doc) return doc;
  try {
    await ClientKyc.create({ client_ref: clientId });
  } catch (err) {
    if (err.code !== 11000) throw err; // a concurrent first visit created it
  }
  doc = await query();
  return doc;
}

/** The client's KYC if one exists, else an empty (unsaved) one — for read-only summaries. */
async function findOrBlank(clientId) {
  return (await ClientKyc.findOne({ client_ref: clientId })) || new ClientKyc({ client_ref: clientId });
}

// An item counts as done when staff verified it or recorded that it does not apply to this client
const DONE = ['Verified', 'Not Applicable'];
// Waiting for staff: sent by the client, or being checked
const WAITING = ['Submitted', 'Under Review'];
// The client may not send a document for these (it is locked, not needed, or not asked for yet)
const LOCKED = ['Verified', 'Not Applicable', 'Not Requested'];

/** Roll the five items up into one status for the client and the staff. */
function overall(doc) {
  const items = doc.items;
  const status = (k) => items[k]?.status || 'Not Submitted';
  // requiredVerified = required items that are done (Verified or Not Applicable)
  const requiredVerified = REQUIRED_KEYS.filter((k) => DONE.includes(status(k))).length;
  const missing = REQUIRED_KEYS.filter((k) => status(k) === 'Not Submitted');
  const rejected = ITEMS.filter((i) => status(i.key) === 'Rejected').map((i) => i.key);
  const pending = ITEMS.filter((i) => WAITING.includes(status(i.key))).map((i) => i.key);
  const notApplicable = ITEMS.filter((i) => status(i.key) === 'Not Applicable').map((i) => i.key);
  const touched = ITEMS.some((i) => !['Not Submitted', 'Not Requested'].includes(status(i.key)));

  let code;
  if (rejected.length) code = 'action_needed';
  else if (requiredVerified === REQUIRED_KEYS.length) code = 'verified';
  else if (pending.length) code = 'in_review';
  else code = touched ? 'incomplete' : 'not_started';

  const LABELS = {
    action_needed: 'Action needed', verified: 'Verified', in_review: 'In review', incomplete: 'Incomplete', not_started: 'Not started',
  };
  return {
    status: code, label: LABELS[code], requiredTotal: REQUIRED_KEYS.length, requiredVerified,
    missing, rejected, pending, notApplicable,
  };
}

const displayValue = (cfg, it, pan) => {
  if (cfg.key === 'gst') return it.value || '';
  if (cfg.key === 'pan') return pan ? v.maskPan(pan) : '';
  if (cfg.key === 'aadhaar') return v.maskAadhaarLast4(it.last4);
  return it.value || '';
};

function baseItemView(cfg, it, pan) {
  return {
    key: cfg.key,
    label: cfg.label,
    required: cfg.required,
    help: cfg.help,
    number: cfg.number,
    accept: cfg.types === IMAGE_TYPES ? 'image' : 'any',
    status: it.status || 'Not Submitted',
    displayValue: displayValue(cfg, it, pan),
    hasFile: !!it.file?.fileId,
    fileName: it.file?.originalName || null,
    submittedAt: it.submittedAt || null,
    reviewedAt: it.reviewedAt || null,
    rejectionReason: it.status === 'Rejected' ? it.rejectionReason || '' : '',
    canSubmit: !LOCKED.includes(it.status || 'Not Submitted'),
    // Whether the client or Vedhunt put the document here (never the admin's name or the N/A reason)
    uploadedBy: it.file?.fileId ? it.uploadedBy || 'client' : null,
    source: it.file?.fileId ? it.source || 'Client portal' : null,
  };
}

const panOf = (doc) => (doc.items.pan?.valueEnc ? decrypt(doc.items.pan.valueEnc) : '');

/** What the client may see: masked numbers, status, reasons — never another person's data. */
function clientView(doc) {
  const pan = panOf(doc);
  return { overall: overall(doc), items: ITEMS.map((cfg) => baseItemView(cfg, doc.items[cfg.key] || {}, pan)) };
}

/** What staff see: the PAN in full (Aadhaar stays masked), reviewer details and cross-check flags. */
async function adminView(doc) {
  const pan = panOf(doc);
  const gstin = doc.items.gst?.value || '';
  const flags = [];
  if (pan && gstin && !v.panMatchesGstin(pan, gstin)) {
    flags.push({ key: 'pan_gst_mismatch', message: `The PAN inside the GSTIN (${gstin.slice(2, 12)}) is different from the PAN submitted.` });
  }
  if (gstin) {
    const other = await ClientKyc.findOne({ client_ref: { $ne: doc.client_ref }, 'items.gst.value': gstin }).select('client_ref').lean();
    if (other) flags.push({ key: 'gst_reused', message: 'This GSTIN is already on another client’s KYC.' });
  }
  return {
    overall: overall(doc),
    flags,
    items: ITEMS.map((cfg) => {
      const it = doc.items[cfg.key] || {};
      return {
        ...baseItemView(cfg, it, pan),
        fullValue: cfg.key === 'pan' ? pan : undefined,
        holderType: it.holderType || null,
        fileMime: it.file?.mimeType || null,
        fileSize: it.file?.size || null,
        attempts: it.attempts || 0,
        reviewerName: it.reviewerName || null,
        uploadedByName: it.file?.fileId ? it.uploadedByName || null : null,
        receivedAt: it.receivedAt || null,
        naReason: it.status === 'Not Applicable' ? it.naReason || '' : '',
      };
    }),
  };
}

/** Validate the number for an item; returns the fields to store. */
function checkNumber(cfg, rawValue) {
  const raw = String(rawValue ?? '').trim();
  if (!cfg.number) return { ok: true, store: {} };
  if (cfg.key === 'brand_authorisation') {
    if (raw.length > 120) return fail(400, 'Brand name is too long (120 characters at most).');
    return { ok: true, store: { value: raw || undefined } };
  }
  if (!raw) return fail(400, `Enter your ${cfg.number.label}.`);
  if (cfg.key === 'gst') {
    const r = v.validateGstin(raw);
    return r.ok ? { ok: true, store: { value: r.value } } : fail(400, r.error);
  }
  if (cfg.key === 'pan') {
    const r = v.validatePan(raw);
    return r.ok ? { ok: true, store: { valueEnc: encrypt(r.value), holderType: r.holderType } } : fail(400, r.error);
  }
  if (cfg.key === 'aadhaar') {
    const r = v.validateAadhaar(raw);
    // The number itself is not kept — only its last 4 digits
    return r.ok ? { ok: true, store: { last4: r.value.slice(-4) } } : fail(400, r.error);
  }
  return { ok: true, store: {} };
}

/**
 * Save a client's submission for one item (replacing an earlier, unreviewed or
 * rejected one). A verified item is locked.
 * @returns { ok:true, doc } | { ok:false, status, message }
 */
async function submitItem(clientId, key, { value, file }, by = { type: 'client' }) {
  const cfg = ITEM_BY_KEY[key];
  if (!cfg) return fail(404, 'Unknown KYC item.');
  const doc = await getOrCreate(clientId);
  const current = doc.items[key] || {};
  const byAdmin = by.type === 'admin';
  if (current.status === 'Verified') return fail(409, `${cfg.label} is already verified. Contact support if it needs to change.`);
  if (current.status === 'Not Applicable') return fail(409, `${cfg.label} is marked Not Applicable for this client. Ask for it again first if it is needed.`);
  // Not asked for yet: only staff can start it (uploading on the client's behalf counts as asking)
  if (current.status === 'Not Requested' && !byAdmin) return fail(409, `${cfg.label} has not been requested from you.`);
  // An admin upload must say where the document came from (SOP §7.1); 'Client portal' is only for the client's own
  if (byAdmin && !ADMIN_SOURCES.includes(by.source)) return fail(400, `Choose where the document came from (${ADMIN_SOURCES.join(', ')}).`);

  if (!file?.buffer?.length) return fail(400, `Attach your ${cfg.label} document.`);
  if (file.buffer.length > MAX_FILE_BYTES) return fail(400, 'The file must be 5MB or smaller.');
  const mimeType = v.detectFileType(file.buffer);
  if (!mimeType || !cfg.types.includes(mimeType)) {
    return fail(400, cfg.types === IMAGE_TYPES ? 'Please upload a JPG, PNG or WEBP image.' : 'Please upload a PDF, JPG, PNG or WEBP file.');
  }

  const number = checkNumber(cfg, value);
  if (!number.ok) return number;

  const stored = await ClientKycFile.create({
    client_ref: clientId, item: key, data: file.buffer, mimeType, size: file.buffer.length,
    originalName: cleanName(file.originalname), sha256: crypto.createHash('sha256').update(file.buffer).digest('hex'),
  });
  if (current.file?.fileId) await ClientKycFile.deleteOne({ _id: current.file.fileId, client_ref: clientId });

  const now = new Date();
  doc.set(`items.${key}`, {
    // The client's own upload waits for staff; an admin's upload is already being looked at
    status: byAdmin ? 'Under Review' : 'Submitted',
    ...number.store,
    file: { fileId: stored._id, originalName: stored.originalName, mimeType, size: stored.size, uploadedAt: now },
    submittedAt: now,
    uploadedBy: byAdmin ? 'admin' : 'client',
    uploadedByAdmin: byAdmin ? by.admin._id : undefined,
    uploadedByName: byAdmin ? staffName(by.admin) : undefined,
    source: byAdmin ? by.source : 'Client portal',
    receivedAt: byAdmin ? by.receivedAt || now : undefined,
    attempts: (current.attempts || 0) + 1,
  });
  await doc.save();
  return { ok: true, doc };
}

const staffName = (u) => [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email;

/**
 * Staff decision on an item the client (or an admin) has submitted:
 *   start_review — Submitted → Under Review (nothing is decided yet)
 *   verify       — needs the document itself on file (no evidence, no Verified)
 *   reject       — needs a reason the client can act on
 */
async function reviewItem(clientId, key, { decision, reason }, reviewer) {
  const cfg = ITEM_BY_KEY[key];
  if (!cfg) return fail(404, 'Unknown KYC item.');
  if (!['verify', 'reject', 'start_review'].includes(decision)) return fail(400, 'Decision must be "start_review", "verify" or "reject".');
  const doc = await getOrCreate(clientId);
  const it = doc.items[key] || {};
  const status = it.status || 'Not Submitted';
  if (!WAITING.includes(status)) {
    return fail(409, status === 'Not Submitted' ? 'The client has not submitted this item yet.' : `This item is already ${status.toLowerCase()}.`);
  }
  if (decision === 'start_review' && status !== 'Submitted') return fail(409, 'This item is already under review.');
  if (decision === 'verify' && !it.file?.fileId) return fail(409, 'There is no document on file to verify — upload it first.');
  const why = String(reason || '').trim();
  if (decision === 'reject' && why.length < 5) return fail(400, 'Tell the client what to fix (at least 5 characters).');

  const before = overall(doc).status;
  const name = staffName(reviewer);
  const next = { start_review: 'Under Review', verify: 'Verified', reject: 'Rejected' }[decision];
  doc.set(`items.${key}.status`, next);
  doc.set(`items.${key}.reviewedAt`, decision === 'start_review' ? undefined : new Date());
  doc.set(`items.${key}.reviewedBy`, reviewer._id);
  doc.set(`items.${key}.reviewerName`, name);
  doc.set(`items.${key}.rejectionReason`, decision === 'reject' ? why.slice(0, 500) : undefined);
  await doc.save();
  return { ok: true, doc, item: cfg, from: status, to: next, becameVerified: before !== 'verified' && overall(doc).status === 'verified' };
}

/**
 * Staff say how an item applies to this client:
 *   not_applicable — it does not apply (e.g. no GST number); needs a reason; counts as done
 *   not_requested  — optional items only: do not ask the client for it
 *   request        — ask for it (from Not Requested / Not Applicable back to Not Submitted)
 * Items with a document waiting or verified are not touched — reject or leave them.
 */
async function setApplicability(clientId, key, { mode, reason }, actor) {
  const cfg = ITEM_BY_KEY[key];
  if (!cfg) return fail(404, 'Unknown KYC item.');
  if (!['not_applicable', 'not_requested', 'request'].includes(mode)) return fail(400, 'Mode must be "not_applicable", "not_requested" or "request".');
  const doc = await getOrCreate(clientId);
  const it = doc.items[key] || {};
  const status = it.status || 'Not Submitted';
  if (WAITING.includes(status) || status === 'Verified') {
    return fail(409, `This item is ${status.toLowerCase()}. Reject it first if it should be changed.`);
  }
  const why = String(reason || '').trim();
  let next;
  if (mode === 'not_applicable') {
    if (why.length < 5) return fail(400, 'Say why it does not apply (at least 5 characters).');
    next = 'Not Applicable';
  } else if (mode === 'not_requested') {
    if (cfg.required) return fail(400, `${cfg.label} is required, so it can only be marked Not Applicable.`);
    next = 'Not Requested';
  } else {
    if (!['Not Requested', 'Not Applicable'].includes(status)) return fail(409, 'This item is already requested.');
    next = 'Not Submitted';
  }
  doc.set(`items.${key}.status`, next);
  doc.set(`items.${key}.naReason`, next === 'Not Applicable' ? why.slice(0, 500) : undefined);
  doc.set(`items.${key}.reviewedAt`, new Date());
  doc.set(`items.${key}.reviewedBy`, actor._id);
  doc.set(`items.${key}.reviewerName`, staffName(actor));
  doc.set(`items.${key}.rejectionReason`, undefined);
  await doc.save();
  return { ok: true, doc, item: cfg, from: status, to: next };
}

/** The bytes of an item's document, only if it belongs to this client. */
async function readFile(clientId, key) {
  const doc = await getOrCreate(clientId);
  const fileId = doc.items[key]?.file?.fileId;
  if (!fileId) return null;
  return ClientKycFile.findOne({ _id: fileId, client_ref: clientId }).select('+data');
}

module.exports = {
  ITEMS, REQUIRED_KEYS, MAX_FILE_BYTES, ADMIN_SOURCES, getOrCreate, findOrBlank, overall, clientView, adminView,
  submitItem, reviewItem, setApplicability, readFile,
};
