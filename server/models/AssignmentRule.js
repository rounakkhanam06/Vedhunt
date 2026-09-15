const mongoose = require('mongoose');

/**
 * Round-robin routing config for the Lead Assignment Engine. Rules are
 * evaluated in priority order (lowest first); the first rule whose
 * matchService/matchSource match the incoming lead is used. Within that
 * rule's pool, assignment rotates from `cursor`, skipping any BD already
 * at `maxActiveLeads`. See server/services/leadAssignment.js.
 *
 * bdPool: [] (the default) means "every active BDE admin," resolved fresh on
 * each assignment — a new hire joins the rotation immediately and a removed
 * account drops out, with no list here to fall out of sync. A non-empty
 * bdPool instead curates a fixed subset for this rule.
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
