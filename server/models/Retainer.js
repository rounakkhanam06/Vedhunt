const mongoose = require('mongoose');

const retainerSchema = new mongoose.Schema(
  {
    retainerId: {
      type: String,
      unique: true,
      sparse: true,
    },
    client_ref: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: [true, 'Client reference is required'],
    },
    packageName: {
      type: String,
      required: [true, 'Package name is required'],
      trim: true,
    },
    monthlyAmount: {
      type: Number,
      required: [true, 'Monthly amount is required'],
      min: 0,
    },
    billingCycle: {
      type: String,
      enum: ['Monthly', 'Quarterly', 'Annual'],
      default: 'Monthly',
    },
    supportHoursPerMonth: {
      type: Number,
      required: [true, 'Support hours per month is required'],
      min: 0,
    },
    hoursUsedThisMonth: {
      type: Number,
      default: 0,
      min: 0,
    },
    contractStartDate: {
      type: Date,
      required: [true, 'Contract start date is required'],
    },
    contractEndDate: {
      type: Date,
      required: [true, 'Contract end date is required'],
    },
    status: {
      type: String,
      enum: ['Active', 'Paused', 'Expired', 'Cancelled'],
      default: 'Active',
    },
    autoRenew: {
      type: Boolean,
      default: false,
    },
    // Internal admin notes — NEVER sent to client
    renewalNotes: { type: String, trim: true, select: false },
  },
  { timestamps: true }
);

// ─── Indexes ─────────────────────────────────────────────────────────────────
retainerSchema.index({ client_ref: 1, status: 1 });
retainerSchema.index({ retainerId: 1 });
retainerSchema.index({ contractEndDate: 1 });
retainerSchema.index({ client_ref: 1, createdAt: -1 });

// ─── Auto-generate retainerId ─────────────────────────────────────────────────
retainerSchema.pre('save', async function () {
  if (!this.retainerId) {
    const count = await this.constructor.countDocuments();
    this.retainerId = `VH-RET-${String(count + 1).padStart(4, '0')}`;
  }
});

// ─── Auto-expire status ───────────────────────────────────────────────────────
retainerSchema.pre('save', function () {
  if (
    this.status === 'Active' &&
    this.contractEndDate &&
    this.contractEndDate < new Date()
  ) {
    this.status = 'Expired';
  }
});

// ─── Virtual: isNearingExpiry (within 15 days) ────────────────────────────────
retainerSchema.virtual('isNearingExpiry').get(function () {
  if (!this.contractEndDate || this.status !== 'Active') return false;
  const daysLeft =
    (this.contractEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return daysLeft > 0 && daysLeft <= 15;
});

// ─── Virtual: hoursRemaining ─────────────────────────────────────────────────
retainerSchema.virtual('hoursRemaining').get(function () {
  return Math.max(0, this.supportHoursPerMonth - this.hoursUsedThisMonth);
});

retainerSchema.set('toJSON', { virtuals: true });
retainerSchema.set('toObject', { virtuals: true });

const Retainer = mongoose.model('Retainer', retainerSchema);
module.exports = Retainer;
