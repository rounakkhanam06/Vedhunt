const express = require('express');
const router = express.Router();
const {
  createLead, getLeads, getLeadById, updateLead, deleteLead,
  assignLead, getAssignmentHistory
} = require('../controllers/leadController');
const authMiddleware = require('../middleware/authMiddleware');
const requirePermission = require('../middleware/requirePermission');

// Public route to submit lead
router.post('/', createLead);

// Admin routes
router.get('/', authMiddleware, requirePermission('leads.view'), getLeads);
router.get('/:id', authMiddleware, requirePermission('leads.view'), getLeadById);
router.get('/:id/assignment-history', authMiddleware, requirePermission('leads.view'), getAssignmentHistory);
router.post('/:id/assign', authMiddleware, requirePermission('leads.assign'), assignLead);
router.put('/:id', authMiddleware, requirePermission('leads.view'), updateLead);
router.delete('/:id', authMiddleware, requirePermission('*'), deleteLead);

module.exports = router;
