const mongoose = require('mongoose');

const LifeAtVedhuntCardSchema = new mongoose.Schema({
  image: {
    type: String,
    required: true
  },
  tag: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  span: {
    type: String,
    enum: ['1x', '2x'],
    default: '1x'
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
}, {
  timestamps: true
});

module.exports = mongoose.model('LifeAtVedhuntCard', LifeAtVedhuntCardSchema);
