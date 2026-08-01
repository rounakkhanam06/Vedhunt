const express = require('express');
const crypto = require('crypto');
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
router.get('/debug', cookieParser(), authMiddleware, roleMiddleware('SUPER_ADMIN'), async (req, res) => {
  const token = process.env.FB_PAGE_ACCESS_TOKEN;

  // Knowing the variable is *set* proved useless in practice — an expired
  // token is set and still drops every lead. Actually exercise it.
  let tokenStatus = { configured: !!token };
  if (token) {
    // Identifies which token is loaded without exposing it, so a stale value
    // can be spotted by comparing against the one you expect.
    tokenStatus.fingerprint = crypto.createHash('sha1').update(token).digest('hex').slice(0, 12);
    try {
      const r = await fetch(`https://graph.facebook.com/v19.0/me?fields=id,name&access_token=${token}`);
      const data = await r.json();
      if (data.error) {
        tokenStatus.valid = false;
        tokenStatus.error = data.error.message;
        tokenStatus.errorCode = data.error.code;
        if (data.error.code === 190) {
          tokenStatus.hint = 'Token is expired or invalid. Every incoming lead is being dropped. ' +
            'Generate a permanent Page token and restart with: pm2 restart <app> --update-env';
        }
      } else {
        tokenStatus.valid = true;
        tokenStatus.identity = `${data.name} (${data.id})`;
        tokenStatus.hint = data.name ? 'Token works. Leads can be fetched.' : undefined;
      }
    } catch (err) {
      tokenStatus.valid = false;
      tokenStatus.error = err.message;
    }
  }

  res.json({
    FB_APP_SECRET_exists: !!process.env.FB_APP_SECRET,
    FB_VERIFY_TOKEN_exists: !!process.env.FB_VERIFY_TOKEN,
    FB_PAGE_ACCESS_TOKEN_exists: !!token,
    GOOGLE_WEBHOOK_KEY_exists: !!process.env.GOOGLE_WEBHOOK_KEY,
    pageAccessToken: tokenStatus,
    NODE_ENV: process.env.NODE_ENV
  });
});

module.exports = router;
