/**
 * Groups leads that share a phone, alt phone or real email — the same rule
 * as services/leadDedup.js — for the duplicate-lead maintenance scripts.
 * Expects the normalized contact fields (backfillLeadDedupFields.js).
 */

// Synthetic emails written when a lead had none — every one is unique or
// shared by unrelated people, so they must never link two leads.
const PLACEHOLDER_EMAIL = /^(import_.*@vedhunt\.in|fb_.*@facebook\.com|unknown@example\.com)$/i;

const isRealEmail = (email) => Boolean(email) && !PLACEHOLDER_EMAIL.test(email);

/** Contact keys a lead can be matched on, e.g. ['Phone 9876543210', 'Email a@b.com']. */
function contactKeys(lead) {
  const keys = [];
  if (lead.phoneNormalized) keys.push(`Phone ${lead.phoneNormalized}`);
  if (lead.altPhoneNormalized) keys.push(`Phone ${lead.altPhoneNormalized}`);
  if (isRealEmail(lead.emailNormalized)) keys.push(`Email ${lead.emailNormalized}`);
  return [...new Set(keys)];
}

/** Union-find over lead ids, linked by any shared contact key. Returns groups of 2+ leads. */
function groupLeads(leads) {
  const parent = new Map(leads.map((l) => [String(l._id), String(l._id)]));
  const find = (x) => (parent.get(x) === x ? x : (parent.set(x, find(parent.get(x))), parent.get(x)));

  const firstByKey = new Map();
  for (const lead of leads) {
    const id = String(lead._id);
    for (const key of contactKeys(lead)) {
      if (firstByKey.has(key)) parent.set(find(id), find(firstByKey.get(key)));
      else firstByKey.set(key, id);
    }
  }

  const groups = new Map();
  for (const lead of leads) {
    const root = find(String(lead._id));
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(lead);
  }
  return [...groups.values()].filter((g) => g.length > 1);
}

/** The contact keys two leads have in common. */
function sharedKeys(a, b) {
  const bKeys = new Set(contactKeys(b));
  return contactKeys(a).filter((k) => bKeys.has(k));
}

module.exports = { PLACEHOLDER_EMAIL, isRealEmail, contactKeys, groupLeads, sharedKeys };
