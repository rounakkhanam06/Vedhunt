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

// ─── Auto-generate projectId ─────────────────────────────────────────────────
projectSchema.pre('save', async function () {
  if (!this.projectId) {
    const count = await this.constructor.countDocuments();
    this.projectId = `VH-PRJ-${String(count + 1).padStart(4, '0')}`;
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
