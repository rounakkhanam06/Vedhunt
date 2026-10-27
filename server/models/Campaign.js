const mongoose = require('mongoose');
const { PLATFORMS } = require('./AdPerformance');

// A client's campaign, with the status the team gives it (Active / Paused / Ended).
// The Financial Overview counts "Campaigns live" from this status, not from recent spend.
//
// Campaigns already named in the daily ad data are added here automatically (services/campaigns.js)
// with no status yet (null = "Needs status"), so nothing is guessed. One record per client +
// platform + campaign key (the lower-cased name the ad data uses), so syncing never duplicates.
const STATUSES = ['Active', 'Paused', 'Ended'];

const campaignSchema = new mongoose.Schema(
  {
    client_ref: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
    platform: { type: String, enum: PLATFORMS, required: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    campaignKey: { type: String, required: true }, // same normalisation as AdPerformance.campaignKey
    campaignId: { type: String, trim: true, maxlength: 100 },
    status: { type: String, enum: [...STATUSES, null], default: null },
    statusUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    statusUpdatedByName: { type: String, trim: true },
    statusUpdatedAt: { type: Date },
    source: { type: String, enum: ['ad-data', 'manual'], default: 'manual' },
  },
  { timestamps: true }
);

campaignSchema.index({ client_ref: 1, platform: 1, campaignKey: 1 }, { unique: true });
campaignSchema.index({ status: 1 });

module.exports = mongoose.model('Campaign', campaignSchema);
module.exports.STATUSES = STATUSES;
