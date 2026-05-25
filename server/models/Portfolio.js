const mongoose = require('mongoose');

const portfolioSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please provide a title'],
      trim: true,
    },
    clientUrl: {
      type: String,
      required: [true, 'Please provide the client URL'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Please provide a category'],
      enum: ['development', 'automation', 'marketing'],
      index: true,
    },
    tagline: {
      type: String,
      required: [true, 'Please provide a tagline'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Please provide a description'],
      trim: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    image: {
      type: String,
      required: [true, 'Please provide an image URL'],
    },
    statLabel: {
      type: String,
      required: [true, 'Please provide a stat label (e.g. Lighthouse Score)'],
      trim: true,
    },
    statValue: {
      type: String,
      required: [true, 'Please provide a stat value (e.g. 98/100)'],
      trim: true,
    },
    icon: {
      type: String,
      default: 'Laptop',
      trim: true,
    },
    featured: {
      type: Boolean,
      default: false,
    },
    displayOrder: {
      type: Number,
      default: 0,
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
  },
  {
    timestamps: true,
  }
);

// Index for sorting by newest first
portfolioSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Portfolio', portfolioSchema);
