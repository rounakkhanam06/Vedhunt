// Client register — the spreadsheet view of the client list ("Client list View",
// client sample, Oct 2026): one row per client with domain, onboarding date,
// billing type, package / GST / total, received, balance, the amount received in
// each month of a financial year (Apr–Mar), the year's total and last month's.
//
// Every figure is derived from retainers, invoices and payments — nothing is typed
// in twice — and the money figures always agree with each other:
//   • Received = what has been paid against the client's sent invoices (all time)
//   • each payment is dated: a verified payment proof by its verification date, and any
//     amount marked paid by staff without a proof by the invoice's paid-on date; the
//     proofs on an invoice never count for more than the invoice's paid amount
//   • so the months of every year added together equal Received exactly.
const Retainer = require('../models/Retainer');
const Invoice = require('../models/Invoice');
const PaymentProof = require('../models/PaymentProof');
const { getBilling } = require('./clientPolicies');
const { round2 } = require('./finance');

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/** The financial year (Apr–Mar) a date falls in, by its starting year: Oct 2026 → 2026, Feb 2027 → 2026. */
const fyOf = (d) => (d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1);

/** The 12 months of FY `startYear`: [{ key: '2026-04', label: 'Apr-26' }, …, { key: '2027-03', label: 'Mar-27' }]. */
function fyMonths(startYear) {
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(startYear, 3 + i, 1);
    return { key: monthKey(d), label: `${MONTH_NAMES[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}` };
  });
}

/**
 * Money received per client per month ('YYYY-MM'), from sent invoices.
 * @returns Map<clientId, Map<monthKey, amount>>
 */
async function receivedByMonth(clientIds) {
  const invoices = await Invoice.find(
    { client_ref: { $in: clientIds }, unsent: { $ne: true }, paidAmount: { $gt: 0 } },
    'client_ref paidAmount paidOn updatedAt'
  ).lean();
  const proofs = await PaymentProof.find(
    { invoice_ref: { $in: invoices.map((i) => i._id) }, status: 'Approved' },
    'invoice_ref amountPaid verifiedAt updatedAt'
  ).sort({ verifiedAt: 1 }).lean();
  const proofsByInvoice = new Map();
  for (const p of proofs) {
    const k = String(p.invoice_ref);
    proofsByInvoice.set(k, [...(proofsByInvoice.get(k) || []), p]);
  }

  const out = new Map();
  const add = (clientId, date, amount) => {
    if (!(amount > 0)) return;
    const c = String(clientId);
    if (!out.has(c)) out.set(c, new Map());
    const m = out.get(c);
    const k = monthKey(new Date(date));
    m.set(k, round2((m.get(k) || 0) + amount));
  };

  for (const inv of invoices) {
    let left = round2(inv.paidAmount);
    for (const p of proofsByInvoice.get(String(inv._id)) || []) {
      const amount = Math.min(left, round2(p.amountPaid));
      add(inv.client_ref, p.verifiedAt || p.updatedAt, amount);
      left = round2(left - amount);
    }
    // Paid without a proof (marked Paid / recorded by staff)
    add(inv.client_ref, inv.paidOn || inv.updatedAt, left);
  }
  return out;
}

/** Billing type, package and tax per client: from active retainers, or — with none — its one-time invoices. */
async function packagesByClient(clientIds, gstPercent) {
  const [retainers, oneTime] = await Promise.all([
    Retainer.find({ client_ref: { $in: clientIds }, status: 'Active' }, 'client_ref monthlyAmount billingCycle packageName').lean(),
    Invoice.aggregate([
      { $match: { client_ref: { $in: clientIds }, unsent: { $ne: true } } },
      { $group: { _id: '$client_ref', subtotal: { $sum: '$subtotal' }, tax: { $sum: '$taxAmount' }, total: { $sum: '$totalAmount' } } },
    ]),
  ]);
  const out = new Map();
  for (const r of retainers) {
    const k = String(r.client_ref);
    const e = out.get(k) || { billingType: new Set(), packages: [], amount: 0 };
    e.billingType.add(r.billingCycle || 'Monthly');
    e.packages.push(r.packageName);
    e.amount = round2(e.amount + (Number(r.monthlyAmount) || 0));
    out.set(k, e);
  }
  const result = new Map();
  for (const [k, e] of out) {
    const gst = round2((e.amount * gstPercent) / 100);
    result.set(k, { billingType: [...e.billingType].join(' + '), packageNames: e.packages, packageAmount: e.amount, gstAmount: gst, totalAmount: round2(e.amount + gst) });
  }
  // No active retainer: what the client was billed one-time (sent invoices)
  for (const row of oneTime) {
    const k = String(row._id);
    if (result.has(k)) continue;
    result.set(k, { billingType: 'One Time', packageNames: [], packageAmount: round2(row.subtotal), gstAmount: round2(row.tax), totalAmount: round2(row.total) });
  }
  return result;
}

/**
 * Register rows for portfolio rows (services/portfolio.js buildPortfolio().rows).
 * Rows without `finance` (no invoice access) get no money figures.
 * @param {object[]} rows
 * @param {number} fy  financial year by its starting year
 */
async function buildRegister(rows, fy, now = new Date()) {
  const ids = rows.map((r) => r._id);
  const gstPercent = Number((await getBilling()).gstPercent) || 0;
  const [received, packages] = await Promise.all([receivedByMonth(ids), packagesByClient(ids, gstPercent)]);
  const months = fyMonths(fy);
  const lastMonth = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));

  const out = rows.map((r) => {
    const k = String(r._id);
    const pkg = packages.get(k) || { billingType: null, packageNames: [], packageAmount: null, gstAmount: null, totalAmount: null };
    const base = {
      _id: r._id,
      clientId: r.clientId,
      businessName: r.businessName,
      party: r.contactName,
      email: r.email,
      phone: r.phone,
      domains: r.profile?.domains || [],
      onboardingDate: r.profile?.onboardingDate || null,
      accountManagerName: r.accountManagerName,
      stage: r.stage,
      stageReason: r.stageReason,
      state: r.state, // login: active / hold / inactive (suspended) / archived
      // Client status (client decision, Oct 2026): In-Active = offboarded by staff
      serviceStatus: r.offboardedAt ? 'In-Active' : r.state === 'hold' ? 'On hold' : 'Active',
      offboardedAt: r.offboardedAt || null,
      offboardReason: r.offboardReason,
      offboardSource: r.offboardSource,
      billingType: pkg.billingType,
      packageNames: pkg.packageNames,
    };
    if (!r.finance) return base;
    const byMonth = received.get(k) || new Map();
    const monthly = months.map((m) => byMonth.get(m.key) || 0);
    return {
      ...base,
      packageAmount: pkg.packageAmount,
      gstAmount: pkg.gstAmount,
      totalAmount: pkg.totalAmount,
      received: r.finance.received,
      balance: r.finance.outstanding,
      overdueAmount: r.finance.overdueAmount,
      months: monthly,
      fyTotal: round2(monthly.reduce((s, v) => s + v, 0)),
      lastMonth: byMonth.get(lastMonth) || 0,
    };
  });

  // Column totals (money rows only)
  const money = out.filter((r) => r.months);
  const sum = (key) => round2(money.reduce((s, r) => s + (r[key] || 0), 0));
  const totals = money.length ? {
    packageAmount: sum('packageAmount'),
    gstAmount: sum('gstAmount'),
    totalAmount: sum('totalAmount'),
    received: sum('received'),
    balance: sum('balance'),
    months: months.map((_, i) => round2(money.reduce((s, r) => s + r.months[i], 0))),
    fyTotal: sum('fyTotal'),
    lastMonth: sum('lastMonth'),
  } : null;

  return {
    fy, fyLabel: `FY ${fy}-${String(fy + 1).slice(-2)}`, months, gstPercent,
    lastMonthLabel: (() => { const d = new Date(now.getFullYear(), now.getMonth() - 1, 1); return `${MONTH_NAMES[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`; })(),
    rows: out, totals,
  };
}

module.exports = { buildRegister, receivedByMonth, packagesByClient, fyMonths, fyOf };
