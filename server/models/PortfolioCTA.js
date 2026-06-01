const mongoose = require('mongoose');

const PortfolioCTASchema = new mongoose.Schema({
  tagText: { type: String, default: "Let's Collaborate" },
  tagIcon: { type: String, default: 'Sparkles' },
  headingRegular: { type: String, default: 'Ready to Build Your' },
  headingHighlight: { type: String, default: 'Digital Legacy?' },
  buttonText: { type: String, default: 'Start a Project' },
  buttonLink: { type: String, default: '/get-quote' },
  features: [{
    text: { type: String, required: true },
    icon: { type: String, required: true }
  }],
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' }
}, { timestamps: true });

module.exports = mongoose.model('PortfolioCTA', PortfolioCTASchema);
