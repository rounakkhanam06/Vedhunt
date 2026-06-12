const express = require('express');
const router = express.Router();
const { createLead, getLeads, updateLead, deleteLead } = require('../controllers/leadController');
const authMiddleware = require('../middleware/authMiddleware');
const requirePermission = require('../middleware/requirePermission');

// Public route to submit lead
router.post('/', createLead);

// Admin routes
router.get('/', authMiddleware, requirePermission('leads.view'), getLeads);
router.put('/:id', authMiddleware, requirePermission('leads.view'), updateLead);
router.delete('/:id', authMiddleware, requirePermission('*'), deleteLead);

module.exports = router;
