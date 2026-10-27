// Leave rules shared by the Employee Portal (apply/cancel), HR approval, the
// Attendance Register and payroll, so a leave is always counted the same way.
//
// Chargeable days: every date in the range except Sundays and company holidays.
//
// Allowance (Settings → Attendance Rules, key attendance_rules — all set by the admin):
//   leaveYearStartMonth  1–12, when the leave year begins (1 = January, 4 = April)
//   leaveBalancePeriod   'Month' | 'Year' for CL / SL / PL
//                          Month → defaultLeaves[type] is earned every month and carries
//                                  forward until the leave year ends (CL 1 → 6 by the 6th month)
//                          Year  → defaultLeaves[type] is the whole year's allowance
//   defaultLeaves        { CL, SL, PL } amounts for that period
//   elPolicy             { mode: 'Month' | 'Fixed', amount } — Emergency Leave during probation:
//                          Month → amount per month of probation, carried forward
//                          Fixed → amount for the whole probation
//   Employee.leaveOverrides[type] replaces the company amount for one person (same period).
//
// Used = paid days of APPROVED requests in the same leave year (EL: in the probation).
// Pending requests hold their paid days until decided. Days beyond the balance can still
// be requested: they are unpaid (LeaveRequest.unpaidDays) and payroll counts them as LOP.
const Holiday = require('../models/Holiday');
const LeaveRequest = require('../models/LeaveRequest');
const Settings = require('../models/Settings');

const LEAVE_TYPES = ['CL', 'SL', 'PL', 'EL'];
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const monthIndex = (d) => d.getFullYear() * 12 + d.getMonth();

async function chargeableDates(startDate, endDate) {
  const start = startOfDay(startDate);
  const end = startOfDay(endDate);
  if (start > end) return [];
  const holidays = await Holiday.find({ date: { $gte: start, $lte: new Date(end.getTime() + 86399999) } }).select('date').lean();
  const holidaySet = new Set(holidays.map((h) => new Date(h.date).toDateString()));
  const dates = [];
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (d.getDay() !== 0 && !holidaySet.has(d.toDateString())) dates.push(new Date(d)); // Sunday is the weekly off
  }
  return dates;
}

async function countChargeableDays(startDate, endDate) {
  return (await chargeableDates(startDate, endDate)).length;
}

/** The admin's leave settings, with defaults for anything not set yet. */
async function getLeaveRules() {
  const [att, probation] = await Promise.all([
    Settings.findOne({ key: 'attendance_rules' }).lean(),
    Settings.findOne({ key: 'probation_policy' }).lean(),
  ]);
  const v = att?.value || {};
  const startMonth = Number(v.leaveYearStartMonth);
  const el = v.elPolicy || {};
  return {
    yearStartMonth: startMonth >= 1 && startMonth <= 12 ? startMonth : 1,
    period: v.leaveBalancePeriod === 'Month' ? 'Month' : 'Year',
    amounts: { CL: 6, SL: 6, PL: 12, ...(v.defaultLeaves || {}) },
    el: {
      mode: el.mode === 'Fixed' ? 'Fixed' : 'Month',
      // Before elPolicy existed, EL came from the probation policy's "leaves per month"
      amount: Number(el.amount ?? probation?.value?.leavesPerMonth ?? 1) || 0,
    },
  };
}

/** { start, end } of the leave year that contains `date` (end exclusive). */
function leaveYear(date, yearStartMonth = 1) {
  const d = new Date(date);
  const m = yearStartMonth - 1;
  const year = d.getMonth() >= m ? d.getFullYear() : d.getFullYear() - 1;
  return { start: new Date(year, m, 1), end: new Date(year + 1, m, 1) };
}

/** Months from `from`'s month to `to`'s month, both included (0 when `to` is earlier). */
const monthsIncluded = (from, to) => Math.max(0, monthIndex(to) - monthIndex(from) + 1);

/**
 * How much of `type` the employee has earned by `asOf` in that leave year (EL: in the probation),
 * and the window that usage is counted in. Pure: no database access.
 */
function allowanceFor(employee, type, rules, asOf = new Date()) {
  const override = employee.leaveOverrides?.[type];
  const at = startOfDay(asOf);
  if (type === 'EL') {
    const amount = override ?? rules.el.amount;
    const from = startOfDay(employee.probation?.startDate || employee.joinDate || at);
    const to = employee.probation?.endDate ? startOfDay(employee.probation.endDate) : null;
    const until = to && to < at ? to : at;
    const allowance = rules.el.mode === 'Fixed' ? amount : amount * monthsIncluded(from, until);
    return { allowance: at < from ? 0 : allowance, period: rules.el.mode === 'Fixed' ? 'Probation' : 'Month', perPeriod: amount, window: { start: from, end: null } };
  }
  const amount = override ?? (Number(rules.amounts[type]) || 0);
  const year = leaveYear(at, rules.yearStartMonth);
  // Earning starts at the later of the leave-year start and when the person became eligible
  // (confirmation after probation, else the joining date)
  const eligible = employee.probation?.isApplicable && employee.probation?.confirmedAt
    ? startOfDay(employee.probation.confirmedAt)
    : employee.joinDate ? startOfDay(employee.joinDate) : year.start;
  const from = eligible > year.start ? eligible : year.start;
  const allowance = rules.period === 'Month' ? amount * monthsIncluded(from, at) : (at < from ? 0 : amount);
  return { allowance, period: rules.period, perPeriod: amount, window: year };
}

/** Days a request takes from the balance (paid part); older requests have no split stored. */
async function paidDaysOf(r) {
  if (typeof r.paidDays === 'number') return r.paidDays;
  if (typeof r.days === 'number') return r.days;
  return countChargeableDays(r.startDate, r.endDate);
}

/**
 * Balance of one leave type, as of `asOf` (default today; a request uses its own start date,
 * so a June leave counts what will have been earned by June).
 * @returns {{ allowance, used, pendingDays, available, period, perPeriod, yearStart, yearEnd }}
 */
async function availableDays(employee, leaveType, { excludeRequestId, asOf = new Date(), rules } = {}) {
  const r = rules || await getLeaveRules();
  const { allowance, period, perPeriod, window } = allowanceFor(employee, leaveType, r, asOf);
  const requests = await LeaveRequest.find({
    employeeId: employee._id,
    leaveType,
    status: { $in: ['Approved', 'Pending'] },
    startDate: { $gte: window.start, ...(window.end && { $lt: window.end }) },
    ...(excludeRequestId && { _id: { $ne: excludeRequestId } }),
  }).select('startDate endDate status days paidDays').lean();
  let used = 0;
  let pendingDays = 0;
  for (const q of requests) {
    const n = await paidDaysOf(q);
    if (q.status === 'Approved') used += n; else pendingDays += n;
  }
  return {
    allowance, used, pendingDays,
    available: Math.max(0, allowance - used - pendingDays),
    period, perPeriod, yearStart: window.start, yearEnd: window.end,
  };
}

/** Every type's balance for one employee, as of today. */
async function leaveSummary(employee, { asOf = new Date() } = {}) {
  const rules = await getLeaveRules();
  const out = {};
  for (const type of LEAVE_TYPES) out[type] = await availableDays(employee, type, { asOf, rules });
  return out;
}

/** How a request of `days` splits against the balance: paid up to what is available, the rest unpaid. */
async function splitRequest(employee, leaveType, startDate, days, { excludeRequestId } = {}) {
  const balance = await availableDays(employee, leaveType, { excludeRequestId, asOf: startDate });
  const paidDays = Math.min(days, Math.floor(balance.available * 2) / 2);
  return { days, paidDays, unpaidDays: days - paidDays, balance };
}

/**
 * Which dates of an approved request are unpaid: the last `unpaidDays` chargeable dates.
 * @returns {Promise<Set<string>>} Date.toDateString() keys
 */
async function unpaidDatesOf(request) {
  const unpaid = Number(request.unpaidDays) || 0;
  if (!unpaid) return new Set();
  const dates = await chargeableDates(request.startDate, request.endDate);
  return new Set(dates.slice(Math.max(0, dates.length - Math.ceil(unpaid))).map((d) => d.toDateString()));
}

// Any Pending/Approved request of this employee overlapping [start, end]
async function findOverlap(employeeId, startDate, endDate, { excludeRequestId } = {}) {
  return LeaveRequest.findOne({
    employeeId,
    status: { $in: ['Pending', 'Approved'] },
    startDate: { $lte: startOfDay(endDate) },
    endDate: { $gte: startOfDay(startDate) },
    ...(excludeRequestId && { _id: { $ne: excludeRequestId } }),
  }).lean();
}

module.exports = {
  LEAVE_TYPES, countChargeableDays, chargeableDates, availableDays, leaveSummary, splitRequest, unpaidDatesOf,
  findOverlap, startOfDay, getLeaveRules, leaveYear, allowanceFor,
};
