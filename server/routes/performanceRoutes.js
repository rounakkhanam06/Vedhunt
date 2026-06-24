const express = require('express');
const mongoose = require('mongoose');
const PerformanceCycle = require('../models/PerformanceCycle');
const KPITarget = require('../models/KPITarget');
const PerformanceReview = require('../models/PerformanceReview');
const Employee = require('../models/Employee');
const Lead = require('../models/Lead');
const WorkLog = require('../models/WorkLog');
const authMiddleware = require('../middleware/authMiddleware');
const requirePermission = require('../middleware/requirePermission');
const logger = require('../utils/logger');

const router = express.Router();
router.use(authMiddleware);

const { METRIC_TYPES, ROLE_PRESETS } = require('../models/KPITarget');
const { getBand } = require('../models/PerformanceReview');

// ─── Helper: Recompute finalScore + band + rank for a cycle ────────────────
async function recomputeReviewForEmployee(cycleId, employeeId) {
  const targets = await KPITarget.find({ cycleId, employeeId });
  const finalScore = parseFloat(targets.reduce((sum, t) => sum + (t.weightedScore || 0), 0).toFixed(2));
  const performanceBand = getBand(finalScore);
  const isTopPerformer = finalScore >= 100;

  await PerformanceReview.findOneAndUpdate(
    { cycleId, employeeId },
    { finalScore, performanceBand, isTopPerformer },
    { upsert: true, new: true }
  );
}

// ─── Helper: Recompute company ranks for entire cycle ──────────────────────
async function recomputeRanks(cycleId) {
  const reviews = await PerformanceReview.find({ cycleId }).sort({ finalScore: -1 });
  for (let i = 0; i < reviews.length; i++) {
    reviews[i].companyRank = i + 1;
    await reviews[i].save();
  }
}

// ════════════════════════════════════════════════════════════════
// PERFORMANCE CYCLE ROUTES (Admin only)
// ════════════════════════════════════════════════════════════════

// GET /api/performance/cycles — list all cycles
router.get('/cycles', requirePermission('team.manage'), async (req, res) => {
  try {
    const cycles = await PerformanceCycle.find({})
      .populate('createdBy', 'firstName lastName email')
      .sort({ year: -1, quarter: -1 });
    res.json({ success: true, cycles });
  } catch (err) {
    logger.error('Error fetching cycles:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/performance/cycles — create new cycle
router.post('/cycles', requirePermission('team.manage'), async (req, res) => {
  try {
    const { title, quarter, year, startDate, endDate } = req.body;

    if (!title || !quarter || !year || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }
    if (!['Q1', 'Q2', 'Q3', 'Q4'].includes(quarter)) {
      return res.status(400).json({ success: false, message: 'Invalid quarter.' });
    }
    if (new Date(startDate) >= new Date(endDate)) {
      return res.status(400).json({ success: false, message: 'Start date must be before end date.' });
    }

    const cycle = await PerformanceCycle.create({
      title: title.trim(),
      quarter,
      year: Number(year),
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      createdBy: req.user._id
    });

    res.status(201).json({ success: true, cycle });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: `${err.keyValue?.quarter || ''} ${err.keyValue?.year || ''} cycle already exists.` });
    }
    logger.error('Error creating cycle:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/performance/cycles/:id — update or activate/close cycle
router.put('/cycles/:id', requirePermission('team.manage'), async (req, res) => {
  try {
    const { status, title, startDate, endDate } = req.body;
    const cycle = await PerformanceCycle.findById(req.params.id);
    if (!cycle) return res.status(404).json({ success: false, message: 'Cycle not found.' });

    // If activating, deactivate any other active cycle
    if (status === 'Active') {
      await PerformanceCycle.updateMany({ status: 'Active', _id: { $ne: cycle._id } }, { status: 'Closed' });
    }

    if (title)     cycle.title     = title.trim();
    if (status)    cycle.status    = status;
    if (startDate) cycle.startDate = new Date(startDate);
    if (endDate)   cycle.endDate   = new Date(endDate);

    await cycle.save();
    res.json({ success: true, cycle });
  } catch (err) {
    logger.error('Error updating cycle:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ════════════════════════════════════════════════════════════════
// ROLE PRESETS ROUTE
// ════════════════════════════════════════════════════════════════

// GET /api/performance/presets — return role presets + metric types
router.get('/presets', requirePermission('team.manage'), (req, res) => {
  res.json({ success: true, presets: ROLE_PRESETS, metricTypes: METRIC_TYPES });
});

// ════════════════════════════════════════════════════════════════
// KPI TARGET ROUTES (Admin only)
// ════════════════════════════════════════════════════════════════

// POST /api/performance/targets — assign KPI targets (bulk for one employee)
router.post('/targets', requirePermission('team.manage'), async (req, res) => {
  try {
    const { cycleId, employeeId, kpis } = req.body;
    // kpis = [{ metricType, targetValue, weightage, unit }]

    if (!cycleId || !employeeId || !Array.isArray(kpis) || kpis.length === 0) {
      return res.status(400).json({ success: false, message: 'cycleId, employeeId and kpis array are required.' });
    }

    // Validate cycle exists
    const cycle = await PerformanceCycle.findById(cycleId);
    if (!cycle) return res.status(404).json({ success: false, message: 'Cycle not found.' });

    // Validate employee exists
    const employee = await Employee.findById(employeeId);
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found.' });

    // Validate weightage sums to 100
    const totalWeight = kpis.reduce((sum, k) => sum + Number(k.weightage || 0), 0);
    if (Math.round(totalWeight) !== 100) {
      return res.status(400).json({ success: false, message: `Total weightage must equal 100%. Current total: ${totalWeight}%` });
    }

    // Validate metric types
    for (const kpi of kpis) {
      if (!METRIC_TYPES.includes(kpi.metricType)) {
        return res.status(400).json({ success: false, message: `Invalid metricType: ${kpi.metricType}` });
      }
    }

    // Delete existing KPIs for this employee+cycle and replace
    await KPITarget.deleteMany({ cycleId, employeeId });

    const created = await KPITarget.insertMany(
      kpis.map(k => ({
        cycleId,
        employeeId,
        metricType: k.metricType,
        targetValue: Number(k.targetValue),
        weightage: Number(k.weightage),
        unit: k.unit || '',
        actualValue: 0,
        autoFilled: false
      }))
    );

    // Create/reset PerformanceReview document
    await PerformanceReview.findOneAndUpdate(
      { cycleId, employeeId },
      { finalScore: 0, performanceBand: 'Pending', isTopPerformer: false, status: 'Pending' },
      { upsert: true }
    );

    res.status(201).json({ success: true, targets: created });
  } catch (err) {
    logger.error('Error assigning KPI targets:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/performance/targets/:cycleId — get all KPI targets for a cycle
router.get('/targets/:cycleId', requirePermission('team.manage'), async (req, res) => {
  try {
    const targets = await KPITarget.find({ cycleId: req.params.cycleId })
      .populate('employeeId', 'firstName lastName employeeId roleDept');
    res.json({ success: true, targets });
  } catch (err) {
    logger.error('Error fetching targets:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/performance/targets/employee/:employeeId/:cycleId — get KPIs for one employee
router.get('/targets/employee/:employeeId/:cycleId', async (req, res) => {
  try {
    const { employeeId, cycleId } = req.params;

    // Allow the employee themselves to view their own KPIs
    const emp = await Employee.findById(employeeId);
    if (!emp) return res.status(404).json({ success: false, message: 'Employee not found.' });

    const isOwnProfile = emp.adminId?.toString() === req.user._id.toString();
    const isAdmin = req.user?.permissions?.some(p => p === 'team.manage' || p === '*');

    if (!isOwnProfile && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const targets = await KPITarget.find({ employeeId, cycleId });
    res.json({ success: true, targets });
  } catch (err) {
    logger.error('Error fetching employee targets:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/performance/targets/:id/manual-actual — Manager manually sets actualValue (for ROAS, FollowUpQuality)
router.put('/targets/:id/manual-actual', requirePermission('team.manage'), async (req, res) => {
  try {
    const { actualValue } = req.body;
    if (actualValue === undefined || actualValue === null) {
      return res.status(400).json({ success: false, message: 'actualValue is required.' });
    }

    const target = await KPITarget.findById(req.params.id);
    if (!target) return res.status(404).json({ success: false, message: 'KPI target not found.' });

    target.actualValue = Number(actualValue);
    target.autoFilled = false;
    target.lastSyncedAt = new Date();
    await target.save(); // pre-save hook computes achievementPct + weightedScore

    await recomputeReviewForEmployee(target.cycleId, target.employeeId);
    await recomputeRanks(target.cycleId);

    res.json({ success: true, target });
  } catch (err) {
    logger.error('Error setting manual actual:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ════════════════════════════════════════════════════════════════
// AUTO-SYNC ACTUAL VALUES
// ════════════════════════════════════════════════════════════════

// POST /api/performance/sync-actual/:cycleId — auto-pull actuals for entire cycle
router.post('/sync-actual/:cycleId', requirePermission('team.manage'), async (req, res) => {
  try {
    const cycle = await PerformanceCycle.findById(req.params.cycleId);
    if (!cycle) return res.status(404).json({ success: false, message: 'Cycle not found.' });

    const targets = await KPITarget.find({ cycleId: req.params.cycleId }).populate('employeeId');
    const syncedCount = { success: 0, skipped: 0 };

    for (const target of targets) {
      const emp = target.employeeId;
      if (!emp) { syncedCount.skipped++; continue; }

      let actual = null;

      // ── Revenue: sum of dealValue from Lead where closedBy = emp._id and closedDate in cycle range
      if (target.metricType === 'Revenue') {
        const result = await Lead.aggregate([
          { $match: { closedBy: emp._id, closedDate: { $gte: cycle.startDate, $lte: cycle.endDate } } },
          { $group: { _id: null, total: { $sum: '$dealValue' } } }
        ]);
        actual = result[0]?.total || 0;
      }

      // ── LeadCount: count Won/Qualified leads where bd matches employee name
      else if (target.metricType === 'LeadCount') {
        const empFullName = `${emp.firstName} ${emp.lastName}`;
        actual = await Lead.countDocuments({
          bd: { $regex: new RegExp(empFullName, 'i') },
          status: { $in: ['Won', 'Qualified'] },
          createdAt: { $gte: cycle.startDate, $lte: cycle.endDate }
        });
      }

      // ── ProductivityPct: from WorkLog
      else if (target.metricType === 'ProductivityPct') {
        const logs = await WorkLog.find({
          employeeId: emp._id,
          date: { $gte: cycle.startDate, $lte: cycle.endDate }
        });
        const productiveMinutes = logs.filter(l => l.isProductive).reduce((s, l) => s + l.duration, 0);
        // Target: 8.5hrs/day × working days in cycle
        const workingDays = Math.max(1, Math.ceil((cycle.endDate - cycle.startDate) / (1000 * 60 * 60 * 24)) * 5 / 7);
        const targetMinutes = workingDays * 8.5 * 60;
        actual = parseFloat(((productiveMinutes / targetMinutes) * 100).toFixed(2));
      }

      // ── BillableHours: from WorkLog
      else if (target.metricType === 'BillableHours') {
        const logs = await WorkLog.find({
          employeeId: emp._id,
          isBillable: true,
          date: { $gte: cycle.startDate, $lte: cycle.endDate }
        });
        const billableMinutes = logs.reduce((s, l) => s + l.duration, 0);
        actual = parseFloat((billableMinutes / 60).toFixed(2));
      }

      // ── AttendancePct: from Employee.attendance[]
      else if (target.metricType === 'AttendancePct') {
        const attendance = emp.attendance?.filter(a => {
          const d = new Date(a.date);
          return d >= cycle.startDate && d <= cycle.endDate;
        }) || [];
        const presentDays = attendance.filter(a => a.status === 'Present').length;
        const workingDays = attendance.filter(a => a.status !== 'Weekend').length;
        actual = workingDays > 0 ? parseFloat(((presentDays / workingDays) * 100).toFixed(2)) : 0;
      }

      // ── OnTimeDelivery: from Employee.tasks[]
      else if (target.metricType === 'OnTimeDelivery') {
        const tasks = emp.tasks?.filter(t => {
          const due = new Date(t.dueDate);
          return due >= cycle.startDate && due <= cycle.endDate;
        }) || [];
        if (tasks.length > 0) {
          const onTime = tasks.filter(t => t.status === 'Completed').length;
          actual = parseFloat(((onTime / tasks.length) * 100).toFixed(2));
        } else {
          actual = 0;
        }
      }

      // CampaignROAS and FollowUpQuality are manual — skip auto-sync
      else {
        syncedCount.skipped++;
        continue;
      }

      if (actual !== null) {
        target.actualValue = actual;
        target.autoFilled = true;
        target.lastSyncedAt = new Date();
        await target.save(); // triggers pre-save hook
        syncedCount.success++;
      }
    }

    // Recompute all reviews and ranks for this cycle
    const uniqueEmployeeIds = [...new Set(targets.map(t => t.employeeId._id?.toString()))];
    for (const empId of uniqueEmployeeIds) {
      await recomputeReviewForEmployee(req.params.cycleId, empId);
    }
    await recomputeRanks(req.params.cycleId);

    res.json({ success: true, message: `Sync complete. ${syncedCount.success} KPIs synced, ${syncedCount.skipped} skipped (manual).` });
  } catch (err) {
    logger.error('Error syncing actuals:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ════════════════════════════════════════════════════════════════
// REVIEW ROUTES
// ════════════════════════════════════════════════════════════════

// POST /api/performance/review/self — Employee submits self review (ESS)
router.post('/review/self', async (req, res) => {
  try {
    const { cycleId, achievements, challenges, learning, supportNeeded, selfRating } = req.body;

    if (!cycleId) return res.status(400).json({ success: false, message: 'cycleId is required.' });
    if (!selfRating || selfRating < 1 || selfRating > 5) {
      return res.status(400).json({ success: false, message: 'Self rating must be between 1 and 5.' });
    }

    const emp = await Employee.findOne({ adminId: req.user._id });
    if (!emp) return res.status(404).json({ success: false, message: 'Employee not found.' });

    // Check if already submitted (lock after first submit)
    const existing = await PerformanceReview.findOne({ cycleId, employeeId: emp._id });
    if (existing?.selfReview?.isSubmitted) {
      return res.status(400).json({ success: false, message: 'Self review already submitted and locked.' });
    }

    const review = await PerformanceReview.findOneAndUpdate(
      { cycleId, employeeId: emp._id },
      {
        selfReview: {
          achievements:  achievements  || '',
          challenges:    challenges    || '',
          learning:      learning      || '',
          supportNeeded: supportNeeded || '',
          selfRating:    Number(selfRating),
          submittedAt:   new Date(),
          isSubmitted:   true
        },
        status: 'SelfSubmitted'
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, review });
  } catch (err) {
    logger.error('Error submitting self review:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/performance/review/manager/:reviewId — Manager submits review
router.post('/review/manager/:reviewId', requirePermission('team.manage'), async (req, res) => {
  try {
    const { managerRating, managerFeedback } = req.body;

    if (!managerRating || managerRating < 1 || managerRating > 5) {
      return res.status(400).json({ success: false, message: 'Manager rating must be between 1 and 5.' });
    }
    if (!managerFeedback?.trim()) {
      return res.status(400).json({ success: false, message: 'Manager feedback is required.' });
    }

    const review = await PerformanceReview.findById(req.params.reviewId);
    if (!review) return res.status(404).json({ success: false, message: 'Review not found.' });

    review.managerReview = {
      managerRating:   Number(managerRating),
      managerFeedback: managerFeedback.trim(),
      reviewDate:      new Date(),
      reviewedBy:      req.user._id,  // WHO reviewed — stored as Admin ObjectId
      isSubmitted:     true
    };
    review.status = 'ManagerReviewed';
    await review.save();

    await recomputeRanks(review.cycleId);

    const populated = await PerformanceReview.findById(review._id)
      .populate('managerReview.reviewedBy', 'firstName lastName email');

    res.json({ success: true, review: populated });
  } catch (err) {
    logger.error('Error submitting manager review:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ════════════════════════════════════════════════════════════════
// REPORTING ROUTES
// ════════════════════════════════════════════════════════════════

// GET /api/performance/company-matrix/:cycleId — Admin: full ranked company table
router.get('/company-matrix/:cycleId', requirePermission('team.manage'), async (req, res) => {
  try {
    const reviews = await PerformanceReview.find({ cycleId: req.params.cycleId })
      .populate('employeeId', 'firstName lastName employeeId roleDept')
      .populate('managerReview.reviewedBy', 'firstName lastName')
      .sort({ companyRank: 1 });

    // Attach KPI summary to each
    const matrix = await Promise.all(reviews.map(async (rv) => {
      const targets = await KPITarget.find({ cycleId: req.params.cycleId, employeeId: rv.employeeId._id });
      return {
        review:  rv.toObject(),
        targets
      };
    }));

    res.json({ success: true, matrix });
  } catch (err) {
    logger.error('Error fetching company matrix:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/performance/scorecard/me/:cycleId — Employee views own scorecard (ESS)
router.get('/scorecard/me/:cycleId', async (req, res) => {
  try {
    const emp = await Employee.findOne({ adminId: req.user._id });
    if (!emp) return res.status(404).json({ success: false, message: 'Employee not found.' });

    const targets = await KPITarget.find({ cycleId: req.params.cycleId, employeeId: emp._id });
    const review = await PerformanceReview.findOne({ cycleId: req.params.cycleId, employeeId: emp._id })
      .populate('managerReview.reviewedBy', 'firstName lastName');
    const cycle  = await PerformanceCycle.findById(req.params.cycleId);

    res.json({ success: true, targets, review, cycle });
  } catch (err) {
    logger.error('Error fetching scorecard:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/performance/history/me — Employee views all past cycles (ESS)
router.get('/history/me', async (req, res) => {
  try {
    const emp = await Employee.findOne({ adminId: req.user._id });
    if (!emp) return res.status(404).json({ success: false, message: 'Employee not found.' });

    const reviews = await PerformanceReview.find({ employeeId: emp._id })
      .populate('cycleId', 'title quarter year status')
      .populate('managerReview.reviewedBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.json({ success: true, history: reviews });
  } catch (err) {
    logger.error('Error fetching history:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/performance/active-cycle — get currently active cycle
router.get('/active-cycle', async (req, res) => {
  try {
    const cycle = await PerformanceCycle.findOne({ status: 'Active' });
    res.json({ success: true, cycle: cycle || null });
  } catch (err) {
    logger.error('Error fetching active cycle:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
