// Platform access tracker rules (Client Journey SOP §8). Pure functions, so they are unit-testable.
//   Requested → Granted → Verified → Revoked  (Revoked is final: a new grant is a new row)
// Dates are set when the status moves (today by default; staff can enter the real day).
const M = require('../models/PlatformAccess');

const NEXT = { Requested: ['Granted', 'Revoked'], Granted: ['Verified', 'Revoked'], Verified: ['Revoked'], Revoked: [] };
// Anything that looks like a pasted credential is refused — access is granted through the platform, never shared as a password
const CREDENTIAL = /(pass(word|code)?|pwd|otp|secret|token|api[\s_-]?key)\s*(is|:|=)/i;

const isDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !Number.isNaN(new Date(`${s}T12:00:00`).getTime());
const clip = (v, n) => String(v ?? '').trim().slice(0, n);

/**
 * @param input    what staff sent
 * @param existing the stored row for an update (null for a new one)
 * @returns { value } | { error }
 */
function validateAccess(input = {}, existing = null, now = new Date()) {
  const errors = [];
  const today = now.toLocaleDateString('en-CA');
  const value = {};
  const pick = (key, list, label) => {
    if (input[key] === undefined) return;
    if (input[key] === '' || input[key] === null) { value[key] = undefined; return; }
    if (!list.includes(input[key])) errors.push(`${label} must be one of ${list.join(', ')}.`);
    else value[key] = input[key];
  };

  if (!existing) {
    if (!M.PLATFORMS.includes(input.platform)) errors.push(`Choose the platform (${M.PLATFORMS.join(', ')}).`);
    else value.platform = input.platform;
  }
  pick('assetOwner', M.OWNERS, 'Asset owner');
  pick('permissionLevel', M.PERMISSIONS, 'Permission level');
  for (const [key, max] of [['assetName', 150], ['accountId', 80], ['notes', 500]]) {
    if (input[key] !== undefined) value[key] = clip(input[key], max) || undefined;
  }
  if (CREDENTIAL.test(`${input.notes || ''} ${input.assetName || ''} ${input.accountId || ''}`)) {
    errors.push('Do not record passwords or codes here. Ask the client to grant access through the platform (partner / business access).');
  }

  const from = existing?.status || null;
  const to = input.status === undefined ? from || 'Requested' : input.status;
  if (!M.STATUSES.includes(to)) errors.push(`Status must be one of ${M.STATUSES.join(', ')}.`);
  else if (from && to !== from && !NEXT[from].includes(to)) errors.push(`${from} cannot move to ${to}. ${from === 'Revoked' ? 'Revoked access is final — add a new row if it is granted again.' : `It can go to: ${NEXT[from].join(', ') || 'nowhere'}.`}`);
  else if (!from || to !== from) {
    const when = input.date === undefined || input.date === '' ? today : input.date;
    if (!isDay(when) || when > today) errors.push('Enter the date this happened (not in the future).');
    else {
      value.status = to;
      const at = new Date(`${when}T12:00:00`);
      const field = { Requested: 'requestedAt', Granted: 'grantedAt', Verified: 'verifiedAt', Revoked: 'revokedAt' }[to];
      value[field] = at;
      if (to === 'Granted' && !(value.permissionLevel || existing?.permissionLevel)) errors.push('Say what permission level was granted.');
      if (to === 'Revoked') {
        const reason = clip(input.revokeReason, 300);
        if (reason.length < 3) errors.push('Say why the access was revoked.');
        value.revokeReason = reason;
      }
    }
  }
  return errors.length ? { error: errors.join(' ') } : { value };
}

/** What is still open for a client: requested but not given, or given but not yet tested. */
function summarize(rows) {
  const count = (s) => rows.filter((r) => r.status === s).length;
  return { requested: count('Requested'), granted: count('Granted'), verified: count('Verified'), revoked: count('Revoked'), live: count('Granted') + count('Verified') };
}

module.exports = { validateAccess, summarize, NEXT };
