const mongoose = require('mongoose');

/**
 * A scheduled follow-up action on a lead. Two kinds:
 *   - 'Primary'  — auto-mirrors Lead.nextFollowUpDate (kept in sync by
 *     services/leadLifecycle.js whenever that field changes). This exists
 *     purely to give every follow-up a durable, independently-queryable
 *     audit trail (stronger than pipelineHistory's free-text notes) without
 *     changing how the existing call-outcome UI/validation works.
 *   - 'Parallel' — a manager-created second (or third...) task on the same
 *     lead, independent of Lead.nextFollowUpDate. This is the "unless a
 *     manager explicitly creates parallel tasks" exception the spec calls
 *     out — the one case where a lead legitimately has more than one active
 *     scheduled action.
 *
 * Completing a task (either kind) always requires a `result` — the hard
 * "BD cannot mark a follow-up complete without an activity/result" gate.
 */
const followUpTaskSchema = new mongoose.Schema(
  {
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
    dueDate: { type: Date, required: true },
    note: { type: String, trim: true },
    type: { type: String, enum: ['Primary', 'Parallel'], default: 'Primary' },
    status: { type: String, enum: ['Pending', 'Completed', 'Rescheduled', 'Cancelled'], default: 'Pending', index: true },
    result: { type: String, trim: true },
    completedAt: { type: Date },
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },

    // Idempotency guards for the reminder cron — mirrors the same fields on
    // Lead (services/followUpEngine.js). Only meaningful for 'Parallel' tasks;
    // 'Primary' tasks are reminded via the Lead-level fields as today.
    reminderSentAt: { type: Date, default: null },
    dueNotifiedAt: { type: Date, default: null },
    overdueNotifiedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

followUpTaskSchema.index({ lead: 1, type: 1, status: 1 });
followUpTaskSchema.index({ assignedTo: 1, status: 1, dueDate: 1 });

module.exports = mongoose.model('FollowUpTask', followUpTaskSchema);
