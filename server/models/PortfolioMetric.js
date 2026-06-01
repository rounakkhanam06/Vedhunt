const mongoose = require('mongoose');

const portfolioMetricSchema = new mongoose.Schema({
  numericValue: {
    type: Number,
    required: true
  },
  suffix: {
    type: String,
    default: ''
  },
  label: {
    type: String,
    required: true
  },
  desc: {
    type: String,
    required: true
  },
  icon: {
    type: String,
    required: true
  },
  order: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  }
}, { timestamps: true });

module.exports = mongoose.model('PortfolioMetric', portfolioMetricSchema);
