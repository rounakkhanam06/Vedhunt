const mongoose = require('mongoose');

/**
 * A generated client proposal for a lead. Each version is its own document:
 * a Draft is edited in place, but once Final (or Shared) it's immutable —
 * revising it creates version + 1 and marks this one Superseded, so what a
 * client actually received is never rewritten (same idea as Payslip).
 *
 * Line items come from the Service Master (config/serviceMaster.js) and also
 * drive the proforma invoice generated from a final proposal.
 */
const lineItemSchema = new mongoose.Schema({
  service: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  sac: { type: String, trim: true },        // HSN / SAC code
  qty: { type: Number, required: true, min: 0.01 },
  uom: { type: String, trim: true },        // Month / Project / Session ...
  rate: { type: Number, required: true, min: 0 },
  gstPercent: { type: Number, default: 18, min: 0, max: 28 },
  taxable: { type: Number, default: 0 },
  gstAmount: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
}, { _id: false });

const proposalSchema = new mongoose.Schema(
  {
    proposalNumber: { type: String, required: true }, // VH-PROP-YYMMDD-NNN, shared by all versions
    sequence: { type: Number }, // the running NNN part
    version: { type: Number, default: 1 },
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
    leadCode: { type: String, trim: true }, // Lead.leadId at creation, for display
    status: { type: String, enum: ['Draft', 'Final', 'Shared', 'Superseded'], default: 'Draft' },
    title: { type: String, trim: true, default: 'Business Proposal' }, // e.g. "Performance Marketing Proposal"

    details: {
      clientName: { type: String, trim: true },     // company / brand
      website: { type: String, trim: true },
      contactPerson: { type: String, trim: true },
      contactDesignation: { type: String, trim: true },
      email: { type: String, trim: true },
      phone: { type: String, trim: true },
      // Billing details — used by the proforma invoice
      address: { type: String, trim: true },
      gstin: { type: String, trim: true },
      pan: { type: String, trim: true },
      placeOfSupply: { type: String, trim: true },  // state name, e.g. "Nagaland"
      // "What we understand about you"
      industry: { type: String, trim: true },
      businessModel: { type: String, trim: true },
      targetAudience: { type: String, trim: true },
      currentStatus: { type: String, trim: true },
      painPoints: { type: String, trim: true },
      goal: { type: String, trim: true },
      // Proposal body
      service: { type: String, trim: true },
      requirement: { type: String, trim: true },
      scope: { type: String, trim: true },
      deliverables: { type: String, trim: true }, // one per line
      timeline: { type: String, trim: true },
      paymentTerms: { type: String, trim: true },
      clientRequirements: { type: String, trim: true }, // what we need from the client, one per line
      assumptions: { type: String, trim: true },
      exclusions: { type: String, trim: true },
      notes: { type: String, trim: true },
    },
    items: { type: [lineItemSchema], default: [] },
    validityDays: { type: Number, default: 15, min: 1, max: 180 },
    projectValue: { type: Number, default: 0 }, // taxable total (sum of items)
    gstAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
    finalizedAt: Date,
    finalizedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    pdfUrl: { type: String, trim: true },

    // Assigned the first time a proforma invoice is generated from this version
    proformaNumber: { type: Number },
    proformaDate: { type: Date },

    shares: [{
      channel: { type: String, enum: ['Email', 'WhatsApp'] },
      recipient: { type: String, trim: true },
      sharedAt: { type: Date, default: Date.now },
      sharedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    }],
  },
  { timestamps: true }
);

proposalSchema.index({ proposalNumber: 1, version: 1 }, { unique: true });
proposalSchema.index({ proformaNumber: 1 }, { unique: true, sparse: true });
proposalSchema.index({ sequence: -1 });

const round2 = (n) => Math.round(n * 100) / 100;

proposalSchema.pre('validate', function () {
  let taxable = 0;
  let gst = 0;
  for (const item of this.items) {
    item.taxable = round2(item.qty * item.rate);
    item.gstAmount = round2(item.taxable * (item.gstPercent || 0) / 100);
    item.total = round2(item.taxable + item.gstAmount);
    taxable += item.taxable;
    gst += item.gstAmount;
  }
  this.projectValue = round2(taxable);
  this.gstAmount = round2(gst);
  this.totalAmount = round2(taxable + gst);
});

module.exports = mongoose.model('Proposal', proposalSchema);
