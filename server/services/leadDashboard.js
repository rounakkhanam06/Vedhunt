// Leads Overview — the KPI tiles, charts and lists at the top of the page.
// One call, every section filtered the same way: Sales leads, optionally one
// platform (Source) / service / owner (BDE) / current status (Lead Stage).
// Definitions, so the numbers can be audited:
//
//   Cohort        = filtered leads whose createdAt falls in the period. Every
//                   count below except the Live ones is over the cohort, each
//                   lead under its CURRENT state, so the KPI tiles add up:
//                   Assigned + Unassigned = Received, Won/Lost/Dropped rates
//                   are ÷ Received.
//   Change %      = the same figure for the equally long period just before.
//   Open Pipeline = sum of dealValue (the running estimate) over the cohort's
//                   open leads (not Won/Lost/Dropped/Hold).
//   Never Contacted = cohort leads with no logged call.
//   Trend         = per day: leads received, and leads that moved to Won that
//                   day (pipelineHistory), whenever they were received.
//   Follow-ups    = Live: open, assigned leads by nextFollowUpDate — before
//                   today / today / the next 7 days. Ignore the period.
//   BDE-wise      = cohort by primary owner. Contacted = has a logged call;
//                   Qualified / Proposal = ever reached that stage or later
//                   (pipelineHistory or current status); Won / Lost = now.
//
// Days are whole days in the server timezone; the caller passes from/to.
const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const Admin = require('../models/Admin');
const { TERMINAL_STATUSES, INTEREST_LEVELS } = require('../utils/leadStateMachine');

const DAY = 24 * 60 * 60 * 1000;
const NON_ACTIVE_STATUSES = [...TERMINAL_STATUSES, 'Hold'];
const STAGES = ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation', 'Won', 'Lost', 'Dropped', 'Hold'];
const QUALIFIED_OR_LATER = ['Qualified', 'Proposal Sent', 'Negotiation', 'Won'];
const PROPOSAL_OR_LATER = ['Proposal Sent', 'Negotiation', 'Won'];

const nameOf = (p) => [p?.firstName, p?.lastName].filter(Boolean).join(' ').trim() || p?.email || 'Unknown';
const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);
/** % change from `prev` to `cur`; null when there is nothing to compare against. */
const change = (cur, prev) => (prev > 0 ? Math.round(((cur - prev) / prev) * 1000) / 10 : null);

/** The Source / Service / BDE / Stage filters as a Lead match. */
function filterMatch({ platform, service, assignedTo, status } = {}) {
  const match = { leadType: { $in: ['Sales', null] } };
  if (platform) match.platform = platform;
  if (service) match.service = service;
  if (assignedTo === 'Unassigned') match.assignedTo = null;
  else if (assignedTo && mongoose.Types.ObjectId.isValid(assignedTo)) match.assignedTo = new mongoose.Types.ObjectId(assignedTo);
  if (status && STAGES.includes(status)) match.status = status;
  return match;
}

/** Headline counts for one cohort — run for the period and the one before it. */
async function cohortKpis(match) {
  const [row] = await Lead.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        received: { $sum: 1 },
        assigned: { $sum: { $cond: [{ $ifNull: ['$assignedTo', false] }, 1, 0] } },
        won: { $sum: { $cond: [{ $eq: ['$status', 'Won'] }, 1, 0] } },
        lost: { $sum: { $cond: [{ $eq: ['$status', 'Lost'] }, 1, 0] } },
        dropped: { $sum: { $cond: [{ $eq: ['$status', 'Dropped'] }, 1, 0] } },
        openValue: {
          $sum: { $cond: [{ $in: ['$status', NON_ACTIVE_STATUSES] }, 0, { $ifNull: ['$dealValue', 0] }] },
        },
        neverContacted: { $sum: { $cond: [{ $gt: [{ $size: { $ifNull: ['$callLogs', []] } }, 0] }, 0, 1] } },
      },
    },
  ]);
  const k = row || { received: 0, assigned: 0, won: 0, lost: 0, dropped: 0, openValue: 0, neverContacted: 0 };
  return { ...k, unassigned: k.received - k.assigned };
}

/** @param {{from: Date, to: Date, platform?, service?, assignedTo?, status?}} opts */
async function leadDashboard({ from, to, ...filters }) {
  const base = filterMatch(filters);
  const cohort = { ...base, createdAt: { $gte: from, $lte: to } };
  const span = to.getTime() - from.getTime() + 1;
  const prevCohort = { ...base, createdAt: { $gte: new Date(from.getTime() - span), $lte: new Date(from.getTime() - 1) } };

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart.getTime() + DAY - 1);
  const weekEnd = new Date(todayEnd.getTime() + 7 * DAY);
  const liveOpen = { ...base, assignedTo: base.assignedTo ?? { $ne: null }, status: base.status && !NON_ACTIVE_STATUSES.includes(base.status) ? base.status : { $nin: NON_ACTIVE_STATUSES } };
  // An Unassigned or closed-stage filter leaves no live follow-ups
  const followUpsApply = base.assignedTo !== null && !(base.status && NON_ACTIVE_STATUSES.includes(base.status));

  const [cur, prev, [facets], wonTrend, followRows, overdueLeads, topLeads] = await Promise.all([
    cohortKpis(cohort),
    cohortKpis(prevCohort),
    Lead.aggregate([
      { $match: cohort },
      {
        $facet: {
          bySource: [{ $group: { _id: { $ifNull: ['$platform', 'Website'] }, count: { $sum: 1 } } }, { $sort: { count: -1 } }],
          byService: [{ $group: { _id: { $ifNull: ['$service', 'Not specified'] }, count: { $sum: 1 } } }, { $sort: { count: -1 } }],
          byStage: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
          byInterest: [{ $group: { _id: { $cond: [{ $in: ['$interestLevel', INTEREST_LEVELS] }, '$interestLevel', 'Not rated'] }, count: { $sum: 1 } } }],
          trend: [{ $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: tz() } }, count: { $sum: 1 } } }],
          byBde: [
            {
              $project: {
                assignedTo: 1,
                status: 1,
                contacted: { $gt: [{ $size: { $ifNull: ['$callLogs', []] } }, 0] },
                reached: { $setUnion: [{ $ifNull: ['$pipelineHistory.status', []] }, [{ $ifNull: ['$status', 'New'] }]] },
              },
            },
            {
              $group: {
                _id: '$assignedTo',
                assigned: { $sum: 1 },
                contacted: { $sum: { $cond: ['$contacted', 1, 0] } },
                qualified: { $sum: { $cond: [{ $gt: [{ $size: { $setIntersection: ['$reached', QUALIFIED_OR_LATER] } }, 0] }, 1, 0] } },
                proposal: { $sum: { $cond: [{ $gt: [{ $size: { $setIntersection: ['$reached', PROPOSAL_OR_LATER] } }, 0] }, 1, 0] } },
                won: { $sum: { $cond: [{ $eq: ['$status', 'Won'] }, 1, 0] } },
                lost: { $sum: { $cond: [{ $eq: ['$status', 'Lost'] }, 1, 0] } },
              },
            },
          ],
        },
      },
    ]),
    Lead.aggregate([
      { $match: { ...base, 'pipelineHistory.status': 'Won', status: 'Won' } },
      { $unwind: '$pipelineHistory' },
      { $match: { 'pipelineHistory.status': 'Won', 'pipelineHistory.date': { $gte: from, $lte: to } } },
      // A lead re-marked Won counts once, on its first Won date in the period
      { $group: { _id: '$_id', date: { $min: '$pipelineHistory.date' } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: tz() } }, count: { $sum: 1 } } },
    ]),
    followUpsApply ? Lead.aggregate([
      { $match: { ...liveOpen, nextFollowUpDate: { $ne: null, $lte: weekEnd } } },
      {
        $group: {
          _id: null,
          overdue: { $sum: { $cond: [{ $lt: ['$nextFollowUpDate', todayStart] }, 1, 0] } },
          dueToday: { $sum: { $cond: [{ $and: [{ $gte: ['$nextFollowUpDate', todayStart] }, { $lte: ['$nextFollowUpDate', todayEnd] }] }, 1, 0] } },
          upcoming: { $sum: { $cond: [{ $gt: ['$nextFollowUpDate', todayEnd] }, 1, 0] } },
        },
      },
    ]) : [],
    followUpsApply ? Lead.find({ ...liveOpen, nextFollowUpDate: { $lt: todayStart } })
      .select('leadId fullName nextFollowUpDate lastCallAt assignedTo')
      .populate('assignedTo', 'firstName lastName email')
      .sort({ nextFollowUpDate: 1 })
      .limit(10)
      .lean() : [],
    Lead.find({ ...base, ...(base.status ? {} : { status: { $nin: NON_ACTIVE_STATUSES } }) })
      .select('leadId fullName platform service leadScore dealValue status')
      .sort({ leadScore: -1, createdAt: -1 })
      .limit(10)
      .lean(),
  ]);

  const owners = facets.byBde.map((r) => r._id).filter(Boolean);
  const people = await Admin.find({ _id: { $in: owners } }, { firstName: 1, lastName: 1, email: 1 }).lean();
  const names = new Map(people.map((p) => [String(p._id), nameOf(p)]));

  const stageCount = Object.fromEntries(facets.byStage.map((r) => [r._id || 'New', r.count]));
  const stages = STAGES.map((stage) => ({ stage, count: stageCount[stage] || 0, pct: pct(stageCount[stage] || 0, cur.received) }));
  const openCount = stages.filter((s) => !NON_ACTIVE_STATUSES.includes(s.stage)).reduce((sum, s) => sum + s.count, 0);

  // One point per day of the period, zeros included
  const received = new Map(facets.trend.map((r) => [r._id, r.count]));
  const won = new Map(wonTrend.map((r) => [r._id, r.count]));
  const trend = [];
  for (let d = new Date(from); d <= to; d = new Date(d.getTime() + DAY)) {
    const key = dayKey(d);
    trend.push({ date: key, received: received.get(key) || 0, won: won.get(key) || 0 });
  }

  const bde = facets.byBde
    .map((r) => ({
      owner: r._id ? String(r._id) : 'Unassigned',
      name: r._id ? names.get(String(r._id)) || 'Deleted user' : 'Unassigned',
      assigned: r.assigned, contacted: r.contacted, qualified: r.qualified, proposal: r.proposal, won: r.won, lost: r.lost,
      convRate: pct(r.won, r.assigned),
    }))
    .sort((a, b) => (a.owner === 'Unassigned') - (b.owner === 'Unassigned') || b.assigned - a.assigned || a.name.localeCompare(b.name));
  const bdeTotal = bde.reduce((t, r) => {
    for (const k of ['assigned', 'contacted', 'qualified', 'proposal', 'won', 'lost']) t[k] += r[k];
    return t;
  }, { assigned: 0, contacted: 0, qualified: 0, proposal: 0, won: 0, lost: 0 });
  bdeTotal.convRate = pct(bdeTotal.won, bdeTotal.assigned);

  const f = followRows[0] || { overdue: 0, dueToday: 0, upcoming: 0 };

  return {
    kpis: {
      received: cur.received, receivedChange: change(cur.received, prev.received),
      assigned: cur.assigned, assignedChange: change(cur.assigned, prev.assigned), assignedPct: pct(cur.assigned, cur.received),
      unassigned: cur.unassigned, unassignedChange: change(cur.unassigned, prev.unassigned), unassignedPct: pct(cur.unassigned, cur.received),
      openValue: cur.openValue, openValueChange: change(cur.openValue, prev.openValue),
      won: cur.won, wonChange: change(cur.won, prev.won), wonPct: pct(cur.won, cur.received),
      lost: cur.lost, lostChange: change(cur.lost, prev.lost), lostPct: pct(cur.lost, cur.received),
      dropped: cur.dropped, droppedChange: change(cur.dropped, prev.dropped), droppedPct: pct(cur.dropped, cur.received),
      neverContacted: cur.neverContacted, neverContactedPct: pct(cur.neverContacted, cur.received),
      overdueFollowUps: f.overdue, followUpsToday: f.dueToday, followUpsUpcoming: f.upcoming,
    },
    trend,
    bySource: facets.bySource.map((r) => ({ name: r._id, count: r.count, pct: pct(r.count, cur.received) })),
    byService: facets.byService.map((r) => ({ name: r._id, count: r.count, pct: pct(r.count, cur.received) })),
    stages,
    byInterest: [...INTEREST_LEVELS, 'Not rated'].map((name) => {
      const count = facets.byInterest.find((r) => r._id === name)?.count || 0;
      return { name, count, pct: pct(count, cur.received) };
    }),
    statusSummary: [
      { name: 'Open', count: openCount },
      { name: 'Won', count: stageCount.Won || 0 },
      { name: 'Lost', count: stageCount.Lost || 0 },
      { name: 'Dropped', count: stageCount.Dropped || 0 },
      { name: 'Hold', count: stageCount.Hold || 0 },
    ].map((s) => ({ ...s, pct: pct(s.count, cur.received) })),
    topLeads,
    overdueLeads: overdueLeads.map((l) => ({
      _id: l._id, leadId: l.leadId, fullName: l.fullName,
      bde: l.assignedTo ? nameOf(l.assignedTo) : 'Unassigned',
      lastCallAt: l.lastCallAt, nextFollowUpDate: l.nextFollowUpDate,
      daysOverdue: Math.floor((todayStart.getTime() - startOfDay(l.nextFollowUpDate).getTime()) / DAY),
    })),
    bde: { rows: bde, totals: bdeTotal },
  };
}

function tz() {
  return process.env.TZ || 'Asia/Kolkata';
}
function startOfDay(d) {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x;
}
function dayKey(d) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

module.exports = { leadDashboard, filterMatch, change, pct };
