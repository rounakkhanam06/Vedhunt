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
const requirePermission = require('../middleware/requirePermission');

// Public routes
router.post('/', createTestimonial);
router.get('/approved', getApprovedTestimonials);

// Admin routes
// All routes below are the Testimonials page in the Admin panel
router.use(authMiddleware, requirePermission('cms.manage'));
router.get('/', getAllTestimonials);
router.post('/admin', createAdminTestimonial);
router.put('/:id', updateTestimonial);
router.put('/:id/status', updateTestimonialStatus);
router.delete('/:id', deleteTestimonial);

module.exports = router;
