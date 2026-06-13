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
const authorize = require('../middleware/roleMiddleware');

// Public routes
router.post('/', subscribeLimiter, subscribe);
router.get('/unsubscribe/:token', unsubscribe);

// Admin protected routes
router.get('/admin/list', protect, authorize('SUPER_ADMIN', 'EDITOR'), getSubscribers);
router.get('/admin/export', protect, authorize('SUPER_ADMIN', 'EDITOR'), exportSubscribers);
router.post('/admin/broadcast', protect, authorize('SUPER_ADMIN'), broadcastNewsletter);

module.exports = router;
