const Lead = require('../models/Lead');
const Admin = require('../models/Admin');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { TERMINAL_STATUSES, FOLLOWUP_TRIGGER_INTEREST_LEVELS, FOLLOWUP_TRIGGER_STATUSES, FOLLOW_UP_TYPES } = require('../utils/leadStateMachine');
const { latestNotes } = require('../services/leadCollaboration');

// A lead on Hold has no active follow-up requirement — it's paused, not overdue.
const NON_ACTIVE_STATUSES = [...TERMINAL_STATUSES, 'Hold'];

/** `?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD` as a Mongo range (whole days), or null when neither is set. */
function dateRangeFromQuery({ dateFrom, dateTo }) {
  if (!dateFrom && !dateTo) return null;
  const range = {};
  if (dateFrom) {
    range.$gte = new Date(dateFrom);
    range.$gte.setHours(0, 0, 0, 0);
  }
  if (dateTo) {
    range.$lte = new Date(dateTo);
    range.$lte.setHours(23, 59, 59, 999);
  }
  return range;
}

// A callLogs entry's time: loggedAt, or callDate on entries written before
// loggedAt existed.
const CALL_AT = { $ifNull: ['$callLogs.loggedAt', '$callLogs.callDate'] };

// @desc    Lead Activity — every call logged on the leads in the viewer's
//          scope (the lead's append-only callLogs, credited to whoever made
//          the call), newest first; services/callActivity.js. Filters:
//          ?by=<caller>, ?result=Connected|Not Connected, ?stage, ?client,
//          ?dateFrom/dateTo. Also returns per-caller counts for the same
//          filters (ignoring ?by) so the page can show "who made how many".
// @route   GET /api/admin/activity/calls
// @access  Private (leads.assign or dashboard.management)
// Every report is limited to the BDs in the person's lead scope
// (req.pageScope from requirePageAccess; null = every BD). Returns the
// Admin ids as ObjectIds, or null for no limit.
const { assigneeIds, leadFilter, oid } = require('../utils/leadScope');
const { listCallActivity } = require('../services/callActivity');
const { assignableAdminFilter } = require('../services/leadAssignment');
const displayNameOf = (a) => `${a.firstName || ''} ${a.lastName || ''}`.trim() || a.email || '';
const scopeIds = async (req) => {
  const ids = await assigneeIds(req);
  return ids && ids.map(oid);
};
// The ?by= "one BD" filter, kept inside the scope
const bdFilter = (req, ids) => {
  const by = req.query.by && req.query.by !== 'All' && mongoose.Types.ObjectId.isValid(req.query.by) ? String(req.query.by) : null;
  if (!ids) return by ? oid(by) : null;
  if (by) return ids.some((i) => String(i) === by) ? oid(by) : { $in: [] };
  return { $in: ids };
};

exports.getCallActivity = async (req, res, next) => {
  try {
    // Calls on the leads the viewer can see (owned or cross-assigned inside
    // their scope; everything for full access), filtered by caller/date/etc.
    const by = req.query.by && req.query.by !== 'All' && mongoose.Types.ObjectId.isValid(req.query.by) ? oid(req.query.by) : null;
    const data = await listCallActivity(await leadFilter(req), {
      ...req.query,
      by,
      period: dateRangeFromQuery(req.query),
    });
    res.status(200).json({ success: true, ...data });
  } catch (error) {
    logger.error('Error fetching call activity:', error);
    next(error);
  }
};

// @desc    Team-wide follow-up compliance — live snapshot of every active
//          lead with a scheduled follow-up, bucketed overdue/today/upcoming
//          per BD and team-wide. Feeds the Manager/CEO dashboard.
// @route   GET /api/admin/activity/followup-compliance
// @access  Private (leads.assign)
exports.getFollowUpCompliance = async (req, res, next) => {
  try {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const ids = await scopeIds(req);
    const leads = await Lead.find({
      assignedTo: ids ? { $in: ids } : { $ne: null },
      nextFollowUpDate: { $ne: null },
      status: { $nin: NON_ACTIVE_STATUSES }
    })
      .select('assignedTo nextFollowUpDate')
      .populate('assignedTo', 'firstName lastName email')
      .lean();

    const byBd = new Map();
    for (const lead of leads) {
      if (!lead.assignedTo) continue;
      const bdId = String(lead.assignedTo._id);
      if (!byBd.has(bdId)) {
        byBd.set(bdId, {
          bd: { _id: lead.assignedTo._id, firstName: lead.assignedTo.firstName, lastName: lead.assignedTo.lastName, email: lead.assignedTo.email },
          overdue: 0,
          dueToday: 0,
          upcoming: 0,
          total: 0
        });
      }
      const entry = byBd.get(bdId);
      const dueDate = new Date(lead.nextFollowUpDate);
      entry.total++;
      if (dueDate < todayStart) entry.overdue++;
      else if (dueDate <= todayEnd) entry.dueToday++;
      else entry.upcoming++;
    }

    const withOnTrackPct = (entry) => ({
      ...entry,
      onTrackPct: entry.total > 0 ? Math.round(((entry.total - entry.overdue) / entry.total) * 100) : 100
    });

    const byBdList = Array.from(byBd.values())
      .map(withOnTrackPct)
      .sort((a, b) => b.overdue - a.overdue);

    const totals = byBdList.reduce(
      (acc, e) => ({
        overdue: acc.overdue + e.overdue,
        dueToday: acc.dueToday + e.dueToday,
        upcoming: acc.upcoming + e.upcoming,
        total: acc.total + e.total
      }),
      { overdue: 0, dueToday: 0, upcoming: 0, total: 0 }
    );

    res.status(200).json({ success: true, totals: withOnTrackPct(totals), byBd: byBdList });
  } catch (error) {
    logger.error('Error fetching follow-up compliance:', error);
    next(error);
  }
};

// @desc    The actual list behind the compliance snapshot — every active
//          lead with a scheduled follow-up, across the whole team, filterable
//          by bucket (Overdue/Today/Upcoming) and by BD. Feeds the dedicated
//          admin Follow-ups page.
// @route   GET /api/admin/activity/followups
// @access  Private (leads.assign)
exports.getFollowUpsList = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    // Owned by, or cross-assigned to, someone in the scope (or the one ?by= BD)
    const ids = await scopeIds(req);
    const by = bdFilter(req, ids);
    const query = {
      nextFollowUpDate: { $ne: null },
      status: { $nin: NON_ACTIVE_STATUSES },
      $or: by ? [{ assignedTo: by }, { 'sharedWith.admin': by }] : [{ assignedTo: { $ne: null } }],
    };
    if (FOLLOW_UP_TYPES.includes(req.query.followUpType)) query.followUpType = req.query.followUpType;
    else if (req.query.followUpType === 'Not set') query.followUpType = { $in: [null, ''] };

    // Bucketed and ranged in JS, not via Mongo $gt/$lt — some legacy leads have
    // nextFollowUpDate stored as a plain string (raw-driver writes bypass
    // schema casting; see utils/leadLookup.js), and Mongo's date comparison
    // operators silently exclude cross-type values rather than coercing
    // them, so DB-level date filtering would miss those leads entirely.
    let leads = await Lead.find(query)
      .select('leadId fullName businessName phone service platform status interestLevel nextFollowUpDate nextActionType followUpType assignedTo sharedWith lastCallAt callDate callLogs.callDate lastActivityAt remark updatedAt')
      .populate('assignedTo', 'firstName lastName email')
      .lean();

    leads = leads.filter((l) => l.nextFollowUpDate && !Number.isNaN(new Date(l.nextFollowUpDate).getTime()));

    const bucketOf = (dateVal) => {
      const due = new Date(dateVal);
      // Same day-based buckets as the Employee Portal (employee/lib/leads.js)
      if (due < todayStart) return 'Overdue';
      if (due <= todayEnd) return 'Today';
      return 'Upcoming';
    };

    if (req.query.bucket && req.query.bucket !== 'All') {
      leads = leads.filter((l) => bucketOf(l.nextFollowUpDate) === req.query.bucket);
    }
    const from = req.query.dueFrom ? new Date(`${req.query.dueFrom}T00:00:00`) : null;
    const to = req.query.dueTo ? new Date(`${req.query.dueTo}T23:59:59.999`) : null;
    if (from || to) {
      leads = leads.filter((l) => {
        const due = new Date(l.nextFollowUpDate);
        return (!from || due >= from) && (!to || due <= to);
      });
    }

    // Earliest due first (so overdue rises to the top); same due time → most
    // recently updated first
    leads.sort((a, b) => (new Date(a.nextFollowUpDate) - new Date(b.nextFollowUpDate))
      || (new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)));

    const total = leads.length;
    const skip = (page - 1) * limit;
    const pageLeads = leads.slice(skip, skip + limit);
    const notes = await latestNotes(pageLeads.map((l) => l._id), req.user);

    const pageData = pageLeads.map(({ callLogs, sharedWith, remark, ...l }) => ({
      ...l,
      bucket: bucketOf(l.nextFollowUpDate),
      lastContactAt: l.lastCallAt || (callLogs || []).reduce((max, c) => (c.callDate && (!max || c.callDate > max) ? c.callDate : max), null) || l.callDate || null,
      latestNote: notes.get(String(l._id)) || (remark ? { text: remark, source: 'remark' } : null),
      sharedCount: (sharedWith || []).length,
    }));

    res.status(200).json({
      success: true,
      data: pageData,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      currentPage: page
    });
  } catch (error) {
    logger.error('Error fetching follow-ups list:', error);
    next(error);
  }
};

/** Which exception bucket a lead in the Action Missing queue falls into — the
 *  spec calls out Hot leads and Proposal/Negotiation leads as their own
 *  automatic-exception categories, not just one undifferentiated queue. */
function classifyException(lead) {
  if (FOLLOWUP_TRIGGER_INTEREST_LEVELS.includes(lead.interestLevel)) return 'Hot Lead';
  if (FOLLOWUP_TRIGGER_STATUSES.includes(lead.status)) return 'Proposal/Negotiation';
  return 'Other';
}

// @desc    Action Missing queue — every connected, still-active lead with no
//          scheduled next action. In steady state this should stay empty:
//          server/utils/leadStateMachine.js already requires a follow-up
//          date whenever a call is connected with a live interest level.
//          This exists as the safety net for legacy data or any bypass.
//          Categorized into Hot Lead / Proposal-Negotiation / Other exception
//          buckets, since those are the spec's own automatic-exception types.
// @route   GET /api/admin/activity/action-missing
// @access  Private (leads.assign)
exports.getActionMissingQueue = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const query = {
      connected: 'Yes',
      status: { $nin: NON_ACTIVE_STATUSES },
      $or: [{ nextFollowUpDate: null }, { nextFollowUpDate: { $exists: false } }, { nextFollowUpDate: '' }]
    };
    const ids = await scopeIds(req);
    const by = bdFilter(req, ids);
    if (by) query.assignedTo = by;

    // Category counts are computed over the full matching set (unpaginated,
    // filter-by-BD respected) so the dashboard's chip counts stay accurate
    // regardless of which page is currently shown.
    const allMatching = await Lead.find(query).select('interestLevel status').lean();
    const counts = { 'Hot Lead': 0, 'Proposal/Negotiation': 0, Other: 0 };
    for (const lead of allMatching) counts[classifyException(lead)]++;

    // Mirrors classifyException's priority order (interestLevel checked
    // before status) so a chip's contents always match the badge shown —
    // a Hot lead that's also in Proposal Sent is badged "Hot Lead", so it
    // must filter under that chip only, not "Proposal/Negotiation" too.
    if (req.query.category && req.query.category !== 'All') {
      if (req.query.category === 'Hot Lead') {
        query.interestLevel = { $in: FOLLOWUP_TRIGGER_INTEREST_LEVELS };
      } else if (req.query.category === 'Proposal/Negotiation') {
        query.interestLevel = { $nin: FOLLOWUP_TRIGGER_INTEREST_LEVELS };
        query.status = { $in: FOLLOWUP_TRIGGER_STATUSES };
      } else if (req.query.category === 'Other') {
        query.interestLevel = { $nin: FOLLOWUP_TRIGGER_INTEREST_LEVELS };
        query.status = { $nin: [...NON_ACTIVE_STATUSES, ...FOLLOWUP_TRIGGER_STATUSES] };
      }
    }

    const [leads, total] = await Promise.all([
      Lead.find(query)
        .select('leadId fullName phone service platform status interestLevel assignedTo callDate updatedAt')
        .populate('assignedTo', 'firstName lastName email')
        .sort({ callDate: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Lead.countDocuments(query)
    ]);

    const data = leads.map((lead) => ({ ...lead, exceptionType: classifyException(lead) }));

    res.status(200).json({ success: true, data, total, totalPages: Math.max(1, Math.ceil(total / limit)), currentPage: page, counts });
  } catch (error) {
    logger.error('Error fetching action-missing queue:', error);
    next(error);
  }
};

// @desc    Pipeline value & conversion summary for the Management Visibility
//          dashboard — count and value per stage, plus overall conversion rate.
// @route   GET /api/admin/activity/pipeline-summary
// @access  Private (leads.assign)
exports.getPipelineSummary = async (req, res, next) => {
  try {
    // Optional ?dateFrom/dateTo: only leads received in that period.
    const period = dateRangeFromQuery(req.query);
    const ids = await scopeIds(req);
    const rows = await Lead.aggregate([
      { $match: { leadType: { $in: ['Sales', null] }, ...(period && { createdAt: period }), ...(ids && { assignedTo: { $in: ids } }) } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          dealValue: { $sum: { $ifNull: ['$dealValue', 0] } },
          dealCloseValue: { $sum: { $ifNull: ['$dealCloseValue', 0] } },
          proposalValue: { $sum: { $ifNull: ['$proposalValue', 0] } }
        }
      }
    ]);

    const byStatus = {};
    let won = 0, lost = 0, dropped = 0;
    for (const row of rows) {
      byStatus[row._id] = { count: row.count, dealValue: row.dealValue, dealCloseValue: row.dealCloseValue, proposalValue: row.proposalValue };
      if (row._id === 'Won') won = row.count;
      if (row._id === 'Lost') lost = row.count;
      if (row._id === 'Dropped') dropped = row.count;
    }

    const closedCount = won + lost + dropped;
    const conversionRate = closedCount > 0 ? Math.round((won / closedCount) * 100) : 0;
    const pipelineValue = Object.entries(byStatus)
      .filter(([status]) => !NON_ACTIVE_STATUSES.includes(status))
      .reduce((sum, [, v]) => sum + (v.proposalValue || 0), 0);
    // Actual closed revenue, not the pre-close estimate — dealValue can keep
    // changing after a deal is Won, dealCloseValue is fixed at close time.
    const wonValue = byStatus.Won?.dealCloseValue || 0;

    res.status(200).json({ success: true, byStatus, conversionRate, pipelineValue, wonValue });
  } catch (error) {
    logger.error('Error fetching pipeline summary:', error);
    next(error);
  }
};

// @desc    Per-BD accountability — assigned load, calls and connect rate,
//          response time, and follow-up breaches. Feeds the Management
//          Visibility dashboard's BD accountability table. Every active BD
//          in the scope is listed (the live assignable roster), with zeros
//          when they had no activity; anyone else with activity is added.
//          Connect rate = connected calls ÷ calls made, credited to the BD who
//          made each call — the same definition as BDE Calling Performance.
// @route   GET /api/admin/activity/bd-accountability
// @access  Private (leads.assign)
exports.getBDAccountability = async (req, res, next) => {
  try {
    // Optional ?dateFrom/dateTo: lead metrics cover leads *assigned* in that
    // period; calls cover calls *made* in it.
    const period = dateRangeFromQuery(req.query);
    const callPeriod = period ? [{ $match: { $expr: { $and: [
      ...(period.$gte ? [{ $gte: [CALL_AT, period.$gte] }] : []),
      ...(period.$lte ? [{ $lte: [CALL_AT, period.$lte] }] : []),
    ] } } }] : [];

    const ids = await scopeIds(req);
    const [leadRows, callRows, noOutcomeRows] = await Promise.all([
      Lead.aggregate([
        { $match: { assignedTo: ids ? { $in: ids } : { $ne: null }, ...(period && { assignedAt: period }) } },
        {
          $group: {
            _id: '$assignedTo',
            assignedCount: { $sum: 1 },
            breachCount: { $sum: { $cond: [{ $eq: ['$followUpBreached', true] }, 1, 0] } },
            totalResponseMs: {
              $sum: {
                $cond: [
                  { $and: ['$firstCallAt', '$assignedAt'] },
                  { $subtract: ['$firstCallAt', '$assignedAt'] },
                  0
                ]
              }
            },
            respondedCount: { $sum: { $cond: [{ $and: ['$firstCallAt', '$assignedAt'] }, 1, 0] } }
          }
        }
      ]),
      // Calls are credited to whoever made them (callLogs.calledBy), not to
      // whoever the lead is assigned to now — a reassigned lead keeps its
      // earlier calls with the BD who made them.
      Lead.aggregate([
        { $unwind: '$callLogs' },
        { $match: { 'callLogs.calledBy': ids ? { $in: ids } : { $ne: null } } },
        ...callPeriod,
        { $group: { _id: '$callLogs.calledBy', callsMade: { $sum: 1 }, connectedCalls: { $sum: { $cond: [{ $eq: ['$callLogs.connected', 'Yes'] }, 1, 0] } } } }
      ]),
      // Start Call pressed but no outcome ever saved for that call — the
      // lead's latest callStartTime has no matching callLogs entry. Credited
      // to whoever started it (callStartedBy), else the assignee.
      Lead.aggregate([
        { $match: { callStartTime: { $ne: null }, ...(period && { callStartTime: period }) } },
        { $project: {
          by: { $ifNull: ['$callStartedBy', '$assignedTo'] },
          logged: { $in: ['$callStartTime', { $ifNull: ['$callLogs.callStartTime', []] }] }
        } },
        { $match: { logged: false, by: ids ? { $in: ids } : { $ne: null } } },
        { $group: { _id: '$by', noOutcomeCount: { $sum: 1 } } }
      ])
    ]);

    const byBd = new Map();
    const row = (id) => {
      const key = String(id);
      if (!byBd.has(key)) byBd.set(key, { _id: id, assignedCount: 0, breachCount: 0, totalResponseMs: 0, respondedCount: 0, callsMade: 0, connectedCalls: 0, noOutcomeCount: 0 });
      return byBd.get(key);
    };
    // Every active BD in the scope, straight from the roster — no fixed list
    const roster = await Admin.find({ ...(await assignableAdminFilter()), ...(ids && { _id: { $in: ids } }) }, { _id: 1 }).lean();
    for (const a of roster) row(a._id);
    for (const r of leadRows) Object.assign(row(r._id), r);
    for (const r of callRows) Object.assign(row(r._id), { callsMade: r.callsMade, connectedCalls: r.connectedCalls });
    for (const r of noOutcomeRows) row(r._id).noOutcomeCount = r.noOutcomeCount;

    const admins = await Admin.find({ _id: { $in: [...byBd.values()].map((r) => r._id) } }, { firstName: 1, lastName: 1, email: 1 }).lean();
    const adminById = new Map(admins.map((a) => [String(a._id), a]));

    const rows = [...byBd.values()]
      .filter((r) => adminById.has(String(r._id)))
      .map((r) => {
        const a = adminById.get(String(r._id));
        return {
          bd: { _id: a._id, firstName: a.firstName, lastName: a.lastName, email: a.email },
          assignedCount: r.assignedCount,
          callsMade: r.callsMade,
          connectedCalls: r.connectedCalls,
          noOutcomeCount: r.noOutcomeCount,
          // null (shown as —) when no calls were made
          connectRate: r.callsMade > 0 ? Math.round((r.connectedCalls / r.callsMade) * 100) : null,
          breachCount: r.breachCount,
          avgResponseMinutes: r.respondedCount > 0 ? Math.round(r.totalResponseMs / r.respondedCount / 60000) : null
        };
      })
      .sort((x, y) => y.breachCount - x.breachCount || y.assignedCount - x.assignedCount || y.callsMade - x.callsMade
        || displayNameOf(x.bd).localeCompare(displayNameOf(y.bd)));

    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    logger.error('Error fetching BD accountability:', error);
    next(error);
  }
};

// A tier's-worth of the conversion-likelihood breakdown is only meaningful
// for leads still actually in play.
const OPEN_STATUS_FILTER = { $nin: NON_ACTIVE_STATUSES };
const LEAD_PRIORITY_ORDER = ['Hot', 'Warm', 'Normal', 'Low'];

// @desc    Lead volume/source/service breakdown (period-scoped) plus a
//          conversion-likelihood snapshot of the current open pipeline
//          (priority tiers + top-scored leads) — feeds the Management
//          Dashboard. Everything here is additive to the existing
//          pipeline-summary/bd-accountability/followup-compliance endpoints,
//          not a replacement.
// @route   GET /api/admin/activity/lead-volume
// @access  Private ('*' — see routes)
exports.getLeadVolumeBreakdown = async (req, res, next) => {
  try {
    const dateTo = req.query.dateTo ? new Date(req.query.dateTo) : new Date();
    dateTo.setHours(23, 59, 59, 999);
    const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom) : new Date(dateTo.getTime() - 30 * 24 * 60 * 60 * 1000);
    dateFrom.setHours(0, 0, 0, 0);

    const periodMatch = { leadType: { $in: ['Sales', null] }, createdAt: { $gte: dateFrom, $lte: dateTo } };

    const [periodResult] = await Lead.aggregate([
      { $match: periodMatch },
      {
        $facet: {
          total: [{ $count: 'count' }],
          byPlatform: [
            { $group: { _id: { $ifNull: ['$platform', 'Website'] }, count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ],
          byService: [
            { $group: { _id: { $ifNull: ['$service', 'Not specified'] }, count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 12 }
          ],
          trend: [
            { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
          ]
        }
      }
    ]);

    // Current-state snapshot below — NOT period-scoped by design: "what does
    // the live pipeline look like right now", a different lens than "what
    // came in during the selected period" above.
    const openMatch = { leadType: { $in: ['Sales', null] }, status: OPEN_STATUS_FILTER };

    const byPriorityRows = await Lead.aggregate([
      { $match: openMatch },
      {
        $group: {
          _id: { $ifNull: ['$leadPriority', 'Normal'] },
          count: { $sum: 1 },
          pipelineValue: { $sum: { $ifNull: ['$dealValue', 0] } }
        }
      }
    ]);
    const byPriority = LEAD_PRIORITY_ORDER.map((priority) => {
      const row = byPriorityRows.find((r) => r._id === priority);
      return { priority, count: row?.count || 0, pipelineValue: row?.pipelineValue || 0 };
    });

    const topScoredLeads = await Lead.find(openMatch)
      .select('leadId fullName leadScore leadPriority status dealValue assignedTo')
      .populate('assignedTo', 'firstName lastName')
      .sort({ leadScore: -1 })
      .limit(10)
      .lean();

    const unassignedCount = await Lead.countDocuments({
      leadType: { $in: ['Sales', null] }, assignedTo: null, status: OPEN_STATUS_FILTER
    });
    const unassignedSlaBreachedCount = await Lead.countDocuments({
      assignedTo: null, unassignedSlaAlerted: true, status: OPEN_STATUS_FILTER
    });

    res.status(200).json({
      success: true,
      period: { from: dateFrom, to: dateTo },
      totalLeads: periodResult.total[0]?.count || 0,
      byPlatform: periodResult.byPlatform.map((r) => ({ platform: r._id, count: r.count })),
      byService: periodResult.byService.map((r) => ({ service: r._id, count: r.count })),
      trend: periodResult.trend.map((r) => ({ date: r._id, count: r.count })),
      byPriority,
      topScoredLeads,
      unassignedCount,
      unassignedSlaBreachedCount
    });
  } catch (error) {
    logger.error('Error fetching lead volume breakdown:', error);
    next(error);
  }
};
