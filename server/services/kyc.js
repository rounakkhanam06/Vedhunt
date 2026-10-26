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
const ClientKycFile = require('../models/ClientKycFile');
const { encrypt, decrypt } = require('../utils/encryption');
const v = require('./kycValidators');

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ANY_TYPES = [...IMAGE_TYPES, 'application/pdf'];
const MAX_FILE_BYTES = 5 * 1024 * 1024;

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
    key: 'aadhaar', label: 'Aadhaar', required: true, types: ANY_TYPES,
    number: { label: 'Aadhaar number', placeholder: '1234 5678 9012', required: true },
    help: 'Of the authorised person. Cover the first 8 digits on the copy you upload — we keep only the last 4 digits of the number.',
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

/** Roll the five items up into one status for the client and the staff. */
function overall(doc) {
  const items = doc.items;
  const status = (k) => items[k]?.status || 'Not Submitted';
  const requiredVerified = REQUIRED_KEYS.filter((k) => status(k) === 'Verified').length;
  const missing = REQUIRED_KEYS.filter((k) => status(k) === 'Not Submitted');
  const rejected = ITEMS.filter((i) => status(i.key) === 'Rejected').map((i) => i.key);
  const pending = ITEMS.filter((i) => status(i.key) === 'Submitted').map((i) => i.key);
  const touched = ITEMS.some((i) => status(i.key) !== 'Not Submitted');

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
    missing, rejected, pending,
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
    canSubmit: it.status !== 'Verified',
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
async function submitItem(clientId, key, { value, file }) {
  const cfg = ITEM_BY_KEY[key];
  if (!cfg) return fail(404, 'Unknown KYC item.');
  const doc = await getOrCreate(clientId);
  const current = doc.items[key] || {};
  if (current.status === 'Verified') return fail(409, `${cfg.label} is already verified. Contact support if it needs to change.`);

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

  doc.set(`items.${key}`, {
    status: 'Submitted',
    ...number.store,
    file: { fileId: stored._id, originalName: stored.originalName, mimeType, size: stored.size, uploadedAt: new Date() },
    submittedAt: new Date(),
    attempts: (current.attempts || 0) + 1,
  });
  await doc.save();
  return { ok: true, doc };
}

/** Staff decision on a submitted item. Rejecting needs a reason the client can act on. */
async function reviewItem(clientId, key, { decision, reason }, reviewer) {
  const cfg = ITEM_BY_KEY[key];
  if (!cfg) return fail(404, 'Unknown KYC item.');
  if (!['verify', 'reject'].includes(decision)) return fail(400, 'Decision must be "verify" or "reject".');
  const doc = await getOrCreate(clientId);
  const it = doc.items[key] || {};
  if (it.status !== 'Submitted') return fail(409, it.status === 'Not Submitted' ? 'The client has not submitted this item yet.' : `This item is already ${it.status.toLowerCase()}.`);
  const why = String(reason || '').trim();
  if (decision === 'reject' && why.length < 5) return fail(400, 'Tell the client what to fix (at least 5 characters).');

  const before = overall(doc).status;
  const name = [reviewer.firstName, reviewer.lastName].filter(Boolean).join(' ').trim() || reviewer.email;
  doc.set(`items.${key}.status`, decision === 'verify' ? 'Verified' : 'Rejected');
  doc.set(`items.${key}.reviewedAt`, new Date());
  doc.set(`items.${key}.reviewedBy`, reviewer._id);
  doc.set(`items.${key}.reviewerName`, name);
  doc.set(`items.${key}.rejectionReason`, decision === 'reject' ? why.slice(0, 500) : undefined);
  await doc.save();
  return { ok: true, doc, item: cfg, becameVerified: before !== 'verified' && overall(doc).status === 'verified' };
}

/** The bytes of an item's document, only if it belongs to this client. */
async function readFile(clientId, key) {
  const doc = await getOrCreate(clientId);
  const fileId = doc.items[key]?.file?.fileId;
  if (!fileId) return null;
  return ClientKycFile.findOne({ _id: fileId, client_ref: clientId }).select('+data');
}

module.exports = {
  ITEMS, REQUIRED_KEYS, MAX_FILE_BYTES, getOrCreate, findOrBlank, overall, clientView, adminView, submitItem, reviewItem, readFile,
};
