const mongoose = require('mongoose');

// Fixed metric types — no free text allowed
const METRIC_TYPES = [
  'Revenue',          // BD/Sales — ₹ deal value (auto from Lead.dealValue)
  'LeadCount',        // Digital Marketing — count of Qualified/Won leads
  'CampaignROAS',     // Digital Marketing — manual manager entry
  'OnTimeDelivery',   // Design/Tech — task completed on/before dueDate %
  'ProductivityPct',  // All teams — from WorkLog (productive/target hrs %)
  'AttendancePct',    // All teams — present days / working days %
  'FollowUpQuality',  // BD — manual manager entry (0-100 score)
  'BillableHours'     // Design/Tech — billable hours from WorkLog
];

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
    { metricType: 'LeadCount',       weightage: 40, unit: 'count', targetValue: 50 },
    { metricType: 'CampaignROAS',    weightage: 30, unit: 'x',     targetValue: 3 },
    { metricType: 'AttendancePct',   weightage: 15, unit: '%',     targetValue: 90 },
    { metricType: 'ProductivityPct', weightage: 15, unit: '%',     targetValue: 80 }
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
  if (this.targetValue > 0) {
    this.achievementPct = parseFloat(((this.actualValue / this.targetValue) * 100).toFixed(2));
  } else {
    this.achievementPct = 0;
  }
  this.weightedScore = parseFloat((this.achievementPct * (this.weightage / 100)).toFixed(2));
});

const KPITarget = mongoose.model('KPITarget', kpiTargetSchema);

module.exports = KPITarget;
module.exports.METRIC_TYPES = METRIC_TYPES;
module.exports.ROLE_PRESETS = ROLE_PRESETS;
