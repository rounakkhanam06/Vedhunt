const mongoose = require('mongoose');

// The KPI catalog — single source for labels, units and how each actual is
// obtained. `auto` metrics are synced from CRM/WorkLog/attendance data
// (POST /performance/sync-actual); manual ones are entered by an admin.
// `lowerIsBetter` (e.g. CPA) scores achievement as target ÷ actual.
const METRIC_DEFS = {
  Revenue:             { label: 'Revenue Closed (₹)',          unit: '₹',     auto: true,  source: 'From CRM (deal value)' },
  LeadCount:           { label: 'Qualified Lead Count',        unit: 'count', auto: true,  source: 'From CRM (Qualified/Won leads)' },
  OnTimeDelivery:      { label: 'On-Time Delivery %',          unit: '%',     auto: true,  source: 'From task completion data' },
  ProductivityPct:     { label: 'Productivity %',              unit: '%',     auto: true,  source: 'From timesheet WorkLog' },
  AttendancePct:       { label: 'Attendance %',                unit: '%',     auto: true,  source: 'From attendance log' },
  BillableHours:       { label: 'Billable Hours',              unit: 'hrs',   auto: true,  source: 'From timesheet WorkLog' },
  FollowUpQuality:     { label: 'Follow-up Quality Score',     unit: 'score', auto: false, source: 'Manual — admin entry' },
  // Digital / performance marketing — entered by admin from the ad platforms
  CampaignROAS:        { label: 'Campaign ROAS',               unit: 'x',     auto: false, source: 'Manual — admin entry' },
  CampaignsHandled:    { label: 'Campaigns Handled',           unit: 'count', auto: false, source: 'Manual — admin entry' },
  AdSpendManaged:      { label: 'Ad Spend Managed (₹)',        unit: '₹',     auto: false, source: 'Manual — admin entry' },
  LeadsGenerated:      { label: 'Leads / Purchases Generated', unit: 'count', auto: false, source: 'Manual — admin entry' },
  CPA:                 { label: 'Cost per Acquisition (₹)',    unit: '₹',     auto: false, source: 'Manual — admin entry', lowerIsBetter: true },
  CTR:                 { label: 'Click-Through Rate %',        unit: '%',     auto: false, source: 'Manual — admin entry' },
  ClientReportsOnTime: { label: 'Client Reports On Time %',    unit: '%',     auto: false, source: 'Manual — admin entry' },
};
const METRIC_TYPES = Object.keys(METRIC_DEFS);

/** Achievement % for one KPI; lower-is-better metrics score target ÷ actual (0 until there's data). */
function achievementPct(metricType, targetValue, actualValue) {
  let pct = 0;
  if (METRIC_DEFS[metricType]?.lowerIsBetter) pct = actualValue > 0 ? (targetValue / actualValue) * 100 : 0;
  else if (targetValue > 0) pct = (actualValue / targetValue) * 100;
  return parseFloat(pct.toFixed(2));
}

// Role-based weightage presets (editable by admin, these are starting defaults)
const ROLE_PRESETS = {
  'BD/Sales': [
    { metricType: 'Revenue',         weightage: 50, unit: '₹',     targetValue: 600000 },
    { metricType: 'LeadCount',       weightage: 20, unit: 'count', targetValue: 30 },
    { metricType: 'FollowUpQuality', weightage: 10, unit: 'score', targetValue: 80 },
    { metricType: 'AttendancePct',   weightage: 10, unit: '%',     targetValue: 90 },
    { metricType: 'ProductivityPct', weightage: 10, unit: '%',     targetValue: 80 }
  ],
  'Digital Marketing': [
    { metricType: 'CampaignROAS',        weightage: 25, unit: 'x',     targetValue: 3 },
    { metricType: 'LeadsGenerated',      weightage: 20, unit: 'count', targetValue: 50 },
    { metricType: 'CPA',                 weightage: 15, unit: '₹',     targetValue: 400 },
    { metricType: 'CTR',                 weightage: 10, unit: '%',     targetValue: 1.5 },
    { metricType: 'ClientReportsOnTime', weightage: 10, unit: '%',     targetValue: 95 },
    { metricType: 'OnTimeDelivery',      weightage: 10, unit: '%',     targetValue: 90 },
    { metricType: 'AttendancePct',       weightage: 10, unit: '%',     targetValue: 90 }
  ],
  'Design/Tech': [
    { metricType: 'OnTimeDelivery',  weightage: 40, unit: '%',     targetValue: 90 },
    { metricType: 'BillableHours',   weightage: 20, unit: 'hrs',   targetValue: 160 },
    { metricType: 'ProductivityPct', weightage: 25, unit: '%',     targetValue: 80 },
    { metricType: 'AttendancePct',   weightage: 15, unit: '%',     targetValue: 90 }
  ]
};

const kpiTargetSchema = new mongoose.Schema(
  {
    cycleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PerformanceCycle',
      required: true
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true
    },

    // ── KPI Definition ──────────────────────────────────────────────────────
    metricType: {
      type: String,
      enum: METRIC_TYPES,
      required: true
    },
    targetValue: {
      type: Number,
      required: true,
      min: 0
    },
    weightage: {
      type: Number,
      required: true,
      min: 1,
      max: 100
      // Sum of all KPI weightages for one employee in one cycle must = 100
    },
    unit: {
      type: String,
      default: ''
      // Display unit: '₹', 'count', '%', 'hrs', 'x', 'score'
    },

    // ── Auto-Pulled Actual (system sets, employee cannot edit) ──────────────
    actualValue: {
      type: Number,
      default: 0
    },
    autoFilled: {
      type: Boolean,
      default: false
      // true = system pulled from WorkLog/Lead/Attendance
      // false = manual entry by manager (for CampaignROAS, FollowUpQuality)
    },
    lastSyncedAt: {
      type: Date
    },

    // ── Computed Fields ──────────────────────────────────────────────────────
    achievementPct: {
      type: Number,
      default: 0
      // (actualValue / targetValue) * 100, capped at display but not DB
    },
    weightedScore: {
      type: Number,
      default: 0
      // achievementPct * (weightage / 100)
    }
  },
  { timestamps: true }
);

// Indexes
kpiTargetSchema.index({ cycleId: 1, employeeId: 1 });
kpiTargetSchema.index({ employeeId: 1 });

// Pre-save: auto-compute achievementPct and weightedScore
kpiTargetSchema.pre('save', function () {
  this.achievementPct = achievementPct(this.metricType, this.targetValue, this.actualValue);
  this.weightedScore = parseFloat((this.achievementPct * (this.weightage / 100)).toFixed(2));
});

const KPITarget = mongoose.model('KPITarget', kpiTargetSchema);

module.exports = KPITarget;
module.exports.METRIC_TYPES = METRIC_TYPES;
module.exports.ROLE_PRESETS = ROLE_PRESETS;
module.exports.METRIC_DEFS = METRIC_DEFS;
module.exports.achievementPct = achievementPct;
