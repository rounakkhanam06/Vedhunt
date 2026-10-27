const mongoose = require('mongoose');

// A scheduled invoice waiting for an admin (client decision: admin approval, with
// the option to correct before it goes out). Drafts live apart from Invoice on
// purpose: a draft is invisible to the client and never counts as money owed
// until it is approved and turned into a real Invoice.
const lineItemSchema = new mongoose.Schema(
  {
    description: { type: String, required: true, trim: true, maxlength: 300 },
    qty: { type: Number, default: 1, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
    revenueType: { type: String, enum: ['Retainer', 'One-time setup', 'Project / Add-on', 'Other'] },
    service: { type: String, trim: true, maxlength: 80 }, // from the admin's service list; absent = Unassigned
  },
  { _id: false }
);

const STATUSES = ['Pending Approval', 'Needs Attention', 'Approved', 'Skipped'];

const invoiceDraftSchema = new mongoose.Schema(
  {
    client_ref: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
    // The scheduled invoice date 'YYYY-MM-DD'; one draft per client per date
    invoiceDate: { type: String, required: true },
    periodStart: { type: String, required: true },
    periodEnd: { type: String, required: true }, // the day before the next invoice date
    dueDate: { type: Date, required: true },
    lineItems: { type: [lineItemSchema], default: [] },
    subtotal: { type: Number, default: 0 },
    taxPercent: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    status: { type: String, enum: STATUSES, default: 'Pending Approval' },
    // Why it needs attention (missing retainer, no email, zero amount …)
    problems: { type: [String], default: [] },
    note: { type: String, trim: true, maxlength: 500 }, // admin note on a correction
    corrected: { type: Boolean, default: false },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    decidedByName: { type: String },
    decidedAt: { type: Date },
    skipReason: { type: String, trim: true, maxlength: 500 },
    invoice_ref: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
  },
  { timestamps: true }
);

// The same scheduled date can never be drafted twice, however many times the job runs
invoiceDraftSchema.index({ client_ref: 1, invoiceDate: 1 }, { unique: true });
invoiceDraftSchema.index({ status: 1, invoiceDate: -1 });

module.exports = mongoose.model('InvoiceDraft', invoiceDraftSchema);
module.exports.STATUSES = STATUSES;
