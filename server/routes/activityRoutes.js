const express = require('express');
const router = express.Router();
const { getCallActivity, getFollowUpCompliance, getFollowUpsList } = require('../controllers/activityController');
const authMiddleware = require('../middleware/authMiddleware');
const requirePermission = require('../middleware/requirePermission');

router.use(authMiddleware, requirePermission('leads.assign'));

router.get('/calls', getCallActivity);
router.get('/followup-compliance', getFollowUpCompliance);
router.get('/followups', getFollowUpsList);

module.exports = router;
