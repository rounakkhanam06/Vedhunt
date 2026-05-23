const mongoose = require('mongoose');

const heroSchema = new mongoose.Schema(
  {
    tagline: {
      type: String,
    },
    heading: {
      type: String,
      required: true,
    },
    subheading: {
      type: String,
    },
    description: {
      type: String,
    },
    primaryButtonText: {
      type: String,
      required: true,
    },
    primaryButtonLink: {
      type: String,
      required: true,
    },
    secondaryButtonText: {
      type: String,
    },
    secondaryButtonLink: {
      type: String,
    },
    backgroundImageUrl: {
      type: String,
    },
    backgroundImagePublicId: {
      type: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
  },
  { timestamps: true }
);

const Hero = mongoose.model('Hero', heroSchema);

module.exports = Hero;
