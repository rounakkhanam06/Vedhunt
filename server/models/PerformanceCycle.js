const mongoose = require('mongoose');

const performanceCycleSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
      // e.g. "Q2 2026 — Performance Cycle"
    },
    quarter: {
      type: String,
      enum: ['Q1', 'Q2', 'Q3', 'Q4'],
      required: true
    },
    year: {
      type: Number,
      required: true
    },
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    status: {
      type: String,
      enum: ['Draft', 'Active', 'Closed'],
      default: 'Draft'
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: true
    }
  },
  { timestamps: true }
);

// Only one Active cycle at a time (enforced in route logic)
performanceCycleSchema.index({ year: 1, quarter: 1 }, { unique: true });

const PerformanceCycle = mongoose.model('PerformanceCycle', performanceCycleSchema);

module.exports = PerformanceCycle;
