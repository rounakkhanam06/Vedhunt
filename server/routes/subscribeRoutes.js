const express = require('express');
const router = express.Router();
const {
  subscribe,
  unsubscribe,
  getSubscribers,
  exportSubscribers,
  subscribeLimiter,
  broadcastNewsletter
} = require('../controllers/subscribeController');

const protect = require('../middleware/authMiddleware');
const requirePermission = require('../middleware/requirePermission');

// Public routes
router.post('/', subscribeLimiter, subscribe);
router.get('/unsubscribe/:token', unsubscribe);

// Admin protected routes
router.get('/admin/list', protect, requirePermission('cms.manage'), getSubscribers);
router.get('/admin/export', protect, requirePermission('cms.manage'), exportSubscribers);
router.post('/admin/broadcast', protect, requirePermission('*'), broadcastNewsletter);

module.exports = router;
