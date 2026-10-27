// Recurring invoices (client decisions, Oct 2026):
//   • each client has their own billing day; the first invoice is on a start date
//     (suggested: onboarding date + 30 days) and always bills the FULL monthly fee
//   • billed IN ADVANCE: an invoice dated D covers D up to the day before the next invoice date
//   • ad spend is billed separately — it is never part of these invoices
//   • nothing reaches the client automatically: the daily job only creates DRAFTS and an
//     admin approves them, correcting any that are wrong first
// A draft that cannot be built (no retainer, no email …) is kept as "Needs Attention"
// with the reasons, never silently skipped.
const BillingSchedule = require('../models/BillingSchedule');
const InvoiceDraft = require('../models/InvoiceDraft');
const Invoice = require('../models/Invoice');
const { REVENUE_TYPES } = require('../models/Invoice');
const Retainer = require('../models/Retainer');
const Client = require('../models/Client');
const { dayOf, addDays } = require('./adPerformance');
const { getBilling } = require('./clientPolicies');
const { notifyPermissionHolders } = require('./staffNotify');
const logger = require('../utils/logger');

const CATCH_UP_DAYS = 7; // a missed run still drafts dates up to a week old, never a backlog of months
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const isDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && dayOf(new Date(`${s}T12:00:00`)) === s;
const fail = (status, message) => ({ ok: false, status, message });

// ── Dates ───────────────────────────────────────────────────────────────────
/** The billing day in a given month, clamped to the month's length (31 → 30 Apr, 28/29 Feb). */
function dayInMonth(year, monthIndex, billingDay) {
  const last = new Date(year, monthIndex + 1, 0).getDate();
  return dayOf(new Date(year, monthIndex, Math.min(billingDay, last)));
}

/** The k-th invoice date: k=0 is the start date; later ones fall on the billing day of each following month. */
function nthDate(schedule, k) {
  if (k === 0) return schedule.startDate;
  const [y, m] = schedule.startDate.split('-').map(Number);
  const d = new Date(y, m - 1 + k, 1);
  return dayInMonth(d.getFullYear(), d.getMonth(), schedule.billingDay);
}

/** All invoice dates in [from, to] (inclusive, strings). */
function invoiceDatesBetween(schedule, from, to) {
  const out = [];
  for (let k = 0; k < 1200; k += 1) {
    const d = nthDate(schedule, k);
    if (d > to) break;
    if (d >= from) out.push(d);
  }
  return out;
}

/** The first invoice date strictly after `date`. */
function nextDateAfter(schedule, date) {
  for (let k = 0; k < 1200; k += 1) {
    const d = nthDate(schedule, k);
    if (d > date) return d;
  }
  return null;
}

/** The next `count` invoice dates from `from` on (for showing staff what will happen). */
function upcomingDates(schedule, from, count = 3) {
  const out = [];
  for (let k = 0; k < 1200 && out.length < count; k += 1) {
    const d = nthDate(schedule, k);
    if (d >= from) out.push(d);
  }
  return out;
}

/** Covers invoiceDate up to the day before the next invoice date. */
const periodFor = (schedule, invoiceDate) => ({ start: invoiceDate, end: addDays(nextDateAfter(schedule, invoiceDate), -1) });

/** Suggested first date for a client: onboarding date + 30 days (the client's rule for existing clients). */
function suggestStartDate(onboardingDate) {
  if (!onboardingDate) return null;
  return addDays(dayOf(new Date(onboardingDate)), 30);
}

// ── Draft contents ──────────────────────────────────────────────────────────
const label = (s) => new Date(`${s}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/** Totals for a set of line items. */
function totals(lineItems, taxPercent) {
  const subtotal = r2(lineItems.reduce((s, i) => s + (Number(i.amount) || 0), 0));
  const taxAmount = r2((subtotal * (Number(taxPercent) || 0)) / 100);
  return { subtotal, taxPercent: Number(taxPercent) || 0, taxAmount, totalAmount: r2(subtotal + taxAmount) };
}

/** Why a draft cannot go out as it is. */
function problemsFor({ lineItems, totalAmount }, client) {
  const problems = [];
  if (!lineItems.length) problems.push('No active monthly retainer was found for this client, so there is nothing to bill.');
  else if (!(totalAmount > 0)) problems.push('The invoice total is zero.');
  if (!client?.email) problems.push('The client has no email address on file.');
  return problems;
}

/** Build the draft's figures from the client's active monthly retainers. */
async function buildContents(schedule, client, invoiceDate, policy) {
  const period = periodFor(schedule, invoiceDate);
  const retainers = await Retainer.find({
    client_ref: schedule.client_ref, status: 'Active', billingCycle: 'Monthly', contractEndDate: { $gte: new Date(`${invoiceDate}T00:00:00`) },
  }).select('packageName monthlyAmount').sort({ createdAt: 1 }).lean();

  const lineItems = retainers.filter((r) => r.monthlyAmount > 0).map((r) => ({
    description: `${r.packageName} — ${label(period.start)} to ${label(period.end)}`,
    qty: 1, unitPrice: r.monthlyAmount, amount: r.monthlyAmount, revenueType: 'Retainer',
  }));
  const t = totals(lineItems, policy.gstPercent);
  const dueDate = new Date(`${addDays(invoiceDate, schedule.dueDays)}T23:59:59`);
  return { period, lineItems, dueDate, ...t, problems: problemsFor({ lineItems, totalAmount: t.totalAmount }, client) };
}

/**
 * Draft one scheduled date for a client. Returns 'created' | 'needAttention' | 'existing'.
 * A date that already has a draft or an invoice is never drafted again.
 */
async function draftOne(schedule, client, invoiceDate, policy) {
  if (await InvoiceDraft.exists({ client_ref: schedule.client_ref, invoiceDate })) return 'existing';
  if (await Invoice.exists({ client_ref: schedule.client_ref, 'scheduled.invoiceDate': invoiceDate })) return 'existing';
  const c = await buildContents(schedule, client, invoiceDate, policy);
  try {
    await InvoiceDraft.create({
      client_ref: schedule.client_ref, invoiceDate, periodStart: c.period.start, periodEnd: c.period.end, dueDate: c.dueDate,
      lineItems: c.lineItems, subtotal: c.subtotal, taxPercent: c.taxPercent, taxAmount: c.taxAmount, totalAmount: c.totalAmount,
      problems: c.problems, status: c.problems.length ? 'Needs Attention' : 'Pending Approval',
    });
  } catch (err) {
    if (err.code === 11000) return 'existing'; // another run got there first
    throw err;
  }
  return c.problems.length ? 'needAttention' : 'created';
}

const MISSED_LOOKBACK_DAYS = 62;

/** Scheduled dates up to today that have neither a draft nor an invoice (the job only catches up a week). */
async function missedDates(schedule, now = new Date()) {
  const today = dayOf(now);
  const from = addDays(today, -MISSED_LOOKBACK_DAYS);
  const dates = invoiceDatesBetween(schedule, from, today);
  if (!dates.length) return [];
  const [drafts, invoices] = await Promise.all([
    InvoiceDraft.find({ client_ref: schedule.client_ref, invoiceDate: { $in: dates } }).select('invoiceDate').lean(),
    Invoice.find({ client_ref: schedule.client_ref, 'scheduled.invoiceDate': { $in: dates } }).select('scheduled.invoiceDate').lean(),
  ]);
  const have = new Set([...drafts.map((d) => d.invoiceDate), ...invoices.map((i) => i.scheduled.invoiceDate)]);
  return dates.filter((d) => !have.has(d)).slice(-3);
}

/** Staff asked for the draft of a date the job did not (or will not) create — e.g. a start date already in the past. */
async function createDraftFor(clientId, invoiceDate, now = new Date()) {
  const schedule = await BillingSchedule.findOne({ client_ref: clientId }).lean();
  if (!schedule) return fail(404, 'This client has no billing schedule yet. Save one first.');
  if (!isDay(invoiceDate)) return fail(400, 'Choose a valid date.');
  if (invoiceDate > dayOf(now)) return fail(400, 'That date has not arrived yet — the daily job will create it.');
  if (!invoiceDatesBetween(schedule, invoiceDate, invoiceDate).length) return fail(400, 'That date is not one of this client\'s scheduled invoice dates.');
  const client = await Client.findById(clientId).select('email businessName clientId isActive deletedAt').lean();
  if (!client || client.deletedAt) return fail(404, 'Client not found');
  const state = await draftOne(schedule, client, invoiceDate, await getBilling());
  if (state === 'existing') return fail(409, 'That date already has a draft or an invoice.');
  const draft = await InvoiceDraft.findOne({ client_ref: clientId, invoiceDate }).lean();
  return { ok: true, draft, state };
}

// ── The daily job ───────────────────────────────────────────────────────────
/**
 * Create the drafts that are due. Safe to run any number of times: the unique
 * (client, invoiceDate) index means a date is drafted once.
 * @returns { created, needAttention, existing }
 */
async function generateDrafts(now = new Date()) {
  const today = dayOf(now);
  const from = addDays(today, -CATCH_UP_DAYS);
  const policy = await getBilling();
  const result = { created: 0, needAttention: 0, existing: 0 };

  const schedules = await BillingSchedule.find({ active: true }).lean();
  for (const schedule of schedules) {
    const dates = invoiceDatesBetween(schedule, from, today);
    if (!dates.length) continue;
    const client = await Client.findById(schedule.client_ref).select('email businessName clientId isActive deletedAt').lean();
    if (!client || client.deletedAt || !client.isActive) continue; // closed or suspended accounts are not invoiced

    for (const invoiceDate of dates) {
      try {
        result[await draftOne(schedule, client, invoiceDate, policy)] += 1;
      } catch (err) {
        logger.error(`Invoice draft failed for ${client.clientId} ${invoiceDate}:`, err.message);
      }
    }
  }

  const total = result.created + result.needAttention;
  if (total > 0) {
    await notifyPermissionHolders('cms.manage', {
      type: 'invoice_drafts',
      title: `${total} scheduled invoice${total > 1 ? 's' : ''} to review`,
      message: result.needAttention ? `${result.needAttention} need attention before they can be approved.` : 'Approve them to send them to the clients.',
      link: '/admin/invoices',
    });
  }
  return result;
}

// ── Reviewing a draft ───────────────────────────────────────────────────────
const OPEN = ['Pending Approval', 'Needs Attention'];
const nameOf = (u) => [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email;

/** Clean line items from staff input. */
function cleanItems(input) {
  if (!Array.isArray(input) || !input.length) return { error: 'Add at least one line item.' };
  if (input.length > 20) return { error: 'An invoice can have at most 20 line items.' };
  const items = [];
  for (const it of input) {
    const description = String(it?.description || '').trim();
    const unitPrice = Number(it?.unitPrice);
    const qty = Number(it?.qty ?? 1);
    if (!description) return { error: 'Every line item needs a description.' };
    if (!Number.isFinite(unitPrice) || unitPrice < 0) return { error: `"${description}": the price must be zero or more.` };
    if (!Number.isInteger(qty) || qty < 1 || qty > 1000) return { error: `"${description}": quantity must be a whole number of 1 or more.` };
    const price = r2(unitPrice); // the amount is worked out from the price shown, so a line always adds up
    // A draft is a retainer invoice unless staff say otherwise
    const revenueType = REVENUE_TYPES.includes(it?.revenueType) ? it.revenueType : 'Retainer';
    items.push({ description: description.slice(0, 300), qty, unitPrice: price, amount: r2(price * qty), revenueType });
  }
  return { items };
}

/** Correct an open draft: line items, due date, tax, note. Problems are re-checked afterwards. */
async function editDraft(id, input, user) {
  const draft = await InvoiceDraft.findById(id);
  if (!draft) return fail(404, 'Scheduled invoice not found');
  if (!OPEN.includes(draft.status)) return fail(409, `This scheduled invoice is already ${draft.status.toLowerCase()}.`);
  const has = (k) => Object.prototype.hasOwnProperty.call(input, k);

  if (has('lineItems')) {
    const { items, error } = cleanItems(input.lineItems);
    if (error) return fail(400, error);
    draft.lineItems = items;
  }
  if (has('taxPercent')) {
    const t = Number(input.taxPercent);
    if (!Number.isFinite(t) || t < 0 || t > 28) return fail(400, 'GST must be between 0 and 28%.');
    draft.taxPercent = t;
  }
  if (has('dueDate')) {
    if (!isDay(input.dueDate)) return fail(400, 'Choose a valid due date.');
    if (input.dueDate < draft.invoiceDate) return fail(400, 'The due date cannot be before the invoice date.');
    draft.dueDate = new Date(`${input.dueDate}T23:59:59`);
  }
  if (has('note')) draft.note = String(input.note || '').trim().slice(0, 500);

  Object.assign(draft, totals(draft.lineItems, draft.taxPercent));
  const client = await Client.findById(draft.client_ref).select('email').lean();
  draft.problems = problemsFor(draft, client);
  draft.status = draft.problems.length ? 'Needs Attention' : 'Pending Approval';
  draft.corrected = true;
  await draft.save();
  return { ok: true, draft };
}

/** Rebuild an open draft from the client's current retainers (after fixing the retainer or schedule). */
async function rebuildDraft(id) {
  const draft = await InvoiceDraft.findById(id);
  if (!draft) return fail(404, 'Scheduled invoice not found');
  if (!OPEN.includes(draft.status)) return fail(409, `This scheduled invoice is already ${draft.status.toLowerCase()}.`);
  const schedule = await BillingSchedule.findOne({ client_ref: draft.client_ref }).lean();
  if (!schedule) return fail(409, 'This client no longer has a billing schedule.');
  const client = await Client.findById(draft.client_ref).select('email').lean();
  const c = await buildContents(schedule, client, draft.invoiceDate, await getBilling());
  Object.assign(draft, { lineItems: c.lineItems, subtotal: c.subtotal, taxPercent: c.taxPercent, taxAmount: c.taxAmount, totalAmount: c.totalAmount, dueDate: c.dueDate, periodStart: c.period.start, periodEnd: c.period.end, problems: c.problems, status: c.problems.length ? 'Needs Attention' : 'Pending Approval', corrected: false });
  await draft.save();
  return { ok: true, draft };
}

/** Approve: turns the draft into a real invoice, saved but not yet sent to the client. Exactly once. */
async function approveDraft(id, user) {
  // Claim first, so a double click or two approvers cannot both create an invoice
  const draft = await InvoiceDraft.findOneAndUpdate(
    { _id: id, status: 'Pending Approval' },
    { $set: { status: 'Approved', decidedBy: user._id, decidedByName: nameOf(user), decidedAt: new Date() } },
    { new: true }
  );
  if (!draft) {
    const current = await InvoiceDraft.findById(id).select('status problems').lean();
    if (!current) return fail(404, 'Scheduled invoice not found');
    if (current.status === 'Needs Attention') return fail(409, `Fix this first: ${current.problems.join(' ')}`);
    return fail(409, `This scheduled invoice is already ${current.status.toLowerCase()}.`);
  }
  try {
    const invoice = await Invoice.create({
      client_ref: draft.client_ref, issueDate: new Date(), dueDate: draft.dueDate, lineItems: draft.lineItems,
      subtotal: draft.subtotal, taxPercent: draft.taxPercent, taxAmount: draft.taxAmount, totalAmount: draft.totalAmount,
      scheduled: { invoiceDate: draft.invoiceDate, periodStart: draft.periodStart, periodEnd: draft.periodEnd },
      // Saved, not sent: staff add the billing details and send it as a Proforma / Tax Invoice
      // from Invoice Manager (services/invoiceDocument.js), which is when the client sees it.
      unsent: true,
    });
    draft.invoice_ref = invoice._id;
    await draft.save();
    return { ok: true, draft, invoice };
  } catch (err) {
    // Not issued: hand the draft back so it can be tried again
    await InvoiceDraft.updateOne({ _id: id }, { $set: { status: 'Pending Approval' }, $unset: { decidedBy: 1, decidedByName: 1, decidedAt: 1 } });
    if (err.code === 11000) return fail(409, 'An invoice for this scheduled date already exists.');
    throw err;
  }
}

async function skipDraft(id, reason, user) {
  const why = String(reason || '').trim();
  if (why.length < 5) return fail(400, 'Give a reason for skipping (at least 5 characters).');
  const draft = await InvoiceDraft.findOneAndUpdate(
    { _id: id, status: { $in: OPEN } },
    { $set: { status: 'Skipped', skipReason: why.slice(0, 500), decidedBy: user._id, decidedByName: nameOf(user), decidedAt: new Date() } },
    { new: true }
  );
  if (!draft) return fail(409, 'This scheduled invoice is not open any more.');
  return { ok: true, draft };
}

/** Validate a billing schedule from staff. */
function validateSchedule(input = {}, defaultDueDays = 7) {
  const billingDay = Number(input.billingDay);
  if (!Number.isInteger(billingDay) || billingDay < 1 || billingDay > 31) return { error: 'The billing day must be a whole number from 1 to 31.' };
  if (!isDay(input.startDate)) return { error: 'Choose a valid first invoice date.' };
  const dueDays = input.dueDays === undefined || input.dueDays === '' ? defaultDueDays : Number(input.dueDays);
  if (!Number.isInteger(dueDays) || dueDays < 1 || dueDays > 30) return { error: 'Days to pay must be a whole number from 1 to 30.' };
  return { value: { active: !!input.active, billingDay, startDate: input.startDate, dueDays, note: String(input.note || '').trim().slice(0, 500) } };
}

module.exports = {
  CATCH_UP_DAYS, dayInMonth, nthDate, invoiceDatesBetween, nextDateAfter, upcomingDates, periodFor, suggestStartDate,
  totals, problemsFor, cleanItems, generateDrafts, missedDates, createDraftFor, editDraft, rebuildDraft, approveDraft, skipDraft, validateSchedule,
};
