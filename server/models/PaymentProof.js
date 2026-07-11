const mongoose = require('mongoose');

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
    utrNumber: {
      type: String,
      required: true,
      trim: true,
    },
    paymentDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    screenshotUrl: {
      type: String,
      required: true,
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

const PaymentProof = mongoose.model('PaymentProof', paymentProofSchema);
module.exports = PaymentProof;
