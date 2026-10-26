const mongoose = require('mongoose');

// The bytes of an uploaded KYC document. Kept in the database (not on a public
// CDN link) and served only through authenticated endpoints, so a leaked URL
// can never expose an identity document. `data` is never selected by default.
const clientKycFileSchema = new mongoose.Schema(
  {
    client_ref: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
    item: { type: String, required: true }, // gst | pan | aadhaar | photo | brand_authorisation
    data: { type: Buffer, required: true, select: false },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    originalName: { type: String },
    sha256: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ClientKycFile', clientKycFileSchema);
