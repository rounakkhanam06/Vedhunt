// Attendance regularization + timesheet correction requests. Employees only
// ever *request* a change; it's applied on a manager's approval, with the
// original record kept on the request and the decision in the audit log.
const mongoose = require('mongoose');
const Employee = require('../models/Employee');
const WorkLog = require('../models/WorkLog');
const Settings = require('../models/Settings');
const AuditLog = require('../models/AuditLog');
const CorrectionRequest = require('../models/CorrectionRequest');
const { findActivityType } = require('./activityMaster');
const { MAX_SESSION_MINUTES } = require('./workTimer');
const { notifyStaff } = require('./staffNotify');
const { notifyApprover } = require('./approvalRouting');
const { formatHHmm, parseClock, lateByMinutes } = require('../utils/clockTime');
const logger = require('../utils/logger');

const MAX_BACKDATE_DAYS = 30; // same window as backdated leave
const REVIEW_LINK = '/admin/corrections';

const ok = (data = {}) => ({ ok: true, ...data });
const fail = (status, message) => ({ ok: false, status, message });

function dayRange(date) {
  const start = new Date(date); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setHours(23, 59, 59, 999);
  return { start, end };
}
const fmtDay = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const fmtTime = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

/** Shared date window: not older than MAX_BACKDATE_DAYS, never in the future unless policy allows. */
async function checkDateWindow(day, { allowFutureKey } = {}) {
  const today = dayRange(new Date()).start;
  if (day > today) {
    const rules = allowFutureKey ? (await Settings.findOne({ key: 'attendance_rules' }).lean())?.value : null;
    if (!rules?.[allowFutureKey]) return 'Corrections cannot be requested for a future date.';
  }
  if (day < new Date(today.getTime() - MAX_BACKDATE_DAYS * 86400000)) {
    return `Corrections can only be requested for the last ${MAX_BACKDATE_DAYS} days.`;
  }
  return null;
}

function cleanReason(reason) {
  const text = String(reason || '').trim();
  if (!text) return { error: 'Please give a reason for this request.' };
  if (text.length > 500) return { error: 'Reason is too long (max 500 characters).' };
  return { text };
}

async function loadRequester(adminId, projection = {}) {
  return Employee.findOne({ adminId }, { firstName: 1, lastName: 1, employeeId: 1, adminId: 1, reportingManager: 1, ...projection }).lean();
}

// Reporting manager first, HR as fallback (services/approvalRouting.js).
const notifyReviewers = (employee, title, message) =>
  notifyApprover(employee, { type: 'correction_request', title, message }, REVIEW_LINK);

// ── Attendance ───────────────────────────────────────────────────────────

async function createAttendanceRequest(user, body, proofUrl) {
  const date = new Date(`${String(body.date || '').slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return fail(400, 'Please choose a valid date.');
  const { start, end } = dayRange(date);
  const windowError = await checkDateWindow(start, { allowFutureKey: 'allowFutureRegularization' });
  if (windowError) return fail(400, windowError);

  const clockIn = formatHHmm(body.clockIn);
  const clockOut = formatHHmm(body.clockOut);
  if (!clockIn || !clockOut) return fail(400, 'Please enter both the check-in and check-out time.');
  if (parseClock(clockOut) <= parseClock(clockIn)) return fail(400, 'Check-out must be after check-in.');
  const { text: reason, error } = cleanReason(body.reason);
  if (error) return fail(400, error);

  const employee = await loadRequester(user._id, { attendance: { $elemMatch: { date: { $gte: start, $lte: end } } } });
  if (!employee) return fail(404, 'Employee not found');
  const existing = employee.attendance?.[0];
  if (existing?.status === 'Leave') return fail(400, 'You are on approved leave that day — cancel the leave instead.');
  if (await CorrectionRequest.exists({ employee: employee._id, kind: 'Attendance', date: start, status: 'Pending' })) {
    return fail(409, 'You already have a pending attendance request for this date.');
  }

  const type = !existing ? 'Backdated' : existing.clockIn && !existing.clockOut ? 'MissedClockOut' : 'Correction';
  const request = await CorrectionRequest.create({
    employee: employee._id,
    requestedBy: user._id,
    kind: 'Attendance',
    type,
    date: start,
    requested: { clockIn, clockOut },
    original: existing
      ? { status: existing.status, clockIn: existing.clockIn || '', clockOut: existing.clockOut || '', lateByMins: existing.lateByMins || 0, missedClockOut: Boolean(existing.missedClockOut) }
      : null,
    reason,
    proofUrl,
  });

  await notifyReviewers(employee,
    `Attendance regularization from ${employee.firstName} ${employee.lastName}`,
    `${fmtDay(start)} · ${clockIn} – ${clockOut} · ${reason.slice(0, 80)}`);
  return ok({ request });
}

async function applyAttendance(request) {
  const { start, end } = dayRange(request.date);
  const employee = await Employee.findById(request.employee, { attendance: { $elemMatch: { date: { $gte: start, $lte: end } } } }).lean();
  if (!employee) return 'Employee no longer exists.';

  const officeTimings = (await Settings.findOne({ key: 'office_timings' }).lean())?.value;
  const clockInMinutes = parseClock(request.requested.clockIn);
  const fields = {
    status: 'Present',
    clockIn: request.requested.clockIn,
    clockOut: request.requested.clockOut,
    lateByMins: lateByMinutes(clockInMinutes, officeTimings?.standardStartTime),
    missedClockOut: false,
    regularized: true,
    regularizationRef: request._id,
  };

  const existing = employee.attendance?.[0];
  if (existing) {
    const set = Object.fromEntries(Object.entries(fields).map(([k, v]) => [`attendance.$.${k}`, v]));
    await Employee.updateOne({ _id: employee._id, 'attendance._id': existing._id }, { $set: set });
  } else {
    const date = new Date(start.getTime() + clockInMinutes * 60000);
    await Employee.updateOne({ _id: employee._id }, { $push: { attendance: { date, ...fields } } });
  }
  return null;
}

// ── Timesheet ────────────────────────────────────────────────────────────

async function findOverlap(employeeId, startTime, endTime, excludeId) {
  return WorkLog.findOne({
    employeeId,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    startTime: { $lt: endTime },
    endTime: { $gt: startTime },
  }, { startTime: 1, endTime: 1 }).lean();
}

async function createTimesheetRequest(user, body) {
  const startTime = new Date(body.startTime);
  const endTime = new Date(body.endTime);
  if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) return fail(400, 'Please enter a valid start and end time.');
  if (endTime <= startTime) return fail(400, 'End time must be after start time.');
  if (startTime.toDateString() !== endTime.toDateString()) return fail(400, 'A time entry must start and end on the same day.');
  if (endTime > new Date()) return fail(400, 'A time entry cannot end in the future.');
  if ((endTime - startTime) / 60000 > MAX_SESSION_MINUTES) return fail(400, 'A single time entry cannot be longer than 12 hours.');
  const { start } = dayRange(startTime);
  const windowError = await checkDateWindow(start);
  if (windowError) return fail(400, windowError);

  const project = String(body.project || '').trim();
  const task = String(body.task || '').trim();
  const activityType = String(body.activityType || '').trim();
  const missing = [!project && 'Project', !task && 'Task', !activityType && 'Activity Type'].filter(Boolean);
  if (missing.length) return fail(400, `Please enter ${missing.join(', ')}.`);
  const master = await findActivityType(activityType);
  if (!master) return fail(400, `"${activityType}" is not a valid activity type.`);
  const { text: reason, error } = cleanReason(body.reason);
  if (error) return fail(400, error);

  const employee = await loadRequester(user._id);
  if (!employee) return fail(404, 'Employee not found');

  let workLog = null;
  if (body.workLogId) {
    if (!mongoose.Types.ObjectId.isValid(body.workLogId)) return fail(400, 'Invalid time entry.');
    workLog = await WorkLog.findOne({ _id: body.workLogId, employeeId: employee._id }).lean();
    if (!workLog) return fail(404, 'Time entry not found.');
    if (await CorrectionRequest.exists({ workLog: workLog._id, status: 'Pending' })) {
      return fail(409, 'This time entry already has a pending correction.');
    }
  }

  const overlap = await findOverlap(employee._id, startTime, endTime, workLog?._id);
  if (overlap) return fail(400, `This overlaps another time entry (${fmtTime(overlap.startTime)} – ${fmtTime(overlap.endTime)}).`);

  const request = await CorrectionRequest.create({
    employee: employee._id,
    requestedBy: user._id,
    kind: 'Timesheet',
    type: workLog ? 'Correction' : 'TimeEntry',
    date: start,
    workLog: workLog?._id,
    requested: {
      startTime, endTime, project, task, activityType,
      isProductive: typeof body.isProductive === 'boolean' ? body.isProductive : master.productive,
    },
    original: workLog
      ? { startTime: workLog.startTime, endTime: workLog.endTime, duration: workLog.duration, project: workLog.project, task: workLog.task, activityType: workLog.activityType, isProductive: workLog.isProductive }
      : null,
    reason,
  });

  await notifyReviewers(employee,
    `Timesheet correction from ${employee.firstName} ${employee.lastName}`,
    `${fmtDay(start)} · ${fmtTime(startTime)} – ${fmtTime(endTime)} · ${reason.slice(0, 80)}`);
  return ok({ request });
}

async function applyTimesheet(request) {
  const r = request.requested;
  const overlap = await findOverlap(request.employee, r.startTime, r.endTime, request.workLog);
  if (overlap) return `It now overlaps another time entry (${fmtTime(overlap.startTime)} – ${fmtTime(overlap.endTime)}).`;

  const master = await findActivityType(r.activityType);
  const fields = {
    date: dayRange(r.startTime).start,
    startTime: r.startTime,
    endTime: r.endTime,
    duration: Math.round((new Date(r.endTime) - new Date(r.startTime)) / 60000),
    project: r.project,
    task: r.task,
    activityType: r.activityType,
    isProductive: Boolean(r.isProductive),
    corrected: true,
    correctionRef: request._id,
  };
  if (request.workLog) {
    const res = await WorkLog.updateOne({ _id: request.workLog, employeeId: request.employee }, { $set: fields });
    if (!res.matchedCount) return 'The original time entry no longer exists.';
  } else {
    await WorkLog.create({
      employeeId: request.employee,
      ...fields,
      isBillable: Boolean(master?.billable),
      remarks: `Added by approved correction: ${request.reason}`,
    });
  }
  return null;
}

// ── Shared ───────────────────────────────────────────────────────────────

async function listOwnRequests(adminId) {
  const employee = await Employee.findOne({ adminId }, { _id: 1 }).lean();
  if (!employee) return fail(404, 'Employee not found');
  const requests = await CorrectionRequest.find({ employee: employee._id })
    .sort({ createdAt: -1 }).limit(100)
    .populate('reviewedBy', 'firstName lastName')
    .lean();
  return ok({ requests });
}

async function cancelOwnRequest(adminId, id) {
  if (!mongoose.Types.ObjectId.isValid(id)) return fail(400, 'Invalid request ID');
  const employee = await Employee.findOne({ adminId }, { _id: 1 }).lean();
  if (!employee) return fail(404, 'Employee not found');
  const request = await CorrectionRequest.findOneAndUpdate(
    { _id: id, employee: employee._id, status: 'Pending' },
    { $set: { status: 'Cancelled' } },
    { returnDocument: 'after' }
  );
  if (!request) return fail(400, 'Only your own pending requests can be cancelled.');
  return ok({ request });
}

async function listForReview({ status, kind } = {}) {
  const filter = {};
  if (['Pending', 'Approved', 'Rejected', 'Cancelled'].includes(status)) filter.status = status;
  if (['Attendance', 'Timesheet'].includes(kind)) filter.kind = kind;
  return CorrectionRequest.find(filter)
    .sort({ status: 1, createdAt: -1 }).limit(300)
    .populate('employee', 'firstName lastName employeeId roleDept')
    .populate('reviewedBy', 'firstName lastName')
    .lean();
}

async function reviewRequest(reviewer, id, status, comment, ipAddress) {
  if (!['Approved', 'Rejected'].includes(status)) return fail(400, 'Status must be Approved or Rejected.');
  if (!mongoose.Types.ObjectId.isValid(id)) return fail(400, 'Invalid request ID');
  const reviewComment = String(comment || '').trim().slice(0, 500);
  if (status === 'Rejected' && !reviewComment) return fail(400, 'Please add a comment explaining the rejection.');

  // Claim the request first so two reviewers can't both apply it.
  const request = await CorrectionRequest.findOneAndUpdate(
    { _id: id, status: 'Pending' },
    { $set: { status, reviewedBy: reviewer._id, reviewComment, reviewedAt: new Date() } },
    { returnDocument: 'after' }
  );
  if (!request) return fail(409, 'This request has already been processed.');

  if (status === 'Approved') {
    const applyError = request.kind === 'Attendance' ? await applyAttendance(request) : await applyTimesheet(request);
    if (applyError) {
      await CorrectionRequest.updateOne({ _id: request._id }, { $set: { status: 'Pending' }, $unset: { reviewedBy: 1, reviewComment: 1, reviewedAt: 1 } });
      return fail(400, `Cannot approve: ${applyError}`);
    }
  }

  await AuditLog.create({
    adminId: reviewer._id,
    action: `CORRECTION_${status.toUpperCase()}`,
    resource: request.kind === 'Attendance' ? 'Attendance' : 'WorkLog',
    beforeSnapshot: request.original,
    afterSnapshot: { requestId: request._id, date: request.date, requested: request.requested, comment: reviewComment },
    ipAddress,
  }).catch((e) => logger.error('Audit log failed (correction review):', e.message));

  const employee = await Employee.findById(request.employee, { adminId: 1 }).lean();
  if (employee?.adminId) {
    await notifyStaff(employee.adminId, {
      type: 'correction_reviewed',
      title: `${request.kind} correction ${status.toLowerCase()}`,
      message: `${fmtDay(request.date)}${reviewComment ? ` · ${reviewComment}` : ''}`,
      link: `/employee/dashboard?tab=${request.kind === 'Attendance' ? 'attendance' : 'timesheet'}`,
    });
  }
  return ok({ request, message: `Request ${status.toLowerCase()}.` });
}

module.exports = {
  createAttendanceRequest, createTimesheetRequest, listOwnRequests, cancelOwnRequest, listForReview, reviewRequest,
};
