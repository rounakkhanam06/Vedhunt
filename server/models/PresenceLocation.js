const mongoose = require('mongoose');

const presenceLocationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    top: {
      type: String,
      required: true,
    },
    left: {
      type: String,
      required: true,
    },
    delay: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PresenceLocation', presenceLocationSchema);
