const Lead = require('../models/Lead');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { TERMINAL_STATUSES } = require('../utils/leadStateMachine');

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

// @desc    Action Missing queue — every connected, still-active lead with no
//          scheduled next action. In steady state this should stay empty:
//          server/utils/leadStateMachine.js already requires a follow-up
//          date whenever a call is connected with a live interest level.
//          This exists as the safety net for legacy data or any bypass.
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

    res.status(200).json({ success: true, data: leads, total, totalPages: Math.max(1, Math.ceil(total / limit)), currentPage: page });
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
          proposalValue: { $sum: { $ifNull: ['$proposalValue', 0] } }
        }
      }
    ]);

    const byStatus = {};
    let won = 0, lost = 0, dropped = 0;
    for (const row of rows) {
      byStatus[row._id] = { count: row.count, dealValue: row.dealValue, proposalValue: row.proposalValue };
      if (row._id === 'Won') won = row.count;
      if (row._id === 'Lost') lost = row.count;
      if (row._id === 'Dropped') dropped = row.count;
    }

    const closedCount = won + lost + dropped;
    const conversionRate = closedCount > 0 ? Math.round((won / closedCount) * 100) : 0;
    const pipelineValue = Object.entries(byStatus)
      .filter(([status]) => !NON_ACTIVE_STATUSES.includes(status))
      .reduce((sum, [, v]) => sum + (v.proposalValue || 0), 0);
    const wonValue = byStatus.Won?.dealValue || 0;

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
