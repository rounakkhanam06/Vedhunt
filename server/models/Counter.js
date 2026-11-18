const mongoose = require('mongoose');

// Named sequences handed out atomically with $inc, so two requests running at
// the same moment can never receive the same number (e.g. 'lead-261118').
const counterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 }
  },
  { versionKey: false }
);

module.exports = mongoose.models.Counter || mongoose.model('Counter', counterSchema);
