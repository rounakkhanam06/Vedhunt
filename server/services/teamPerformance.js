const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const Admin = require('../models/Admin');
const Employee = require('../models/Employee');
const { getBDERole } = require('./leadAssignment');
const { directReportIds } = require('./approvalRouting');
const { TERMINAL_STATUSES } = require('../utils/leadStateMachine');
const { hasPermission } = require('../config/permissions');

/**
 * My Team Performance — per-BDE call and lead numbers for a manager's direct
 * reports (Employee Portal) or every BDE (Super Admin). Calls are read from
 * each lead's append-only callLogs, so a BDE's history stays intact even
 * after a lead is reassigned.
 */

// A lead on Hold has no active follow-up requirement.
const NON_ACTIVE_STATUSES = [...TERMINAL_STATUSES, 'Hold'];
const PERIODS = ['today', 'week', 'month', 'custom'];

/** `period` = today | week (Mon–now) | month | custom (`from`/`to` as YYYY-MM-DD). */
function periodRange({ period = 'today', from, to } = {}) {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  let end = now;
  if (period === 'week') {
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  } else if (period === 'month') {
    start.setDate(1);
  } else if (period === 'custom') {
    if (from) start.setTime(new Date(from).setHours(0, 0, 0, 0));
    if (to) end = new Date(new Date(to).setHours(23, 59, 59, 999));
  }
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return { start, end };
}

const toObjectIds = (ids) => ids
  .filter((id) => mongoose.Types.ObjectId.isValid(id))
  .map((id) => new mongoose.Types.ObjectId(String(id)));

const nameOf = (person) => [person?.firstName, person?.lastName].filter(Boolean).join(' ').trim() || person?.email || 'Unknown';

/**
 * The logins (Admin ids) whose numbers `user` may see: every active BDE with
 * the team.performance permission (or as Super Admin), otherwise the
 * manager's direct reports that have a login.
 */
async function visibleMembers(user) {
  if (hasPermission(user.permissions, 'team.performance')) {
    const bdeRole = await getBDERole();
    const admins = await Admin.find({ roles: bdeRole._id, isActive: true }, { firstName: 1, lastName: 1, email: 1 }).lean();
    const employees = await Employee.find({ adminId: { $in: admins.map((a) => a._id) } }, { adminId: 1, employeeId: 1, designation: 1 }).lean();
    const byAdmin = new Map(employees.map((e) => [String(e.adminId), e]));
    return admins.map((a) => ({
      adminId: a._id,
      name: nameOf(a),
      employeeId: byAdmin.get(String(a._id))?.employeeId || '',
      designation: byAdmin.get(String(a._id))?.designation || 'BDE',
    }));
  }
  const ids = await directReportIds(user._id);
  if (!ids.length) return [];
  const reports = await Employee.find(
    { _id: { $in: ids }, adminId: { $ne: null } },
    { adminId: 1, firstName: 1, lastName: 1, employeeId: 1, designation: 1 }
  ).lean();
  return reports.map((e) => ({ adminId: e.adminId, name: nameOf(e), employeeId: e.employeeId || '', designation: e.designation || '' }));
}

// callLogs entries logged in the range (loggedAt, or callDate on older entries).
const callInRange = ({ start, end }) => ({
  $or: [
    { 'callLogs.loggedAt': { $gte: start, $lte: end } },
    { 'callLogs.loggedAt': { $exists: false }, 'callLogs.callDate': { $gte: start, $lte: end } },
  ],
});

async function teamSummary(user, range) {
  const members = await visibleMembers(user);
  if (!members.length) return { members: [], totals: null };
  const ids = toObjectIds(members.map((m) => m.adminId));
  const now = new Date();
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const [calls, pipeline, followUps, won] = await Promise.all([
    Lead.aggregate([
      { $unwind: '$callLogs' },
      { $match: { 'callLogs.calledBy': { $in: ids }, ...callInRange(range) } },
      {
        $group: {
          _id: '$callLogs.calledBy',
          calls: { $sum: 1 },
          connected: { $sum: { $cond: [{ $eq: ['$callLogs.connected', 'Yes'] }, 1, 0] } },
          talkMinutes: { $sum: { $ifNull: ['$callLogs.callDuration', 0] } },
          leads: { $addToSet: '$_id' },
        },
      },
    ]),
    Lead.aggregate([
      { $match: { assignedTo: { $in: ids }, status: { $nin: TERMINAL_STATUSES } } },
      { $group: { _id: { bd: '$assignedTo', status: '$status' }, count: { $sum: 1 } } },
    ]),
    Lead.aggregate([
      { $match: { assignedTo: { $in: ids }, status: { $nin: NON_ACTIVE_STATUSES }, nextFollowUpDate: { $ne: null, $lte: todayEnd } } },
      {
        $group: {
          _id: '$assignedTo',
          overdue: { $sum: { $cond: [{ $lt: ['$nextFollowUpDate', now] }, 1, 0] } },
          dueToday: { $sum: { $cond: [{ $gte: ['$nextFollowUpDate', now] }, 1, 0] } },
        },
      },
    ]),
    Lead.aggregate([
      { $match: { assignedTo: { $in: ids }, status: 'Won', closedDate: { $gte: range.start, $lte: range.end } } },
      { $group: { _id: '$assignedTo', count: { $sum: 1 }, value: { $sum: { $ifNull: ['$dealCloseValue', 0] } } } },
    ]),
  ]);

  const index = (rows) => new Map(rows.map((r) => [String(r._id), r]));
  const callsBy = index(calls);
  const followUpsBy = index(followUps);
  const wonBy = index(won);
  const stagesBy = new Map();
  for (const row of pipeline) {
    const key = String(row._id.bd);
    const stages = stagesBy.get(key) || {};
    stages[row._id.status] = row.count;
    stagesBy.set(key, stages);
  }

  const rows = members.map((m) => {
    const key = String(m.adminId);
    const c = callsBy.get(key);
    const stages = stagesBy.get(key) || {};
    const callCount = c?.calls || 0;
    return {
      ...m,
      calls: callCount,
      connected: c?.connected || 0,
      notConnected: callCount - (c?.connected || 0),
      connectRate: callCount ? Math.round(((c?.connected || 0) / callCount) * 100) : 0,
      talkMinutes: c?.talkMinutes || 0,
      leadsWorked: c?.leads?.length || 0,
      activeLeads: Object.values(stages).reduce((a, b) => a + b, 0),
      stages,
      followUpsDueToday: followUpsBy.get(key)?.dueToday || 0,
      followUpsOverdue: followUpsBy.get(key)?.overdue || 0,
      won: wonBy.get(key)?.count || 0,
      wonValue: wonBy.get(key)?.value || 0,
    };
  }).sort((a, b) => b.calls - a.calls || a.name.localeCompare(b.name));

  const sum = (field) => rows.reduce((t, r) => t + r[field], 0);
  const totals = {
    calls: sum('calls'), connected: sum('connected'), notConnected: sum('notConnected'),
    talkMinutes: sum('talkMinutes'), leadsWorked: sum('leadsWorked'), activeLeads: sum('activeLeads'),
    followUpsDueToday: sum('followUpsDueToday'), followUpsOverdue: sum('followUpsOverdue'),
    won: sum('won'), wonValue: sum('wonValue'),
  };
  totals.connectRate = totals.calls ? Math.round((totals.connected / totals.calls) * 100) : 0;
  return { members: rows, totals };
}

/** One BDE's active leads and their call log for the range — null if not visible to `user`. */
async function memberDetail(user, adminId, range) {
  const members = await visibleMembers(user);
  const member = members.find((m) => String(m.adminId) === String(adminId));
  if (!member) return null;
  const [id] = toObjectIds([adminId]);

  const [leads, calls] = await Promise.all([
    Lead.find(
      { assignedTo: id, status: { $nin: TERMINAL_STATUSES } },
      { leadId: 1, fullName: 1, phone: 1, status: 1, interestLevel: 1, nextFollowUpDate: 1, nextActionType: 1, lastCallAt: 1, touchNumber: 1, assignedAt: 1 }
    ).sort({ nextFollowUpDate: 1, lastCallAt: -1 }).limit(300).lean(),
    Lead.aggregate([
      { $unwind: '$callLogs' },
      { $match: { 'callLogs.calledBy': id, ...callInRange(range) } },
      { $sort: { 'callLogs.loggedAt': -1, 'callLogs.callDate': -1 } },
      { $limit: 300 },
      {
        $project: {
          _id: 0,
          leadRef: '$_id',
          leadId: 1,
          fullName: 1,
          touchNumber: '$callLogs.touchNumber',
          at: { $ifNull: ['$callLogs.loggedAt', '$callLogs.callDate'] },
          duration: '$callLogs.callDuration',
          connected: '$callLogs.connected',
          notConnectedReason: '$callLogs.notConnectedReason',
          interestLevel: '$callLogs.interestLevel',
          remark: '$callLogs.remark',
          leadStage: '$callLogs.leadStage',
          callType: '$callLogs.callType',
        },
      },
    ]),
  ]);

  return { member, leads, calls };
}

const CALL_LOG_PROJECTION = {
  _id: 0,
  leadRef: '$_id',
  leadId: 1,
  fullName: 1,
  calledBy: '$callLogs.calledBy',
  touchNumber: '$callLogs.touchNumber',
  at: { $ifNull: ['$callLogs.loggedAt', '$callLogs.callDate'] },
  duration: '$callLogs.callDuration',
  connected: '$callLogs.connected',
  notConnectedReason: '$callLogs.notConnectedReason',
  interestLevel: '$callLogs.interestLevel',
  remark: '$callLogs.remark',
  leadStage: '$callLogs.leadStage',
  callType: '$callLogs.callType',
};

/**
 * Every call by everyone `user` may see, newest first, one page at a time.
 * `by` narrows to one BDE (must be visible); `result` is Connected / Not Connected.
 */
async function teamCalls(user, range, { by, result, page = 1, limit = 25 } = {}) {
  const members = await visibleMembers(user);
  const visibleIds = members.map((m) => String(m.adminId));
  const ids = toObjectIds(by && by !== 'All' ? visibleIds.filter((id) => id === String(by)) : visibleIds);
  if (!ids.length) return { calls: [], total: 0, page: 1, pages: 1, members };

  const match = { 'callLogs.calledBy': { $in: ids }, ...callInRange(range) };
  if (result === 'Connected') match['callLogs.connected'] = 'Yes';
  else if (result === 'Not Connected') match['callLogs.connected'] = { $ne: 'Yes' };

  const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);
  const safePage = Math.max(Number(page) || 1, 1);
  const [out] = await Lead.aggregate([
    { $unwind: '$callLogs' },
    { $match: match },
    { $sort: { 'callLogs.loggedAt': -1, 'callLogs.callDate': -1 } },
    {
      $facet: {
        calls: [{ $skip: (safePage - 1) * safeLimit }, { $limit: safeLimit }, { $project: CALL_LOG_PROJECTION }],
        total: [{ $count: 'n' }],
      },
    },
  ]);

  const names = new Map(members.map((m) => [String(m.adminId), m.name]));
  const total = out?.total?.[0]?.n || 0;
  return {
    calls: (out?.calls || []).map((c) => ({ ...c, calledByName: names.get(String(c.calledBy)) || 'Unknown' })),
    total,
    page: safePage,
    pages: Math.max(Math.ceil(total / safeLimit), 1),
    members,
  };
}

module.exports = { PERIODS, periodRange, visibleMembers, teamSummary, memberDetail, teamCalls };
