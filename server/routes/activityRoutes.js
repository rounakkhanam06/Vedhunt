const express = require('express');
const router = express.Router();
const {
  getCallActivity, getFollowUpCompliance, getFollowUpsList,
  getActionMissingQueue, getPipelineSummary, getBDAccountability,
  getLeadVolumeBreakdown, getLeadDashboard
} = require('../controllers/activityController');
const authMiddleware = require('../middleware/authMiddleware');
const requirePermission = require('../middleware/requirePermission');
const requirePageAccess = require('../middleware/requirePageAccess');

// Lead reports, limited to the person's lead scope (controllers/activityController.js).
// The follow-ups list belongs to the Follow-ups page (role: leads.assign). The
// other reports are shared by Follow-ups and Lead Activity (role: leads.assign,
// or dashboard.management, which the Management Dashboard reads with).
// No auth here: mounted behind the Admin auth below and behind the Employee
// Portal auth for person-wise grants.
const scoped = express.Router();
const REPORTS = requirePageAccess([['followups', 'view'], ['lead-activity', 'view']]);

scoped.get('/calls', REPORTS, getCallActivity);
scoped.get('/followups', requirePageAccess('followups', 'view'), getFollowUpsList);
scoped.get('/followup-compliance', REPORTS, getFollowUpCompliance);
scoped.get('/action-missing', REPORTS, getActionMissingQueue);
scoped.get('/pipeline-summary', REPORTS, getPipelineSummary);
scoped.get('/bd-accountability', REPORTS, getBDAccountability);

router.use(authMiddleware);
router.use(scoped);
router.get('/lead-volume', requirePermission('dashboard.management'), getLeadVolumeBreakdown);
router.get('/lead-dashboard', requirePermission('dashboard.management'), getLeadDashboard);
// BDE Team Performance — every BDE (managers use the Employee Portal tab).
router.use('/team-performance', requirePermission('team.performance'), require('./teamPerformanceRoutes'));

module.exports = router;
module.exports.scopedActivityRouter = scoped;
