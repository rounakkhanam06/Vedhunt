const mongoose = require('mongoose');
const { PLATFORMS } = require('./AdPerformance');

// KPI setup per client per ad platform ("KPI Metric for Client Reports", client sample,
// Oct 2026 — Client Setup sheet). Budgets and targets are per platform: a client's Meta and
// Google budgets are separate and never added into one combined budget.
const FREQUENCIES = ['Daily', 'Weekly', 'Monthly'];
const GOALS = ['Purchases', 'Leads', 'Qualified Leads', 'Other'];

const kpiSetupSchema = new mongoose.Schema(
  {
    client_ref: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
    platform: { type: String, enum: PLATFORMS, required: true },
    businessType: { type: String, trim: true, maxlength: 80 }, // e.g. E-commerce, Lead Generation
    reportingFrequency: { type: String, enum: FREQUENCIES, default: 'Monthly' },
    monthlyBudget: { type: Number, min: 0, required: true }, // client-approved, for this platform — this month's
    // Every budget change, effective from a month: past months keep the budget they had
    // (client decision, Oct 2026). Before the first entry, the first entry's budget applies.
    budgetHistory: {
      type: [{ _id: false, month: { type: String, match: /^\d{4}-\d{2}$/ }, monthlyBudget: { type: Number, min: 0 } }],
      default: [],
    },
    primaryGoal: { type: String, enum: GOALS, default: 'Purchases' },
    targetCpa: { type: Number, min: 0 }, // target cost per purchase / lead (₹)
    targetRoas: { type: Number, min: 0 }, // e.g. 2.5
    grossMarginPercent: { type: Number, min: 0, max: 100 }, // internal only — never sent to the client
    accountOwner: { type: String, trim: true, maxlength: 120 },
    notes: { type: String, trim: true, maxlength: 1000 }, // internal only
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    updatedByName: { type: String, trim: true },
  },
  { timestamps: true }
);

kpiSetupSchema.index({ client_ref: 1, platform: 1 }, { unique: true });

module.exports = mongoose.model('KpiSetup', kpiSetupSchema);
module.exports.FREQUENCIES = FREQUENCIES;
module.exports.GOALS = GOALS;
