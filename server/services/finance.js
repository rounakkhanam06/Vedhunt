// Single source of truth for invoice money maths. Overdue / balance / collection
// are always derived from the invoice's amounts and due date — never from a
// hand-typed status — so lists, KPIs, the client portal and PDFs agree.
const Invoice = require('../models/Invoice');

const DAY_MS = 24 * 60 * 60 * 1000;

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const invoiceBalance = (inv) => round2(Math.max(0, (Number(inv.totalAmount) || 0) - (Number(inv.paidAmount) || 0)));

/** Whole days past due for an invoice that still has a balance; 0 otherwise. */
const daysOverdue = (inv, now = new Date()) => {
  if (!inv.dueDate || inv.paymentStatus === 'Paid' || invoiceBalance(inv) <= 0) return 0;
  const diff = now.getTime() - new Date(inv.dueDate).getTime();
  return diff > 0 ? Math.floor(diff / DAY_MS) : 0;
};

const isOverdue = (inv, now = new Date()) =>
  !!inv.dueDate && inv.paymentStatus !== 'Paid' && invoiceBalance(inv) > 0 && new Date(inv.dueDate) < now;

/** received / total × 100, or null when the total is zero (UI shows "--"). */
const collectionPercent = (received, total) => {
  const t = Number(total) || 0;
  if (t <= 0) return null;
  return round2(((Number(received) || 0) / t) * 100);
};

/** A lean invoice with its derived fields: balance, daysOverdue, isOverdue and the displayed status. */
const withDerived = (inv, now = new Date()) => {
  const overdue = isOverdue(inv, now);
  // 'Overdue' is never trusted from storage (older records may carry it): it is
  // shown only while the invoice really is past due with a balance.
  const stored = inv.paymentStatus === 'Overdue' ? 'Unpaid' : inv.paymentStatus;
  return {
    ...inv,
    paymentStatus: overdue ? 'Overdue' : stored,
    balance: invoiceBalance(inv),
    daysOverdue: daysOverdue(inv, now),
    isOverdue: overdue,
  };
};

/** Mongo filter for invoices that are overdue right now (matches isOverdue above). */
const overdueFilter = (now = new Date()) => ({
  paymentStatus: { $ne: 'Paid' },
  dueDate: { $lt: now },
  $expr: { $gt: ['$totalAmount', '$paidAmount'] },
});

/** Mongo filter for invoices that are open (still owe money) but not yet overdue. */
const unpaidNotOverdueFilter = (now = new Date()) => ({
  paymentStatus: { $ne: 'Paid' },
  $expr: { $gt: ['$totalAmount', '$paidAmount'] },
  $or: [{ dueDate: null }, { dueDate: { $gte: now } }],
});

/**
 * Credit a verified payment to its invoice. Uses an atomic $inc so two
 * approvals landing together can't overwrite each other's read-modify-write,
 * then settles the status from the stored total.
 * @returns the updated invoice document
 */
async function applyPaymentToInvoice(invoiceId, amount, { paidOn = new Date(), method } = {}) {
  const amt = round2(amount);
  let invoice = await Invoice.findByIdAndUpdate(invoiceId, { $inc: { paidAmount: amt } }, { new: true });
  if (!invoice) return null;
  if (invoice.paidAmount >= invoice.totalAmount && invoice.paymentStatus !== 'Paid') {
    const set = { paymentStatus: 'Paid', paidOn };
    if (method) set.paymentMethod = method;
    invoice = await Invoice.findByIdAndUpdate(invoiceId, { $set: set }, { new: true });
  }
  return invoice;
}

/**
 * Portfolio-wide money totals, optionally limited to some clients.
 * Outstanding = balance of every unpaid invoice; overdue is shown separately.
 * `perClient` carries what the portfolio table needs: received, balance,
 * overdue amount, oldest overdue due date and days overdue.
 */
async function portfolioFinance({ clientIds, now = new Date() } = {}) {
  const match = { unsent: { $ne: true } }; // an invoice not sent to the client yet is not owed
  if (clientIds) match.client_ref = { $in: clientIds };

  const rows = await Invoice.aggregate([
    { $match: match },
    {
      $project: {
        client_ref: 1,
        totalAmount: 1,
        paidAmount: 1,
        dueDate: 1,
        balance: { $max: [0, { $subtract: ['$totalAmount', '$paidAmount'] }] },
        overdue: {
          $and: [
            { $ne: ['$paymentStatus', 'Paid'] },
            { $lt: ['$dueDate', now] },
            { $gt: ['$totalAmount', '$paidAmount'] },
          ],
        },
      },
    },
    {
      $group: {
        _id: '$client_ref',
        billed: { $sum: '$totalAmount' },
        received: { $sum: '$paidAmount' },
        outstanding: { $sum: '$balance' },
        overdueAmount: { $sum: { $cond: ['$overdue', '$balance', 0] } },
        overdueInvoices: { $sum: { $cond: ['$overdue', 1, 0] } },
        oldestOverdueDue: { $min: { $cond: ['$overdue', '$dueDate', null] } },
      },
    },
  ]);

  const perClient = new Map();
  const totals = { billed: 0, received: 0, outstanding: 0, overdueAmount: 0, defaulters: 0 };
  for (const r of rows) {
    const oldest = r.oldestOverdueDue || null;
    const entry = {
      billed: round2(r.billed),
      received: round2(r.received),
      outstanding: round2(r.outstanding),
      overdueAmount: round2(r.overdueAmount),
      overdueInvoices: r.overdueInvoices,
      oldestOverdueDue: oldest,
      daysOverdue: oldest ? Math.floor((now.getTime() - new Date(oldest).getTime()) / DAY_MS) : 0,
      collectionPercent: collectionPercent(r.received, r.billed),
    };
    perClient.set(String(r._id), entry);
    totals.billed += r.billed;
    totals.received += r.received;
    totals.outstanding += r.outstanding;
    totals.overdueAmount += r.overdueAmount;
    if (r.overdueInvoices > 0) totals.defaulters += 1;
  }
  totals.billed = round2(totals.billed);
  totals.received = round2(totals.received);
  totals.outstanding = round2(totals.outstanding);
  totals.overdueAmount = round2(totals.overdueAmount);
  totals.collectionPercent = collectionPercent(totals.received, totals.billed);
  return { perClient, totals };
}

module.exports = {
  round2, invoiceBalance, daysOverdue, isOverdue, collectionPercent, withDerived,
  overdueFilter, unpaidNotOverdueFilter, applyPaymentToInvoice, portfolioFinance,
};
