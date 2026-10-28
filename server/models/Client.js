const mongoose = require('mongoose');
const { nextSequenceId } = require('../utils/nextSequenceId');
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
      match: [/^[\p{L}][\p{L}\s.'’-]*$/u, 'Contact name can only contain letters, spaces, dots, hyphens and apostrophes'],
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
    // ── Portfolio profile (Client Portal CRM §2–3) ─────────────────────────
    // Descriptive account data the portfolio filters, groups and shows. Status,
    // fees and payments are NOT stored here — they're derived from the linked
    // retainers / invoices / payments so there is one source of truth.
    profile: {
      logoUrl: { type: String, trim: true },
      // The brand's website(s); the first is the primary domain
      domains: { type: [String], default: [] },
      sectors: { type: [String], default: [] },
      // e.g. Performance Marketing, Digital Marketing, Website Development,
      // App Development, Social Media Management
      services: { type: [String], default: [] },
      accountManager: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
      dedicatedTeam: {
        type: [{
          _id: false,
          employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
          role: { type: String, trim: true, maxlength: 80 },
        }],
        default: [],
      },
      onboardingDate: { type: Date },
      adAccountLiveDate: { type: Date },
      // Approved monthly ad budget (client-paid, separate from Vedhunt's fee)
      monthlyAdBudget: { type: Number, min: 0 },
      platforms: { type: [String], default: [] },
      authorisedSignatory: { type: String, trim: true, maxlength: 120 },
      paymentReceivedDate: { type: Date },
    },
    // Service status (client decision, Oct 2026): 'Hold' pauses the service — typically for
    // non-payment — while the client can still log in, see why and pay. Set and released
    // manually by staff; no automatic trigger until the client confirms one.
    serviceStatus: { type: String, enum: ['Active', 'Hold'], default: 'Active' },
    // Flagged "at risk" by the team (Financial Overview). Overdue payments and missed KPI
    // targets are worked out from the records (services/clientRisk.js); this is the manual reason.
    riskFlag: {
      flagged: { type: Boolean, default: false },
      reason: { type: String, trim: true, maxlength: 500 },
      flaggedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
      flaggedByName: { type: String, trim: true },
      flaggedAt: { type: Date },
    },
    holdReason: { type: String, trim: true, maxlength: 500 },
    // 'manual' (staff) or 'auto' (the overdue-payment rule). Only auto holds are ever lifted automatically.
    holdSource: { type: String, enum: ['manual', 'auto'] },
    holdSince: { type: Date },
    holdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    holdByName: { type: String, trim: true },
    // Offboarded (client decision, Oct 2026): the engagement has ended — the client is
    // "In-Active" in the client register. Login is NOT blocked: they can still see and pay
    // their invoices. Set and undone by staff only (POST /admin/clients/:id/offboard|onboard-again).
    offboardedAt: { type: Date },
    offboardReason: { type: String, trim: true, maxlength: 500 },
    offboardedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    offboardedByName: { type: String, trim: true },
    // 'manual' (a Super Admin) or 'auto' (unpaid + not answering calls — services/autoOffboard.js)
    offboardSource: { type: String, enum: ['manual', 'auto'] },
    // Suspension (reversible): isActive=false + who/when/why. Internal only —
    // never returned by the client-facing APIs.
    suspendedAt: { type: Date },
    suspendedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    suspensionReason: { type: String, trim: true, maxlength: 500 },
    // Archive ("delete"): login blocked and hidden from admin lists, but every
    // invoice/project/ticket is kept. Super Admin can restore it, or delete it
    // permanently once nothing is linked to it.
    deletedAt: { type: Date, index: true },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    deletionReason: { type: String, trim: true, maxlength: 500 },
    refreshToken: {
      type: String,
      select: false,
    },
    // Embedded in client JWTs as `tv`; incremented on password change/reset
    // to revoke all previously issued tokens (see clientAuthMiddleware).
    tokenVersion: {
      type: Number,
      default: 0,
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
    // Account activation (Client Journey SOP §4: never email a password). A new account gets a
    // random password nobody knows and an emailed "set your password" link; the client sets
    // their own password through it. activatedAt = when they first did.
    activationSentAt: { type: Date },
    activatedAt: { type: Date },
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
    // Bumped each time an admin changes agreementDetails, so the client is
    // asked to sign again (see services/agreementVersioning.js).
    agreementVersion: {
      type: Number,
      default: 0,
    },
    // Exactly what the client signed — the common template is rendered from
    // these details in the Agreement tab, even if the admin edits them later.
    signedAgreement: {
      version: { type: Number },
      acceptedAt: { type: Date },
      businessName: { type: String },
      contactName: { type: String },
      phone: { type: String },
      details: { type: mongoose.Schema.Types.Mixed },
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
clientSchema.index({ 'profile.accountManager': 1 });
clientSchema.index({ 'profile.sectors': 1 });
clientSchema.index({ 'profile.services': 1 });

// ─── Auto-generate clientId on first save ────────────────────────────────────
clientSchema.pre('save', async function () {
  if (!this.clientId) this.clientId = await nextSequenceId(this.constructor, 'clientId', 'VH-CL-');
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
/**
 * A one-time link token (only its hash is stored). Forgot-password links last 10 minutes;
 * an activation link (new account, or one staff send) lasts `minutes` (72 hours).
 */
clientSchema.methods.getResetPasswordToken = function (minutes = 10) {
  const resetToken = crypto.randomBytes(20).toString('hex');
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  this.resetPasswordExpire = Date.now() + minutes * 60 * 1000;
  return resetToken;
};

const Client = mongoose.model('Client', clientSchema);
module.exports = Client;
