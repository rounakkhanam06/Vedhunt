const express = require('express');
const router = express.Router();

// @desc    Public Firebase client config for push notifications (Cloud
//          Messaging). These values are meant to be embedded in client code
//          (they're not secrets — the real credential is FIREBASE_* on the
//          server side, used by utils/firebaseAdmin.js). Returns
//          { configured: false } until FIREBASE_API_KEY etc. are set, so the
//          frontend can silently skip push setup until then.
// @route   GET /api/config/firebase-public
// @access  Public
router.get('/firebase-public', (req, res) => {
  const { FIREBASE_API_KEY, FIREBASE_PROJECT_ID, FIREBASE_MESSAGING_SENDER_ID, FIREBASE_APP_ID, FIREBASE_VAPID_KEY } = process.env;

  if (!FIREBASE_API_KEY || !FIREBASE_PROJECT_ID || !FIREBASE_MESSAGING_SENDER_ID || !FIREBASE_APP_ID || !FIREBASE_VAPID_KEY) {
    return res.status(200).json({ configured: false });
  }

  res.status(200).json({
    configured: true,
    apiKey: FIREBASE_API_KEY,
    projectId: FIREBASE_PROJECT_ID,
    messagingSenderId: FIREBASE_MESSAGING_SENDER_ID,
    appId: FIREBASE_APP_ID,
    vapidKey: FIREBASE_VAPID_KEY
  });
});

module.exports = router;
