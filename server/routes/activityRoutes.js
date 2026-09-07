const express = require('express');
const router = express.Router();
const {
  getCallActivity, getFollowUpCompliance, getFollowUpsList,
  getActionMissingQueue, getPipelineSummary, getBDAccountability,
  getLeadVolumeBreakdown
} = require('../controllers/activityController');
const authMiddleware = require('../middleware/authMiddleware');
const requirePermission = require('../middleware/requirePermission');

router.use(authMiddleware, requirePermission('leads.assign'));

router.get('/calls', getCallActivity);
router.get('/followup-compliance', getFollowUpCompliance);
router.get('/followups', getFollowUpsList);
router.get('/action-missing', getActionMissingQueue);
router.get('/pipeline-summary', getPipelineSummary);
router.get('/bd-accountability', getBDAccountability);
// Management Dashboard — Super Admin only, an extra gate stacked on top of
// this router's own leads.assign check.
router.get('/lead-volume', requirePermission('*'), getLeadVolumeBreakdown);

module.exports = router;
