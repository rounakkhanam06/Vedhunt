const mongoose = require('mongoose');

/**
 * Round-robin routing config for the Lead Assignment Engine. Rules are
 * evaluated in priority order (lowest first); the first rule whose
 * matchService/matchSource match the incoming lead is used. Within that
 * rule's bdPool, assignment rotates from `cursor`, skipping any BD already
 * at `maxActiveLeads`. See server/services/leadAssignment.js.
 */
const assignmentRuleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a rule name'],
    trim: true
  },
  active: {
    type: Boolean,
    default: true
  },
  priority: {
    type: Number,
    default: 0
  },
  // Blank = matches any. Case-insensitive exact match against Lead.service.
  matchService: {
    type: String,
    trim: true,
    default: ''
  },
  // Blank = matches any. Case-insensitive exact match against Lead.platform.
  matchSource: {
    type: String,
    trim: true,
    default: ''
  },
  bdPool: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  }],
  // null/undefined = unlimited.
  maxActiveLeads: {
    type: Number,
    default: null
  },
  // Round-robin pointer into bdPool, persisted between assignments.
  cursor: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

assignmentRuleSchema.index({ active: 1, priority: 1 });

module.exports = mongoose.model('AssignmentRule', assignmentRuleSchema);
