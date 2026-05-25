const mongoose = require('mongoose');

const whyChooseUsHeaderSchema = new mongoose.Schema(
  {
    tagline: {
      type: String,
      default: 'Why Vedhunt',
    },
    heading: {
      type: String,
      default: 'Engineering Success with',
    },
    highlightText: {
      type: String,
      default: 'Precision',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
  },
  { timestamps: true }
);

const WhyChooseUsHeader = mongoose.model('WhyChooseUsHeader', whyChooseUsHeaderSchema);

module.exports = WhyChooseUsHeader;
