// Leave rules shared by the Employee Portal (apply/cancel) and HR approval,
// so the number of days an employee is charged is always computed the same
// way: every date in the range except Sundays and company holidays.
const Holiday = require('../models/Holiday');
const LeaveRequest = require('../models/LeaveRequest');

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

async function countChargeableDays(startDate, endDate) {
  const start = startOfDay(startDate);
  const end = startOfDay(endDate);
  if (start > end) return 0;
  const holidays = await Holiday.find({ date: { $gte: start, $lte: new Date(end.getTime() + 86399999) } }).select('date').lean();
  const holidaySet = new Set(holidays.map((h) => new Date(h.date).toDateString()));
  let days = 0;
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (d.getDay() !== 0 && !holidaySet.has(d.toDateString())) days++; // Sunday is the weekly off
  }
  return days;
}

/**
 * Days still available for a leave type = allowance − already used − days
 * held by other PENDING requests of the same type (so several pending
 * requests can never add up to more than the balance).
 */
async function availableDays(employee, leaveType, { excludeRequestId } = {}) {
  const allowance = Number(employee.leaveBalances?.[leaveType]) || 0;
  const used = Number(employee.leavesUsed?.[leaveType]) || 0;
  const pending = await LeaveRequest.find({
    employeeId: employee._id,
    leaveType,
    status: 'Pending',
    ...(excludeRequestId && { _id: { $ne: excludeRequestId } }),
  }).select('startDate endDate').lean();
  let pendingDays = 0;
  for (const r of pending) pendingDays += await countChargeableDays(r.startDate, r.endDate);
  return { allowance, used, pendingDays, available: Math.max(0, allowance - used - pendingDays) };
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

module.exports = { countChargeableDays, availableDays, findOverlap, startOfDay };
