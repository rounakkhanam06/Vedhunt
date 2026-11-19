// When an admin changes a lead's phone number, carry the new number to every
// record that copied it from the lead:
//   - the client account made from the lead (Client.leadRef)
//   - the lead's Draft proposals / proformas (details.phone)
//   - the client's invoices that have not been sent yet (billing.phone)
// Only copies that still hold the OLD number (or are empty) are changed, so a
// number someone deliberately set differently on the client is left alone.
// Issued records are never rewritten: shared/final proposals, sent invoices
// and the signed agreement are what the client actually received.
const Client = require('../models/Client');
const Proposal = require('../models/Proposal');
const Invoice = require('../models/Invoice');
const { normalizePhone } = require('../utils/normalize');

const CLIENT_PHONE = /^\+?[1-9]\d{9,14}$/; // same rule as models/Client.js

const sameOrEmpty = (value, oldNorm) => !value || normalizePhone(value) === oldNorm;

/**
 * @returns {{ client: boolean, proposals: number, invoices: number, skipped?: string }}
 */
async function syncLeadPhone(leadId, oldPhone, newPhone) {
  const oldNorm = normalizePhone(oldPhone);
  const result = { client: false, proposals: 0, invoices: 0 };
  if (!newPhone || normalizePhone(newPhone) === oldNorm) return result;

  const proposals = await Proposal.find({ lead: leadId, status: 'Draft' }).select('details.phone');
  for (const p of proposals) {
    if (!sameOrEmpty(p.details?.phone, oldNorm)) continue;
    await Proposal.updateOne({ _id: p._id }, { $set: { 'details.phone': newPhone } });
    result.proposals += 1;
  }

  const client = await Client.findOne({ leadRef: leadId }).select('phone clientId');
  if (!client) return result;

  if (sameOrEmpty(client.phone, oldNorm)) {
    // Store it the way client accounts are created from leads: digits only
    const clientPhone = normalizePhone(newPhone);
    if (CLIENT_PHONE.test(clientPhone)) {
      await Client.updateOne({ _id: client._id }, { $set: { phone: clientPhone } });
      result.client = true;
      result.clientId = client.clientId;
    } else {
      result.skipped = 'The client account phone was not changed: the new number is not a valid 10–15 digit phone.';
    }
  } else {
    result.skipped = 'The client account has a different phone set on it, so it was left unchanged.';
  }

  const invoices = await Invoice.find({ client_ref: client._id, unsent: true }).select('billing.phone');
  for (const inv of invoices) {
    if (!inv.billing || !sameOrEmpty(inv.billing.phone, oldNorm)) continue;
    await Invoice.updateOne({ _id: inv._id }, { $set: { 'billing.phone': newPhone } });
    result.invoices += 1;
  }

  return result;
}

module.exports = { syncLeadPhone };
