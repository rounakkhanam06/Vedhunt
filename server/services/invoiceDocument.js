// Proforma / tax invoice for an invoice made in Invoice Manager.
//
// Staff make an invoice (lines, tax %, who it is billed to), look at it, and then
// send it to the client as either a "Proforma Invoice" or a "Tax Invoice" — the
// same layout, only the title and the number series differ. Sending allocates the
// number for that type (once, kept on every resend), records the date staff typed,
// makes the invoice visible to the client and notifies them.
//   • Tax Invoice       — its own series (company_profile.taxInvoiceNumberStart)
//   • Proforma Invoice  — shares the series with the proforma raised from a proposal
const Invoice = require('../models/Invoice');
const Client = require('../models/Client');
const ClientKyc = require('../models/ClientKyc');
const Proposal = require('../models/Proposal');
const { buildBillDocPdfBuffer } = require('./proformaPdf');
const { getCompanyProfile } = require('./pdfBranding');
const { GST_STATE_CODES } = require('../config/gstStates');
const { notifyInvoiceSent } = require('./clientNotify');

const { DOCUMENT_TYPES } = Invoice;
const MAX_ITEMS = 12; // keeps the item table on one page
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const fail = (status, message) => ({ ok: false, status, message });

const isTax = (type) => type === 'Tax Invoice';

/** 'YYYY-MM-DD' → noon that day (so a time-zone shift never moves the date), or null. */
function parseDay(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!m) return null;
  const [y, mo, d] = m.slice(1).map(Number);
  const day = new Date(y, mo - 1, d, 12);
  return day.getFullYear() === y && day.getMonth() === mo - 1 && day.getDate() === d ? day : null;
}

async function highestDocumentNumber(type) {
  const [row] = await Invoice.aggregate([
    { $unwind: '$documents' },
    { $match: { 'documents.type': type } },
    { $group: { _id: null, max: { $max: '$documents.number' } } },
  ]);
  return row?.max || 0;
}

/** The number the next document of this type will get. */
async function nextNumber(type) {
  const company = await getCompanyProfile();
  const own = await highestDocumentNumber(type);
  if (isTax(type)) return Math.max(own + 1, company.taxInvoiceNumberStart || 1);
  const lastProposal = await Proposal.findOne({ proformaNumber: { $ne: null } }, { proformaNumber: 1 }).sort({ proformaNumber: -1 }).lean();
  return Math.max(own + 1, (lastProposal?.proformaNumber || 0) + 1, company.proformaNumberStart || 1);
}

/** Item rows with the tax worked out per line; the last line absorbs rounding so the columns add up. */
function documentItems(invoice) {
  const pct = Number(invoice.taxPercent) || 0;
  const lines = invoice.lineItems || [];
  let remaining = r2(invoice.taxAmount);
  return lines.map((li, i) => {
    const taxable = r2(li.amount);
    const gst = i === lines.length - 1 ? Math.max(0, remaining) : r2((taxable * pct) / 100);
    remaining = r2(remaining - gst);
    // First line is the service name (bold); the rest is its description
    const [service, ...rest] = String(li.description || '').split(/\r?\n/);
    return {
      service: service.trim(), description: rest.join('\n').trim(), sac: li.sac, qty: li.qty, uom: '',
      rate: li.unitPrice, taxable, gstPercent: pct, gstAmount: gst, total: r2(taxable + gst),
    };
  });
}

function specFor({ invoice, client, company, type, number, date }) {
  const b = invoice.billing || {};
  const tax = isTax(type);
  return {
    title: tax ? 'TAX INVOICE' : 'PROFORMA INVOICE',
    pdfTitle: `${type} ${number}`,
    noLabel: tax ? 'Invoice No.' : 'Proforma No.',
    number,
    dateLabel: tax ? 'Invoice Date' : 'Proforma Date',
    date,
    ref: invoice.invoiceId ? `Ref: ${invoice.invoiceId}` : '',
    original: tax,
    fitOnePage: true,
    customer: {
      nameLabel: 'Name',
      name: b.name || client.businessName,
      address: b.address,
      phone: b.phone || client.phone,
      gstin: b.gstin,
      pan: b.pan,
      placeOfSupply: b.placeOfSupply,
      dashEmptyGstin: true,
    },
    items: documentItems(invoice),
    taxable: invoice.subtotal,
    gstAmount: invoice.taxAmount,
    totalAmount: invoice.totalAmount,
    terms: { title: 'Terms and Conditions', lines: company.invoiceTerms || [] },
  };
}

const latestDocument = (invoice) => [...(invoice.documents || [])]
  .sort((a, b) => new Date(b.sentAt || 0) - new Date(a.sentAt || 0))[0];

/**
 * The PDF of an invoice as the given type. Once it has been sent as that type the
 * stored number and date are used; before that it is a preview (number "DRAFT").
 */
async function renderDocument(invoice, client, { type, previewDate } = {}) {
  const docType = DOCUMENT_TYPES.includes(type) ? type : (latestDocument(invoice)?.type || 'Tax Invoice');
  const sent = (invoice.documents || []).find((d) => d.type === docType);
  const company = await getCompanyProfile();
  const buffer = await buildBillDocPdfBuffer(specFor({
    invoice, client, company, type: docType,
    number: sent ? sent.number : 'DRAFT',
    date: sent ? sent.date : (previewDate || invoice.issueDate || new Date()),
  }));
  return { buffer, type: docType, number: sent?.number || null };
}

/** What has to be filled in before an invoice can go out as a proforma / tax invoice. */
function sendProblem(invoice, type) {
  if (!DOCUMENT_TYPES.includes(type)) return 'Choose Proforma Invoice or Tax Invoice.';
  const lines = invoice.lineItems || [];
  if (!lines.length) return 'The invoice has no line items.';
  if (lines.length > MAX_ITEMS) return `A proforma / tax invoice holds up to ${MAX_ITEMS} line items; this one has ${lines.length}.`;
  const b = invoice.billing || {};
  if (!String(b.address || '').trim()) return 'Add the billing address (Billing details) before sending.';
  if (!GST_STATE_CODES[b.placeOfSupply]) return 'Choose the place of supply (Billing details) — it decides IGST or CGST + SGST.';
  return null;
}

/**
 * Send the invoice to the client as `type` dated `date` (YYYY-MM-DD, typed by staff).
 * The first send of a type allocates its number; sending again keeps the number, may
 * change the date, and notifies the client again.
 */
async function sendInvoice(invoiceId, { type, date }, user) {
  const day = parseDay(date);
  if (!day) return fail(400, 'Enter the invoice date.');
  const invoice = await Invoice.findById(invoiceId).lean();
  if (!invoice) return fail(404, 'Invoice not found');
  const problem = sendProblem(invoice, type);
  if (problem) return fail(400, problem);

  const now = new Date();
  const actor = { sentAt: now, sentBy: user?._id, sentByName: [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || '' };
  let entry = (invoice.documents || []).find((d) => d.type === type);
  let created = false;

  if (entry) {
    entry = { ...entry, date: day, ...actor };
    await Invoice.updateOne(
      { _id: invoiceId, 'documents.type': type },
      { $set: { 'documents.$.date': day, 'documents.$.sentAt': now, 'documents.$.sentBy': actor.sentBy, 'documents.$.sentByName': actor.sentByName, unsent: false } }
    );
  } else {
    for (let attempt = 0; attempt < 5 && !entry; attempt += 1) {
      const candidate = { type, number: await nextNumber(type), date: day, ...actor };
      try {
        const r = await Invoice.updateOne(
          { _id: invoiceId, 'documents.type': { $ne: type } },
          { $push: { documents: candidate }, $set: { unsent: false } }
        );
        if (r.modifiedCount) { entry = candidate; created = true; } else {
          // Another request sent it as this type first — use theirs
          entry = ((await Invoice.findById(invoiceId).select('documents').lean())?.documents || []).find((d) => d.type === type);
          break;
        }
      } catch (err) {
        if (err.code !== 11000) throw err; // number taken by a parallel send — try the next one
      }
    }
    if (!entry) return fail(409, 'Could not allocate a number. Please try again.');
  }

  const fresh = await Invoice.findById(invoiceId).lean();
  await notifyInvoiceSent(fresh, entry);
  return { ok: true, invoice: fresh, document: entry, created };
}

/** Billing details to start a new invoice from: the client's last invoice, then what the client record and KYC know. */
async function billingDefaults(clientId) {
  const client = await Client.findById(clientId).select('businessName phone').lean();
  if (!client) return null;
  const [kyc, last] = await Promise.all([
    ClientKyc.findOne({ client_ref: clientId }).select('items.gst.value').lean(),
    Invoice.findOne({ client_ref: clientId, billing: { $exists: true } }).sort({ createdAt: -1 }).select('billing').lean(),
  ]);
  const prev = last?.billing || {};
  const gstin = prev.gstin || kyc?.items?.gst?.value || '';
  // The first two digits of a GSTIN are the state code
  const stateOfGstin = Object.keys(GST_STATE_CODES).find((s) => GST_STATE_CODES[s] === gstin.slice(0, 2)) || '';
  return {
    name: prev.name || client.businessName || '',
    address: prev.address || '',
    phone: prev.phone || client.phone || '',
    gstin,
    pan: prev.pan || '',
    placeOfSupply: prev.placeOfSupply || stateOfGstin,
  };
}

module.exports = {
  DOCUMENT_TYPES, MAX_ITEMS, parseDay, highestDocumentNumber, nextNumber, documentItems,
  renderDocument, latestDocument, sendProblem, sendInvoice, billingDefaults,
};
