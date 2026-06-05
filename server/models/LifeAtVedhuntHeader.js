const mongoose = require('mongoose');

const LifeAtVedhuntHeaderSchema = new mongoose.Schema({
  heading: {
    type: String,
    default: 'Life at'
  },
  highlightText: {
    type: String,
    default: 'Vedhunt'
  },
  description: {
    type: String,
    default: 'We believe in working hard, innovating continuously, and having fun along the way. Discover our vibrant culture, modern workspaces, and the incredible people driving our vision.'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('LifeAtVedhuntHeader', LifeAtVedhuntHeaderSchema);
