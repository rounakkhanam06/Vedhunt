const mongoose = require('mongoose');

// ─── Line Item Sub-Schema ─────────────────────────────────────────────────────
const lineItemSchema = new mongoose.Schema(
  {
    description: { type: String, required: true, trim: true },
    qty: { type: Number, required: true, min: 1, default: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 }, // qty * unitPrice
    sac: { type: String, trim: true, maxlength: 12 }, // HSN / SAC printed on the proforma / tax invoice
  },
  { _id: false }
);

const DOCUMENT_TYPES = ['Proforma Invoice', 'Tax Invoice'];

// Who the invoice is made out to, filled by staff from the client's details.
// The Client record has no billing address or state, so they live on the invoice.
const billingSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, maxlength: 150 },
    address: { type: String, trim: true, maxlength: 400 },
    phone: { type: String, trim: true, maxlength: 20 },
    gstin: { type: String, trim: true, uppercase: true, maxlength: 15 },
    pan: { type: String, trim: true, uppercase: true, maxlength: 10 },
    placeOfSupply: { type: String, trim: true, maxlength: 60 }, // a GST state name — decides IGST vs CGST + SGST
  },
  { _id: false }
);

// One entry per document type the invoice has been sent as. The number is
// allocated when it is first sent and never changes (services/invoiceDocument.js).
const documentSchema = new mongoose.Schema(
  {
    type: { type: String, enum: DOCUMENT_TYPES, required: true },
    number: { type: Number, required: true },
    date: { type: Date, required: true }, // typed by staff
    sentAt: { type: Date },
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    sentByName: { type: String, trim: true },
  },
  { _id: false }
);

// ─── Invoice Schema ───────────────────────────────────────────────────────────
const invoiceSchema = new mongoose.Schema(
  {
    invoiceId: {
      type: String,
      unique: true,
      sparse: true,
    },
    client_ref: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: [true, 'Client reference is required'],
    },
    project_ref: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
    },
    issueDate: {
      type: Date,
      required: [true, 'Issue date is required'],
      default: Date.now,
    },
    dueDate: {
      type: Date,
      required: [true, 'Due date is required'],
    },
    lineItems: {
      type: [lineItemSchema],
      validate: {
        validator: (arr) => arr.length > 0,
        message: 'At least one line item is required',
      },
    },
    subtotal: { type: Number, required: true, min: 0 },
    taxPercent: { type: Number, default: 0, min: 0, max: 100 },
    taxAmount: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },
    // Total of the credit notes issued against this invoice (incl. GST). The invoice as issued
    // (totalAmount) is never rewritten: what is owed is totalAmount − creditedAmount.
    creditedAmount: { type: Number, default: 0, min: 0 },
    paymentStatus: {
      type: String,
      enum: ['Paid', 'Unpaid', 'Overdue'],
      default: 'Unpaid',
    },
    paidOn: { type: Date },
    // Set on invoices generated from a retainer's extra hours: one invoice per retainer per month
    // Set on invoices created from a billing schedule (one per client per scheduled date)
    scheduled: {
      invoiceDate: { type: String },
      periodStart: { type: String },
      periodEnd: { type: String },
    },
    extraHours: {
      retainer_ref: { type: mongoose.Schema.Types.ObjectId, ref: 'Retainer' },
      month: { type: String }, // 'YYYY-MM'
      hours: { type: Number },
    },
    paymentMethod: { type: String, trim: true },
    billing: { type: billingSchema, default: undefined },
    documents: { type: [documentSchema], default: [] },
    // True on invoices made by staff and not sent yet: the client does not see
    // them and they are not counted as receivables. Absent on older invoices.
    unsent: { type: Boolean },
    // Internal admin notes — NEVER sent to client (select: false)
    notes: { type: String, trim: true, select: false },
  },
  { timestamps: true }
);

// ─── Indexes ─────────────────────────────────────────────────────────────────
invoiceSchema.index({ client_ref: 1, createdAt: -1 });
invoiceSchema.index({ invoiceId: 1 });
invoiceSchema.index({ paymentStatus: 1 });
invoiceSchema.index({ dueDate: 1 });
invoiceSchema.index(
  { client_ref: 1, 'scheduled.invoiceDate': 1 },
  { unique: true, partialFilterExpression: { 'scheduled.invoiceDate': { $exists: true } } }
);
invoiceSchema.index(
  { 'extraHours.retainer_ref': 1, 'extraHours.month': 1 },
  { unique: true, partialFilterExpression: { 'extraHours.month': { $exists: true } } }
);
invoiceSchema.index({ client_ref: 1, paymentStatus: 1 });
// A proforma / tax invoice number is used once per type
invoiceSchema.index(
  { 'documents.type': 1, 'documents.number': 1 },
  { unique: true, partialFilterExpression: { 'documents.number': { $exists: true } } }
);

// ─── Auto-generate invoiceId ─────────────────────────────────────────────────
invoiceSchema.pre('save', async function () {
  if (!this.invoiceId) {
    const now = new Date();
    const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `VH-INV-${yyyymm}-`;
    const lastInvoice = await this.constructor
      .findOne({ invoiceId: new RegExp(`^${prefix}`) })
      .sort({ createdAt: -1 })
      .lean();
    let seq = 1;
    if (lastInvoice?.invoiceId) {
      const last = parseInt(lastInvoice.invoiceId.split('-').pop(), 10);
      if (!isNaN(last)) seq = last + 1;
    }
    this.invoiceId = `${prefix}${String(seq).padStart(3, '0')}`;
  }
});

// ─── Auto-mark Overdue on read ────────────────────────────────────────────────
// A lightweight post-find hook to flip Unpaid → Overdue if past dueDate
invoiceSchema.post('find', function (docs) {
  const now = new Date();
  docs.forEach((doc) => {
    if (doc.paymentStatus === 'Unpaid' && doc.dueDate && doc.dueDate < now) {
      doc.paymentStatus = 'Overdue';
    }
  });
});

invoiceSchema.post('findOne', function (doc) {
  if (!doc) return;
  const now = new Date();
  if (doc.paymentStatus === 'Unpaid' && doc.dueDate && doc.dueDate < now) {
    doc.paymentStatus = 'Overdue';
  }
});

const Invoice = mongoose.model('Invoice', invoiceSchema);
module.exports = Invoice;
module.exports.DOCUMENT_TYPES = DOCUMENT_TYPES;
