const crypto = require('crypto');
const Client = require('../models/Client');
const Lead = require('../models/Lead');
const logger = require('../utils/logger');
const { sendEmail } = require('../utils/sendEmail');
const issues = require('./clientCreationIssues');

// Activation links last 72 hours; staff can send a new one at any time.
const ACTIVATION_MINUTES = 72 * 60;
const frontendUrl = () => (process.env.FRONTEND_URL || process.env.CLIENT_ORIGIN || 'https://vedhunt.in').replace(/\/$/, '');

/**
 * Emails the client a one-time link to set their own password (Client Journey SOP §4: a
 * password is never emailed or shown to staff). Used for a new account ("activate") and when
 * staff send a fresh link later ("reset", once the client has activated).
 * @returns {{ sent: boolean, error?: string }}
 */
async function sendActivationLink(client) {
  const token = client.getResetPasswordToken(ACTIVATION_MINUTES);
  const activated = Boolean(client.activatedAt);
  client.activationSentAt = new Date();
  await client.save({ validateBeforeSave: false });
  const url = `${frontendUrl()}/client/${activated ? 'reset-password' : 'activate'}/${token}`;
  try {
    await sendEmail({
      email: client.email,
      subject: activated ? 'Vedhunt Client Portal — set a new password' : 'Activate your Vedhunt Client Portal account',
      message: activated
        ? `Hello ${client.contactName},\n\nA link to set a new password for your Vedhunt Client Portal account (valid for 72 hours):\n\n${url}\n\nIf you did not expect this, please contact your Vedhunt account manager.\n\n— Vedhunt Team`
        : `Hello ${client.contactName},\n\nYour Vedhunt Client Portal account is ready. Set your password to activate it (the link is valid for 72 hours):\n\n${url}\n\nYour login email: ${client.email}\n\nIf the link has expired, ask your Vedhunt account manager to send a new one.\n\n— Vedhunt Team`,
    });
    return { sent: true };
  } catch (err) {
    logger.warn(`Activation email failed for ${client.email}: ${err.message}`);
    return { sent: false, error: 'The email could not be sent.' };
  }
}

/**
 * Creates a Client Portal account and emails an activation link (no password).
 * Shared by the admin's manual "Create Client" action
 * (routes/clientManagementRoutes.js POST /clients) and the automatic
 * Won -> Client conversion below, so there's exactly one place that knows
 * how to provision an account.
 *
 * @returns the created Client document (with `activationEmail` = { sent, error })
 */
async function provisionClientAccount({ businessName, contactName, email, phone, leadRef, createdBy, notes }) {
  const clientData = {
    businessName,
    contactName,
    email,
    phone,
    // Nobody ever learns this one: the client sets their own through the activation link
    password: crypto.randomBytes(24).toString('base64url'),
    notes,
    isTemporaryPassword: true,
    createdBy
  };
  if (leadRef) clientData.leadRef = leadRef;

  const client = await Client.create(clientData);
  const withToken = await Client.findById(client._id).select('+resetPasswordToken +resetPasswordExpire');
  client.activationEmail = await sendActivationLink(withToken);
  client.activationSentAt = withToken.activationSentAt;
  return client;
}

/**
 * Automatic post-sale conversion — called from services/leadLifecycle.js
 * whenever a lead's status transitions into Won. Idempotent: safe to call
 * again if a Won lead is re-saved (e.g. deal value corrected).
 */
async function noteArchivedClient(lead, client, actorAdminId) {
  await Lead.updateOne(
    { _id: lead._id },
    { $push: { pipelineHistory: { status: 'Client link skipped', date: new Date(), updatedBy: actorAdminId, note: `Client account ${client.clientId} is deleted (archived). Restore it from Client Accounts to give this customer portal access again.` } } }
  );
}

async function convertWonLeadToClient(lead, actorAdminId, { source = 'won' } = {}) {
  const existingByLead = await Client.findOne({ leadRef: lead._id }).lean();
  if (existingByLead) {
    await issues.resolveIssue(lead._id, existingByLead, { resolution: 'An account is linked to this lead' });
    if (existingByLead.deletedAt) await noteArchivedClient(lead, existingByLead, actorAdminId);
    return existingByLead;
  }

  // Anything that stops the account being created is recorded for an admin — never only logged
  const details = issues.detailsFromLead(lead);
  const { reasons, existingClient } = await issues.diagnose(details);
  if (reasons.length) {
    logger.warn(`Won lead ${lead._id}: client account not created — ${reasons.map((r) => r.message).join(' | ')}`);
    await issues.recordIssue(lead, reasons, { existingClient, source, actorAdminId });
    return null;
  }

  let client;
  try {
    client = await provisionClientAccount({ ...details, leadRef: lead._id, createdBy: actorAdminId });
  } catch (err) {
    logger.error(`Won->Client conversion failed for lead ${lead._id}:`, err);
    await issues.recordIssue(lead, [issues.unexpected(err)], { source, actorAdminId });
    return null;
  }

  await Lead.updateOne(
    { _id: lead._id },
    { $push: { pipelineHistory: { status: 'Converted to Client', date: new Date(), updatedBy: actorAdminId, note: `Client account ${client.clientId} created — activation link emailed` } } }
  );
  await issues.resolveIssue(lead._id, client, { resolution: 'Client account created' });
  return client;
}

module.exports = { provisionClientAccount, convertWonLeadToClient, sendActivationLink, ACTIVATION_MINUTES };
