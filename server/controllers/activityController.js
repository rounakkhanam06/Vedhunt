const Lead = require('../models/Lead');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { TERMINAL_STATUSES, FOLLOWUP_TRIGGER_INTEREST_LEVELS, FOLLOWUP_TRIGGER_STATUSES } = require('../utils/leadStateMachine');

// pipelineHistory entries a BD's call outcome writes (see leadController.js's
// updateLead and employeePortalRoutes.js's PUT /ess/leads/:id).
const CALL_STATUSES = ['Call connected', 'Call not connected'];

// A lead on Hold has no active follow-up requirement — it's paused, not overdue.
const NON_ACTIVE_STATUSES = [...TERMINAL_STATUSES, 'Hold'];

// @desc    Cross-BD call activity feed — every "Call connected"/"Call not
//          connected" entry across all leads, newest first.
// @route   GET /api/admin/activity/calls
// @access  Private (leads.assign)
exports.getCallActivity = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const match = { 'pipelineHistory.status': { $in: CALL_STATUSES } };
    if (req.query.by && req.query.by !== 'All') {
      match['pipelineHistory.updatedBy'] = new mongoose.Types.ObjectId(req.query.by);
    }
    if (req.query.result === 'Connected') {
      match['pipelineHistory.status'] = 'Call connected';
    } else if (req.query.result === 'Not Connected') {
      match['pipelineHistory.status'] = 'Call not connected';
    }

    const [result] = await Lead.aggregate([
      { $unwind: '$pipelineHistory' },
      { $match: match },
      { $sort: { 'pipelineHistory.date': -1 } },
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limit },
            {
              $lookup: {
                from: 'admins',
                localField: 'pipelineHistory.updatedBy',
                foreignField: '_id',
                as: 'byAdmin'
              }
            },
            {
              $project: {
                _id: 0,
                leadId: '$_id',
                leadDisplayId: '$leadId',
                leadName: '$fullName',
                leadPhone: '$phone',
                status: '$pipelineHistory.status',
                note: '$pipelineHistory.note',
                date: '$pipelineHistory.date',
                by: {
                  $let: {
                    vars: { a: { $arrayElemAt: ['$byAdmin', 0] } },
                    // firstName/lastName aren't guaranteed — the original
                    // legacy admin seed account predates those being
                    // required, so email is included as a display fallback.
                    in: { $cond: [{ $ifNull: ['$$a', false] }, { _id: '$$a._id', firstName: '$$a.firstName', lastName: '$$a.lastName', email: '$$a.email' }, null] }
                  }
                }
              }
            }
          ],
          totalCount: [{ $count: 'count' }]
        }
      }
    ]);

    const data = result?.data || [];
    const total = result?.totalCount?.[0]?.count || 0;

    res.status(200).json({
      success: true,
      data,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page
    });
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

    const leads = await Lead.find({
      assignedTo: { $ne: null },
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

    const query = {
      assignedTo: { $ne: null },
      nextFollowUpDate: { $ne: null },
      status: { $nin: NON_ACTIVE_STATUSES }
    };
    if (req.query.by && req.query.by !== 'All') {
      query.assignedTo = new mongoose.Types.ObjectId(req.query.by);
    }

    // Bucketed in JS, not via Mongo $gt/$lt — some legacy leads have
    // nextFollowUpDate stored as a plain string (raw-driver writes bypass
    // schema casting; see utils/leadLookup.js), and Mongo's date comparison
    // operators silently exclude cross-type values rather than coercing
    // them, so DB-level date filtering would miss those leads entirely.
    let leads = await Lead.find(query)
      .select('leadId fullName phone service platform status interestLevel nextFollowUpDate assignedTo')
      .populate('assignedTo', 'firstName lastName email')
      .lean();

    leads = leads.filter((l) => l.nextFollowUpDate);

    const bucketOf = (dateVal) => {
      const due = new Date(dateVal);
      if (due < todayStart) return 'Overdue';
      if (due <= todayEnd) return 'Today';
      return 'Upcoming';
    };

    if (req.query.bucket && req.query.bucket !== 'All') {
      leads = leads.filter((l) => bucketOf(l.nextFollowUpDate) === req.query.bucket);
    }

    leads.sort((a, b) => new Date(a.nextFollowUpDate) - new Date(b.nextFollowUpDate));

    const total = leads.length;
    const skip = (page - 1) * limit;
    const pageData = leads.slice(skip, skip + limit).map((l) => ({ ...l, bucket: bucketOf(l.nextFollowUpDate) }));

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
    if (req.query.by && req.query.by !== 'All') {
      query.assignedTo = new mongoose.Types.ObjectId(req.query.by);
    }

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
    const rows = await Lead.aggregate([
      { $match: { leadType: { $in: ['Sales', null] } } },
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

// @desc    Per-BD accountability — assigned load, call outcomes, response
//          time, and follow-up breaches. Feeds the Management Visibility
//          dashboard's BD accountability table.
// @route   GET /api/admin/activity/bd-accountability
// @access  Private (leads.assign)
exports.getBDAccountability = async (req, res, next) => {
  try {
    const rows = await Lead.aggregate([
      { $match: { assignedTo: { $ne: null } } },
      {
        $group: {
          _id: '$assignedTo',
          assignedCount: { $sum: 1 },
          callsMade: { $sum: { $size: { $ifNull: ['$callLogs', []] } } },
          connectedCount: { $sum: { $cond: [{ $eq: ['$connected', 'Yes'] }, 1, 0] } },
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
      },
      { $lookup: { from: 'admins', localField: '_id', foreignField: '_id', as: 'admin' } },
      { $unwind: '$admin' },
      {
        $project: {
          _id: 0,
          bd: { _id: '$admin._id', firstName: '$admin.firstName', lastName: '$admin.lastName', email: '$admin.email' },
          assignedCount: 1,
          callsMade: 1,
          connectRate: {
            $cond: [{ $gt: ['$assignedCount', 0] }, { $round: [{ $multiply: [{ $divide: ['$connectedCount', '$assignedCount'] }, 100] }, 0] }, 0]
          },
          breachCount: 1,
          avgResponseMinutes: {
            $cond: [{ $gt: ['$respondedCount', 0] }, { $round: [{ $divide: [{ $divide: ['$totalResponseMs', '$respondedCount'] }, 60000] }, 0] }, null]
          }
        }
      },
      { $sort: { breachCount: -1, assignedCount: -1 } }
    ]);

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
