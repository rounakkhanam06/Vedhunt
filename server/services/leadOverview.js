// Leads Overview dashboard — volume KPIs, Interest Level and Lead Stage
// (PRD 5.1–5.3). Definitions, so the numbers can be audited:
//
//   Leads Received  = Sales leads whose createdAt falls in the period.
//   Assigned Leads  = Sales leads whose assignedAt falls in the period and that
//                     are assigned now (an assignment event, so it can include
//                     leads received before the period).
//   Interest / Stage = the leads RECEIVED in the period, each counted once under
//                     its CURRENT interestLevel / status (a snapshot of that
//                     cohort, not a conversion history). Interest is one field
//                     with six values; a lead with none set is "Not rated", so
//                     every row adds up to Leads Received.
//   BD-wise         = by primary owner (assignedTo) only, plus an Unassigned
//                     row. A lead cross-assigned to other BDs (sharedWith) is
//                     still one lead under its owner, never counted twice.
//
// The period is whole days in the server timezone (IST by default), both ends
// included — the caller passes the already-resolved from/to.
const Lead = require('../models/Lead');
const Admin = require('../models/Admin');
const { INTEREST_LEVELS } = require('../utils/leadStateMachine');

const SALES = { leadType: { $in: ['Sales', null] } };
const NOT_RATED = 'Not rated';
const INTEREST_COLUMNS = [...INTEREST_LEVELS, NOT_RATED];
const STAGE_COLUMNS = ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation', 'Won', 'Lost', 'Dropped', 'Hold'];

const nameOf = (p) => [p?.firstName, p?.lastName].filter(Boolean).join(' ').trim() || p?.email || 'Unknown';
const zeroCounts = (columns) => Object.fromEntries(columns.map((c) => [c, 0]));

/**
 * Folds `{ _id: { owner, key }, count }` groups into one row per owner plus
 * totals. `names` maps owner id → display name. Pure, so it is unit-tested.
 */
function foldRows(groups, columns, names = new Map()) {
  const byOwner = new Map();
  const totals = { ...zeroCounts(columns), total: 0 };
  for (const { _id, count } of groups) {
    if (!columns.includes(_id.key)) continue;
    const owner = _id.owner ? String(_id.owner) : 'unassigned';
    if (!byOwner.has(owner)) {
      byOwner.set(owner, {
        owner,
        name: owner === 'unassigned' ? 'Unassigned' : names.get(owner) || 'Deleted user',
        unassigned: owner === 'unassigned',
        counts: zeroCounts(columns),
        total: 0,
      });
    }
    const row = byOwner.get(owner);
    row.counts[_id.key] += count;
    row.total += count;
    totals[_id.key] += count;
    totals.total += count;
  }
  const rows = [...byOwner.values()].sort((a, b) => (a.unassigned - b.unassigned) || a.name.localeCompare(b.name));
  return { columns, rows, totals };
}

/** @param {{from: Date, to: Date}} period whole-day bounds, both included */
async function leadOverview({ from, to }) {
  const range = { $gte: from, $lte: to };
  const [facets, [assignedRow]] = await Promise.all([
    Lead.aggregate([
      { $match: { ...SALES, createdAt: range } },
      {
        $facet: {
          interest: [{
            $group: {
              _id: {
                owner: '$assignedTo',
                key: { $cond: [{ $in: ['$interestLevel', INTEREST_LEVELS] }, '$interestLevel', NOT_RATED] },
              },
              count: { $sum: 1 },
            },
          }],
          stages: [{
            $group: {
              _id: { owner: '$assignedTo', key: { $cond: [{ $in: ['$status', STAGE_COLUMNS] }, '$status', 'New'] } },
              count: { $sum: 1 },
            },
          }],
          received: [{ $count: 'count' }],
        },
      },
    ]),
    Lead.aggregate([
      { $match: { ...SALES, assignedTo: { $ne: null }, assignedAt: range } },
      { $count: 'count' },
    ]),
  ]);
  const [{ interest, stages, received }] = facets;

  const ownerIds = [...new Set([...interest, ...stages].map((g) => g._id.owner).filter(Boolean).map(String))];
  const people = await Admin.find({ _id: { $in: ownerIds } }, { firstName: 1, lastName: 1, email: 1 }).lean();
  const names = new Map(people.map((p) => [String(p._id), nameOf(p)]));

  return {
    received: received[0]?.count || 0,
    assigned: assignedRow?.count || 0,
    interest: foldRows(interest, INTEREST_COLUMNS, names),
    stages: foldRows(stages, STAGE_COLUMNS, names),
  };
}

module.exports = { leadOverview, foldRows, INTEREST_COLUMNS, STAGE_COLUMNS, NOT_RATED };
