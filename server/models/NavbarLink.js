const mongoose = require('mongoose');

const navbarLinkSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: true,
      trim: true,
    },
    path: {
      type: String,
      required: true,
      trim: true,
    },
    order: {
      type: Number,
      default: 0,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
  },
  { timestamps: true }
);

// Indexes for fast querying of active navbar links sorted by order
navbarLinkSchema.index({ isDeleted: 1, order: 1 });

const NavbarLink = mongoose.model('NavbarLink', navbarLinkSchema);

module.exports = NavbarLink;
