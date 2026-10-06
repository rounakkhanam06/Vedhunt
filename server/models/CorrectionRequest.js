const mongoose = require('mongoose');

/**
 * An employee's request to correct their own record — never applied
 * directly; a manager approves or rejects it.
 *   - Attendance: backdated day, missed clock-out, or wrong times
 *     (writes Employee.attendance on approval)
 *   - Timesheet: fix an existing WorkLog or add a missing time entry
 *     (writes WorkLog on approval)
 * `original` is a snapshot of the record before the change, so approval
 * never loses what the system had recorded.
 */
const correctionRequestSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
    kind: { type: String, enum: ['Attendance', 'Timesheet'], required: true },
    type: { type: String, enum: ['Backdated', 'MissedClockOut', 'Correction', 'TimeEntry'], required: true },
    date: { type: Date, required: true }, // the day being corrected (start of day)

    requested: {
      clockIn: String,  // attendance — "10:05 AM"
      clockOut: String,
      startTime: Date,  // timesheet
      endTime: Date,
      project: String,
      task: String,
      activityType: String,
      isProductive: Boolean,
    },
    workLog: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkLog' }, // timesheet edit target
    original: { type: mongoose.Schema.Types.Mixed, default: null },

    reason: { type: String, required: true, trim: true, maxlength: 500 },
    proofUrl: { type: String, trim: true },

    status: { type: String, enum: ['Pending', 'Approved', 'Rejected', 'Cancelled'], default: 'Pending' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    reviewComment: { type: String, trim: true, maxlength: 500 },
    reviewedAt: Date,
  },
  { timestamps: true }
);

correctionRequestSchema.index({ employee: 1, createdAt: -1 });
correctionRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('CorrectionRequest', correctionRequestSchema);
