const Lead = require('../models/Lead');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

// pipelineHistory entries a BD's call outcome writes (see leadController.js's
// updateLead and employeePortalRoutes.js's PUT /ess/leads/:id).
const CALL_STATUSES = ['Call connected', 'Call not connected'];

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
      status: { $nin: ['Won', 'Lost', 'Dropped'] }
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
      status: { $nin: ['Won', 'Lost', 'Dropped'] }
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
