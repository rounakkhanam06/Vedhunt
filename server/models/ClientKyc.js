const mongoose = require('mongoose');

// One KYC record per client: five items, each reviewed on its own
// (services/kyc.js has the rules). Documents live in ClientKycFile, never on a
// public URL; only the last 4 digits of an Aadhaar number are ever stored.
// Client Journey SOP §7: Not Requested (staff have not asked for it), Not Submitted (asked, client
// has not sent it), Submitted (client sent it), Under Review (staff are checking it — also what an
// admin-uploaded document starts as), Verified, Rejected, Not Applicable (does not apply to this client).
const ITEM_STATUSES = ['Not Requested', 'Not Submitted', 'Submitted', 'Under Review', 'Verified', 'Rejected', 'Not Applicable'];
// Where a document came from. 'Client portal' is the client's own upload; the rest are what an admin
// picks when uploading on the client's behalf.
const UPLOAD_SOURCES = ['Client portal', 'Client WhatsApp', 'Email', 'In person', 'Other'];

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
    // Who put the document here and where it came from (an admin may upload for the client)
    uploadedBy: { type: String, enum: ['client', 'admin'] },
    uploadedByAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    uploadedByName: { type: String },
    source: { type: String, enum: UPLOAD_SOURCES },
    receivedAt: { type: Date }, // when the client actually handed it over (admin-entered)
    naReason: { type: String, trim: true, maxlength: 500 }, // why it is Not Applicable — staff only
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
module.exports.UPLOAD_SOURCES = UPLOAD_SOURCES;
