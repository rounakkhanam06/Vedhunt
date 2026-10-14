const express = require('express');
const router = express.Router();
const {
  getCallActivity, getFollowUpCompliance, getFollowUpsList,
  getActionMissingQueue, getPipelineSummary, getBDAccountability,
  getLeadVolumeBreakdown
} = require('../controllers/activityController');
const authMiddleware = require('../middleware/authMiddleware');
const requirePermission = require('../middleware/requirePermission');

// Lead Activity / Follow-ups reports need leads.assign; the reports the
// Management Dashboard reads are also open to dashboard.management.
const LEAD_REPORTS = 'leads.assign';
const DASHBOARD_REPORTS = ['leads.assign', 'dashboard.management'];

router.use(authMiddleware);

router.get('/calls', requirePermission(DASHBOARD_REPORTS), getCallActivity);
router.get('/followups', requirePermission(LEAD_REPORTS), getFollowUpsList);
router.get('/followup-compliance', requirePermission(DASHBOARD_REPORTS), getFollowUpCompliance);
router.get('/action-missing', requirePermission(DASHBOARD_REPORTS), getActionMissingQueue);
router.get('/pipeline-summary', requirePermission(DASHBOARD_REPORTS), getPipelineSummary);
router.get('/bd-accountability', requirePermission(DASHBOARD_REPORTS), getBDAccountability);
router.get('/lead-volume', requirePermission('dashboard.management'), getLeadVolumeBreakdown);
// BDE Team Performance — every BDE (managers use the Employee Portal tab).
router.use('/team-performance', requirePermission('team.performance'), require('./teamPerformanceRoutes'));

module.exports = router;
