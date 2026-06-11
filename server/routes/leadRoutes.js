const express = require('express');
const router = express.Router();
const { createLead, getLeads, updateLead, deleteLead } = require('../controllers/leadController');
const authMiddleware = require('../middleware/authMiddleware');

// Public route to submit lead
router.post('/', createLead);

// Admin routes
router.get('/', authMiddleware, getLeads);
router.put('/:id', authMiddleware, updateLead);
router.delete('/:id', authMiddleware, deleteLead);

module.exports = router;
