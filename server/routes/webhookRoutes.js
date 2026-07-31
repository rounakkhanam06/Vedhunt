const express = require('express');
const cookieParser = require('cookie-parser');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const { verifyFacebookWebhook, receiveFacebookLead, receiveGoogleLead } = require('../controllers/webhookController');

// Google Ads Webhook (Uses standard JSON)
// This router is mounted BEFORE the global express.json() in server.js (the FB
// route needs a raw body), so the Google route must parse its own JSON body.
router.post('/google', express.json(), receiveGoogleLead);

// Facebook Webhook Verification (GET)
router.get('/facebook', verifyFacebookWebhook);

// Facebook Webhook Receive (POST) - Requires raw body
// We use express.raw to ensure we can verify the HMAC signature correctly
router.post('/facebook', express.raw({ type: 'application/json' }), receiveFacebookLead);

// Debug route to check if env variables are present on the live server.
// Publicly readable config disclosure, so it is admin-only. This router is
// mounted before the global cookieParser(), so it needs its own to let
// authMiddleware read the adminToken cookie.
router.get('/debug', cookieParser(), authMiddleware, roleMiddleware('SUPER_ADMIN'), (req, res) => {
  res.json({
    FB_APP_SECRET_exists: !!process.env.FB_APP_SECRET,
    FB_VERIFY_TOKEN_exists: !!process.env.FB_VERIFY_TOKEN,
    FB_PAGE_ACCESS_TOKEN_exists: !!process.env.FB_PAGE_ACCESS_TOKEN,
    GOOGLE_WEBHOOK_KEY_exists: !!process.env.GOOGLE_WEBHOOK_KEY,
    NODE_ENV: process.env.NODE_ENV
  });
});

module.exports = router;
