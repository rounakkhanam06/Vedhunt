const mongoose = require('mongoose');

// Which of a client's platforms / assets Vedhunt has been given access to (Client Journey SOP §8).
// This is a RECORD of access, never a place for credentials: there is no password field, and the
// SOP says to use official partner / business access, never shared passwords.
const PLATFORMS = ['Meta Ads', 'Google Ads', 'Google Analytics / Tag Manager', 'Website / CMS', 'E-commerce store', 'Social account', 'Other'];
const OWNERS = ['Client', 'Vedhunt', 'Third party'];
const PERMISSIONS = ['Admin', 'Standard / Editor', 'Analyst / View only', 'Partner access', 'Other'];
const STATUSES = ['Requested', 'Granted', 'Verified', 'Revoked'];

const platformAccessSchema = new mongoose.Schema(
  {
    client_ref: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
    platform: { type: String, enum: PLATFORMS, required: true },
    assetName: { type: String, trim: true, maxlength: 150 }, // e.g. the ad account / page / site name
    accountId: { type: String, trim: true, maxlength: 80 }, // the platform's business / account ID
    assetOwner: { type: String, enum: OWNERS, default: 'Client' },
    permissionLevel: { type: String, enum: PERMISSIONS },
    status: { type: String, enum: STATUSES, default: 'Requested' },
    requestedAt: { type: Date },
    grantedAt: { type: Date },
    verifiedAt: { type: Date }, // access tested and working
    revokedAt: { type: Date },
    revokeReason: { type: String, trim: true, maxlength: 300 },
    notes: { type: String, trim: true, maxlength: 500 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    updatedByName: { type: String, trim: true },
  },
  { timestamps: true }
);

platformAccessSchema.index({ client_ref: 1, platform: 1, status: 1 });

module.exports = mongoose.model('PlatformAccess', platformAccessSchema);
Object.assign(module.exports, { PLATFORMS, OWNERS, PERMISSIONS, STATUSES });
