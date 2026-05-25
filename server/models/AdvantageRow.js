const mongoose = require('mongoose');

const advantageRowSchema = new mongoose.Schema(
  {
    feature: {
      type: String,
      required: true,
    },
    vedhunt: {
      type: String,
      required: true,
    },
    typical: {
      type: String,
      required: true,
    },
    order: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Index for optimized sorting in the frontend/admin
advantageRowSchema.index({ order: 1 });
advantageRowSchema.index({ isActive: 1 });

module.exports = mongoose.model('AdvantageRow', advantageRowSchema);
