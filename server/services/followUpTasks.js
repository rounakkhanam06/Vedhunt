const { findLeadRaw } = require('../utils/leadLookup');
const FollowUpTask = require('../models/FollowUpTask');

/**
 * Follow-up Tasks — the 'Primary' task per lead is auto-managed by
 * services/leadLifecycle.js (mirrors Lead.nextFollowUpDate). This module is
 * only for reading a lead's task history and for the 'Parallel' task surface:
 * a manager-only extra task, independent of the lead's primary follow-up —
 * the "unless a manager explicitly creates parallel tasks" exception.
 *
 * Shared by both the admin and Employee Portal routes via `extraFilter`,
 * same split as services/leadDocuments.js.
 */

async function listTasks(leadId, extraFilter = {}) {
  const lead = await findLeadRaw(leadId, extraFilter);
  if (!lead) return { ok: false, status: 404, message: 'Lead not found' };

  const tasks = await FollowUpTask.find({ lead: lead._id })
    .populate('assignedTo', 'firstName lastName email')
    .populate('createdBy', 'firstName lastName email')
    .populate('completedBy', 'firstName lastName email')
    .sort({ dueDate: -1 })
    .lean();

  return { ok: true, tasks };
}

async function createParallelTask(leadId, { assignedTo, dueDate, note }, actorId, extraFilter = {}) {
  const lead = await findLeadRaw(leadId, extraFilter);
  if (!lead) return { ok: false, status: 404, message: 'Lead not found' };
  if (!assignedTo || !dueDate) {
    return { ok: false, status: 400, message: 'assignedTo and dueDate are required to create a follow-up task.' };
  }

  const task = await FollowUpTask.create({
    lead: lead._id,
    assignedTo,
    createdBy: actorId,
    dueDate: new Date(dueDate),
    note: note || '',
    type: 'Parallel',
    status: 'Pending'
  });

  return { ok: true, task };
}

async function completeTask(leadId, taskId, resultText, actorId, { canManage = false } = {}, extraFilter = {}) {
  const lead = await findLeadRaw(leadId, extraFilter);
  if (!lead) return { ok: false, status: 404, message: 'Lead not found' };
  if (!resultText || !String(resultText).trim()) {
    return { ok: false, status: 400, message: 'A result is required to complete a follow-up task.' };
  }

  const task = await FollowUpTask.findOne({ _id: taskId, lead: lead._id });
  if (!task) return { ok: false, status: 404, message: 'Task not found' };
  if (task.status !== 'Pending') return { ok: false, status: 400, message: 'This task is already closed.' };
  if (String(task.assignedTo) !== String(actorId) && !canManage) {
    return { ok: false, status: 403, message: 'Only the assignee (or a manager) can complete this task.' };
  }

  task.status = 'Completed';
  task.result = String(resultText).trim();
  task.completedAt = new Date();
  task.completedBy = actorId;
  await task.save();

  return { ok: true, task };
}

module.exports = { listTasks, createParallelTask, completeTask };
