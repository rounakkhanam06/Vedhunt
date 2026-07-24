const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const clientSchema = new mongoose.Schema(
  {
    clientId: {
      type: String,
      unique: true,
      sparse: true,
    },
    businessName: {
      type: String,
      required: [true, 'Business name is required'],
      trim: true,
      minlength: [2, 'Business name must be at least 2 characters'],
      maxlength: [100, 'Business name cannot exceed 100 characters'],
    },
    contactName: {
      type: String,
      required: [true, 'Contact name is required'],
      trim: true,
      minlength: [2, 'Contact name must be at least 2 characters'],
      maxlength: [50, 'Contact name cannot exceed 50 characters'],
      match: [/^[A-Za-z\s]+$/, 'Contact name cannot contain numbers or special characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    phone: {
      type: String,
      trim: true,
      match: [/^\+?[1-9]\d{9,14}$/, 'Please enter a valid phone number (10-15 digits)'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      select: false, // Never returned in queries by default
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    refreshToken: {
      type: String,
      select: false,
    },
    // Internal admin notes — NEVER exposed to client via API
    notes: {
      type: String,
      select: false,
    },
    // Linked lead (for traceability from lead → client conversion)
    leadRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
      sparse: true,
    },
    resetPasswordToken: {
      type: String,
      select: false,
    },
    resetPasswordExpire: {
      type: Date,
      select: false,
    },
    isTemporaryPassword: {
      type: Boolean,
      default: true,
    },
    temporaryPasswordText: {
      type: String,
      select: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
    acceptedAgreementVersion: {
      type: Number,
      default: 0,
    },
    agreementAcceptedAt: {
      type: Date,
    },
    agreementDetails: {
      domain: { type: String, default: '' },
      agreementDate: { type: Date },
      effectiveDate: { type: Date },
      serviceName: { type: String, default: 'Performance Marketing management' },
      platforms: { 
        type: [String], 
        default: [
          'Meta Ads (Facebook & Instagram) — campaign strategy, setup, audience targeting, budget management, and daily optimization.',
          'Google Ads — Search and Shopping campaign strategy, setup, keyword/audience targeting, budget management, and daily optimization.'
        ] 
      },
      deliverables: {
        type: [String],
        default: [
          'Campaign strategy aligned to the Client\'s objective of driving website purchases (ROAS-driven).',
          'Meta Pixel & Conversions API (CAPI) setup and Google conversion tracking implementation, with test events removed before go-live.',
          'Daily monitoring and optimization of live campaigns across Meta and Google.',
          'Access to a live excel performance dashboard tracking Spend, Results, ROAS, and campaign-level metrics.',
          'Monthly performance summary covering month-on-month growth, platform comparison, and creative performance (static vs. video script).'
        ]
      },
      exclusions: {
        type: [String],
        default: [
          'Ad spend on Meta and Google platforms — billed separately to the Client at actuals with no markup (see Clause 2).',
          'Creative production (photography, videography, UGC content sourcing) beyond guidance on creative strategy.',
          'Website, landing page, or product catalog development and maintenance.',
          'Influencer or third-party talent fees.'
        ]
      },
      monthlyFee: { type: Number, default: 15000 },
      gstAmount: { type: Number, default: 2700 },
      totalPayable: { type: Number, default: 17700 }
    }
  },
  { timestamps: true }
);

// ─── Indexes ─────────────────────────────────────────────────────────────────
clientSchema.index({ email: 1 });
clientSchema.index({ clientId: 1 });
clientSchema.index({ businessName: 'text', contactName: 'text', email: 'text' });
clientSchema.index({ createdAt: -1 });

// ─── Auto-generate clientId on first save ────────────────────────────────────
clientSchema.pre('save', async function () {
  if (!this.clientId) {
    const count = await this.constructor.countDocuments();
    this.clientId = `VH-CL-${String(count + 1).padStart(4, '0')}`;
  }
});

// ─── Hash password before saving ─────────────────────────────────────────────
clientSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// ─── Compare entered password ─────────────────────────────────────────────────
clientSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// ─── Generate password reset token ───────────────────────────────────────────
clientSchema.methods.getResetPasswordToken = function () {
  const resetToken = crypto.randomBytes(20).toString('hex');
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
  return resetToken;
};

const Client = mongoose.model('Client', clientSchema);
module.exports = Client;
