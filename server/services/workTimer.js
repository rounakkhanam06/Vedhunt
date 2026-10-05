// Closing a work-timer session into a WorkLog — shared by "Stop timer" and
// clock-out (which stops a still-running timer). A session never spills past
// the end of the day it started on, and never exceeds 12 hours: a timer left
// running overnight is capped and labelled instead of logging 15+ hours.
const WorkLog = require('../models/WorkLog');

const MAX_SESSION_MINUTES = 12 * 60;

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

/**
 * Writes the WorkLog for employee.activeTimer and clears the timer
 * (caller saves the employee). Returns { workLog, capped }.
 */
async function closeActiveTimer(employee, fields = {}, now = new Date()) {
  const timer = employee.activeTimer;
  const { start, end, duration, capped } = sessionBounds(timer.startTime, now);
  const note = capped ? 'Timer was left running — session capped automatically.' : '';
  const workLog = await WorkLog.create({
    employeeId: employee._id,
    date: start, // the session belongs to the day it started
    startTime: start,
    endTime: end,
    duration,
    project: timer.project,
    task: timer.task,
    activityType: timer.activityType,
    isProductive: Boolean(fields.isProductive),
    isBillable: Boolean(fields.isBillable),
    remarks: [fields.remarks, note].filter(Boolean).join(' '),
    meetingWith: fields.meetingWith,
    clientName: fields.clientName,
    teamMemberName: fields.teamMemberName,
  });
  employee.activeTimer = { project: null, task: null, activityType: null, startTime: null };
  employee.markModified('activeTimer');
  return { workLog, capped };
}

module.exports = { closeActiveTimer, sessionBounds, MAX_SESSION_MINUTES };
