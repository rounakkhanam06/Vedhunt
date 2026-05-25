const express = require('express');
const router = express.Router();
const {
  createTestimonial,
  getApprovedTestimonials,
  getAllTestimonials,
  updateTestimonialStatus,
  createAdminTestimonial,
  updateTestimonial,
  deleteTestimonial,
} = require('../controllers/testimonialController');
const authMiddleware = require('../middleware/authMiddleware');

// Public routes
router.post('/', createTestimonial);
router.get('/approved', getApprovedTestimonials);

// Admin routes
router.use(authMiddleware); // All routes below require admin authentication
router.get('/', getAllTestimonials);
router.post('/admin', createAdminTestimonial);
router.put('/:id', updateTestimonial);
router.put('/:id/status', updateTestimonialStatus);
router.delete('/:id', deleteTestimonial);

module.exports = router;
