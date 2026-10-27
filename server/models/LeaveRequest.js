const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true
    },
    leaveType: {
      type: String,
      enum: ['CL', 'SL', 'PL', 'EL'],  // EL = Emergency Leave (probation employees only)
      required: true
    },
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    reason: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected', 'Cancelled'],
      default: 'Pending'
    },
    adminComment: {
      type: String,
      trim: true
    },
    // Chargeable days (no Sundays / holidays), split against the balance when requested and
    // again when approved (services/leavePolicy.js): days beyond the balance are unpaid (LOP)
    days: { type: Number },
    paidDays: { type: Number },
    unpaidDays: { type: Number, default: 0 },
    // Who decided (HR or the reporting manager) and when
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    reviewedAt: { type: Date }
  },
  { timestamps: true }
);

const LeaveRequest = mongoose.model('LeaveRequest', leaveRequestSchema);

module.exports = LeaveRequest;
