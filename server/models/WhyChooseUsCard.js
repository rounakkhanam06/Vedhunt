const mongoose = require('mongoose');

const whyChooseUsCardSchema = new mongoose.Schema(
  {
    icon: {
      type: String,
      required: true,
      default: 'Target',
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    order: {
      type: Number,
      default: 0,
      index: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
  },
  { timestamps: true }
);

const WhyChooseUsCard = mongoose.model('WhyChooseUsCard', whyChooseUsCardSchema);

module.exports = WhyChooseUsCard;
