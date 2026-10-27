// Super-Admin-decided rules (Settings), so the business can change them without a deploy:
//   client_auto_hold      — when an unpaid client goes On hold automatically
//   retainer_extra_hours  — whether hours beyond a retainer's plan are billed, and how
const Settings = require('../models/Settings');

const AUTO_HOLD_KEY = 'client_auto_hold';
const EXTRA_KEY = 'retainer_extra_hours';
const BILLING_KEY = 'recurring_invoice_defaults';

const AUTO_HOLD_DEFAULTS = { enabled: false, daysOverdue: 15, minOverdueAmount: 0, autoRelease: true };
// In-Active (offboarded) automatically: a client already on hold that still owes money
// past `daysOverdue` and has not answered the last `unansweredCalls` calls logged since the hold.
// Never undone automatically — a Super Admin marks them Active again (client decision, Oct 2026).
const AUTO_OFFBOARD_KEY = 'client_auto_offboard';
const AUTO_OFFBOARD_DEFAULTS = { enabled: false, daysOverdue: 45, unansweredCalls: 3 };
const EXTRA_DEFAULTS = { mode: 'track_only', ratePerHour: 0, freeHours: 0, roundTo: 0.5, gstPercent: 18 };
const ROUNDING = [0.25, 0.5, 1];
// Recurring invoices: the client asked for 7 or 10 days to pay; the rest is per-client
const BILLING_DEFAULTS = { defaultDueDays: 7, gstPercent: 18 };

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

async function read(key, defaults) {
  const doc = await Settings.findOne({ key }).lean();
  return { ...defaults, ...(doc?.value || {}) };
}

/** @returns {{ value?: object, error?: string }} */
function validateAutoHold(input = {}) {
  const v = { ...AUTO_HOLD_DEFAULTS };
  v.enabled = !!input.enabled;
  v.autoRelease = input.autoRelease !== false;
  const days = Number(input.daysOverdue);
  if (!Number.isInteger(days) || days < 1 || days > 180) return { error: 'Days overdue must be a whole number from 1 to 180.' };
  v.daysOverdue = days;
  const min = Number(input.minOverdueAmount ?? 0);
  if (!Number.isFinite(min) || min < 0) return { error: 'Minimum overdue amount must be zero or more.' };
  v.minOverdueAmount = r2(min);
  return { value: v };
}

function validateAutoOffboard(input = {}) {
  const days = Number(input.daysOverdue);
  if (!Number.isInteger(days) || days < 1 || days > 365) return { error: 'Days overdue must be a whole number from 1 to 365.' };
  const calls = Number(input.unansweredCalls);
  if (!Number.isInteger(calls) || calls < 1 || calls > 20) return { error: 'Unanswered calls must be a whole number from 1 to 20.' };
  return { value: { enabled: !!input.enabled, daysOverdue: days, unansweredCalls: calls } };
}

function validateExtraHours(input = {}) {
  const v = { ...EXTRA_DEFAULTS };
  if (!['track_only', 'bill'].includes(input.mode)) return { error: 'Choose whether extra hours are only tracked or billed.' };
  v.mode = input.mode;
  const rate = Number(input.ratePerHour ?? 0);
  if (!Number.isFinite(rate) || rate < 0) return { error: 'Hourly rate must be zero or more.' };
  if (v.mode === 'bill' && rate <= 0) return { error: 'Set an hourly rate to bill extra hours.' };
  v.ratePerHour = r2(rate);
  const free = Number(input.freeHours ?? 0);
  if (!Number.isFinite(free) || free < 0 || free > 100) return { error: 'Free extra hours must be between 0 and 100.' };
  v.freeHours = r2(free);
  const round = Number(input.roundTo ?? 0.5);
  if (!ROUNDING.includes(round)) return { error: 'Round to 0.25, 0.5 or 1 hour.' };
  v.roundTo = round;
  const gst = Number(input.gstPercent ?? 18);
  if (!Number.isFinite(gst) || gst < 0 || gst > 28) return { error: 'GST must be between 0 and 28%.' };
  v.gstPercent = gst;
  return { value: v };
}

/**
 * What a month's extra hours cost under the policy. Free hours are taken off
 * first, then the rest is rounded UP to the step (0.5 → 1.2h bills as 1.5h).
 */
function extraCharge(extraHours, policy) {
  if (!policy || policy.mode !== 'bill' || !(extraHours > 0)) return { billableHours: 0, amount: 0, gst: 0, total: 0 };
  const over = Math.max(0, extraHours - (policy.freeHours || 0));
  const billableHours = over > 0 ? r2(Math.ceil(r2(over / policy.roundTo)) * policy.roundTo) : 0;
  const amount = r2(billableHours * policy.ratePerHour);
  const gst = r2((amount * (policy.gstPercent || 0)) / 100);
  return { billableHours, amount, gst, total: r2(amount + gst) };
}

function validateBilling(input = {}) {
  const days = Number(input.defaultDueDays);
  if (!Number.isInteger(days) || days < 1 || days > 30) return { error: 'Days to pay must be a whole number from 1 to 30.' };
  const gst = Number(input.gstPercent);
  if (!Number.isFinite(gst) || gst < 0 || gst > 28) return { error: 'GST must be between 0 and 28%.' };
  return { value: { defaultDueDays: days, gstPercent: gst } };
}

const getBilling = () => read(BILLING_KEY, BILLING_DEFAULTS);
const getAutoHold = () => read(AUTO_HOLD_KEY, AUTO_HOLD_DEFAULTS);
const getAutoOffboard = () => read(AUTO_OFFBOARD_KEY, AUTO_OFFBOARD_DEFAULTS);
const getExtraHours = () => read(EXTRA_KEY, EXTRA_DEFAULTS);

async function save(key, value) {
  await Settings.findOneAndUpdate({ key }, { $set: { value } }, { upsert: true });
  return value;
}

module.exports = {
  AUTO_HOLD_DEFAULTS, EXTRA_DEFAULTS, ROUNDING,
  BILLING_DEFAULTS, validateBilling, getBilling, saveBilling: (v) => save(BILLING_KEY, v),
  validateAutoHold, validateExtraHours, extraCharge, getAutoHold, getExtraHours,
  saveAutoHold: (v) => save(AUTO_HOLD_KEY, v), saveExtraHours: (v) => save(EXTRA_KEY, v),
  AUTO_OFFBOARD_DEFAULTS, validateAutoOffboard, getAutoOffboard, saveAutoOffboard: (v) => save(AUTO_OFFBOARD_KEY, v),
};
