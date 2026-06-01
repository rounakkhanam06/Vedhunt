const mongoose = require('mongoose');

const presenceHeaderSchema = new mongoose.Schema(
  {
    titlePrefix: {
      type: String,
      default: 'Our',
    },
    highlightedWord: {
      type: String,
      default: 'Presence',
    },
    description: {
      type: String,
      default: 'From thriving startup ecosystems to rapidly growing business hubs, our network spans across the nation—helping us deliver innovation, collaboration, and technology without boundaries.',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PresenceHeader', presenceHeaderSchema);
