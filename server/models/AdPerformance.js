const mongoose = require('mongoose');

// One manually entered Daily Tracker row (Client Portal CRM §5): a client's
// results for one platform + campaign (+ optional creative) on one day.
// Ratios (CTR, CPC, CPM, cost per result, ROAS) are never stored — they are
// recomputed from summed numerators/denominators (services/adPerformance.js).
const PLATFORMS = ['Meta', 'Google', 'LinkedIn', 'YouTube', 'Other'];

const adPerformanceSchema = new mongoose.Schema(
  {
    client_ref: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
    // Reporting day as entered, 'YYYY-MM-DD' (no timezone drift; sorts and ranges as text)
    day: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    platform: { type: String, enum: PLATFORMS, required: true },
    campaignName: { type: String, required: true, trim: true, maxlength: 200 },
    campaignKey: { type: String, required: true }, // lower-cased name, for the duplicate check
    campaignId: { type: String, trim: true, maxlength: 100 }, // the platform's campaign ID, if known
    objective: { type: String, trim: true, maxlength: 100 },
    creativeType: { type: String, trim: true, maxlength: 60 },
    creativeName: { type: String, trim: true, maxlength: 200 },
    creativeKey: { type: String, default: '' },
    budget: { type: Number, min: 0 },
    budgetType: { type: String, enum: ['Daily', 'Lifetime'], default: 'Daily' },
    spend: { type: Number, required: true, min: 0 },
    impressions: { type: Number, default: 0, min: 0 },
    clicks: { type: Number, default: 0, min: 0 },
    results: { type: Number, default: 0, min: 0 },
    resultType: { type: String, trim: true, maxlength: 60 }, // e.g. Leads, Purchases
    revenue: { type: Number, min: 0 }, // attributed conversion value, if reported
    currency: { type: String, default: 'INR', enum: ['INR'] },
    notes: { type: String, trim: true, maxlength: 1000 }, // internal — never shown to the client
    hidden: { type: Boolean, default: false }, // hidden from the client portal (e.g. while being corrected)
    enteredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    enteredByName: { type: String },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  },
  { timestamps: true }
);

// Entering the same day/platform/campaign/creative twice is refused instead of double counting
adPerformanceSchema.index({ client_ref: 1, day: 1, platform: 1, campaignKey: 1, creativeKey: 1 }, { unique: true });
adPerformanceSchema.index({ client_ref: 1, day: -1 });

module.exports = mongoose.model('AdPerformance', adPerformanceSchema);
module.exports.PLATFORMS = PLATFORMS;
