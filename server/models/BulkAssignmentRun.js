const mongoose = require('mongoose');

// One bulk reassignment, as confirmed by the person who ran it: who, when,
// where the leads went, what they had filtered and selected, and the outcome
// of every lead. Each moved lead also gets its own AssignmentLog entry
// (bulkRun points back here).
const bulkAssignmentRunSchema = new mongoose.Schema({
  initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
  // null = unassign
  toAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  // Owner the leads were filtered by; any lead no longer owned by them is refused
  expectedOwner: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  // What the person saw when they selected: filter labels, and whether it was
  // 'all-matching' or a hand-picked selection
  filters: { type: mongoose.Schema.Types.Mixed, default: {} },
  selection: { type: String, enum: ['all-matching', 'manual'], default: 'manual' },
  reason: { type: String, trim: true, default: '' },
  requested: { type: Number, required: true },
  succeeded: [{
    _id: false,
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
    leadId: String,
    fromAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  }],
  failed: [{
    _id: false,
    lead: { type: mongoose.Schema.Types.Mixed },
    leadId: String,
    fullName: String,
    reason: String,
  }],
  status: { type: String, enum: ['running', 'completed', 'partial', 'failed'], default: 'running' },
  finishedAt: { type: Date, default: null },
}, { timestamps: true });

bulkAssignmentRunSchema.index({ initiatedBy: 1, createdAt: -1 });
bulkAssignmentRunSchema.index({ createdAt: -1 });

module.exports = mongoose.model('BulkAssignmentRun', bulkAssignmentRunSchema);
