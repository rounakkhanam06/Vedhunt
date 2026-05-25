const mongoose = require('mongoose');

const statsCounterCardSchema = new mongoose.Schema({
  value: {
    type: Number,
    required: true
  },
  suffix: {
    type: String,
    default: ""
  },
  label: {
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
    ref: 'User'
  }
}, { timestamps: true });

module.exports = mongoose.model('StatsCounterCard', statsCounterCardSchema);
