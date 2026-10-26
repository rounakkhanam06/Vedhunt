const mongoose = require('mongoose');

const workLogSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true
    },
    date: {
      type: Date,
      required: true
    },
    startTime: {
      type: Date,
      required: true
    },
    endTime: {
      type: Date
    },
    duration: {
      type: Number, // duration in minutes
      default: 0
    },
    project: {
      type: String,
      required: true
    },
    task: {
      type: String,
      required: true
    },
    // Free text from the Admin-defined activity master (Settings
    // 'activity_master', see services/activityMaster.js) — no schema enum,
    // so admins can add activity types without a code change.
    activityType: {
      type: String,
      required: true,
      trim: true
    },
    // The assigned Employee.tasks entry this time was logged against —
    // drives a task's actual effort.
    taskId: {
      type: mongoose.Schema.Types.ObjectId
    },
    isProductive: {
      type: Boolean,
      default: false
    },
    isBillable: {
      type: Boolean,
      default: false
    },
    // ── Client work history ────────────────────────────────────────────────
    // Optional links: internal work (meetings, HR, training) has no client.
    // Ticket resolution time, project actual hours and retainer usage all read
    // these same records, so one piece of work is never counted twice.
    client_ref: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
    project_ref: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    ticket_ref: { type: mongoose.Schema.Types.ObjectId, ref: 'SupportTicket' },
    campaign_ref: { type: mongoose.Schema.Types.ObjectId }, // set once campaigns exist
    // What was done / the result or blocker — shown to management, and to the
    // client only when visibility is 'Client'
    outcome: { type: String, trim: true, maxlength: 1000 },
    visibility: { type: String, enum: ['Internal', 'Client'], default: 'Internal' },
    // Meeting tracking fields
    meetingWith: {
      type: String
    },
    clientName: {
      type: String
    },
    teamMemberName: {
      type: String
    },
    remarks: {
      type: String
    },
    // Written or changed by an approved CorrectionRequest (never silently)
    corrected: {
      type: Boolean,
      default: false
    },
    correctionRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CorrectionRequest'
    }
  },
  { timestamps: true }
);

// Indexes for fast querying by employee and date range
workLogSchema.index({ employeeId: 1, date: -1 });
// Overlap checks and task effort roll-ups
workLogSchema.index({ employeeId: 1, startTime: 1 });
workLogSchema.index({ employeeId: 1, taskId: 1 });
// Client-wise hours / retainer usage / ticket + project roll-ups
workLogSchema.index({ client_ref: 1, date: -1 });
workLogSchema.index({ ticket_ref: 1 });
workLogSchema.index({ project_ref: 1 });

const WorkLog = mongoose.model('WorkLog', workLogSchema);

module.exports = WorkLog;
