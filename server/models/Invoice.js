const mongoose = require('mongoose');

// ─── Line Item Sub-Schema ─────────────────────────────────────────────────────
const lineItemSchema = new mongoose.Schema(
  {
    description: { type: String, required: true, trim: true },
    qty: { type: Number, required: true, min: 1, default: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 }, // qty * unitPrice
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
    paymentStatus: {
      type: String,
      enum: ['Paid', 'Unpaid', 'Overdue'],
      default: 'Unpaid',
    },
    paidOn: { type: Date },
    paymentMethod: { type: String, trim: true },
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
invoiceSchema.index({ client_ref: 1, paymentStatus: 1 });

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
