const Admin = require('../models/Admin');
const logger = require('../utils/logger');
const { getFirebaseApp, isFirebaseConfigured } = require('./firebaseAdmin');

/**
 * Sends a push notification to every device an Admin has registered
 * (Admin.fcmTokens). No-ops silently if Firebase isn't configured yet, and
 * never throws — a push failure must never break the in-app Notification
 * flow it accompanies (see every call site in services/followUpEngine.js
 * etc., which always creates the in-app Notification first).
 */
async function sendPushToAdmin(adminId, { title, body, link, data = {} }) {
  if (!adminId || !isFirebaseConfigured()) return;

  try {
    const admin = await Admin.findById(adminId).select('fcmTokens').lean();
    const tokens = (admin?.fcmTokens || []).map((t) => t.token);
    if (!tokens.length) return;

    const messaging = getFirebaseApp().messaging();
    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: { link: link || '', ...data },
      webpush: { fcmOptions: link ? { link } : undefined }
    });

    // Prune tokens Firebase reports as dead (uninstalled/expired/revoked) —
    // otherwise they accumulate forever and every send keeps failing on them.
    const deadTokens = [];
    response.responses.forEach((r, i) => {
      if (!r.success && r.error?.code === 'messaging/registration-token-not-registered') {
        deadTokens.push(tokens[i]);
      }
    });
    if (deadTokens.length) {
      await Admin.updateOne({ _id: adminId }, { $pull: { fcmTokens: { token: { $in: deadTokens } } } });
    }
  } catch (err) {
    logger.error(`Push notification failed for admin ${adminId}:`, err);
  }
}

module.exports = { sendPushToAdmin };
