const mongoose = require('mongoose');

// A call staff made to a client (account follow-up, payment reminder …). Logged by
// hand on the client's Overview. Unanswered calls feed the automatic In-Active rule
// (services/autoOffboard.js). Internal — never shown to the client.
const clientCallSchema = new mongoose.Schema(
  {
    client_ref: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
    connected: { type: Boolean, required: true },
    purpose: { type: String, enum: ['Payment follow-up', 'Account follow-up', 'Other'], default: 'Payment follow-up' },
    note: { type: String, trim: true, maxlength: 1000 },
    calledAt: { type: Date, default: Date.now },
    calledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    calledByName: { type: String, trim: true },
  },
  { timestamps: true }
);

clientCallSchema.index({ client_ref: 1, calledAt: -1 });

module.exports = mongoose.model('ClientCall', clientCallSchema);
