const crypto = require('crypto');
const Client = require('../models/Client');
const Lead = require('../models/Lead');
const logger = require('../utils/logger');
const { sendEmail } = require('../utils/sendEmail');
const issues = require('./clientCreationIssues');

/**
 * Creates a Client Portal account and emails the temporary credentials.
 * Shared by the admin's manual "Create Client" action
 * (routes/clientManagementRoutes.js POST /clients) and the automatic
 * Won -> Client conversion below, so there's exactly one place that knows
 * how to provision an account.
 *
 * @returns the created Client document
 */
async function provisionClientAccount({ businessName, contactName, email, phone, leadRef, createdBy, notes, password }) {
  const finalPassword = password || crypto.randomBytes(6).toString('hex');

  const clientData = {
    businessName,
    contactName,
    email,
    phone,
    password: finalPassword,
    temporaryPasswordText: finalPassword,
    notes,
    isTemporaryPassword: true,
    createdBy
  };
  if (leadRef) clientData.leadRef = leadRef;

  const client = await Client.create(clientData);

  const frontendUrl = (process.env.FRONTEND_URL || process.env.CLIENT_ORIGIN || 'https://vedhunt.in').replace(/\/$/, '');
  try {
    await sendEmail({
      email: client.email,
      subject: 'Welcome to Vedhunt Client Portal',
      message: `Hello ${client.contactName},\n\nYour client portal account has been created.\n\nLogin at: ${frontendUrl}/client/login\nEmail: ${client.email}\nTemporary Password: ${finalPassword}\n\nPlease change your password upon first login.\n\n— Vedhunt Team`
    });
  } catch (emailErr) {
    logger.warn('Welcome email failed for new client:', emailErr.message);
  }

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
    { $push: { pipelineHistory: { status: 'Converted to Client', date: new Date(), updatedBy: actorAdminId, note: `Client account ${client.clientId} created` } } }
  );
  await issues.resolveIssue(lead._id, client, { resolution: 'Client account created' });
  return client;
}

module.exports = { provisionClientAccount, convertWonLeadToClient };
