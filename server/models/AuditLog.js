const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    // The admin behind the action. Optional: client, employee-portal and
    // system actions (e.g. a scheduled invoice) have no Admin — they are
    // identified by actorType/actorId/actorName instead.
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
    actorType: {
      type: String,
      enum: ['Admin', 'Employee', 'Client', 'System'],
    },
    actorId: { type: mongoose.Schema.Types.ObjectId },
    actorName: { type: String },
    action: {
      type: String,
      required: true, // e.g., 'LOGIN', 'ROLE_ASSIGN', 'USER_CREATE'
    },
    resource: {
      type: String,
      required: true, // e.g., 'Auth', 'Admin', 'Role'
    },
    // The record the action changed, so one record's history can be pulled up
    recordId: { type: String, index: true },
    source: { type: String }, // e.g. 'admin-api', 'client-portal', 'scheduler'
    outcome: { type: String, enum: ['success', 'failure'], default: 'success' },
    beforeSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    afterSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    ipAddress: {
      type: String,
    },
  },
  { timestamps: true }
);

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLog;
