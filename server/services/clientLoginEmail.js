const Client = require('../models/Client');
const { sendActivationLink } = require('./clientProvisioning');

/**
 * The client's email is also their portal login. Changing it must not collide
 * with another account, and the old address must stop working.
 */

/** True when another client (not `exceptId`) already uses this email. */
const loginEmailTaken = (email, exceptId) =>
  Client.exists({ email: String(email).toLowerCase().trim(), _id: { $ne: exceptId } }).then(Boolean);

/**
 * Apply a new login email to a loaded Client document (not saved here).
 * Returns null when nothing changed, else { from, to }.
 * Throws { status: 409 } when another client already has the email.
 */
async function applyLoginEmail(client, email) {
  const to = String(email).toLowerCase().trim();
  if (!to || to === client.email) return null;
  if (await loginEmailTaken(to, client._id)) {
    const err = new Error('Another client already uses this email address.');
    err.status = 409;
    throw err;
  }
  const from = client.email;
  client.email = to;
  // Log out existing portal sessions; they sign in again with the new email
  client.refreshToken = undefined;
  // A pending activation/reset link went to the old address — void it
  client.resetPasswordToken = undefined;
  client.resetPasswordExpire = undefined;
  return { from, to };
}

/**
 * After a saved email change: a client who never activated gets a fresh link
 * at the new address (the old one is void). Returns a staff-facing message.
 */
async function afterLoginEmailChange(client, change) {
  if (!client.activatedAt && client.isActive && !client.deletedAt) {
    const withToken = await Client.findById(client._id).select('+resetPasswordToken +resetPasswordExpire');
    const r = await sendActivationLink(withToken);
    return r.sent
      ? `The client login email is now ${change.to} and a new activation link was emailed there.`
      : `The client login email is now ${change.to}, but the activation email could not be sent — use "Send activation link".`;
  }
  return `The client now logs in with ${change.to} (same password).`;
}

module.exports = { loginEmailTaken, applyLoginEmail, afterLoginEmailChange };
