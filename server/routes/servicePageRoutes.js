const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const requirePermission = require('../middleware/requirePermission');
const {
  getServicePageBySlug,
  getServicePages,
  updateServicePage
} = require('../controllers/servicePageController');

// Public routes
router.get('/:slug', getServicePageBySlug);

// Protected routes
// Service Subpages in the Admin panel
router.use(authMiddleware, requirePermission('services.manage'));
router.get('/', getServicePages);
router.put('/:slug', updateServicePage);

module.exports = router;
