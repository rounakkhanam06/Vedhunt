const mongoose = require('mongoose');

// One document per saved version of a client's campaign strategy & targeting
// notes (Client Portal CRM §3.2). Versions are never edited in place — saving
// creates the next one — so performance can always be read against the
// strategy that was in effect at that time. A version is hidden from the
// client until someone explicitly approves it for sharing.
const campaignStrategySchema = new mongoose.Schema(
  {
    client_ref: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
    version: { type: Number, required: true, min: 1 },

    objective: { type: String, trim: true, maxlength: 2000 },
    targetAudience: { type: String, trim: true, maxlength: 4000 },
    adStrategySummary: { type: String, trim: true, maxlength: 6000 },
    keyDifferentiator: { type: String, trim: true, maxlength: 2000 },
    specialInstructions: { type: String, trim: true, maxlength: 4000 },
    // Internal only — never part of what the client sees
    competitorReference: { type: String, trim: true, maxlength: 2000 },
    changeNote: { type: String, trim: true, maxlength: 1000 },

    author: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
    authorName: { type: String, trim: true },

    // Approved for sharing = visible to the client in the portal
    sharedWithClient: { type: Boolean, default: false },
    sharedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    sharedByName: { type: String, trim: true },
    sharedAt: { type: Date },
  },
  { timestamps: true }
);

campaignStrategySchema.index({ client_ref: 1, version: -1 }, { unique: true });

module.exports = mongoose.model('CampaignStrategy', campaignStrategySchema);
