const express = require('express');
const router = express.Router();
const {
  getAssignableBDs, getAssignmentSettings, updateAssignmentSettings,
  listRules, createRule, updateRule, deleteRule,
  getLeadScoringConfig, updateLeadScoringConfig
} = require('../controllers/assignmentController');
const authMiddleware = require('../middleware/authMiddleware');
const requirePermission = require('../middleware/requirePermission');

router.use(authMiddleware, requirePermission('leads.assign'));

router.get('/bds', getAssignableBDs);

router.get('/settings', getAssignmentSettings);
router.put('/settings', updateAssignmentSettings);

router.get('/rules', listRules);
router.post('/rules', createRule);
router.put('/rules/:id', updateRule);
router.delete('/rules/:id', deleteRule);

router.get('/scoring-settings', getLeadScoringConfig);
router.put('/scoring-settings', updateLeadScoringConfig);

module.exports = router;
