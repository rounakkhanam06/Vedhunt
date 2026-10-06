// Live, role-specific KPI scorecard for the Employee Portal's My Performance
// page. Computed from operational data (leads, follow-ups, tasks, timer logs,
// tickets) for a date range; the manager-entered KPI targets of a review
// cycle stay in KPITarget and are shown separately.
//
// Output is one generic shape — groups of { key, label, value, format } — so
// the client renders any segment's scorecard without segment-specific code.
const Lead = require('../models/Lead');
const FollowUpTask = require('../models/FollowUpTask');
const WorkLog = require('../models/WorkLog');
const SupportTicket = require('../models/SupportTicket');
const Project = require('../models/Project');
const { deliveryGroup, memberGroup } = require('./projectDelivery');

const HOURS_PER_DAY = 8.5; // same daily target the timesheet uses
const pct = (num, den) => (den > 0 ? Math.round((num / den) * 1000) / 10 : 0);
const metric = (key, label, value, format = 'count', hint) => ({ key, label, value, format, ...(hint ? { hint } : {}) });

/** Mon–Sat working days in [from, to] (Sundays are the weekly off). */
function workingDays(from, to) {
  let days = 0;
  const cursor = new Date(from); cursor.setHours(0, 0, 0, 0);
  const end = to > new Date() ? new Date() : to;
  while (cursor <= end) {
    if (cursor.getDay() !== 0) days += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

async function bdGroups(adminId, from, to) {
  const reached = (stage) => ({ $in: [stage, { $ifNull: ['$pipelineHistory.status', []] }] });
  const [cohort] = await Lead.aggregate([
    // Leads assigned to this BD within the period (older leads fall back to createdAt).
    { $match: { assignedTo: adminId } },
    { $addFields: { _assigned: { $ifNull: ['$assignedAt', '$createdAt'] } } },
    { $match: { _assigned: { $gte: from, $lte: to } } },
    {
      $group: {
        _id: null,
        assigned: { $sum: 1 },
        contacted: { $sum: { $cond: [{ $gt: [{ $ifNull: ['$touchNumber', 0] }, 0] }, 1, 0] } },
        qualified: { $sum: { $cond: [{ $or: [{ $in: ['$status', ['Qualified', 'Proposal Sent', 'Negotiation', 'Won']] }, reached('Qualified')] }, 1, 0] } },
        proposals: { $sum: { $cond: [{ $or: [{ $in: ['$status', ['Proposal Sent', 'Negotiation', 'Won']] }, reached('Proposal Sent')] }, 1, 0] } },
        negotiation: { $sum: { $cond: [{ $or: [{ $eq: ['$status', 'Negotiation'] }, reached('Negotiation')] }, 1, 0] } },
        won: { $sum: { $cond: [{ $eq: ['$status', 'Won'] }, 1, 0] } },
        wonValue: { $sum: { $cond: [{ $eq: ['$status', 'Won'] }, { $ifNull: ['$dealCloseValue', 0] }, 0] } },
        responseMs: { $avg: { $cond: [{ $and: ['$firstCallAt', '$assignedAt'] }, { $subtract: ['$firstCallAt', '$assignedAt'] }, null] } },
      },
    },
  ]);
  const c = cohort || { assigned: 0, contacted: 0, qualified: 0, proposals: 0, negotiation: 0, won: 0, wonValue: 0, responseMs: null };

  const [calls] = await Lead.aggregate([
    { $match: { 'callLogs.calledBy': adminId } },
    { $unwind: '$callLogs' },
    { $match: { 'callLogs.calledBy': adminId, 'callLogs.callDate': { $gte: from, $lte: to } } },
    { $group: { _id: null, total: { $sum: 1 }, connected: { $sum: { $cond: [{ $eq: ['$callLogs.connected', 'Yes'] }, 1, 0] } } } },
  ]);

  const now = new Date();
  const [followUpsDue, followUpsDone, overdueNow] = await Promise.all([
    FollowUpTask.countDocuments({ assignedTo: adminId, dueDate: { $gte: from, $lte: to < now ? to : now } }),
    FollowUpTask.countDocuments({ assignedTo: adminId, dueDate: { $gte: from, $lte: to < now ? to : now }, status: 'Completed' }),
    FollowUpTask.countDocuments({ assignedTo: adminId, status: 'Pending', dueDate: { $lt: now } }),
  ]);

  const responseHours = c.responseMs != null ? Math.round((c.responseMs / 3600000) * 10) / 10 : null;
  return [
    {
      title: 'Pipeline',
      items: [
        metric('assigned', 'Leads assigned', c.assigned),
        metric('contacted', 'Contacted', c.contacted),
        metric('qualified', 'Qualified', c.qualified),
        metric('proposals', 'Proposals', c.proposals),
        metric('negotiation', 'Negotiation', c.negotiation),
        metric('won', 'Won', c.won),
        metric('wonValue', 'Won value', c.wonValue, 'currency'),
        metric('conversion', 'Conversion', pct(c.won, c.assigned), 'pct', 'Won ÷ assigned'),
      ],
    },
    {
      title: 'Activity',
      items: [
        metric('connectedPct', 'Connected calls', pct(calls?.connected || 0, calls?.total || 0), 'pct', `${calls?.connected || 0} of ${calls?.total || 0} calls`),
        metric('followUpCompletion', 'Follow-up completion', pct(followUpsDone, followUpsDue), 'pct', `${followUpsDone} of ${followUpsDue} due`),
        metric('overdueFollowUps', 'Overdue follow-ups', overdueNow, 'count', 'Open right now'),
        metric('responseTime', 'Avg. first response', responseHours, 'hours', 'Assignment → first call'),
      ],
    },
  ];
}

function taskGroup(tasks, from, to) {
  const now = new Date();
  const inPeriod = tasks.filter((t) => {
    const anchor = new Date(t.dueDate || t.createdAt);
    return anchor >= from && anchor <= to && t.status !== 'Cancelled';
  });
  const completed = inPeriod.filter((t) => t.status === 'Completed');
  const onTime = completed.filter((t) => !t.dueDate || !t.completedAt || new Date(t.completedAt) <= new Date(new Date(t.dueDate).setHours(23, 59, 59, 999)));
  const overdue = tasks.filter((t) => !['Completed', 'Cancelled'].includes(t.status) && t.dueDate && new Date(new Date(t.dueDate).setHours(23, 59, 59, 999)) < now);
  return {
    title: 'Tasks & Delivery',
    items: [
      metric('tasksAssigned', 'Tasks in period', inPeriod.length),
      metric('tasksCompleted', 'Completed', completed.length),
      metric('onTimePct', 'On-time delivery', pct(onTime.length, completed.length), 'pct', `${onTime.length} of ${completed.length} on time`),
      metric('overdueTasks', 'Overdue tasks', overdue.length, 'count', 'Open right now'),
      metric('blockedTasks', 'Blocked', tasks.filter((t) => t.status === 'Blocked').length),
    ],
  };
}

async function timeGroup(employeeId, from, to) {
  const [row] = await WorkLog.aggregate([
    { $match: { employeeId, date: { $gte: from, $lte: to } } },
    {
      $group: {
        _id: null,
        total: { $sum: '$duration' },
        productive: { $sum: { $cond: ['$isProductive', '$duration', 0] } },
        billable: { $sum: { $cond: ['$isBillable', '$duration', 0] } },
      },
    },
  ]);
  const hours = (m) => Math.round(((m || 0) / 60) * 10) / 10;
  const expectedMinutes = workingDays(from, to) * HOURS_PER_DAY * 60;
  return {
    title: 'Time & Utilization',
    items: [
      metric('loggedHours', 'Hours logged', hours(row?.total), 'hours'),
      metric('productivePct', 'Productivity', pct(row?.productive || 0, row?.total || 0), 'pct', 'Productive ÷ logged'),
      metric('utilization', 'Utilization', pct(row?.total || 0, expectedMinutes), 'pct', `vs ${HOURS_PER_DAY}h × working days`),
      metric('billableHours', 'Billable hours', hours(row?.billable), 'hours'),
    ],
  };
}

async function ticketGroup(adminId, from, to) {
  const [assigned, resolved, open] = await Promise.all([
    SupportTicket.countDocuments({ assignedTo: adminId, createdAt: { $gte: from, $lte: to } }),
    SupportTicket.countDocuments({ assignedTo: adminId, createdAt: { $gte: from, $lte: to }, status: { $in: ['Resolved', 'Closed'] } }),
    SupportTicket.countDocuments({ assignedTo: adminId, status: { $in: ['Open', 'In Progress', 'Pending Client'] } }),
  ]);
  return {
    title: 'Client Tickets',
    items: [
      metric('ticketsAssigned', 'Tickets assigned', assigned),
      metric('ticketsResolved', 'Resolved', resolved),
      metric('ticketResolution', 'Resolution rate', pct(resolved, assigned), 'pct'),
      metric('ticketsOpen', 'Open now', open),
    ],
  };
}

/**
 * @param {object} p
 * @param {object} p.employee lean Employee with _id and tasks
 * @param {import('mongoose').Types.ObjectId} p.adminId
 * @param {string} p.segment from utils/employeeSegments.js
 */
async function buildScorecard({ employee, adminId, segment, from, to }) {
  const tasks = employee.tasks || [];
  let groups;
  if (segment === 'BD') {
    groups = [...await bdGroups(adminId, from, to), await timeGroup(employee._id, from, to)];
  } else {
    groups = [taskGroup(tasks, from, to), await timeGroup(employee._id, from, to)];
    // Project delivery: what I manage, else the projects I'm on; management sees the whole company.
    if (await Project.exists({ projectManager: employee._id })) {
      groups.unshift(await deliveryGroup({ projectManager: employee._id }, from, to, 'Project Delivery'));
    } else if (await Project.exists({ teamMembers: employee._id })) {
      groups.push(await memberGroup(employee._id));
    }
    if (segment === 'Management') groups.unshift(await deliveryGroup({}, from, to, 'Company Project Delivery'));
    if (segment === 'Technology') groups.push(await ticketGroup(adminId, from, to));
  }
  return { segment, period: { from, to }, groups };
}

module.exports = { buildScorecard };
