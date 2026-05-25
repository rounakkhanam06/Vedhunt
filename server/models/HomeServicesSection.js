const mongoose = require('mongoose');

const homeServicesSectionSchema = new mongoose.Schema(
  {
    tagline: {
      type: String,
      default: 'Our Expertise',
    },
    heading: {
      type: String,
      default: 'Services That Fit',
    },
    highlightText: {
      type: String,
      default: 'Your Business',
    },
    description: {
      type: String,
      default: 'From digital transformation to financial clarity, we provide end-to-end technical solutions designed to scale your operations and maximize ROI.',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
  },
  { timestamps: true }
);

const HomeServicesSection = mongoose.model('HomeServicesSection', homeServicesSectionSchema);

module.exports = HomeServicesSection;
