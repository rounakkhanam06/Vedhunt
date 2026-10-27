const mongoose = require('mongoose');

// A credit note reduces what a client owes on one invoice (a discount, a correction, a service not
// delivered …). It has its own number series and never changes the invoice as issued: the invoice
// carries creditedAmount, and what is owed is totalAmount − creditedAmount (services/finance.js).
const creditNoteSchema = new mongoose.Schema(
  {
    number: { type: Number, required: true, unique: true }, // CN-<number>
    client_ref: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
    invoice_ref: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true },
    invoiceId: { type: String }, // the invoice's own ID, for display
    date: { type: Date, required: true }, // typed by staff
    amount: { type: Number, required: true, min: 0.01 }, // taxable value credited
    taxPercent: { type: Number, default: 0, min: 0, max: 100 }, // the invoice's rate
    taxAmount: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0.01 }, // amount + tax: what the invoice's balance drops by
    reason: { type: String, required: true, trim: true, maxlength: 500 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    createdByName: { type: String, trim: true },
  },
  { timestamps: true }
);

creditNoteSchema.index({ invoice_ref: 1, date: 1 });
creditNoteSchema.index({ client_ref: 1, date: -1 });

module.exports = mongoose.model('CreditNote', creditNoteSchema);
