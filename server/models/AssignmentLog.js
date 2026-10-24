const mongoose = require('mongoose');

/**
 * Audit trail for lead ownership changes — one entry per assign/reassign/
 * unassign, written exclusively by server/services/leadAssignment.js so
 * every change (manual or round-robin) is captured with who/when/why.
 */
const assignmentLogSchema = new mongoose.Schema({
  lead: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead',
    required: true,
    index: true
  },
  fromAdmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  toAdmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  // Who performed the action. null = system (round-robin).
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  mode: {
    type: String,
    // Cross-Assign / Cross-Unassign: toAdmin / fromAdmin is the BD given or
    // losing shared access; the owner is unchanged.
    enum: ['Manual', 'Auto-RoundRobin', 'Cross-Assign', 'Cross-Unassign'],
    required: true
  },
  // Cross-Assign / Cross-Unassign: the lead's owner at that moment (unchanged
  // by the share). Ownership changes carry it in fromAdmin / toAdmin instead.
  leadOwner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  // Set when the change was part of a bulk reassignment (BulkAssignmentRun)
  bulkRun: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BulkAssignmentRun',
    default: null,
    index: true
  },
  reason: {
    type: String,
    trim: true
  }
}, { timestamps: true });

assignmentLogSchema.index({ lead: 1, createdAt: -1 });
assignmentLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AssignmentLog', assignmentLogSchema);
