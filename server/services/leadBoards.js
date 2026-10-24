// BDE-wise lead tables for the Calling Performance dashboard (PRD 6.1):
//
//   Lead Status  — per primary owner: Open / Hold / Won / Lost / Dropped /
//                  Total and open pipeline value. "Open" = every non-terminal
//                  status, Hold included (Hold is also shown on its own).
//                  Counted by owner only, so a cross-assigned lead is one lead
//                  in every total; leads a BD collaborates on are a separate
//                  column that never adds into the totals.
//   Pending Call — leads assigned but with no action taken yet (same rule as
//                  Raw Leads, utils/leadActivity.js), grouped by
//                  owner and IST assignment date.
//
// Both are snapshots of the CRM as of now. Admin rows cover every owner plus
// Unassigned, so the totals reconcile to every Sales lead; a manager sees
// their reports; a BD sees their own leads and, separately, the leads shared
// with them. Every count drills down to its leads (leadsFor).
const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const Admin = require('../models/Admin');
const { TERMINAL_STATUSES } = require('../utils/leadStateMachine');
const { pendingCallFilter } = require('../utils/leadActivity');

const TIME_ZONE = process.env.TZ || 'Asia/Kolkata';
const SALES = { leadType: { $in: ['Sales', null] } };
const oid = (id) => new mongoose.Types.ObjectId(String(id));
const nameOf = (p) => [p?.firstName, p?.lastName].filter(Boolean).join(' ').trim() || p?.email || 'Unknown';

const BUCKETS = {
  open: { status: { $nin: TERMINAL_STATUSES } },
  hold: { status: 'Hold' },
  won: { status: 'Won' },
  lost: { status: 'Lost' },
  dropped: { status: 'Dropped' },
  total: {},
};

// Assigned, still open, and no action taken yet — the same rule as the Raw Leads
// tab (utils/leadActivity.js), so the two always reconcile
const NOT_CALLED = pendingCallFilter();

const statusGroup = (idExpr) => ({
  $group: {
    _id: idExpr,
    open: { $sum: { $cond: [{ $in: ['$status', TERMINAL_STATUSES] }, 0, 1] } },
    hold: { $sum: { $cond: [{ $eq: ['$status', 'Hold'] }, 1, 0] } },
    won: { $sum: { $cond: [{ $eq: ['$status', 'Won'] }, 1, 0] } },
    lost: { $sum: { $cond: [{ $eq: ['$status', 'Lost'] }, 1, 0] } },
    dropped: { $sum: { $cond: [{ $eq: ['$status', 'Dropped'] }, 1, 0] } },
    total: { $sum: 1 },
    openValue: { $sum: { $cond: [{ $in: ['$status', TERMINAL_STATUSES] }, 0, { $ifNull: ['$proposalValue', { $ifNull: ['$dealValue', 0] }] }] } },
    wonValue: { $sum: { $cond: [{ $eq: ['$status', 'Won'] }, { $ifNull: ['$dealCloseValue', 0] }, 0] } },
  },
});
const ZERO = { open: 0, hold: 0, won: 0, lost: 0, dropped: 0, total: 0, openValue: 0, wonValue: 0 };
const pickCounts = (r) => Object.fromEntries(Object.keys(ZERO).map((k) => [k, r?.[k] || 0]));
const sumRows = (rows) => Object.fromEntries(Object.keys(ZERO).map((k) => [k, rows.reduce((s, r) => s + r[k], 0)]));

/** Owner rows for a team: its members, and (admin) every other owner + Unassigned. */
async function ownerRows(scope, perOwner) {
  const byId = new Map(perOwner.map((r) => [r._id ? String(r._id) : 'unassigned', r]));
  const rows = scope.members.map((m) => ({ owner: String(m.adminId), name: m.name, employeeId: m.employeeId || '', row: byId.get(String(m.adminId)) }));
  if (scope.admin) {
    const known = new Set(rows.map((r) => r.owner));
    const others = perOwner.filter((r) => r._id && !known.has(String(r._id)));
    const people = await Admin.find({ _id: { $in: others.map((r) => r._id) } }, { firstName: 1, lastName: 1, email: 1 }).lean();
    const names = new Map(people.map((p) => [String(p._id), nameOf(p)]));
    for (const r of others) rows.push({ owner: String(r._id), name: names.get(String(r._id)) || 'Deleted user', employeeId: '', row: r, other: true });
    if (byId.has('unassigned')) rows.push({ owner: 'unassigned', name: 'Unassigned', employeeId: '', row: byId.get('unassigned'), unassigned: true });
  }
  return rows;
}

/** Lead Status table. `scope` = { members, admin } for a team, or { self } for a BD. */
async function leadStatusBoard(scope) {
  if (scope.self) {
    const me = oid(scope.self);
    const [[own], [shared]] = await Promise.all([
      Lead.aggregate([{ $match: { ...SALES, assignedTo: me } }, statusGroup(null)]),
      Lead.aggregate([{ $match: { ...SALES, 'sharedWith.admin': me, assignedTo: { $ne: me } } }, statusGroup(null)]),
    ]);
    const rows = [
      { owner: 'own', name: 'My leads (primary owner)', ...pickCounts(own) },
      { owner: 'shared', name: 'Shared with me (collaborator)', collaborator: true, ...pickCounts(shared) },
    ];
    // Owner totals only — shared leads belong to another BD's totals
    return { rows, totals: pickCounts(own) };
  }

  const ids = scope.members.map((m) => oid(m.adminId));
  const ownerMatch = scope.admin ? {} : { assignedTo: { $in: ids } };
  const [perOwner, collab] = await Promise.all([
    Lead.aggregate([{ $match: { ...SALES, ...ownerMatch } }, statusGroup('$assignedTo')]),
    Lead.aggregate([
      { $match: { ...SALES, 'sharedWith.admin': { $in: ids } } },
      { $unwind: '$sharedWith' },
      { $match: { 'sharedWith.admin': { $in: ids } } },
      { $group: { _id: '$sharedWith.admin', collaborating: { $sum: 1 }, collaboratingOpen: { $sum: { $cond: [{ $in: ['$status', TERMINAL_STATUSES] }, 0, 1] } } } },
    ]),
  ]);
  const collabBy = new Map(collab.map((r) => [String(r._id), r]));
  const rows = (await ownerRows(scope, perOwner)).map(({ row, ...r }) => ({
    ...r, ...pickCounts(row),
    collaborating: collabBy.get(r.owner)?.collaborating || 0,
    collaboratingOpen: collabBy.get(r.owner)?.collaboratingOpen || 0,
  }));
  // Each lead has one owner, so these totals are distinct leads
  return { rows, totals: sumRows(rows) };
}

const dayOf = { $dateToString: { format: '%Y-%m-%d', date: { $toDate: { $ifNull: ['$assignedAt', '$createdAt'] } }, timezone: TIME_ZONE } };

/** Pending Call view: owner × IST assignment date → count. */
async function pendingCallBoard(scope) {
  const group = (match) => Lead.aggregate([
    { $match: { ...SALES, ...NOT_CALLED, ...match } },
    { $group: { _id: { owner: '$assignedTo', day: dayOf }, count: { $sum: 1 } } },
  ]);
  const toDays = (rows) => Object.fromEntries(rows.map((r) => [r._id.day, r.count]));

  if (scope.self) {
    const me = oid(scope.self);
    const [own, shared] = await Promise.all([
      group({ assignedTo: me }),
      group({ 'sharedWith.admin': me, assignedTo: { $ne: me } }),
    ]);
    const owners = [
      { owner: 'own', name: 'My leads (primary owner)', days: toDays(own) },
      { owner: 'shared', name: 'Shared with me (collaborator)', collaborator: true, days: toDays(shared) },
    ];
    return finishPending(owners);
  }

  const ids = scope.members.map((m) => oid(m.adminId));
  const rows = await group(scope.admin ? { assignedTo: { $ne: null } } : { assignedTo: { $in: ids } });
  const perOwner = [...new Map(rows.map((r) => [String(r._id.owner), { _id: r._id.owner }])).values()];
  const owners = (await ownerRows({ ...scope, admin: scope.admin }, perOwner)).map(({ row, ...r }) => ({
    ...r, days: toDays(rows.filter((x) => String(x._id.owner) === r.owner)),
  }));
  return finishPending(owners);
}

function finishPending(owners) {
  const days = [...new Set(owners.flatMap((o) => Object.keys(o.days)))].sort();
  const out = owners.map((o) => ({ ...o, total: Object.values(o.days).reduce((s, n) => s + n, 0) }));
  const totals = Object.fromEntries(days.map((d) => [d, out.filter((o) => !o.collaborator).reduce((s, o) => s + (o.days[d] || 0), 0)]));
  return { days, owners: out, totals, total: Object.values(totals).reduce((s, n) => s + n, 0) };
}

/**
 * The leads behind one count. `owner` = an Admin id | 'unassigned' (admin) |
 * 'own' / 'shared' (a BD); `bucket` = open|hold|won|lost|dropped|total|
 * collaborating for the status table, or `pending` with an optional `day`.
 * Returns null when `owner` is outside the scope.
 */
async function leadsFor(scope, { owner, bucket, day }) {
  let ownerMatch;
  if (scope.self) {
    const me = oid(scope.self);
    if (owner === 'own') ownerMatch = { assignedTo: me };
    else if (owner === 'shared') ownerMatch = { 'sharedWith.admin': me, assignedTo: { $ne: me } };
    else return null;
  } else {
    const allowed = scope.admin || scope.members.some((m) => String(m.adminId) === String(owner));
    if (owner === 'unassigned' && scope.admin) ownerMatch = { assignedTo: null };
    else if (allowed && mongoose.isValidObjectId(owner)) {
      ownerMatch = bucket === 'collaborating' ? { 'sharedWith.admin': oid(owner) } : { assignedTo: oid(owner) };
    } else return null;
  }

  const match = { ...SALES, ...ownerMatch };
  if (bucket === 'pending') Object.assign(match, NOT_CALLED);
  else if (bucket === 'collaborating' || bucket === 'collaboratingOpen') {
    if (bucket === 'collaboratingOpen') Object.assign(match, BUCKETS.open);
  } else if (BUCKETS[bucket]) Object.assign(match, BUCKETS[bucket]);
  else return null;

  const pipeline = [{ $match: match }];
  if (bucket === 'pending' && day) pipeline.push({ $match: { $expr: { $eq: [dayOf, day] } } });
  pipeline.push(
    { $sort: { assignedAt: 1, createdAt: 1 } },
    { $limit: 500 },
    { $lookup: { from: 'admins', localField: 'assignedTo', foreignField: '_id', as: 'ownerDoc' } },
    { $project: {
      leadId: 1, fullName: 1, businessName: 1, phone: 1, status: 1, interestLevel: 1, assignedAt: 1, createdAt: 1, lastCallAt: 1,
      nextFollowUpDate: 1, proposalValue: 1, dealValue: 1, dealCloseValue: 1,
      owner: { $let: { vars: { a: { $arrayElemAt: ['$ownerDoc', 0] } }, in: { $trim: { input: { $concat: [{ $ifNull: ['$$a.firstName', ''] }, ' ', { $ifNull: ['$$a.lastName', ''] }] } } } } },
    } },
  );
  return Lead.aggregate(pipeline);
}

module.exports = { leadStatusBoard, pendingCallBoard, leadsFor, NOT_CALLED };
