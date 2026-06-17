const express = require('express');
const router = express.Router();
const { submitContactForm, getInquiries, updateInquiryStatus, deleteInquiry } = require('../controllers/contactController');
const protect = require('../middleware/authMiddleware');
const authorize = require('../middleware/requirePermission');

// Public route to submit contact form
router.post('/', submitContactForm);

// Admin routes for managing inquiries
router.use(protect);
router.use(authorize('cms.manage'));

router.get('/', getInquiries);
router.put('/:id/status', updateInquiryStatus);
router.delete('/:id', deleteInquiry);

module.exports = router;
