// The work timer: start → (pause ↔ resume) → stop, each running segment
// becoming one WorkLog. A session never spills past the end of the day it
// started on and never exceeds 12 hours — a timer left running overnight is
// capped and labelled instead of logging 15+ hours.
//
// Writes go through atomic, condition-guarded updates on Employee.activeTimer
// rather than employee.save(): saving re-validates the whole employee record
// (legacy records missing required fields made Start fail with a bare 500),
// and the startTime condition stops two tabs from logging the same segment
// twice or starting overlapping timers.
const mongoose = require('mongoose');
const Employee = require('../models/Employee');
const WorkLog = require('../models/WorkLog');
const { findActivityType } = require('./activityMaster');

const MAX_SESSION_MINUTES = 12 * 60;
const EMPTY_TIMER = { project: null, task: null, taskId: null, activityType: null, startTime: null, pausedAt: null };

const ok = (data = {}) => ({ ok: true, ...data });
const fail = (status, message) => ({ ok: false, status, message });

function sessionBounds(startTime, now = new Date()) {
  const start = new Date(startTime);
  const endOfStartDay = new Date(start);
  endOfStartDay.setHours(23, 59, 59, 999);
  let end = now < endOfStartDay ? now : endOfStartDay;
  let capped = end !== now;
  let duration = Math.max(0, Math.floor((end - start) / 60000));
  if (duration > MAX_SESSION_MINUTES) {
    duration = MAX_SESSION_MINUTES;
    end = new Date(start.getTime() + MAX_SESSION_MINUTES * 60000);
    capped = true;
  }
  return { start, end, duration, capped };
}

/** WorkLog fields for the running segment; Productive/Billable default from the activity master. */
async function buildWorkLog(employeeId, timer, fields = {}, now = new Date()) {
  const { start, end, duration, capped } = sessionBounds(timer.startTime, now);
  const master = await findActivityType(timer.activityType);
  const flag = (value, fallback) => (typeof value === 'boolean' ? value : Boolean(fallback));
  const note = capped ? 'Timer was left running — session capped automatically.' : '';
  return {
    capped,
    doc: {
      employeeId,
      date: start, // the session belongs to the day it started
      startTime: start,
      endTime: end,
      duration,
      project: timer.project,
      task: timer.task,
      taskId: timer.taskId || undefined,
      activityType: timer.activityType,
      isProductive: flag(fields.isProductive, master?.productive),
      isBillable: flag(fields.isBillable, master?.billable),
      remarks: [fields.remarks, note].filter(Boolean).join(' '),
      meetingWith: fields.meetingWith,
      clientName: fields.clientName,
      teamMemberName: fields.teamMemberName,
    },
  };
}

/**
 * Logs and clears the timer on an already-loaded employee document — used by
 * clock-out and the nightly missed-clock-out guard, which save the employee
 * themselves. Returns { workLog, capped }; workLog is null for a paused timer.
 */
async function closeActiveTimer(employee, fields = {}, now = new Date()) {
  const timer = employee.activeTimer;
  let workLog = null;
  let capped = false;
  if (timer?.startTime) {
    const built = await buildWorkLog(employee._id, timer, fields, now);
    workLog = await WorkLog.create(built.doc);
    capped = built.capped;
  }
  employee.activeTimer = EMPTY_TIMER;
  employee.markModified('activeTimer');
  return { workLog, capped };
}

const hasTimer = (timer) => Boolean(timer?.startTime || timer?.pausedAt);

function todayRange(now = new Date()) {
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const end = new Date(now); end.setHours(23, 59, 59, 999);
  return { start, end };
}

/** Employee with just the timer, open tasks and today's attendance entry. */
function loadForTimer(adminId) {
  const { start, end } = todayRange();
  return Employee.findOne(
    { adminId },
    { activeTimer: 1, tasks: 1, attendance: { $elemMatch: { date: { $gte: start, $lte: end } } } }
  ).lean();
}

function attendanceBlocker(employee) {
  const today = employee.attendance?.[0];
  if (!today?.clockIn) return 'Please clock in before starting the work timer.';
  if (today.clockOut) return "You've already clocked out for today.";
  return null;
}

async function getTimer(adminId) {
  const employee = await Employee.findOne({ adminId }, { activeTimer: 1 }).lean();
  if (!employee) return fail(404, 'Employee not found');
  return ok({ activeTimer: hasTimer(employee.activeTimer) ? employee.activeTimer : null });
}

async function startTimer(adminId, input = {}) {
  const project = String(input.project || '').trim();
  const task = String(input.task || '').trim();
  const activityType = String(input.activityType || '').trim();

  const missing = [!project && 'Project', !task && 'Task', !activityType && 'Activity Type'].filter(Boolean);
  if (missing.length) return fail(400, `Please enter ${missing.join(', ')} to start the timer.`);
  if (!(await findActivityType(activityType))) return fail(400, `"${activityType}" is not a valid activity type.`);

  const employee = await loadForTimer(adminId);
  if (!employee) return fail(404, 'Employee not found');
  if (employee.activeTimer?.startTime) return fail(409, 'A timer is already running. Pause or stop it before starting another.');
  const blocker = attendanceBlocker(employee);
  if (blocker) return fail(400, blocker);

  let taskId = null;
  if (input.taskId) {
    const assigned = mongoose.Types.ObjectId.isValid(input.taskId)
      && employee.tasks?.find((t) => String(t._id) === String(input.taskId));
    if (!assigned) return fail(400, 'That task is not assigned to you.');
    if (['Completed', 'Cancelled'].includes(assigned.status)) return fail(400, `That task is already ${assigned.status.toLowerCase()}.`);
    taskId = assigned._id;
  }

  const activeTimer = { project, task, taskId, activityType, startTime: new Date(), pausedAt: null };
  const result = await Employee.updateOne(
    { _id: employee._id, 'activeTimer.startTime': null },
    { $set: { activeTimer } }
  );
  if (!result.modifiedCount) return fail(409, 'A timer is already running. Pause or stop it before starting another.');
  return ok({ activeTimer, employeeId: employee._id });
}

async function pauseTimer(adminId) {
  const employee = await Employee.findOne({ adminId }, { activeTimer: 1 }).lean();
  if (!employee) return fail(404, 'Employee not found');
  const timer = employee.activeTimer;
  if (!timer?.startTime) return fail(400, 'There is no running timer to pause.');

  const now = new Date();
  const { doc } = await buildWorkLog(employee._id, timer, {}, now);
  const workLog = await WorkLog.create(doc);
  const result = await Employee.updateOne(
    { _id: employee._id, 'activeTimer.startTime': timer.startTime },
    { $set: { 'activeTimer.startTime': null, 'activeTimer.pausedAt': now } }
  );
  if (!result.modifiedCount) {
    await WorkLog.deleteOne({ _id: workLog._id }); // lost the race — the other request logged it
    return fail(409, 'The timer was changed from another window. Refresh and try again.');
  }
  return ok({ workLog, activeTimer: { ...timer, startTime: null, pausedAt: now } });
}

async function resumeTimer(adminId) {
  const employee = await loadForTimer(adminId);
  if (!employee) return fail(404, 'Employee not found');
  const timer = employee.activeTimer;
  if (!timer?.pausedAt) return fail(400, 'There is no paused timer to resume.');
  const blocker = attendanceBlocker(employee);
  if (blocker) return fail(400, blocker);

  const startTime = new Date();
  const result = await Employee.updateOne(
    { _id: employee._id, 'activeTimer.pausedAt': timer.pausedAt, 'activeTimer.startTime': null },
    { $set: { 'activeTimer.startTime': startTime, 'activeTimer.pausedAt': null } }
  );
  if (!result.modifiedCount) return fail(409, 'The timer was changed from another window. Refresh and try again.');
  return ok({ activeTimer: { ...timer, startTime, pausedAt: null } });
}

/** Logs the running segment (if any) and clears the timer. */
async function stopTimer(adminId, fields = {}) {
  const employee = await Employee.findOne({ adminId }, { activeTimer: 1 }).lean();
  if (!employee) return fail(404, 'Employee not found');
  const timer = employee.activeTimer;
  if (!hasTimer(timer)) return fail(400, 'No active timer found.');

  let workLog = null;
  let capped = false;
  if (timer.startTime) {
    const built = await buildWorkLog(employee._id, timer, fields);
    workLog = await WorkLog.create(built.doc);
    capped = built.capped;
  }
  const result = await Employee.updateOne(
    { _id: employee._id, 'activeTimer.startTime': timer.startTime || null, 'activeTimer.pausedAt': timer.pausedAt || null },
    { $set: { activeTimer: EMPTY_TIMER } }
  );
  if (!result.modifiedCount) {
    if (workLog) await WorkLog.deleteOne({ _id: workLog._id });
    return fail(409, 'The timer was changed from another window. Refresh and try again.');
  }
  return ok({ workLog, capped, timer });
}

module.exports = {
  closeActiveTimer, sessionBounds, getTimer, startTimer, pauseTimer, resumeTimer, stopTimer, hasTimer,
  MAX_SESSION_MINUTES,
};
