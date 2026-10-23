const express = require('express');
const router = express.Router();
const {
  subscribe,
  unsubscribe,
  getSubscribers,
  addSubscriber,
  toggleSubscriberStatus,
  deleteSubscriber,
  exportSubscribers,
  subscribeLimiter,
  broadcastNewsletter
} = require('../controllers/subscribeController');

const protect = require('../middleware/authMiddleware');
const requirePermission = require('../middleware/requirePermission');

// Defined permissions for Newsletter Management (grants to newsletter.manage or cms.manage)
const NEWSLETTER_PERMISSIONS = ['newsletter.manage', 'cms.manage'];

// Public routes
router.post('/', subscribeLimiter, subscribe);
router.get('/unsubscribe/:token', unsubscribe);

// Admin protected routes - separated from sales leads
router.get('/admin/list', protect, requirePermission(NEWSLETTER_PERMISSIONS), getSubscribers);
router.post('/admin/subscribers', protect, requirePermission(NEWSLETTER_PERMISSIONS), addSubscriber);
router.patch('/admin/subscribers/:id/status', protect, requirePermission(NEWSLETTER_PERMISSIONS), toggleSubscriberStatus);
router.delete('/admin/subscribers/:id', protect, requirePermission(NEWSLETTER_PERMISSIONS), deleteSubscriber);
router.get('/admin/export', protect, requirePermission(NEWSLETTER_PERMISSIONS), exportSubscribers);
router.post('/admin/broadcast', protect, requirePermission([...NEWSLETTER_PERMISSIONS, '*']), broadcastNewsletter);

module.exports = router;
