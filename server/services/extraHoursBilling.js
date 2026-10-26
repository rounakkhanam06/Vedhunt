// Billing a retainer's extra hours (hours worked beyond the plan) when the Super
// Admin policy says "bill". Nothing is invoiced automatically: staff preview a
// finished month and click to create the invoice. One invoice per retainer per
// month — a second attempt is refused by a unique index, not just a check.
const Invoice = require('../models/Invoice');
const Retainer = require('../models/Retainer');
const { monthlyHistory } = require('./retainerUsage');
const { getExtraHours, extraCharge } = require('./clientPolicies');

const DAY_MS = 24 * 60 * 60 * 1000;
const monthKeyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const fail = (status, message) => ({ ok: false, status, message });

/** The charge for one finished month, or why there is none. */
async function previewMonth(retainer, month, now = new Date()) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month))) return fail(400, 'Choose a month as YYYY-MM.');
  if (month >= monthKeyOf(now)) return fail(400, 'Only finished months can be billed — wait until the month is over.');
  const policy = await getExtraHours();
  if (policy.mode !== 'bill') return fail(409, 'Extra hours are not billed. A Super Admin can turn billing on in Settings.');

  const history = await monthlyHistory(retainer, 18, now);
  const m = history.find((h) => h.key === month);
  if (!m) return fail(400, 'That month is too far back to bill from here.');
  if (!m.inContract) return fail(400, 'The retainer was not in force that month.');

  const charge = extraCharge(m.extra, policy);
  const existing = await Invoice.findOne({ 'extraHours.retainer_ref': retainer._id, 'extraHours.month': month }).select('invoiceId').lean();
  return {
    ok: true, month, label: m.label, included: m.included, used: m.used, extraHours: m.extra,
    policy: { ratePerHour: policy.ratePerHour, freeHours: policy.freeHours, roundTo: policy.roundTo, gstPercent: policy.gstPercent },
    ...charge, alreadyInvoiced: existing?.invoiceId || null,
  };
}

async function createInvoice(retainerId, month, now = new Date()) {
  const retainer = await Retainer.findById(retainerId).lean();
  if (!retainer) return fail(404, 'Retainer not found');
  const p = await previewMonth(retainer, month, now);
  if (!p.ok) return p;
  if (p.alreadyInvoiced) return fail(409, `Extra hours for ${p.label} were already invoiced (${p.alreadyInvoiced}).`);
  if (p.amount <= 0) return fail(400, `Nothing to bill for ${p.label}: ${p.extraHours}h extra is within the ${p.policy.freeHours}h free allowance.`);

  try {
    const invoice = await Invoice.create({
      client_ref: retainer.client_ref,
      issueDate: now,
      dueDate: new Date(now.getTime() + 7 * DAY_MS),
      lineItems: [{
        description: `Extra hours — ${retainer.packageName}, ${p.label} (${p.billableHours}h at ₹${p.policy.ratePerHour}/h)`,
        qty: 1, unitPrice: p.amount, amount: p.amount,
      }],
      subtotal: p.amount, taxPercent: p.policy.gstPercent, taxAmount: p.gst, totalAmount: p.total,
      extraHours: { retainer_ref: retainer._id, month, hours: p.billableHours },
    });
    return { ok: true, invoice, preview: p };
  } catch (err) {
    if (err.code === 11000) return fail(409, `Extra hours for ${p.label} were already invoiced.`);
    throw err;
  }
}

module.exports = { previewMonth, createInvoice };
