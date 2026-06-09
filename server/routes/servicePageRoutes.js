const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
  getServicePageBySlug,
  getServicePages,
  updateServicePage
} = require('../controllers/servicePageController');

// Public routes
router.get('/:slug', getServicePageBySlug);

// Protected routes
router.use(authMiddleware);
router.get('/', getServicePages);
router.put('/:slug', updateServicePage);

module.exports = router;
