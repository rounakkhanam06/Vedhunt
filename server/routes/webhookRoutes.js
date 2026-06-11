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

module.exports = router;
