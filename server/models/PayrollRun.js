const mongoose = require('mongoose');

// The editable, per-employee-per-month working document — created as a
// Draft by the payroll engine, adjustable by HR (bonus/incentive/
// reimbursement/tds/other deductions/remarks) during review, then Approved
// (by HR or by the generation-day cron auto-approve) which triggers
// Payslip generation. Never re-used across months — one doc per
// employee+month, enforced by the unique index below.
const payrollRunSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true
    },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },

    status: {
      type: String,
      enum: ['Draft', 'UnderReview', 'OnHold', 'Approved', 'Generated', 'Sent'],
      default: 'Draft'
    },

    // Attendance snapshot the calculation was based on.
    totalDaysInMonth: Number,
    presentDays: Number,
    paidLeaveDays: Number,
    lopDays: Number,

    earnings: {
      basic: { type: Number, default: 0 },
      hra: { type: Number, default: 0 },
      specialAllowance: { type: Number, default: 0 },
      conveyance: { type: Number, default: 0 },
      medicalAllowance: { type: Number, default: 0 },
      otherAllowances: { type: Number, default: 0 },
      // HR-editable during review
      bonus: { type: Number, default: 0 },
      incentive: { type: Number, default: 0 },
      reimbursement: { type: Number, default: 0 },
      arrears: { type: Number, default: 0 }
    },
    deductions: {
      lopDeduction: { type: Number, default: 0 },
      pf: { type: Number, default: 0 },
      professionalTax: { type: Number, default: 0 },
      // HR-editable during review — see plan: no automated IT-slab engine.
      tds: { type: Number, default: 0 },
      otherDeductions: { type: Number, default: 0 },
      otherDeductionsReason: { type: String, trim: true }
    },

    grossEarnings: { type: Number, default: 0 },
    totalDeductions: { type: Number, default: 0 },
    netPay: { type: Number, default: 0 },

    // The proration audit trail — one entry per salary-revision segment
    // that overlapped this month.
    salaryBreakup: [{
      revisionId: { type: mongoose.Schema.Types.ObjectId, ref: 'SalaryRevision' },
      fromDate: Date,
      toDate: Date,
      daysApplicable: Number,
      proratedAmount: Number
    }],

    remarks: { type: String, trim: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    reviewedAt: Date,
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    approvedAt: Date,

    payslipId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payslip', default: null }
  },
  { timestamps: true }
);

payrollRunSchema.index({ employeeId: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('PayrollRun', payrollRunSchema);
