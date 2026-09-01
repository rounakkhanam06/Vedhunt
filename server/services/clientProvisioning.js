const crypto = require('crypto');
const Client = require('../models/Client');
const Lead = require('../models/Lead');
const logger = require('../utils/logger');
const { sendEmail } = require('../utils/sendEmail');
const { normalizePhone } = require('../utils/normalize');

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

  try {
    await sendEmail({
      email: client.email,
      subject: 'Welcome to Vedhunt Client Portal',
      message: `Hello ${client.contactName},\n\nYour client portal account has been created.\n\nLogin at: ${process.env.FRONTEND_URL || 'http://localhost:5173'}/client/login\nEmail: ${client.email}\nTemporary Password: ${finalPassword}\n\nPlease change your password upon first login.\n\n— Vedhunt Team`
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
async function convertWonLeadToClient(lead, actorAdminId) {
  const existingByLead = await Client.findOne({ leadRef: lead._id }).lean();
  if (existingByLead) return existingByLead;

  const existingByEmail = await Client.findOne({ email: String(lead.email || '').toLowerCase().trim() }).lean();
  if (existingByEmail) {
    logger.info(`Won lead ${lead._id} matches existing client ${existingByEmail._id} by email — not creating a duplicate account.`);
    await Lead.updateOne(
      { _id: lead._id },
      { $push: { pipelineHistory: { status: 'Client link skipped', date: new Date(), updatedBy: actorAdminId, note: `A client account already exists for ${lead.email} — link it manually if this is the same customer.` } } }
    );
    return existingByEmail;
  }

  const client = await provisionClientAccount({
    businessName: lead.businessName || lead.fullName,
    contactName: lead.fullName,
    email: lead.email,
    phone: normalizePhone(lead.phone),
    leadRef: lead._id,
    createdBy: actorAdminId
  });

  await Lead.updateOne(
    { _id: lead._id },
    { $push: { pipelineHistory: { status: 'Converted to Client', date: new Date(), updatedBy: actorAdminId, note: `Client account ${client.clientId} created` } } }
  );

  return client;
}

module.exports = { provisionClientAccount, convertWonLeadToClient };
