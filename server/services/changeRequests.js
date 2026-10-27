// Change requests (Client Journey SOP §10 / §15): out-of-scope work is assessed, quoted, approved by
// the client, and only then started and billed.
//   • work cannot start until the client's approval is Approved
//   • an invoice can only be made from an approved request, once, as a "Project / Add-on" line
//   • where a request stands is read from its approval (never stored twice)
const ChangeRequest = require('../models/ChangeRequest');
const Approval = require('../models/Approval');
const Invoice = require('../models/Invoice');
const { getBilling } = require('./clientPolicies');
const { billingDefaults } = require('./invoiceDocument');

const fail = (status, message) => ({ ok: false, status, message });
const clip = (v, n) => String(v ?? '').trim().slice(0, n);
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const staffName = (u) => [u?.firstName, u?.lastName].filter(Boolean).join(' ').trim() || u?.email || '';
const inr = (n) => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

/** Validate a new change request. @returns { value } | { error } */
function validateRequest(input = {}) {
  const errors = [];
  const title = clip(input.title, 150);
  const description = clip(input.description, 3000);
  if (title.length < 3) errors.push('Give the change request a title.');
  if (description.length < 10) errors.push('Describe what is being asked for (at least 10 characters).');
  const quoteAmount = Number(input.quoteAmount);
  if (!Number.isFinite(quoteAmount) || quoteAmount <= 0) errors.push('Enter the fee quoted (before GST).');
  let estimatedDays;
  if (input.estimatedDays !== undefined && input.estimatedDays !== '' && input.estimatedDays !== null) {
    estimatedDays = Number(input.estimatedDays);
    if (!Number.isInteger(estimatedDays) || estimatedDays < 0 || estimatedDays > 365) errors.push('Estimated days must be a whole number from 0 to 365.');
  }
  if (errors.length) return { error: errors.join(' ') };
  return { value: { title, description, quoteAmount: r2(quoteAmount), estimatedDays, assessment: clip(input.assessment, 1500) || undefined } };
}

/** Where a request stands, from its approval and its work: one label for the list. */
function stageOf(cr, approval) {
  if (!approval) return 'Unknown';
  if (approval.status === 'Pending') return 'Awaiting client approval';
  if (approval.status === 'Rejected') return 'Rejected by client';
  if (approval.status === 'Cancelled') return 'Withdrawn';
  if (cr.workStatus === 'Done') return cr.invoice_ref ? 'Done and invoiced' : 'Done — not invoiced yet';
  if (cr.workStatus === 'In progress') return 'In progress';
  return 'Approved — ready to start';
}

async function nextNumber() {
  const last = await ChangeRequest.findOne({}, { number: 1 }).sort({ number: -1 }).lean();
  return (last?.number || 0) + 1;
}

/** The quote as the client reads it in their approval. */
function approvalDetails(cr, gstPercent) {
  const gst = r2((cr.quoteAmount * gstPercent) / 100);
  return [
    cr.description,
    '',
    `Fee: ${inr(cr.quoteAmount)} + ${gstPercent}% GST (${inr(gst)}) = ${inr(cr.quoteAmount + gst)}`,
    cr.estimatedDays ? `Estimated time: ${cr.estimatedDays} working day${cr.estimatedDays === 1 ? '' : 's'}` : null,
    'This is outside your current scope, so we will start only after you approve, and bill it separately.',
  ].filter((l) => l !== null).join('\n');
}

/** Create the request and the client approval that goes with it. */
async function create(clientId, input, user) {
  const { value, error } = validateRequest(input);
  if (error) return fail(400, error);
  const { gstPercent } = await getBilling();
  let cr = null;
  for (let attempt = 0; attempt < 5 && !cr; attempt += 1) {
    const number = await nextNumber();
    const draft = { ...value, number, client_ref: clientId, createdBy: user._id, createdByName: staffName(user) };
    const approval = await Approval.create({
      client_ref: clientId, kind: 'Change request', title: `CR-${number}: ${value.title}`, versionLabel: `CR-${number}`,
      amount: value.quoteAmount, details: approvalDetails(draft, Number(gstPercent) || 0),
      requestedBy: user._id, requestedByName: staffName(user),
    });
    try {
      cr = await ChangeRequest.create({ ...draft, approval_ref: approval._id });
    } catch (err) {
      await Approval.deleteOne({ _id: approval._id });
      if (err.code !== 11000) throw err; // number taken in parallel — try the next one
    }
  }
  if (!cr) return fail(409, 'Could not allocate a change request number. Please try again.');
  return { ok: true, changeRequest: cr, approval: await Approval.findById(cr.approval_ref).lean() };
}

async function load(id, clientId) {
  const cr = await ChangeRequest.findOne({ _id: id, client_ref: clientId });
  if (!cr) return { error: fail(404, 'Change request not found') };
  return { cr, approval: await Approval.findById(cr.approval_ref).lean() };
}

/** Start or finish the work. Starting needs the client's approval first. */
async function setWork(id, clientId, status) {
  if (!['In progress', 'Done'].includes(status)) return fail(400, 'Status must be "In progress" or "Done".');
  const { cr, approval, error } = await load(id, clientId);
  if (error) return error;
  if (approval?.status !== 'Approved') return fail(409, 'The client has not approved this change request, so work cannot start.');
  if (status === 'In progress' && cr.workStatus !== 'Not started') return fail(409, `The work is already ${cr.workStatus.toLowerCase()}.`);
  if (status === 'Done' && cr.workStatus === 'Done') return fail(409, 'The work is already done.');
  const now = new Date();
  cr.workStatus = status;
  if (status === 'In progress') cr.startedAt = now;
  else { cr.doneAt = now; cr.startedAt = cr.startedAt || now; }
  await cr.save();
  return { ok: true, changeRequest: cr, approval };
}

/** Make the (unsent) invoice for an approved request — once. Staff check the billing details and send it from Invoices. */
async function createInvoice(id, clientId, user) {
  const { cr, approval, error } = await load(id, clientId);
  if (error) return error;
  if (approval?.status !== 'Approved') return fail(409, 'Only an approved change request can be invoiced.');
  if (cr.invoice_ref) return fail(409, 'This change request already has an invoice.');

  const { gstPercent, defaultDueDays } = await getBilling();
  const taxPercent = Number(gstPercent) || 0;
  const taxAmount = r2((cr.quoteAmount * taxPercent) / 100);
  const now = new Date();
  // Claim the request first, so two clicks cannot make two invoices
  const claimed = await ChangeRequest.findOneAndUpdate({ _id: cr._id, invoice_ref: null }, { $set: { invoice_ref: cr._id } }, { new: true });
  if (!claimed) return fail(409, 'This change request already has an invoice.');
  try {
    const invoice = await Invoice.create({
      client_ref: clientId, issueDate: now, dueDate: new Date(now.getTime() + (Number(defaultDueDays) || 7) * 864e5),
      lineItems: [{ description: `CR-${cr.number}: ${cr.title}`, qty: 1, unitPrice: cr.quoteAmount, amount: cr.quoteAmount, revenueType: 'Project / Add-on' }],
      subtotal: cr.quoteAmount, taxPercent, taxAmount, totalAmount: r2(cr.quoteAmount + taxAmount),
      billing: (await billingDefaults(clientId)) || undefined,
      unsent: true,
      notes: `Change request CR-${cr.number}, approved ${approval.decidedAt ? new Date(approval.decidedAt).toLocaleDateString('en-IN') : ''}`,
    });
    await ChangeRequest.updateOne({ _id: cr._id }, { $set: { invoice_ref: invoice._id } });
    return { ok: true, invoice, changeRequest: await ChangeRequest.findById(cr._id).lean() };
  } catch (err) {
    await ChangeRequest.updateOne({ _id: cr._id }, { $unset: { invoice_ref: 1 } }); // nothing was invoiced: free it for another try
    throw err;
  }
}

module.exports = { validateRequest, stageOf, create, setWork, createInvoice, load };
