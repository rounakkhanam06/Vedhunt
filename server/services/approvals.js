// Client approvals (Client Journey SOP §9, §15): request → the client decides in the portal, or staff
// record an answer given another way. Decisions are claimed atomically, so two clicks (or the client and
// a staff member together) can never decide the same request twice.
const Approval = require('../models/Approval');
const { KINDS, CHANNELS } = require('../models/Approval');

const fail = (status, message) => ({ ok: false, status, message });
const clip = (v, n) => String(v ?? '').trim().slice(0, n);
const STAFF_CHANNELS = CHANNELS.filter((c) => c !== 'Client portal');
const staffName = (u) => [u?.firstName, u?.lastName].filter(Boolean).join(' ').trim() || u?.email || '';

/** Validate a new request from staff. @returns { value } | { error } */
function validateRequest(input = {}) {
  const errors = [];
  if (!KINDS.includes(input.kind)) errors.push(`Choose what is being approved (${KINDS.join(', ')}).`);
  const title = clip(input.title, 150);
  if (title.length < 3) errors.push('Give the request a title.');
  let amount;
  if (input.amount !== undefined && input.amount !== '' && input.amount !== null) {
    amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount < 0) errors.push('The amount must be zero or more.');
  }
  if (input.kind === 'Budget' && !(amount > 0)) errors.push('Enter the budget amount to be approved.');
  let linkUrl = clip(input.linkUrl, 500);
  if (linkUrl && !/^https?:\/\//i.test(linkUrl)) errors.push('The link must start with http:// or https://.');
  if (errors.length) return { error: errors.join(' ') };
  return { value: { kind: input.kind, title, details: clip(input.details, 3000) || undefined, versionLabel: clip(input.versionLabel, 40) || undefined, amount, linkUrl: linkUrl || undefined } };
}

const parseDay = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
  return d.getMonth() === Number(m[2]) - 1 ? d : null;
};

/**
 * Decide a pending request. `by` is { type: 'client', client } or { type: 'staff', user, channel, receivedAt }.
 * Rejecting needs a reason (at least 5 characters) so staff know what to change.
 */
async function decide(id, clientId, decision, input, by, now = new Date()) {
  if (!['approve', 'reject'].includes(decision)) return fail(400, 'Decision must be "approve" or "reject".');
  const note = clip(input?.note, 1000);
  if (decision === 'reject' && note.length < 5) return fail(400, 'Say what should change (at least 5 characters).');

  const set = { status: decision === 'approve' ? 'Approved' : 'Rejected', decidedAt: now, note: note || undefined };
  if (by.type === 'client') {
    Object.assign(set, { decisionBy: 'client', decidedByName: by.client.contactName || by.client.businessName, channel: 'Client portal' });
  } else {
    if (!STAFF_CHANNELS.includes(by.channel)) return fail(400, `Choose where the answer came from (${STAFF_CHANNELS.join(', ')}).`);
    const day = parseDay(by.receivedAt) || (by.receivedAt ? null : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12));
    if (!day || day > new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59)) return fail(400, 'Enter the day the client answered (not in the future).');
    Object.assign(set, { decisionBy: 'staff', decidedByName: staffName(by.user), channel: by.channel, receivedAt: day });
  }
  // Only a Pending request of this client can be decided, and only once
  const done = await Approval.findOneAndUpdate({ _id: id, client_ref: clientId, status: 'Pending' }, { $set: set }, { new: true });
  if (done) return { ok: true, approval: done };
  const current = await Approval.findOne({ _id: id, client_ref: clientId }).select('status').lean();
  if (!current) return fail(404, 'Approval not found');
  return fail(409, `This request is already ${current.status.toLowerCase()}.`);
}

/** Withdraw a pending request (staff). */
async function cancel(id, clientId, reason, user, now = new Date()) {
  const why = clip(reason, 1000);
  if (why.length < 3) return fail(400, 'Say why the request is withdrawn.');
  const done = await Approval.findOneAndUpdate({ _id: id, client_ref: clientId, status: 'Pending' },
    { $set: { status: 'Cancelled', decidedAt: now, decisionBy: 'staff', decidedByName: staffName(user), note: why } }, { new: true });
  if (done) return { ok: true, approval: done };
  const current = await Approval.findOne({ _id: id, client_ref: clientId }).select('status').lean();
  return current ? fail(409, `This request is already ${current.status.toLowerCase()}.`) : fail(404, 'Approval not found');
}

/** What the client sees: no staff names (the requester), only the decision and its comment. */
function clientView(a) {
  return {
    _id: a._id, kind: a.kind, title: a.title, details: a.details || '', versionLabel: a.versionLabel || '', amount: a.amount ?? null,
    linkUrl: a.linkUrl || '', status: a.status, requestedAt: a.requestedAt, decidedAt: a.decidedAt || null,
    channel: a.channel || null, decidedByClient: a.decisionBy === 'client', note: a.note || '',
  };
}

module.exports = { validateRequest, decide, cancel, clientView, STAFF_CHANNELS };
