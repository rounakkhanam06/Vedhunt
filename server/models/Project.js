const mongoose = require('mongoose');

// ─── Milestone Sub-Schema ─────────────────────────────────────────────────────
const milestoneSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    // internalDescription is select:false — never shown to client
    internalDescription: { type: String, trim: true, select: false },
    status: {
      type: String,
      enum: ['Pending', 'In Progress', 'Completed'],
      default: 'Pending',
    },
    targetDate: { type: Date },
    completedOn: { type: Date },
    order: { type: Number, default: 0 }, // for explicit ordering
  },
  { _id: true }
);

// ─── Escalation Sub-Schema ────────────────────────────────────────────────────
// A client complaint or internal red flag on the project. Internal only:
// `escalations` is select:false, so client-facing queries never return it.
const ESCALATION_SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];
const escalationSchema = new mongoose.Schema(
  {
    source: { type: String, enum: ['Client', 'Internal'], default: 'Client' },
    severity: { type: String, enum: ESCALATION_SEVERITIES, default: 'Medium' },
    note: { type: String, required: true, trim: true, maxlength: 1000 },
    raisedAt: { type: Date, default: Date.now },
    raisedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    raisedByName: { type: String, trim: true },
    status: { type: String, enum: ['Open', 'Resolved'], default: 'Open' },
    resolution: { type: String, trim: true, maxlength: 1000 },
    resolvedAt: { type: Date },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    resolvedByName: { type: String, trim: true },
  },
  { _id: true }
);

// ─── Project Schema ───────────────────────────────────────────────────────────
const projectSchema = new mongoose.Schema(
  {
    projectId: {
      type: String,
      unique: true,
      sparse: true,
    },
    client_ref: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: [true, 'Client reference is required'],
    },
    projectName: {
      type: String,
      required: [true, 'Project name is required'],
      trim: true,
    },
    totalPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    // internalNotes — NEVER sent to client
    internalNotes: { type: String, trim: true, select: false },
    startDate: { type: Date },
    expectedEndDate: { type: Date },
    status: {
      type: String,
      enum: ['Active', 'On Hold', 'Completed', 'Cancelled'],
      default: 'Active',
    },
    milestones: { type: [milestoneSchema], default: [] },
    // ── Delivery ownership (drives My Projects + delivery KPIs) ─────────────
    projectManager: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
    teamMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }],
    // Set when the project first becomes Completed — on-time = completedAt ≤ expectedEndDate
    completedAt: { type: Date },
    escalations: { type: [escalationSchema], default: [], select: false },
    // Auto-computed from milestones (0–100)
    overallProgress: { type: Number, default: 0, min: 0, max: 100 },
  },
  { timestamps: true }
);

// ─── Indexes ─────────────────────────────────────────────────────────────────
projectSchema.index({ client_ref: 1, createdAt: -1 });
projectSchema.index({ projectId: 1 });
projectSchema.index({ status: 1 });
projectSchema.index({ client_ref: 1, status: 1 });
projectSchema.index({ projectManager: 1, status: 1 });
projectSchema.index({ teamMembers: 1 });

// ─── Auto-generate projectId ─────────────────────────────────────────────────
projectSchema.pre('save', async function () {
  if (!this.projectId) {
    const count = await this.constructor.countDocuments();
    this.projectId = `VH-PRJ-${String(count + 1).padStart(4, '0')}`;
  }
});

// ─── Delivery dates: stamp completion so on-time delivery can be measured ──
projectSchema.pre('save', function () {
  if (this.status === 'Completed' && !this.completedAt) this.completedAt = new Date();
  if (this.status !== 'Completed' && this.isModified('status')) this.completedAt = undefined; // reopened
  for (const m of this.milestones || []) {
    if (m.status === 'Completed' && !m.completedOn) m.completedOn = new Date();
    if (m.status !== 'Completed' && m.completedOn) m.completedOn = undefined;
  }
});

// ─── Auto-compute overallProgress from milestones ────────────────────────────
projectSchema.pre('save', function () {
  if (this.milestones && this.milestones.length > 0) {
    const completed = this.milestones.filter((m) => m.status === 'Completed').length;
    this.overallProgress = Math.round((completed / this.milestones.length) * 100);
  } else {
    this.overallProgress = 0;
  }
});

const Project = mongoose.model('Project', projectSchema);
module.exports = Project;
module.exports.ESCALATION_SEVERITIES = ESCALATION_SEVERITIES;
