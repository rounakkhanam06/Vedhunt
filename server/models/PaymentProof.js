const mongoose = require('mongoose');

const PAYMENT_METHODS = ['UPI', 'Bank Transfer', 'Cash', 'Cheque', 'Card', 'Other'];

const paymentProofSchema = new mongoose.Schema(
  {
    invoice_ref: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      required: true,
    },
    client_ref: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
    },
    amountPaid: {
      type: Number,
      required: true,
      min: 0,
    },
    // The bank / UPI reference. Required for a client's proof; staff may leave it out for cash
    utrNumber: {
      type: String,
      required() { return this.source !== 'staff'; },
      trim: true,
    },
    // How it was paid, and who put it on record: 'client' = the client submitted a proof,
    // 'staff' = recorded by staff (cash, cheque, an offline transfer …)
    method: { type: String, enum: PAYMENT_METHODS },
    source: { type: String, enum: ['client', 'staff'], default: 'client' },
    note: { type: String, trim: true, maxlength: 500 },
    recordedByName: { type: String, trim: true },
    // Numbered when the payment is accepted, in one series for all receipts
    receiptNumber: { type: Number },
    paymentDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    screenshotUrl: {
      type: String,
      default: null
    },
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected'],
      default: 'Pending',
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
    verifiedAt: {
      type: Date,
    }
  },
  { timestamps: true }
);

// Indexes for faster querying
paymentProofSchema.index({ invoice_ref: 1 });
paymentProofSchema.index({ client_ref: 1 });
paymentProofSchema.index({ status: 1 });
paymentProofSchema.index({ receiptNumber: 1 }, { unique: true, sparse: true });

const PaymentProof = mongoose.model('PaymentProof', paymentProofSchema);
module.exports = PaymentProof;
module.exports.PAYMENT_METHODS = PAYMENT_METHODS;
