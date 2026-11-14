const mongoose = require('mongoose');

// Portfolio showcase categories (filter tabs on /portfolio). `key` is what a
// Portfolio item stores in its `category` field, so it never changes after
// creation — renaming a category only changes its labels.
const portfolioCategorySchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Key may contain only lowercase letters, numbers and hyphens'],
      maxlength: 50,
    },
    label: { type: String, required: [true, 'Please provide a name'], trim: true, maxlength: 80 },
    // Short text for the badge on each showcase card
    badge: { type: String, trim: true, maxlength: 40 },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PortfolioCategory', portfolioCategorySchema);
