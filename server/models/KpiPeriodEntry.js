const mongoose = require('mongoose');
const { PLATFORMS } = require('./AdPerformance');

// What staff add to one row of the KPI report (a day, week or month for one platform):
// the client-confirmed numbers the ad platforms cannot know, and what was done about the
// result. Entered by employees; the client can only see it.
const kpiPeriodEntrySchema = new mongoose.Schema(
  {
    client_ref: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
    platform: { type: String, enum: PLATFORMS, required: true },
    frequency: { type: String, enum: ['Daily', 'Weekly', 'Monthly'], required: true },
    periodStart: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ }, // the day / Monday / 1st of the month
    qualifiedLeads: { type: Number, min: 0 }, // leads meeting the client's qualification rules
    verifiedOrders: { type: Number, min: 0 }, // orders / customers confirmed in the store or CRM, duplicates removed
    action: { type: String, trim: true, maxlength: 2000 }, // "Result / Optimization Action" — shown to the client
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    updatedByName: { type: String, trim: true },
  },
  { timestamps: true }
);

kpiPeriodEntrySchema.index({ client_ref: 1, platform: 1, frequency: 1, periodStart: 1 }, { unique: true });

module.exports = mongoose.model('KpiPeriodEntry', kpiPeriodEntrySchema);
