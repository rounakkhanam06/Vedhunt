const admin = require('firebase-admin');
const logger = require('./logger');

/**
 * Lazy-init wrapper around the Firebase Admin SDK, used only for Cloud
 * Messaging (push notifications). No real Firebase project exists yet —
 * this reads its service account from env vars and simply stays
 * unconfigured (every caller no-ops) until they're set, the same
 * graceful-skip idiom already used for FB_PAGE_ACCESS_TOKEN in
 * services/leadSync.js. Configure with either:
 *   - FIREBASE_SERVICE_ACCOUNT_JSON — the full service account JSON, as one string
 *   - or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY
 */

let app = null;
let attempted = false;

function getFirebaseApp() {
  if (app || attempted) return app;
  attempted = true;

  try {
    let credential;
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      credential = admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON));
    } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      credential = admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // .env files can't hold real newlines in a value — the private key is
        // stored with literal "\n" escapes and un-escaped here.
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      });
    } else {
      logger.info('Firebase push notifications not configured (no FIREBASE_* env vars) — skipping.');
      return null;
    }

    app = admin.initializeApp({ credential });
    logger.info('Firebase Admin SDK initialized for push notifications.');
  } catch (err) {
    logger.error('Failed to initialize Firebase Admin SDK — push notifications disabled:', err);
    app = null;
  }
  return app;
}

function isFirebaseConfigured() {
  return !!getFirebaseApp();
}

module.exports = { getFirebaseApp, isFirebaseConfigured };
