// Proposal workflow on a lead: Draft (editable) → Final (PDF generated,
// immutable) → Shared (Email / WhatsApp). Every Final/Share step is written
// to the lead's timeline, and the lead's proposal fields (value, reference,
// sent date) are filled in so moving the stage to "Proposal Sent" needs no
// re-typing — the stage change itself still goes through the state machine.
const mongoose = require('mongoose');
const Proposal = require('../models/Proposal');
const Employee = require('../models/Employee');
const Admin = require('../models/Admin');
const { findLeadRaw } = require('../utils/leadLookup');
const { appendLeadActivity } = require('./leadLifecycle');
const { buildProposalPdfBuffer } = require('./proposalPdf');
const { inr, getCompanyProfile } = require('./pdfBranding');
const { buildProformaPdfBuffer } = require('./proformaPdf');
const { uploadBuffer } = require('../utils/cloudinary');
const { sendEmail } = require('../utils/sendEmail');
const logger = require('../utils/logger');

const ok = (data = {}) => ({ ok: true, ...data });
const fail = (status, message) => ({ ok: false, status, message });

const DETAIL_LIMITS = {
  clientName: 150, website: 200, contactPerson: 150, contactDesignation: 100, email: 150, phone: 30,
  address: 500, gstin: 20, pan: 15, placeOfSupply: 60,
  industry: 150, businessModel: 300, targetAudience: 300, currentStatus: 500, painPoints: 1000, goal: 500,
  service: 200, requirement: 3000, scope: 5000, deliverables: 3000, timeline: 1000, paymentTerms: 1500,
  clientRequirements: 2000, assumptions: 2000, exclusions: 2000, notes: 2000,
};
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_ITEMS = 12; // keeps the proforma item table on one page

function cleanItems(items) {
  if (!Array.isArray(items) || items.length === 0) return { error: 'Add at least one service line item.' };
  if (items.length > MAX_ITEMS) return { error: `A proposal can have at most ${MAX_ITEMS} line items.` };
  const clean = [];
  for (const [i, raw] of items.entries()) {
    const service = String(raw?.service || '').trim().slice(0, 200);
    const qty = Number(raw?.qty);
    const rate = Number(raw?.rate);
    const gstPercent = raw?.gstPercent === undefined || raw?.gstPercent === '' ? 18 : Number(raw.gstPercent);
    if (!service) return { error: `Line ${i + 1}: choose a service.` };
    if (!(qty > 0)) return { error: `Line ${i + 1}: quantity must be more than 0.` };
    if (!(rate > 0)) return { error: `Line ${i + 1}: enter the rate.` };
    if (!(gstPercent >= 0 && gstPercent <= 28)) return { error: `Line ${i + 1}: GST must be between 0% and 28%.` };
    clean.push({
      service,
      description: String(raw.description || '').trim().slice(0, 1000),
      sac: String(raw.sac || '').trim().slice(0, 12),
      uom: String(raw.uom || '').trim().slice(0, 20),
      qty, rate, gstPercent,
    });
  }
  return { items: clean };
}

function cleanInput(input = {}) {
  const details = {};
  for (const [key, max] of Object.entries(DETAIL_LIMITS)) {
    details[key] = String(input.details?.[key] ?? '').trim().slice(0, max);
  }
  const { items, error: itemError } = cleanItems(input.items);
  if (!details.service && items?.length) details.service = items.map((i) => i.service).join(', ').slice(0, 200);
  const missing = [
    !details.clientName && 'Client / business name',
    !details.requirement && 'Requirement',
    !details.scope && 'Scope',
  ].filter(Boolean);
  if (missing.length) return { error: `Please fill in: ${missing.join(', ')}.` };
  if (itemError) return { error: itemError };
  if (details.email && !EMAIL_RE.test(details.email)) return { error: 'Client email looks invalid.' };

  const validityDays = input.validityDays === undefined || input.validityDays === '' ? 15 : Number(input.validityDays);
  if (!(validityDays >= 1 && validityDays <= 180)) return { error: 'Validity must be between 1 and 180 days.' };
  const title = String(input.title || '').trim().slice(0, 80) || 'Business Proposal';

  return { value: { title, details, items, validityDays } };
}

/** VH-PROP-YYMMDD-NNN — date of issue plus a running number, as on the approved template. */
async function nextProposalNumber() {
  const [{ proposalSequenceStart }, last] = await Promise.all([
    getCompanyProfile(),
    Proposal.findOne({ sequence: { $ne: null } }, { sequence: 1 }).sort({ sequence: -1 }).lean(),
  ]);
  const sequence = Math.max((last?.sequence || 0) + 1, proposalSequenceStart || 1);
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(-2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return { proposalNumber: `VH-PROP-${ymd}-${String(sequence).padStart(3, '0')}`, sequence };
}

/** The proposal plus its lead, when that lead is visible under `leadFilter` (e.g. assignedTo). */
async function loadOwned(proposalId, leadFilter) {
  if (!mongoose.Types.ObjectId.isValid(proposalId)) return { error: fail(400, 'Invalid proposal ID') };
  const proposal = await Proposal.findById(proposalId);
  if (!proposal) return { error: fail(404, 'Proposal not found') };
  const lead = await findLeadRaw(proposal.lead, leadFilter);
  if (!lead) return { error: fail(404, 'Proposal not found') };
  return { proposal, lead };
}

async function listForLead(leadId, leadFilter) {
  const lead = await findLeadRaw(leadId, leadFilter);
  if (!lead) return fail(404, 'Lead not found');
  const proposals = await Proposal.find({ lead: lead._id })
    .sort({ createdAt: -1 })
    .populate('createdBy', 'firstName lastName')
    .lean();
  return ok({ proposals });
}

/** New proposal, or — with basedOn — the next version of an existing one. */
async function createDraft(user, leadId, input, leadFilter) {
  const lead = await findLeadRaw(leadId, leadFilter);
  if (!lead) return fail(404, 'Lead not found');
  const { value, error } = cleanInput(input);
  if (error) return fail(400, error);

  let numbering = null; // { proposalNumber, sequence } — kept when revising
  let version = 1;
  if (input.basedOn) {
    const base = await loadOwned(input.basedOn, leadFilter);
    if (base.error) return base.error;
    if (String(base.proposal.lead) !== String(lead._id)) return fail(400, 'That proposal belongs to a different lead.');
    if (await Proposal.exists({ proposalNumber: base.proposal.proposalNumber, status: 'Draft' })) {
      return fail(409, 'A draft revision of this proposal already exists — edit that one.');
    }
    const latest = await Proposal.findOne({ proposalNumber: base.proposal.proposalNumber }, { version: 1 }).sort({ version: -1 }).lean();
    numbering = { proposalNumber: base.proposal.proposalNumber, sequence: base.proposal.sequence };
    version = latest.version + 1;
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const proposal = await Proposal.create({
        ...value,
        ...(numbering || await nextProposalNumber()),
        version,
        lead: lead._id,
        leadCode: lead.leadId,
        createdBy: user._id,
      });
      return ok({ proposal });
    } catch (err) {
      if (err.code !== 11000 || numbering) throw err; // retry only a numbering race
    }
  }
  return fail(409, 'Could not allocate a proposal number. Please try again.');
}

async function updateDraft(proposalId, input, leadFilter) {
  const { proposal, error: loadError } = await loadOwned(proposalId, leadFilter);
  if (loadError) return loadError;
  if (proposal.status !== 'Draft') return fail(400, 'Only a draft can be edited. Create a new version instead.');
  const { value, error } = cleanInput(input);
  if (error) return fail(400, error);
  proposal.set(value);
  await proposal.save();
  return ok({ proposal });
}

/** Name + designation printed as "Prepared By" and on the acceptance block. */
async function preparedByOf(user) {
  const employee = await Employee.findOne({ adminId: user._id }, { designation: 1, roleDept: 1 }).lean();
  return {
    name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
    email: user.email,
    designation: employee?.designation || employee?.roleDept || '',
  };
}

/**
 * "Prepared By" for a proposal's PDF: whoever created it, not whoever opens
 * it — a Super Admin previewing or sharing a BD's proposal from the admin
 * Lead page must not replace the BD's name on it.
 */
async function preparedByForProposal(proposal, user) {
  if (!proposal.createdBy || String(proposal.createdBy) === String(user._id)) return preparedByOf(user);
  const author = await Admin.findById(proposal.createdBy, { firstName: 1, lastName: 1, email: 1 }).lean();
  return preparedByOf(author || user);
}

async function renderPdf(proposalId, user, leadFilter) {
  const { proposal, error } = await loadOwned(proposalId, leadFilter);
  if (error) return error;
  const buffer = await buildProposalPdfBuffer(proposal, await preparedByForProposal(proposal, user));
  return ok({ buffer, proposal });
}

async function finalize(user, proposalId, leadFilter) {
  const { proposal, lead, error } = await loadOwned(proposalId, leadFilter);
  if (error) return error;
  if (proposal.status !== 'Draft') return fail(400, `This proposal is already ${proposal.status.toLowerCase()}.`);

  proposal.status = 'Final';
  proposal.finalizedAt = new Date();
  proposal.finalizedBy = user._id;
  const buffer = await buildProposalPdfBuffer(proposal, await preparedByForProposal(proposal, user));
  try {
    const uploaded = await uploadBuffer(buffer, {
      folder: 'vedhunt-proposals',
      public_id: `${proposal.proposalNumber}_v${proposal.version}.pdf`,
      resource_type: 'raw',
    });
    proposal.pdfUrl = uploaded.secure_url;
  } catch (err) {
    // The PDF can always be regenerated on demand; only the WhatsApp link needs the stored copy.
    logger.error(`Proposal PDF upload failed for ${proposal.proposalNumber}:`, err.message);
  }
  await proposal.save();
  await Proposal.updateMany(
    { proposalNumber: proposal.proposalNumber, version: { $lt: proposal.version }, status: { $ne: 'Superseded' } },
    { $set: { status: 'Superseded' } }
  );

  const reference = `${proposal.proposalNumber} v${proposal.version}`;
  await appendLeadActivity(lead._id, {
    status: 'Proposal generated',
    note: `${reference} · ${inr(proposal.projectValue)} + GST = ${inr(proposal.totalAmount)}`,
    actorId: user._id,
  }, {}, { proposalValue: proposal.projectValue, proposalReference: reference });
  return ok({ proposal });
}

/**
 * Records a share and sends it. Email goes out from the server with the PDF
 * attached; WhatsApp is opened by the employee's browser, so this returns
 * the message text (with the PDF link) for the client to open.
 */
async function share(user, proposalId, { channel, recipient, message }, leadFilter) {
  const { proposal, lead, error } = await loadOwned(proposalId, leadFilter);
  if (error) return error;
  if (!['Final', 'Shared'].includes(proposal.status)) return fail(400, 'Generate the final proposal before sharing it.');
  if (!['Email', 'WhatsApp'].includes(channel)) return fail(400, 'Choose Email or WhatsApp.');
  const to = String(recipient || '').trim();
  if (channel === 'Email' && !EMAIL_RE.test(to)) return fail(400, 'Enter a valid recipient email.');
  if (channel === 'WhatsApp' && to.replace(/\D/g, '').length < 10) return fail(400, 'Enter a valid WhatsApp number.');
  const note = String(message || '').trim().slice(0, 2000);
  const reference = `${proposal.proposalNumber} v${proposal.version}`;

  let whatsappText = null;
  if (channel === 'Email') {
    const buffer = await buildProposalPdfBuffer(proposal, await preparedByForProposal(proposal, user));
    const name = (await preparedByOf(user)).name || 'Vedhunt';
    try {
      await sendEmail({
        email: to,
        subject: `Proposal ${reference} — Vedhunt InfoTech`,
        html: `<div style="font-family:Arial,sans-serif;color:#222;max-width:560px">
          <p>${(note || `Dear ${proposal.details.contactPerson || proposal.details.clientName},\n\nPlease find attached our proposal for ${proposal.details.service}.`)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>')}</p>
          <p>Total: <strong>${inr(proposal.totalAmount)}</strong> (incl. GST)</p>
          <p>Regards,<br>${name}<br>Vedhunt InfoTech Pvt Ltd</p></div>`,
        attachments: [{ filename: `Proposal-${proposal.proposalNumber}-v${proposal.version}.pdf`, content: buffer.toString('base64') }],
      });
    } catch (err) {
      return fail(502, 'The email could not be sent. Please try again in a moment.');
    }
  } else {
    whatsappText = [
      note || `Hello ${proposal.details.contactPerson || proposal.details.clientName}, please find our proposal for ${proposal.details.service}.`,
      `Proposal: ${reference} · Total ${inr(proposal.totalAmount)} (incl. GST)`,
      proposal.pdfUrl,
    ].filter(Boolean).join('\n\n');
  }

  const sharedAt = new Date();
  proposal.shares.push({ channel, recipient: to, sharedAt, sharedBy: user._id });
  proposal.status = 'Shared';
  await proposal.save();
  await appendLeadActivity(lead._id, {
    status: `Proposal shared via ${channel}`,
    note: `${reference} → ${to} · ${inr(proposal.totalAmount)}`,
    actorId: user._id,
  }, {}, { proposalSentDate: sharedAt, proposalValue: proposal.projectValue, proposalReference: reference });

  return ok({ proposal, whatsappText, missingPdfLink: channel === 'WhatsApp' && !proposal.pdfUrl });
}

/**
 * Proforma invoice for a final proposal. The proforma number is allocated
 * once (continuing the company sequence) and reused on every re-download.
 */
async function renderProforma(user, proposalId, leadFilter) {
  const { proposal, lead, error } = await loadOwned(proposalId, leadFilter);
  if (error) return error;
  if (!['Final', 'Shared'].includes(proposal.status)) return fail(400, 'Generate the final proposal before raising a proforma invoice.');

  if (!proposal.proformaNumber) {
    const { proformaNumberStart } = await getCompanyProfile();
    for (let attempt = 0; attempt < 3 && !proposal.proformaNumber; attempt += 1) {
      const last = await Proposal.findOne({ proformaNumber: { $ne: null } }, { proformaNumber: 1 }).sort({ proformaNumber: -1 }).lean();
      const number = Math.max((last?.proformaNumber || 0) + 1, proformaNumberStart || 1);
      try {
        const updated = await Proposal.findOneAndUpdate(
          { _id: proposal._id, proformaNumber: null },
          { $set: { proformaNumber: number, proformaDate: new Date() } },
          { returnDocument: 'after' }
        );
        if (updated) {
          proposal.proformaNumber = updated.proformaNumber;
          proposal.proformaDate = updated.proformaDate;
          await appendLeadActivity(lead._id, {
            status: 'Proforma invoice generated',
            note: `Proforma No. ${number} for ${proposal.proposalNumber} v${proposal.version} · ${inr(proposal.totalAmount)}`,
            actorId: user._id,
          });
        } else {
          const fresh = await Proposal.findById(proposal._id, { proformaNumber: 1, proformaDate: 1 }).lean(); // allocated by another request
          proposal.proformaNumber = fresh.proformaNumber;
          proposal.proformaDate = fresh.proformaDate;
        }
      } catch (err) {
        if (err.code !== 11000) throw err; // number taken by a parallel request — try the next one
      }
    }
    if (!proposal.proformaNumber) return fail(409, 'Could not allocate a proforma number. Please try again.');
  }

  const buffer = await buildProformaPdfBuffer(proposal);
  return ok({ buffer, proposal });
}

module.exports = { listForLead, createDraft, updateDraft, renderPdf, renderProforma, finalize, share };
