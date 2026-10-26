// Format + check-digit validation for the Indian identifiers collected in KYC.
// These catch typos and made-up numbers before a reviewer spends time on them;
// they do NOT prove the number belongs to the person — the uploaded document
// and the reviewer do that.

const GST_CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// State / UT codes used in a GSTIN (01–38, plus 97 "Other Territory" and 99 "Centre Jurisdiction")
const GST_STATE_CODES = new Set([
  ...Array.from({ length: 38 }, (_, i) => String(i + 1).padStart(2, '0')), '97', '99',
]);

const compact = (v) => String(v ?? '').replace(/[\s-]+/g, '').toUpperCase();

// ── GSTIN ───────────────────────────────────────────────────────────────────
/** The 15th character of a GSTIN is a mod-36 check of the first 14. */
function gstinCheckChar(first14) {
  let sum = 0;
  for (let i = 0; i < 14; i += 1) {
    const idx = GST_CHARSET.indexOf(first14[i]);
    if (idx < 0) return null;
    const product = idx * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return GST_CHARSET[(36 - (sum % 36)) % 36];
}

/** @returns { ok, value, error } — `value` is the normalised GSTIN */
function validateGstin(input) {
  const value = compact(input);
  if (!/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(value)) {
    return { ok: false, error: 'Enter a valid 15-character GSTIN (for example 27AALCV0172E1ZD).' };
  }
  if (!GST_STATE_CODES.has(value.slice(0, 2))) return { ok: false, error: 'The first two digits of a GSTIN must be a valid state code.' };
  if (gstinCheckChar(value.slice(0, 14)) !== value[14]) return { ok: false, error: 'This GSTIN does not pass its check digit — please re-check it.' };
  return { ok: true, value };
}

// ── PAN ─────────────────────────────────────────────────────────────────────
// 4th character = holder type
const PAN_TYPES = {
  P: 'Individual', C: 'Company', H: 'Hindu Undivided Family', F: 'Firm / LLP', A: 'Association of Persons',
  T: 'Trust', B: 'Body of Individuals', L: 'Local Authority', J: 'Artificial Juridical Person', G: 'Government', K: 'Krishi',
};

function validatePan(input) {
  const value = compact(input);
  if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(value)) return { ok: false, error: 'Enter a valid 10-character PAN (for example ABCDE1234F).' };
  if (!PAN_TYPES[value[3]]) return { ok: false, error: 'The fourth character of this PAN is not a valid holder type.' };
  return { ok: true, value, holderType: PAN_TYPES[value[3]] };
}

// ── Aadhaar (Verhoeff) ──────────────────────────────────────────────────────
const V_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5], [2, 3, 4, 0, 1, 7, 8, 9, 5, 6], [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1], [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4], [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const V_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4], [5, 8, 0, 3, 7, 9, 6, 1, 4, 2], [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1], [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];
const V_INV = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];

function verhoeffValid(digits) {
  let c = 0;
  const rev = digits.split('').reverse().map(Number);
  for (let i = 0; i < rev.length; i += 1) c = V_D[c][V_P[i % 8][rev[i]]];
  return c === 0;
}

/** The Verhoeff check digit for a digit string (used to build test numbers). */
function verhoeffCheckDigit(digits) {
  let c = 0;
  const rev = digits.split('').reverse().map(Number);
  for (let i = 0; i < rev.length; i += 1) c = V_D[c][V_P[(i + 1) % 8][rev[i]]];
  return V_INV[c];
}

function validateAadhaar(input) {
  const value = compact(input);
  if (!/^\d{12}$/.test(value)) return { ok: false, error: 'An Aadhaar number has 12 digits.' };
  if (!/^[2-9]/.test(value)) return { ok: false, error: 'An Aadhaar number cannot start with 0 or 1.' };
  if (!verhoeffValid(value)) return { ok: false, error: 'This Aadhaar number does not pass its check digit — please re-check it.' };
  return { ok: true, value };
}

// ── Cross-checks and masking ────────────────────────────────────────────────
/** Characters 3–12 of a GSTIN are the holder's PAN. */
const panMatchesGstin = (pan, gstin) => !!pan && !!gstin && gstin.slice(2, 12) === pan;

const maskPan = (pan) => (pan ? `XXXXX${pan.slice(5, 9)}${pan[9]}` : '');
const maskAadhaarLast4 = (last4) => (last4 ? `XXXX XXXX ${last4}` : '');

// ── Uploaded files ──────────────────────────────────────────────────────────
/** What a buffer really is, from its first bytes — never from the filename or the browser's claim. */
function detectFileType(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  if (buf.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  return null;
}

module.exports = {
  validateGstin, gstinCheckChar, validatePan, validateAadhaar, verhoeffCheckDigit, verhoeffValid,
  panMatchesGstin, maskPan, maskAadhaarLast4, detectFileType, PAN_TYPES,
};
