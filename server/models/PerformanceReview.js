const mongoose = require('mongoose');

// Performance band thresholds
const PERFORMANCE_BANDS = [
  { band: 'Outstanding',           min: 90,  max: Infinity },
  { band: 'Exceeds Expectations',  min: 75,  max: 89.99 },
  { band: 'Meets Expectations',    min: 60,  max: 74.99 },
  { band: 'Needs Improvement',     min: 40,  max: 59.99 },
  { band: 'Poor',                  min: 0,   max: 39.99 }
];

function getBand(score) {
  for (const b of PERFORMANCE_BANDS) {
    if (score >= b.min && score <= b.max) return b.band;
  }
  return 'Poor';
}

const performanceReviewSchema = new mongoose.Schema(
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

    // ── Self Review (Employee submits via ESS) ──────────────────────────────
    selfReview: {
      achievements:  { type: String, default: '' },
      challenges:    { type: String, default: '' },
      learning:      { type: String, default: '' },
      supportNeeded: { type: String, default: '' },
      selfRating: {
        type: Number,
        min: 1,
        max: 5,
        default: null
      },
      submittedAt: { type: Date },
      isSubmitted: { type: Boolean, default: false }
    },

    // ── Manager Review (Admin submits, stores WHO reviewed) ─────────────────
    managerReview: {
      managerRating: {
        type: Number,
        min: 1,
        max: 5,
        default: null
      },
      managerFeedback: { type: String, default: '' },
      reviewDate:  { type: Date },
      reviewedBy:  {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin'
        // Stores which admin/manager did the review
      },
      isSubmitted: { type: Boolean, default: false }
    },

    // ── Final Computed Output ───────────────────────────────────────────────
    finalScore: {
      type: Number,
      default: 0
      // Sum of all KPITarget.weightedScore for this employee+cycle
    },
    performanceBand: {
      type: String,
      enum: [
        'Outstanding',
        'Exceeds Expectations',
        'Meets Expectations',
        'Needs Improvement',
        'Poor',
        'Pending'  // before any actuals are synced
      ],
      default: 'Pending'
    },
    companyRank: {
      type: Number,
      default: null
      // Auto-computed rank within the cycle (1 = best)
    },
    isTopPerformer: {
      type: Boolean,
      default: false
      // true if finalScore >= 100 (achieved or exceeded all targets)
    },

    status: {
      type: String,
      enum: ['Pending', 'SelfSubmitted', 'ManagerReviewed', 'Finalized'],
      default: 'Pending'
    }
  },
  { timestamps: true }
);

// One review document per employee per cycle
performanceReviewSchema.index({ cycleId: 1, employeeId: 1 }, { unique: true });
performanceReviewSchema.index({ employeeId: 1 });

const PerformanceReview = mongoose.model('PerformanceReview', performanceReviewSchema);

module.exports = PerformanceReview;
module.exports.getBand = getBand;
module.exports.PERFORMANCE_BANDS = PERFORMANCE_BANDS;
