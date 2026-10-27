// Offboarding checklist and its gate (Client Journey SOP §14). A client is marked Offboarded only once
// every step is done — or a Super Admin bypasses the gate and says why (kept in the audit log).
//   1. notice          — notice date and last day of service recorded
//   2. final_invoice   — nothing is still owed on a sent invoice (live, from the invoices)
//   3. handover        — final report / files / learnings handed over (confirmed by staff)
//   4. access_revoked  — no platform access still Granted / Verified (live, from the access tracker)
//   5. retention       — what happens to the client's documents and personal data (confirmed by staff)
//   6. closure         — Super Admin approves closing the account
const OffboardingChecklist = require('../models/OffboardingChecklist');
const Invoice = require('../models/Invoice');
const PlatformAccess = require('../models/PlatformAccess');
const finance = require('./finance');

const fail = (status, message) => ({ ok: false, status, message });
const clip = (v, n) => String(v ?? '').trim().slice(0, n);
const staffName = (u) => [u?.firstName, u?.lastName].filter(Boolean).join(' ').trim() || u?.email || '';
const CONFIRM_ITEMS = ['handover', 'retention', 'closure'];
const LABELS = {
  notice: 'Notice and last day of service recorded',
  final_invoice: 'Final invoice settled — nothing left to pay',
  handover: 'Handover done (final report, files, learnings)',
  access_revoked: 'Platform access revoked',
  retention: 'Data retention decided (documents, KYC, personal data)',
  closure: 'Closure approved by a Super Admin',
};

const parseDay = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
  return d.getMonth() === Number(m[2]) - 1 ? d : null;
};
const day = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '');
const inr = (n) => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

/** The pieces of the checklist that are worked out from other records. */
async function liveFacts(clientId) {
  const [invoices, live] = await Promise.all([
    Invoice.find({ client_ref: clientId, unsent: { $ne: true }, paymentStatus: { $ne: 'Paid' }, $expr: { $gt: [finance.NET_TOTAL, '$paidAmount'] } }).select('invoiceId totalAmount creditedAmount paidAmount').lean(),
    PlatformAccess.countDocuments({ client_ref: clientId, status: { $in: ['Granted', 'Verified'] } }),
  ]);
  const owed = invoices.reduce((s, i) => s + finance.invoiceBalance(i), 0);
  return { openInvoices: invoices.length, owed: Math.round(owed * 100) / 100, liveAccess: live };
}

/** The checklist as the screen shows it, with what is still open. */
async function evaluate(clientId) {
  const [doc, facts] = await Promise.all([OffboardingChecklist.findOne({ client_ref: clientId }).lean(), liveFacts(clientId)]);
  const confirm = (key) => ({ done: !!doc?.[key]?.done, note: doc?.[key]?.note || '', doneAt: doc?.[key]?.doneAt || null, doneByName: doc?.[key]?.doneByName || '' });
  const items = [
    { key: 'notice', auto: false, done: !!(doc?.noticeDate && doc?.effectiveDate), detail: doc?.noticeDate ? `Notice ${day(doc.noticeDate)}${doc.effectiveDate ? ` · last day ${day(doc.effectiveDate)}` : ''}` : 'Not recorded yet' },
    { key: 'final_invoice', auto: true, done: facts.openInvoices === 0, detail: facts.openInvoices ? `${facts.openInvoices} invoice${facts.openInvoices === 1 ? '' : 's'} still owing ${inr(facts.owed)}` : 'Nothing is owed' },
    { key: 'handover', auto: false, ...confirm('handover') },
    { key: 'access_revoked', auto: true, done: facts.liveAccess === 0, detail: facts.liveAccess ? `${facts.liveAccess} platform access${facts.liveAccess === 1 ? '' : 'es'} still live (see the Access tab)` : 'No live access' },
    { key: 'retention', auto: false, ...confirm('retention') },
    { key: 'closure', auto: false, ...confirm('closure') },
  ].map((i) => ({ label: LABELS[i.key], ...i }));
  const open = items.filter((i) => !i.done);
  return {
    started: !!doc,
    noticeDate: doc?.noticeDate || null, effectiveDate: doc?.effectiveDate || null,
    items, open: open.map((i) => i.label), complete: open.length === 0,
  };
}

/**
 * Update the checklist: the dates, or confirm / un-confirm one manual step.
 * @param input { noticeDate, effectiveDate } | { item: 'handover' | 'retention' | 'closure', done, note }
 * @param canCloseAccount  true for a Super Admin (only they can confirm the closure)
 */
async function update(clientId, input, user, { canCloseAccount = false, now = new Date() } = {}) {
  const set = {};
  if (input.noticeDate !== undefined || input.effectiveDate !== undefined) {
    const current = await OffboardingChecklist.findOne({ client_ref: clientId }).lean();
    const notice = input.noticeDate !== undefined ? parseDay(input.noticeDate) : current?.noticeDate;
    const effective = input.effectiveDate !== undefined ? parseDay(input.effectiveDate) : current?.effectiveDate;
    if ((input.noticeDate !== undefined && !notice) || (input.effectiveDate !== undefined && !effective)) return fail(400, 'Enter the dates as real days.');
    if (notice && notice > new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59)) return fail(400, 'The notice date cannot be in the future.');
    if (notice && effective && effective < notice) return fail(400, 'The last day of service cannot be before the notice date.');
    if (input.noticeDate !== undefined) set.noticeDate = notice;
    if (input.effectiveDate !== undefined) set.effectiveDate = effective;
  }
  if (input.item !== undefined) {
    if (!CONFIRM_ITEMS.includes(input.item)) return fail(400, `Item must be one of ${CONFIRM_ITEMS.join(', ')} (the others are worked out by themselves).`);
    if (input.item === 'closure' && !canCloseAccount) return fail(403, 'Only a Super Admin can approve closing the account.');
    const done = input.done !== false;
    const note = clip(input.note, 500);
    if (done && note.length < 3) return fail(400, 'Add a short note saying what was done.');
    set[input.item] = { done, note: done ? note : undefined, doneAt: done ? now : undefined, doneByName: done ? staffName(user) : undefined };
  }
  if (!Object.keys(set).length) return fail(400, 'Nothing to update.');
  await OffboardingChecklist.findOneAndUpdate({ client_ref: clientId }, { $set: set, $setOnInsert: { startedByName: staffName(user) } }, { upsert: true });
  return { ok: true, checklist: await evaluate(clientId) };
}

/**
 * The gate. `bypassReason` (Super Admin only — the route is) lets the offboarding through with steps
 * still open; it must say why, and what was skipped is returned so it can be audited.
 */
async function gate(clientId, bypassReason) {
  const checklist = await evaluate(clientId);
  if (checklist.complete) return { ok: true, checklist, bypassed: [] };
  const why = clip(bypassReason, 500);
  if (!why) {
    return { ok: false, status: 409, message: `The offboarding checklist is not complete. Still open: ${checklist.open.join('; ')}. Finish them, or — as a Super Admin — offboard anyway and say why.`, open: checklist.open };
  }
  if (why.length < 10) return fail(400, 'Say why the checklist is being bypassed (at least 10 characters).');
  return { ok: true, checklist, bypassed: checklist.open, bypassReason: why };
}

module.exports = { evaluate, update, gate, LABELS, CONFIRM_ITEMS };
