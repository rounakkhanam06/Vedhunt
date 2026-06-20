const express = require('express');
const router = express.Router();
const { verifyFacebookWebhook, receiveFacebookLead, receiveGoogleLead } = require('../controllers/webhookController');

// Google Ads Webhook (Uses standard JSON)
router.post('/google', receiveGoogleLead);

// Facebook Webhook Verification (GET)
router.get('/facebook', verifyFacebookWebhook);

// Facebook Webhook Receive (POST) - Requires raw body
// We use express.raw to ensure we can verify the HMAC signature correctly
router.post('/facebook', express.raw({ type: 'application/json' }), receiveFacebookLead);

// Safe Debug Route to check if env variables are present on live server
router.get('/debug', (req, res) => {
  res.json({
    FB_APP_SECRET_exists: !!process.env.FB_APP_SECRET,
    FB_VERIFY_TOKEN_exists: !!process.env.FB_VERIFY_TOKEN,
    FB_PAGE_ACCESS_TOKEN_exists: !!process.env.FB_PAGE_ACCESS_TOKEN,
    NODE_ENV: process.env.NODE_ENV
  });
});

module.exports = router;
