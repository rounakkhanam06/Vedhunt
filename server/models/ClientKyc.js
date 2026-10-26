const mongoose = require('mongoose');

// One KYC record per client: five items, each reviewed on its own
// (services/kyc.js has the rules). Documents live in ClientKycFile, never on a
// public URL; only the last 4 digits of an Aadhaar number are ever stored.
const ITEM_STATUSES = ['Not Submitted', 'Submitted', 'Verified', 'Rejected'];

const itemSchema = new mongoose.Schema(
  {
    status: { type: String, enum: ITEM_STATUSES, default: 'Not Submitted' },
    // gst: the GSTIN · pan: encrypted PAN (valueEnc) · aadhaar: last 4 only (last4)
    // brand_authorisation: the brand name the letter covers (optional)
    value: { type: String, trim: true },
    valueEnc: { type: String, select: false },
    last4: { type: String },
    holderType: { type: String }, // PAN holder type, e.g. Company / Individual
    file: {
      fileId: { type: mongoose.Schema.Types.ObjectId, ref: 'ClientKycFile' },
      originalName: { type: String },
      mimeType: { type: String },
      size: { type: Number },
      uploadedAt: { type: Date },
    },
    submittedAt: { type: Date },
    attempts: { type: Number, default: 0 },
    reviewedAt: { type: Date },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    reviewerName: { type: String },
    rejectionReason: { type: String, trim: true, maxlength: 500 },
  },
  { _id: false }
);

const item = () => ({ type: itemSchema, default: () => ({}) });

const clientKycSchema = new mongoose.Schema(
  {
    client_ref: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true, unique: true },
    items: {
      gst: item(),
      pan: item(),
      aadhaar: item(),
      photo: item(),
      brand_authorisation: item(),
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ClientKyc', clientKycSchema);
module.exports.ITEM_STATUSES = ITEM_STATUSES;
