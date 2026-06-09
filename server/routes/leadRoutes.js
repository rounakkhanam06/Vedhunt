const express = require('express');
const router = express.Router();
const { createLead, getLeads, updateLeadStatus, deleteLead } = require('../controllers/leadController');
const authMiddleware = require('../middleware/authMiddleware');

// Public route to submit lead
router.post('/', createLead);

// Admin routes
router.get('/', authMiddleware, getLeads);
router.put('/:id', authMiddleware, updateLeadStatus);
router.delete('/:id', authMiddleware, deleteLead);

module.exports = router;
