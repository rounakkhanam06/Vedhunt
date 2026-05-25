const mongoose = require('mongoose');

const advantageHeaderSchema = new mongoose.Schema(
  {
    heading: {
      type: String,
      default: 'The Vedhunt Advantage',
    },
    description: {
      type: String,
      default: "We don't just provide services; we build high-performance growth machines. Here is how we stand out from the typical agency model.",
    },
    vedhuntColumnHeader: {
      type: String,
      default: 'Vedhunt InfoTech ✅',
    },
    typicalColumnHeader: {
      type: String,
      default: 'Typical Agency ❌',
    },
    bottomNote: {
      type: String,
      default: 'Empirical Data Based on Regional Industry Audits 2026',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AdvantageHeader', advantageHeaderSchema);
