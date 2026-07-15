const mongoose = require('mongoose');

// ─── SLA definitions by priority (in hours) ──────────────────────────────────
const SLA_HOURS = {
  Critical: 4,
  High: 24,
  Medium: 72,
  Low: 168, // 7 days
};

const supportTicketSchema = new mongoose.Schema(
  {
    ticketId: {
      type: String,
      unique: true,
      sparse: true,
    },
    client_ref: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: [true, 'Client reference is required'],
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true,
      maxlength: [200, 'Subject cannot exceed 200 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    category: {
      type: String,
      enum: ['Bug Report', 'Feature Request', 'General Inquiry', 'Urgent Fix'],
      required: [true, 'Category is required'],
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical'],
      default: 'Medium',
    },
    status: {
      type: String,
      enum: ['Open', 'In Progress', 'Pending Client', 'Resolved', 'Closed'],
      default: 'Open',
    },
    // Auto-computed from priority at creation
    slaDeadline: { type: Date },
    // Internal team notes — NEVER sent to client
    resolution: { type: String, trim: true, select: false },
    // File attachment URLs (uploaded via upload route)
    attachments: [{ type: String, trim: true }],
    // When was ticket resolved / closed
    resolvedAt: { type: Date },
    closedAt: { type: Date },
    // Which admin handled it
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    },
  },
  { timestamps: true }
);

// ─── Indexes ─────────────────────────────────────────────────────────────────
supportTicketSchema.index({ client_ref: 1, createdAt: -1 });
supportTicketSchema.index({ ticketId: 1 });
supportTicketSchema.index({ status: 1 });
supportTicketSchema.index({ priority: 1 });
supportTicketSchema.index({ slaDeadline: 1 });
supportTicketSchema.index({ client_ref: 1, status: 1 });

// ─── Auto-generate ticketId + slaDeadline on first save ──────────────────────
supportTicketSchema.pre('save', async function () {
  if (this.isNew) {
    // Generate ticket ID: VH-TK-XXXX
    const count = await this.constructor.countDocuments();
    this.ticketId = `VH-TK-${String(count + 1).padStart(4, '0')}`;

    // Auto-compute SLA deadline based on priority
    const slaHours = SLA_HOURS[this.priority] || SLA_HOURS.Medium;
    this.slaDeadline = new Date(Date.now() + slaHours * 60 * 60 * 1000);
  }

  // Track resolved/closed timestamps
  if (this.isModified('status')) {
    if (this.status === 'Resolved' && !this.resolvedAt) {
      this.resolvedAt = new Date();
    }
    if (this.status === 'Closed' && !this.closedAt) {
      this.closedAt = new Date();
    }
  }
});

// ─── Virtual: isSLABreached ───────────────────────────────────────────────────
supportTicketSchema.virtual('isSLABreached').get(function () {
  if (!this.slaDeadline) return false;
  const isActive = !['Resolved', 'Closed'].includes(this.status);
  return isActive && this.slaDeadline < new Date();
});

// ─── Virtual: slaRemainingMs ─────────────────────────────────────────────────
supportTicketSchema.virtual('slaRemainingMs').get(function () {
  if (!this.slaDeadline) return null;
  return this.slaDeadline.getTime() - Date.now();
});

supportTicketSchema.set('toJSON', { virtuals: true });
supportTicketSchema.set('toObject', { virtuals: true });

const SupportTicket = mongoose.model('SupportTicket', supportTicketSchema);
module.exports = SupportTicket;
