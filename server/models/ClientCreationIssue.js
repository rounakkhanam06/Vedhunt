const mongoose = require('mongoose');

// A Won lead whose client account could not be created (or was deliberately
// not created) and now needs a person. One record per lead: repeated attempts
// update it instead of piling up. It closes itself when an account exists.
const reasonSchema = new mongoose.Schema(
  {
    code: { type: String, required: true }, // e.g. invalid_phone, email_in_use, client_archived, error
    message: { type: String, required: true },
  },
  { _id: false }
);

const clientCreationIssueSchema = new mongoose.Schema(
  {
    lead_ref: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true, unique: true },
    status: { type: String, enum: ['Open', 'Resolved', 'Dismissed'], default: 'Open', index: true },
    reasons: { type: [reasonSchema], default: [] },
    // The existing client in the way, when the cause is a clashing email
    existingClient: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
    source: { type: String, enum: ['won', 'scan', 'retry'], default: 'won' },
    attempts: { type: Number, default: 1 },
    lastAttemptAt: { type: Date, default: Date.now },
    resolvedAt: { type: Date },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    resolvedByName: { type: String },
    resolution: { type: String, trim: true, maxlength: 500 }, // how it was closed
    client_ref: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' }, // the account that now exists
  },
  { timestamps: true }
);

module.exports = mongoose.model('ClientCreationIssue', clientCreationIssueSchema);
