// Employee-side task workflow for Employee.tasks: status changes with an
// append-only history, comments, and actual effort from WorkLogs. Updates are
// atomic on the one task entry (positional $), so they never re-validate — or
// race — the rest of the employee record.
const mongoose = require('mongoose');
const Employee = require('../models/Employee');
const WorkLog = require('../models/WorkLog');
const { stopTimer } = require('./workTimer');
const { notifyStaff } = require('./staffNotify');

// What an employee may do; Cancelled and reopening stay manager-only.
const EMPLOYEE_TRANSITIONS = {
  Pending: ['In Progress', 'Blocked', 'Completed'],
  'In Progress': ['Blocked', 'Completed'],
  Blocked: ['In Progress', 'Completed'],
  Completed: [],
  Cancelled: [],
};
const STATUS_LABEL = { Pending: 'Not Started' };
const label = (status) => STATUS_LABEL[status] || status;

const ok = (data = {}) => ({ ok: true, ...data });
const fail = (status, message) => ({ ok: false, status, message });

const actorName = (user) => `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Employee';
const entry = (text, user) => ({ text, by: user._id, byName: actorName(user), at: new Date() });

/** Actual minutes logged per task, keyed by task id. Older logs without a taskId fall back to the task title. */
async function taskEffortMinutes(employeeId, tasks) {
  const rows = await WorkLog.aggregate([
    { $match: { employeeId } },
    { $group: { _id: { taskId: '$taskId', task: { $cond: [{ $ifNull: ['$taskId', false] }, null, '$task'] } }, minutes: { $sum: '$duration' } } },
  ]);
  const byId = new Map();
  const byTitle = new Map();
  for (const row of rows) {
    if (row._id.taskId) byId.set(String(row._id.taskId), row.minutes);
    else if (row._id.task) byTitle.set(row._id.task, (byTitle.get(row._id.task) || 0) + row.minutes);
  }
  const effort = {};
  for (const t of tasks) effort[String(t._id)] = (byId.get(String(t._id)) || 0) + (byTitle.get(t.title) || 0);
  return effort;
}

async function listTasks(adminId) {
  const employee = await Employee.findOne({ adminId }, { tasks: 1 })
    .populate('tasks.assignedBy', 'firstName lastName')
    .lean();
  if (!employee) return fail(404, 'Employee not found');
  const tasks = employee.tasks || [];
  const effort = await taskEffortMinutes(employee._id, tasks);
  return ok({ tasks: tasks.map((t) => ({ ...t, actualMinutes: effort[String(t._id)] || 0 })) });
}

/** Status change by the assignee. Completing stops a timer running on this task (its time is kept). */
async function updateTaskStatus(user, taskId, status, { reason } = {}) {
  if (!mongoose.Types.ObjectId.isValid(taskId)) return fail(400, 'Invalid task ID');
  const employee = await Employee.findOne({ adminId: user._id }, { tasks: { $elemMatch: { _id: taskId } }, activeTimer: 1, firstName: 1, lastName: 1 }).lean();
  if (!employee) return fail(404, 'Employee not found');
  const task = employee.tasks?.[0];
  if (!task) return fail(404, 'Task not found');

  const current = task.status || 'Pending';
  if (!(EMPLOYEE_TRANSITIONS[current] || []).includes(status)) {
    return fail(400, current === 'Completed' || current === 'Cancelled'
      ? `This task is ${current.toLowerCase()}. Ask your manager to reopen it.`
      : `Cannot move a task from ${label(current)} to ${label(status)}.`);
  }
  const why = String(reason || '').trim();
  if (status === 'Blocked' && !why) return fail(400, 'Please describe what is blocking this task.');

  const set = { 'tasks.$.status': status };
  if (status === 'Completed') set['tasks.$.completedAt'] = new Date();
  if (status === 'Blocked') set['tasks.$.blockerReason'] = why.slice(0, 500);
  const text = `${label(current)} → ${label(status)}${why ? ` · ${why.slice(0, 500)}` : ''}`;

  const result = await Employee.updateOne(
    { _id: employee._id, tasks: { $elemMatch: { _id: task._id, status: current } } },
    { $set: set, $push: { 'tasks.$.history': entry(text, user) } }
  );
  if (!result.modifiedCount) return fail(409, 'This task was just updated elsewhere. Refresh and try again.');

  let timerStopped = false;
  if (status === 'Completed' && employee.activeTimer?.taskId && String(employee.activeTimer.taskId) === String(task._id)) {
    timerStopped = (await stopTimer(user._id, { remarks: 'Stopped automatically when the task was completed.' })).ok;
  }

  if (status === 'Completed' && task.assignedBy && String(task.assignedBy) !== String(user._id)) {
    await notifyStaff(task.assignedBy, {
      type: 'task_completed',
      title: `Task completed by ${employee.firstName} ${employee.lastName}`,
      message: String(task.title).slice(0, 140),
      link: '/admin/tasks',
    });
  }
  return ok({ message: status === 'Completed' ? 'Task marked as completed.' : `Task moved to ${label(status)}.`, timerStopped });
}

/** Starting a timer on a Not Started task moves it to In Progress. Never fails the timer start. */
async function startTaskIfPending(user, taskId) {
  if (!taskId) return;
  await Employee.updateOne(
    { adminId: user._id, tasks: { $elemMatch: { _id: taskId, status: 'Pending' } } },
    { $set: { 'tasks.$.status': 'In Progress' }, $push: { 'tasks.$.history': entry('Not Started → In Progress · timer started', user) } }
  ).catch(() => {});
}

async function addTaskComment(user, taskId, text) {
  const clean = String(text || '').trim();
  if (!clean) return fail(400, 'Comment cannot be empty.');
  if (clean.length > 2000) return fail(400, 'Comment is too long (max 2000 characters).');
  if (!mongoose.Types.ObjectId.isValid(taskId)) return fail(400, 'Invalid task ID');
  const comment = entry(clean, user);
  const result = await Employee.updateOne(
    { adminId: user._id, 'tasks._id': taskId },
    { $push: { 'tasks.$.comments': comment } }
  );
  if (!result.matchedCount) return fail(404, 'Task not found');
  return ok({ comment });
}

module.exports = { listTasks, updateTaskStatus, startTaskIfPending, addTaskComment, EMPLOYEE_TRANSITIONS };
