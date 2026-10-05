const mongoose = require('mongoose');

// An employee's request to change the bank account their salary is paid to.
// Nothing changes on the Employee record until HR approves. Account numbers
// are stored encrypted (utils/encryption.js); `previous` is the snapshot of
// what was on file when the request was made — the audit trail.
const bankSnapshot = new mongoose.Schema({
  bankName: { type: String, trim: true },
  accountName: { type: String, trim: true },
  accountNumber: { type: String, trim: true }, // encrypted
  ifscCode: { type: String, trim: true, uppercase: true },
}, { _id: false });

const bankChangeRequestSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
  previous: { type: bankSnapshot, default: () => ({}) },
  requested: { type: bankSnapshot, required: true },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected', 'Cancelled'], default: 'Pending', index: true },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  reviewedAt: { type: Date },
  reviewComment: { type: String, trim: true, maxlength: 500 },
  cancelledAt: { type: Date },
}, { timestamps: true });

bankChangeRequestSchema.index({ employee: 1, status: 1 });

module.exports = mongoose.model('BankChangeRequest', bankChangeRequestSchema);
