// Payments, credit notes and the ageing report (Client Journey SOP §5.2 / §11).
//
//   • staff can record a payment themselves (cash, cheque, an offline transfer …) with its method,
//     reference and date; a client's own proof gets its method / receipt when staff approve it
//   • every accepted payment gets a receipt number (one series), and a receipt PDF
//   • a credit note (own series) lowers what the client owes on one invoice: the invoice as issued
//     is untouched and carries creditedAmount (services/finance.js netTotal)
//   • ageing: what is still owed, by how long it has been overdue
const Invoice = require('../models/Invoice');
const Client = require('../models/Client');
const PaymentProof = require('../models/PaymentProof');
const CreditNote = require('../models/CreditNote');
const { PAYMENT_METHODS } = require('../models/PaymentProof');
const finance = require('./finance');
const { getCompanyProfile } = require('./pdfBranding');
const { parseDay } = require('./invoiceDocument');

const { round2 } = finance;
const fail = (status, message) => ({ ok: false, status, message });
const staffName = (u) => [u?.firstName, u?.lastName].filter(Boolean).join(' ').trim() || u?.email || '';
const DAY_MS = 864e5;

/** The day a staff-entered date falls on (noon, so a time zone never shifts it); null if invalid or in the future. */
function pastDay(value, now = new Date()) {
  const d = value ? parseDay(value) : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  if (!d) return null;
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  return d > endOfToday ? null : d;
}

async function nextNumber(Model, field, start) {
  const last = await Model.findOne({ [field]: { $ne: null } }, { [field]: 1 }).sort({ [field]: -1 }).lean();
  return Math.max((last?.[field] || 0) + 1, start || 1);
}

// ── Receipts ────────────────────────────────────────────────────────────────
/** Gives an accepted payment its receipt number, once (also when two requests race). */
async function allocateReceipt(paymentId) {
  const { receiptNumberStart } = await getCompanyProfile();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const number = await nextNumber(PaymentProof, 'receiptNumber', receiptNumberStart);
    try {
      const done = await PaymentProof.findOneAndUpdate({ _id: paymentId, receiptNumber: null }, { $set: { receiptNumber: number } }, { new: true });
      if (done) return done.receiptNumber;
      return (await PaymentProof.findById(paymentId).select('receiptNumber').lean())?.receiptNumber || null; // numbered by another request
    } catch (err) {
      if (err.code !== 11000) throw err; // number taken in parallel — try the next one
    }
  }
  return null;
}

/**
 * Staff record a payment received outside the portal.
 * @param input { amount, date 'YYYY-MM-DD' (default today), method, reference, note }
 */
async function recordPayment(invoiceId, input, user) {
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) return fail(404, 'Invoice not found');
  if (invoice.unsent) return fail(409, 'Send the invoice to the client before recording a payment on it.');
  const balance = finance.invoiceBalance(invoice);
  if (balance <= 0) return fail(409, 'This invoice has nothing left to pay.');

  const amount = round2(input.amount);
  if (!(amount > 0)) return fail(400, 'Enter the amount received.');
  if (amount > balance) return fail(400, `The amount cannot be more than the balance of ₹${balance.toLocaleString('en-IN')}.`);
  const date = pastDay(input.date);
  if (!date) return fail(400, 'Enter the date the payment was received (not in the future).');
  if (!PAYMENT_METHODS.includes(input.method)) return fail(400, `Choose how it was paid: ${PAYMENT_METHODS.join(', ')}.`);
  const reference = String(input.reference || '').trim().slice(0, 60);
  if (input.method !== 'Cash' && reference.length < 3) return fail(400, 'Enter the reference (UTR / cheque number / transaction ID).');
  // One reference backs one live payment — a repeat would credit the same money twice
  if (reference && await PaymentProof.exists({ utrNumber: reference, status: { $in: ['Pending', 'Approved'] } })) {
    return fail(409, 'A payment with this reference has already been recorded.');
  }

  const payment = await PaymentProof.create({
    invoice_ref: invoice._id, client_ref: invoice.client_ref, amountPaid: amount, utrNumber: reference || undefined,
    paymentDate: date, method: input.method, source: 'staff', status: 'Approved',
    note: String(input.note || '').trim().slice(0, 500) || undefined,
    verifiedBy: user._id, verifiedAt: new Date(), recordedByName: staffName(user),
  });
  let updated;
  try {
    updated = await finance.applyPaymentToInvoice(invoice._id, amount, { paidOn: date, method: input.method });
    if (!updated) throw new Error('Invoice not found');
  } catch (err) {
    await PaymentProof.deleteOne({ _id: payment._id }); // the invoice was not credited, so nothing is left on record
    throw err;
  }
  await allocateReceipt(payment._id);
  return { ok: true, payment: await PaymentProof.findById(payment._id).lean(), invoice: updated };
}

// ── Credit notes ────────────────────────────────────────────────────────────
/**
 * Issue a credit note against a sent invoice.
 * @param input { amount (taxable value), reason, date 'YYYY-MM-DD' (default today) }
 * The invoice's own tax rate is applied; the credit (incl. tax) cannot be more than the balance.
 */
async function createCreditNote(invoiceId, input, user) {
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) return fail(404, 'Invoice not found');
  if (invoice.unsent) return fail(409, 'A credit note can only be issued on an invoice that has been sent.');
  const amount = round2(input.amount);
  if (!(amount > 0)) return fail(400, 'Enter the amount to credit.');
  const reason = String(input.reason || '').trim();
  if (reason.length < 5) return fail(400, 'Give the reason for the credit note (at least 5 characters).');
  const date = pastDay(input.date);
  if (!date) return fail(400, 'Enter the credit note date (not in the future).');

  const taxPercent = Number(invoice.taxPercent) || 0;
  const taxAmount = round2((amount * taxPercent) / 100);
  const gross = round2(amount + taxAmount);
  const balance = finance.invoiceBalance(invoice);
  if (gross > balance) {
    return fail(400, `The credit (₹${gross.toLocaleString('en-IN')} with tax) cannot be more than what is still owed on this invoice (₹${balance.toLocaleString('en-IN')}). A credit on a paid amount would be a refund, which is handled outside this.`);
  }

  // Claim the credit atomically so two notes together cannot take the balance below zero
  const claimed = await Invoice.findOneAndUpdate(
    { _id: invoice._id, $expr: { $gte: [{ $subtract: [finance.NET_TOTAL, '$paidAmount'] }, gross - 0.005] } },
    { $inc: { creditedAmount: gross } },
    { new: true }
  );
  if (!claimed) return fail(409, 'The balance changed while you were working — please check the invoice and try again.');

  const { creditNoteNumberStart } = await getCompanyProfile();
  let note = null;
  for (let attempt = 0; attempt < 5 && !note; attempt += 1) {
    try {
      note = await CreditNote.create({
        number: await nextNumber(CreditNote, 'number', creditNoteNumberStart),
        client_ref: invoice.client_ref, invoice_ref: invoice._id, invoiceId: invoice.invoiceId, date,
        amount, taxPercent, taxAmount, totalAmount: gross, reason: reason.slice(0, 500),
        createdBy: user._id, createdByName: staffName(user),
      });
    } catch (err) {
      if (err.code !== 11000) { await Invoice.updateOne({ _id: invoice._id }, { $inc: { creditedAmount: -gross } }); throw err; }
    }
  }
  if (!note) {
    await Invoice.updateOne({ _id: invoice._id }, { $inc: { creditedAmount: -gross } });
    return fail(409, 'Could not allocate a credit note number. Please try again.');
  }

  // Once what was paid covers what is now owed, the invoice is settled
  let invoiceAfter = claimed;
  if (claimed.paidAmount > 0 && claimed.paidAmount >= finance.netTotal(claimed) && claimed.paymentStatus !== 'Paid') {
    invoiceAfter = await Invoice.findByIdAndUpdate(invoice._id, { $set: { paymentStatus: 'Paid', paidOn: claimed.paidOn || date } }, { new: true });
  }
  return { ok: true, creditNote: note.toObject(), invoice: invoiceAfter };
}

// ── Ageing ──────────────────────────────────────────────────────────────────
const BUCKETS = [
  { key: 'notDue', label: 'Not due yet' },
  { key: 'd1_30', label: '1–30 days' },
  { key: 'd31_60', label: '31–60 days' },
  { key: 'd61_90', label: '61–90 days' },
  { key: 'd90plus', label: 'Over 90 days' },
];

function bucketOf(dueDate, now) {
  if (!dueDate || new Date(dueDate) >= now) return 'notDue';
  const days = Math.floor((now.getTime() - new Date(dueDate).getTime()) / DAY_MS);
  if (days <= 30) return 'd1_30';
  if (days <= 60) return 'd31_60';
  if (days <= 90) return 'd61_90';
  return 'd90plus';
}

/**
 * What is still owed (net of credit notes and payments), per client, by how overdue it is.
 * @param opts.clientIds  limit to these clients (person-wise grants); undefined = all
 */
async function ageingReport({ clientIds, now = new Date() } = {}) {
  const filter = { unsent: { $ne: true }, paymentStatus: { $ne: 'Paid' }, $expr: { $gt: [finance.NET_TOTAL, '$paidAmount'] } };
  if (clientIds) filter.client_ref = { $in: clientIds };
  const invoices = await Invoice.find(filter).select('client_ref invoiceId dueDate totalAmount creditedAmount paidAmount').lean();

  const clients = new Map((await Client.find({ _id: { $in: [...new Set(invoices.map((i) => String(i.client_ref)))] } }).select('clientId businessName').lean())
    .map((c) => [String(c._id), c]));
  const empty = () => ({ ...Object.fromEntries(BUCKETS.map((b) => [b.key, 0])), total: 0, invoices: 0 });
  const byClient = new Map();
  const totals = empty();
  for (const inv of invoices) {
    const balance = finance.invoiceBalance(inv);
    if (balance <= 0) continue;
    const key = String(inv.client_ref);
    if (!byClient.has(key)) byClient.set(key, empty());
    const row = byClient.get(key);
    const b = bucketOf(inv.dueDate, now);
    for (const target of [row, totals]) { target[b] = round2(target[b] + balance); target.total = round2(target.total + balance); target.invoices += 1; }
  }
  const rows = [...byClient.entries()].map(([id, sums]) => ({
    clientRef: id, clientId: clients.get(id)?.clientId || '', businessName: clients.get(id)?.businessName || 'Unknown client', ...sums,
  })).sort((a, b) => b.total - a.total || a.businessName.localeCompare(b.businessName));
  return { asOf: now, buckets: BUCKETS, rows, totals };
}

function ageingCsv(report) {
  const esc = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const head = ['Client ID', 'Client', ...report.buckets.map((b) => `${b.label} (₹)`), 'Total outstanding (₹)', 'Open invoices'];
  const line = (r) => [r.clientId, r.businessName, ...report.buckets.map((b) => r[b.key]), r.total, r.invoices];
  return [head, ...report.rows.map(line), ['', 'Total', ...report.buckets.map((b) => report.totals[b.key]), report.totals.total, report.totals.invoices]]
    .map((r) => r.map(esc).join(',')).join('\n');
}

// ── Revenue by type (SOP §5.1) ──────────────────────────────────────────────
const { REVENUE_TYPES } = require('../models/Invoice');
const AdPerformance = require('../models/AdPerformance');
const dayStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Vedhunt's revenue in a period, kept apart by type, with the other money figures that must not
 * be mistaken for it:
 *   • revenue      — taxable value (excl. GST) of invoices SENT in the period, per line type,
 *                    less credit notes dated in the period. An invoice is not revenue "collected".
 *   • gst          — tax on those invoices and credit notes (not revenue either)
 *   • collected    — cash actually received in the period (incl. GST)
 *   • mediaSpend   — the client's ad spend from the ad data; never part of Vedhunt's revenue
 * @param opts { from, to: 'YYYY-MM-DD' inclusive, clientIds }
 */
async function revenueReport({ from, to, clientIds }) {
  const start = parseDay(from);
  const end = parseDay(to);
  if (!start || !end || start > end) return null;
  const endOfDay = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999);
  const startOfDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const scope = clientIds ? { client_ref: { $in: clientIds } } : {};

  const [invoices, notes, payments, ads] = await Promise.all([
    Invoice.find({ ...scope, unsent: { $ne: true }, issueDate: { $gte: startOfDay, $lte: endOfDay } }).select('lineItems subtotal taxAmount').lean(),
    CreditNote.find({ ...scope, date: { $gte: startOfDay, $lte: endOfDay } }).select('amount taxAmount').lean(),
    PaymentProof.find({ ...scope, status: 'Approved', paymentDate: { $gte: startOfDay, $lte: endOfDay } }).select('amountPaid').lean(),
    AdPerformance.find({ ...scope, day: { $gte: dayStr(start), $lte: dayStr(end) } }).select('platform spend').lean(),
  ]);

  const types = new Map([...REVENUE_TYPES, 'Untyped'].map((t) => [t, { type: t, taxable: 0, lines: 0 }]));
  let gst = 0;
  for (const inv of invoices) {
    gst += Number(inv.taxAmount) || 0;
    for (const li of inv.lineItems || []) {
      const row = types.get(li.revenueType) || types.get('Untyped');
      row.taxable = round2(row.taxable + (Number(li.amount) || 0));
      row.lines += 1;
    }
  }
  const credited = round2(notes.reduce((s, n) => s + n.amount, 0));
  const creditedTax = round2(notes.reduce((s, n) => s + n.taxAmount, 0));
  const rows = [...types.values()].filter((r) => r.lines > 0 || REVENUE_TYPES.includes(r.type));
  const billed = round2(rows.reduce((s, r) => s + r.taxable, 0));

  const spendBy = new Map();
  for (const a of ads) spendBy.set(a.platform, round2((spendBy.get(a.platform) || 0) + (Number(a.spend) || 0)));
  return {
    from, to,
    types: rows,
    billed, creditNotes: credited, netRevenue: round2(billed - credited),
    gst: round2(gst - creditedTax),
    invoices: invoices.length, creditNoteCount: notes.length,
    collected: round2(payments.reduce((s, p) => s + p.amountPaid, 0)),
    mediaSpend: { total: round2([...spendBy.values()].reduce((s, v) => s + v, 0)), byPlatform: [...spendBy.entries()].map(([platform, spend]) => ({ platform, spend })).sort((a, b) => b.spend - a.spend) },
  };
}

module.exports = {
  revenueReport,
  PAYMENT_METHODS, BUCKETS, pastDay, allocateReceipt, recordPayment, createCreditNote, bucketOf, ageingReport, ageingCsv,
};
