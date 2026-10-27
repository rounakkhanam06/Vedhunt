// Approving / rejecting a leave request — shared by HR (Admin panel) and the
// employee's reporting manager (Employee Portal → Team Approvals).
const LeaveRequest = require('../models/LeaveRequest');
const Employee = require('../models/Employee');
const Holiday = require('../models/Holiday');
const { countChargeableDays, splitRequest } = require('./leavePolicy');
const { notifyStaff } = require('./staffNotify');

const ok = (data = {}) => ({ ok: true, ...data });
const fail = (status, message, extra = {}) => ({ ok: false, status, message, ...extra });

/** Marks each day of an approved leave on the attendance log and counts chargeable days as used. */
async function applyApprovedLeave(leaveRequest) {
  const employee = await Employee.findById(leaveRequest.employeeId);
  if (!employee) return;
  const start = new Date(leaveRequest.startDate); start.setHours(0, 0, 0, 0);
  const end = new Date(leaveRequest.endDate); end.setHours(0, 0, 0, 0);
  const holidays = await Holiday.find({ date: { $gte: start, $lte: end } });
  const holidayDates = holidays.map((h) => new Date(h.date).toDateString());
  const type = leaveRequest.leaveType || 'PL';

  for (const day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) {
    const isWeekend = day.getDay() === 0; // Sunday is the weekly off
    const isHoliday = holidayDates.includes(day.toDateString());
    const status = isWeekend ? 'Weekend' : isHoliday ? 'Holiday' : 'Leave';
    const existing = employee.attendance.find((a) => new Date(a.date).toDateString() === day.toDateString());
    if (existing) existing.status = status;
    else employee.attendance.push({ date: new Date(day), status });
    if (!isWeekend && !isHoliday) {
      if (!employee.leavesUsed) employee.leavesUsed = { CL: 0, SL: 0, PL: 0 };
      employee.leavesUsed[type] = (employee.leavesUsed[type] || 0) + 1;
    }
  }
  await employee.save({ validateModifiedOnly: true });
}

/**
 * @param {string} id LeaveRequest id
 * @param {'Approved'|'Rejected'} status
 * @param {string} comment shown to the employee
 * @param {object} [opts]
 * @param {string} [opts.reviewerLabel] "HR" or "Your manager", used in the notification
 */
async function reviewLeaveRequest(id, status, comment, { reviewerLabel = 'HR', reviewerId } = {}) {
  if (!['Approved', 'Rejected'].includes(status)) return fail(400, 'Invalid status');
  const leaveRequest = await LeaveRequest.findById(id);
  if (!leaveRequest) return fail(404, 'Leave request not found');
  // Only pending requests, to avoid double-processing
  if (leaveRequest.status !== 'Pending') return fail(400, 'Only pending requests can be approved or rejected.');

  const requester = await Employee.findById(leaveRequest.employeeId).select('adminId leaveOverrides joinDate probation employmentStatus firstName');
  // The balance may have changed since the request was made (policy edited, another leave approved),
  // so the paid / unpaid split is worked out again now; days beyond the balance are unpaid (LOP).
  let split = null;
  if (status === 'Approved' && requester) {
    const days = await countChargeableDays(leaveRequest.startDate, leaveRequest.endDate);
    split = await splitRequest(requester, leaveRequest.leaveType || 'PL', leaveRequest.startDate, days, { excludeRequestId: leaveRequest._id });
  }

  // Claim the request atomically so HR and the manager can't both process it.
  const claimed = await LeaveRequest.findOneAndUpdate(
    { _id: leaveRequest._id, status: 'Pending' },
    { $set: {
      status,
      ...(split ? { days: split.days, paidDays: split.paidDays, unpaidDays: split.unpaidDays } : {}),
      ...(comment ? { adminComment: comment } : {}),
      ...(reviewerId ? { reviewedBy: reviewerId, reviewedAt: new Date() } : {}),
    } },
    { returnDocument: 'after' }
  );
  if (!claimed) return fail(409, 'This request has already been processed.');
  if (status === 'Approved') await applyApprovedLeave(claimed);

  if (requester?.adminId) {
    const range = [claimed.startDate, claimed.endDate]
      .map((d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })).join(' – ');
    await notifyStaff(requester.adminId, {
      type: 'leave_decision',
      title: `Leave ${status.toLowerCase()}: ${claimed.leaveType} ${range}`,
      message: [
        split?.unpaidDays ? `${split.paidDays} paid, ${split.unpaidDays} unpaid (beyond your balance).` : '',
        comment ? `${reviewerLabel} note: ${String(comment).slice(0, 200)}` : `Your leave request was ${status.toLowerCase()}.`,
      ].filter(Boolean).join(' '),
      link: '/employee/dashboard?tab=attendance',
    });
  }
  return ok({
    leaveRequest: claimed,
    message: `Leave request ${status.toLowerCase()} successfully${split?.unpaidDays ? ` — ${split.paidDays} paid, ${split.unpaidDays} unpaid (LOP)` : ''}`,
  });
}

module.exports = { reviewLeaveRequest };
