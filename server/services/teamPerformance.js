const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const Admin = require('../models/Admin');
const Employee = require('../models/Employee');
const { getBDERole } = require('./leadAssignment');
const { directReportIds } = require('./approvalRouting');
const { TERMINAL_STATUSES } = require('../utils/leadStateMachine');
const { hasPermission } = require('../config/permissions');
const { leadSearchFilter } = require('./employeeLeads');
const FollowUpTask = require('../models/FollowUpTask');
const { WITH_PREV_AT } = require('./callActivity');
const { DURATION_EXPR } = require('../utils/callOutcome');

/**
 * My Team Performance — per-BDE call and lead numbers for a manager's direct
 * reports (Employee Portal) or every BDE (Super Admin). Calls are read from
 * each lead's append-only callLogs, so a BDE's history stays intact even
 * after a lead is reassigned.
 */

// A lead on Hold has no active follow-up requirement.
const NON_ACTIVE_STATUSES = [...TERMINAL_STATUSES, 'Hold'];
const PERIODS = ['today', 'week', 'month', 'custom'];

// Every period boundary is a calendar day in the server's timezone —
// APP_TIMEZONE, Asia/Kolkata (IST) by default (server.js sets process.env.TZ).
const TIME_ZONE = process.env.TZ || 'Asia/Kolkata';

/** `period` = today | week (Mon–now) | month | custom (`from`/`to` as YYYY-MM-DD, whole days). */
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
    // `${day}T00:00:00` parses as a local (server-timezone) day, not UTC midnight
    if (from) start.setTime(new Date(`${from}T00:00:00`).getTime());
    if (to) end = new Date(`${to}T23:59:59.999`);
  }
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return { start, end, timeZone: TIME_ZONE };
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

/**
 * Calling numbers per caller for `range`: calls, connected, unique leads,
 * and talk time / average duration over the calls that were timed
 * (utils/callOutcome.js — an untimed call has no duration).
 */
async function callStats(ids, range) {
  return Lead.aggregate([
    { $match: { 'callLogs.calledBy': { $in: ids } } },
    WITH_PREV_AT,
    { $unwind: '$callLogs' },
    { $match: { 'callLogs.calledBy': { $in: ids }, ...callInRange(range) } },
    { $addFields: { duration: DURATION_EXPR } },
    {
      $group: {
        _id: '$callLogs.calledBy',
        calls: { $sum: 1 },
        connected: { $sum: { $cond: [{ $eq: ['$callLogs.connected', 'Yes'] }, 1, 0] } },
        talkMinutes: { $sum: { $ifNull: ['$duration', 0] } },
        timedCalls: { $sum: { $cond: [{ $ne: ['$duration', null] }, 1, 0] } },
        leads: { $addToSet: '$_id' },
      },
    },
  ]);
}

/** Follow-up tasks per assignee: due in `range`, and completed in `range`. */
async function followUpStats(ids, range) {
  const [due, completed] = await Promise.all([
    FollowUpTask.aggregate([
      { $match: { assignedTo: { $in: ids }, dueDate: { $gte: range.start, $lte: range.end }, status: { $ne: 'Cancelled' } } },
      { $group: { _id: '$assignedTo', count: { $sum: 1 }, done: { $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] } } } },
    ]),
    FollowUpTask.aggregate([
      { $match: { assignedTo: { $in: ids }, status: 'Completed', completedAt: { $gte: range.start, $lte: range.end } } },
      { $group: { _id: '$assignedTo', count: { $sum: 1 } } },
    ]),
  ]);
  const dueBy = new Map(due.map((r) => [String(r._id), r]));
  const completedBy = new Map(completed.map((r) => [String(r._id), r.count]));
  return (id) => ({
    followUpsDue: dueBy.get(String(id))?.count || 0,
    followUpsDueCompleted: dueBy.get(String(id))?.done || 0,
    followUpsCompleted: completedBy.get(String(id)) || 0,
  });
}

/** The calling metrics for one caller's callStats row (or none). */
function callMetrics(c) {
  const calls = c?.calls || 0;
  const connected = c?.connected || 0;
  const timedCalls = c?.timedCalls || 0;
  return {
    calls,
    connected,
    notConnected: calls - connected,
    connectRate: calls ? Math.round((connected / calls) * 100) : 0,
    talkMinutes: c?.talkMinutes || 0,
    timedCalls,
    avgCallMinutes: timedCalls ? Math.round(((c?.talkMinutes || 0) / timedCalls) * 10) / 10 : null,
    leadsWorked: c?.leads?.length || 0,
  };
}

async function teamSummary(user, range) {
  const members = await visibleMembers(user);
  if (!members.length) return { members: [], totals: null };
  const ids = toObjectIds(members.map((m) => m.adminId));
  const now = new Date();
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const [calls, pipeline, followUps, won, followUpsInPeriod] = await Promise.all([
    callStats(ids, range),
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
    followUpStats(ids, range),
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
    return {
      ...m,
      ...callMetrics(c),
      ...followUpsInPeriod(m.adminId),
      activeLeads: Object.values(stages).reduce((a, b) => a + b, 0),
      stages,
      followUpsDueToday: followUpsBy.get(key)?.dueToday || 0,
      followUpsOverdue: followUpsBy.get(key)?.overdue || 0,
      won: wonBy.get(key)?.count || 0,
      wonValue: wonBy.get(key)?.value || 0,
    };
  }).sort((a, b) => b.calls - a.calls || a.name.localeCompare(b.name));

  const sum = (field) => rows.reduce((t, r) => t + r[field], 0);
  // Organisation totals. Unique leads are counted once across BDEs (a lead
  // two BDEs called is one lead), so they aren't a sum of the rows.
  const allLeads = new Set(calls.flatMap((c) => (c.leads || []).map(String)));
  const totals = {
    ...callMetrics({
      calls: sum('calls'), connected: sum('connected'), talkMinutes: sum('talkMinutes'), timedCalls: sum('timedCalls'),
      leads: [...allLeads],
    }),
    activeLeads: sum('activeLeads'),
    followUpsDueToday: sum('followUpsDueToday'), followUpsOverdue: sum('followUpsOverdue'),
    followUpsDue: sum('followUpsDue'), followUpsDueCompleted: sum('followUpsDueCompleted'), followUpsCompleted: sum('followUpsCompleted'),
    won: sum('won'), wonValue: sum('wonValue'),
  };
  return { members: rows, totals };
}

/** Clamps page/limit query values; 25 per page by default, at most 100. */
function paging({ page, limit } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);
  const safePage = Math.max(Number(page) || 1, 1);
  return { safePage, safeLimit, skip: (safePage - 1) * safeLimit, pagesFor: (total) => Math.max(Math.ceil(total / safeLimit), 1) };
}

/**
 * One BDE's active leads, a page at a time, optionally filtered by `q`
 * (lead ID, name, phone, email …) — null if not visible to `user`. Their
 * call log is paged through teamCalls() with `by` set to this BDE.
 */
async function memberDetail(user, adminId, { q, page, limit } = {}) {
  const members = await visibleMembers(user);
  const member = members.find((m) => String(m.adminId) === String(adminId));
  if (!member) return null;
  const [id] = toObjectIds([adminId]);

  const filter = { assignedTo: id, status: { $nin: TERMINAL_STATUSES }, ...leadSearchFilter(q) };
  const { safePage, safeLimit, skip, pagesFor } = paging({ page, limit });
  const [leads, total] = await Promise.all([
    Lead.find(
      filter,
      { leadId: 1, fullName: 1, phone: 1, status: 1, interestLevel: 1, nextFollowUpDate: 1, nextActionType: 1, lastCallAt: 1, touchNumber: 1, assignedAt: 1 }
    ).sort({ nextFollowUpDate: 1, lastCallAt: -1, _id: 1 }).skip(skip).limit(safeLimit).lean(),
    Lead.countDocuments(filter),
  ]);

  return { member, leads, total, page: safePage, pages: pagesFor(total) };
}

const CALL_LOG_PROJECTION = {
  _id: 0,
  leadRef: '$_id',
  leadId: 1,
  fullName: 1,
  calledBy: '$callLogs.calledBy',
  touchNumber: '$callLogs.touchNumber',
  at: { $ifNull: ['$callLogs.loggedAt', '$callLogs.callDate'] },
  duration: DURATION_EXPR,
  connected: '$callLogs.connected',
  notConnectedReason: '$callLogs.notConnectedReason',
  interestLevel: '$callLogs.interestLevel',
  remark: '$callLogs.remark',
  leadStage: '$callLogs.leadStage',
  callType: '$callLogs.callType',
};

/**
 * Calls made by `ids` in `range`, newest first, one page at a time.
 * `result` is Connected / Not Connected; `q` keeps calls on leads matching
 * a search (lead ID, name, phone …).
 */
async function pagedCalls(ids, range, { result, q, page, limit } = {}) {
  const match = { 'callLogs.calledBy': { $in: ids }, ...callInRange(range) };
  if (result === 'Connected') match['callLogs.connected'] = 'Yes';
  else if (result === 'Not Connected') match['callLogs.connected'] = { $ne: 'Yes' };

  const { safePage, safeLimit, skip, pagesFor } = paging({ page, limit });
  const [out] = await Lead.aggregate([
    // narrow to leads these BDEs called (and that match the search) before unwinding
    { $match: { 'callLogs.calledBy': { $in: ids }, ...leadSearchFilter(q) } },
    WITH_PREV_AT,
    { $unwind: '$callLogs' },
    { $match: match },
    { $sort: { 'callLogs.loggedAt': -1, 'callLogs.callDate': -1 } },
    {
      $facet: {
        calls: [{ $skip: skip }, { $limit: safeLimit }, { $project: CALL_LOG_PROJECTION }],
        total: [{ $count: 'n' }],
      },
    },
  ]);

  const total = out?.total?.[0]?.n || 0;
  return { calls: out?.calls || [], total, page: safePage, pages: pagesFor(total) };
}

/**
 * Every call by everyone `user` may see — pagedCalls() across the team.
 * `by` narrows to one BDE (must be visible).
 */
async function teamCalls(user, range, { by, ...options } = {}) {
  const members = await visibleMembers(user);
  const visibleIds = members.map((m) => String(m.adminId));
  const ids = toObjectIds(by && by !== 'All' ? visibleIds.filter((id) => id === String(by)) : visibleIds);
  if (!ids.length) return { calls: [], total: 0, page: 1, pages: 1, members };

  const names = new Map(members.map((m) => [String(m.adminId), m.name]));
  const out = await pagedCalls(ids, range, options);
  return {
    ...out,
    calls: out.calls.map((c) => ({ ...c, calledByName: names.get(String(c.calledBy)) || 'Unknown' })),
    members,
  };
}

/** A BDE's own call log — only ever their calls, whatever the request asks for. */
async function myCalls(user, range, options = {}) {
  return pagedCalls(toObjectIds([user._id]), range, options);
}

// Daily breakdown: at most this many days as columns
const MAX_DAILY_DAYS = 62;

/** Every calendar day (YYYY-MM-DD, server timezone) from range.start to range.end. */
function daysIn(range) {
  const days = [];
  const d = new Date(range.start);
  d.setHours(0, 0, 0, 0);
  while (d <= range.end && days.length <= MAX_DAILY_DAYS) {
    days.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    d.setDate(d.getDate() + 1);
  }
  return days;
}

// Connect % = connected ÷ total × 100, two decimals; null (shown as —) with no calls
const rate = (connected, calls) => (calls ? Math.round((connected / calls) * 10000) / 100 : null);
const dayCell = (calls = 0, connected = 0, uniqueLeads = 0, collaboratorCalls = 0) => ({
  calls, connected, notConnected: calls - connected, connectRate: rate(connected, calls), uniqueLeads, collaboratorCalls,
});

/**
 * Calls per caller per day in `range`. Every attempt counts (a lead called
 * three times is three calls); unique leads are reported separately. A call
 * belongs to whoever logged it (callLogs.calledBy), whoever owns the lead —
 * so calls on cross-assigned leads count for the BDE who made them. Days are
 * calendar days in TIME_ZONE (IST).
 * Returns null when the range has more than MAX_DAILY_DAYS days.
 */
async function dailyCallStats(members, range) {
  const days = daysIn(range);
  if (days.length > MAX_DAILY_DAYS) return null;
  const ids = toObjectIds(members.map((m) => m.adminId));
  const at = { $ifNull: ['$callLogs.loggedAt', '$callLogs.callDate'] };
  // A call on a lead someone else owns (collaborator activity) — still the caller's call
  const COLLAB_CALL = { $cond: [{ $ne: ['$assignedTo', '$callLogs.calledBy'] }, 1, 0] };
  const [out] = await Lead.aggregate([
    { $match: { 'callLogs.calledBy': { $in: ids } } },
    { $unwind: '$callLogs' },
    { $match: { 'callLogs.calledBy': { $in: ids }, ...callInRange(range) } },
    {
      $facet: {
        perDay: [
          {
            $group: {
              _id: { by: '$callLogs.calledBy', day: { $dateToString: { format: '%Y-%m-%d', date: { $toDate: at }, timezone: TIME_ZONE } } },
              calls: { $sum: 1 },
              connected: { $sum: { $cond: [{ $eq: ['$callLogs.connected', 'Yes'] }, 1, 0] } },
              leads: { $addToSet: '$_id' },
              collaboratorCalls: { $sum: COLLAB_CALL },
            },
          },
        ],
        perMember: [
          { $group: { _id: '$callLogs.calledBy', calls: { $sum: 1 }, connected: { $sum: { $cond: [{ $eq: ['$callLogs.connected', 'Yes'] }, 1, 0] } }, leads: { $addToSet: '$_id' }, collaboratorCalls: { $sum: COLLAB_CALL } } },
        ],
        // organisation-wide distinct leads (a lead two BDEs called is one lead)
        allLeads: [{ $group: { _id: null, leads: { $addToSet: '$_id' } } }],
        allLeadsPerDay: [
          { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: { $toDate: at }, timezone: TIME_ZONE } }, leads: { $addToSet: '$_id' } } },
        ],
      },
    },
  ]);

  const cells = new Map((out?.perDay || []).map((r) => [`${r._id.by}|${r._id.day}`, r]));
  const totalsBy = new Map((out?.perMember || []).map((r) => [String(r._id), r]));
  const orgLeadsPerDay = new Map((out?.allLeadsPerDay || []).map((r) => [r._id, r.leads.length]));

  const rows = members.map((m) => {
    const key = String(m.adminId);
    const byDay = {};
    for (const day of days) {
      const c = cells.get(`${key}|${day}`);
      byDay[day] = dayCell(c?.calls, c?.connected, c?.leads?.length, c?.collaboratorCalls);
    }
    const t = totalsBy.get(key);
    return { adminId: m.adminId, name: m.name, employeeId: m.employeeId, days: byDay, total: dayCell(t?.calls, t?.connected, t?.leads?.length, t?.collaboratorCalls) };
  }).sort((a, b) => b.total.calls - a.total.calls || a.name.localeCompare(b.name));

  const orgDays = {};
  for (const day of days) {
    const calls = rows.reduce((s, r) => s + r.days[day].calls, 0);
    const connected = rows.reduce((s, r) => s + r.days[day].connected, 0);
    const collaborator = rows.reduce((s, r) => s + r.days[day].collaboratorCalls, 0);
    orgDays[day] = dayCell(calls, connected, orgLeadsPerDay.get(day) || 0, collaborator);
  }
  const calls = rows.reduce((s, r) => s + r.total.calls, 0);
  const connected = rows.reduce((s, r) => s + r.total.connected, 0);
  const collaborator = rows.reduce((s, r) => s + r.total.collaboratorCalls, 0);
  return {
    days,
    members: rows,
    totals: { days: orgDays, total: dayCell(calls, connected, out?.allLeads?.[0]?.leads?.length || 0, collaborator) },
  };
}

/** Daily breakdown for everyone `user` may see (same people as teamSummary). */
async function teamDaily(user, range) {
  return dailyCallStats(await visibleMembers(user), range);
}

/** A BDE's own daily breakdown. */
async function myDaily(user, range) {
  const me = await Admin.findById(user._id, { firstName: 1, lastName: 1, email: 1 }).lean();
  return dailyCallStats([{ adminId: user._id, name: nameOf(me), employeeId: '' }], range);
}

/** A BDE's own calling performance in `range` — the same metrics as one teamSummary row. */
async function myCallSummary(user, range) {
  const [id] = toObjectIds([user._id]);
  const [[row], followUps] = await Promise.all([callStats([id], range), followUpStats([id], range)]);
  return { ...callMetrics(row), ...followUps(id) };
}

module.exports = { PERIODS, periodRange, visibleMembers, teamSummary, memberDetail, teamCalls, myCalls, myCallSummary, teamDaily, myDaily, MAX_DAILY_DAYS };
