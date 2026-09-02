const mongoose = require('mongoose');

// One document per salary revision. Never mutated after creation except to
// close it out (effectiveTo) when a later revision supersedes it — this is
// what lets payroll for a past month always recompute against the salary
// that was actually applicable then, and what lets a mid-month raise be
// prorated (see server/services/payrollEngine.js).
const salaryRevisionSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true
    },
    effectiveFrom: {
      type: Date,
      required: true
    },
    // null while this is the current/active revision; set to the next
    // revision's effectiveFrom the moment it's superseded.
    effectiveTo: {
      type: Date,
      default: null
    },
    ctc: {
      type: Number,
      required: true,
      min: 0
    },
    // Monthly component split. Any component left blank defaults to 0 in
    // the payroll engine — only `basic` is meaningfully required for PF.
    components: {
      basic: { type: Number, default: 0, min: 0 },
      hra: { type: Number, default: 0, min: 0 },
      specialAllowance: { type: Number, default: 0, min: 0 },
      conveyance: { type: Number, default: 0, min: 0 },
      medicalAllowance: { type: Number, default: 0, min: 0 },
      otherAllowances: { type: Number, default: 0, min: 0 },
      employerPFPercent: { type: Number, default: 12, min: 0, max: 100 },
      employeePFPercent: { type: Number, default: 12, min: 0, max: 100 },
      professionalTax: { type: Number, default: 0, min: 0 }
    },
    // Snapshot of the CTC this revision replaced — kept here (not just
    // derivable from the previous doc) so the revision history reads
    // standalone in the UI without an extra lookup.
    previousCTC: {
      type: Number,
      default: null
    },
    reason: {
      type: String,
      trim: true,
      required: true
    },
    revisedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    },
    status: {
      type: String,
      enum: ['Active', 'Superseded'],
      default: 'Active'
    }
  },
  { timestamps: true }
);

salaryRevisionSchema.index({ employeeId: 1, effectiveFrom: 1 });

module.exports = mongoose.model('SalaryRevision', salaryRevisionSchema);
