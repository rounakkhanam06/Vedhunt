const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { PAGE_CATALOG, ACTIONS, SCOPE_MODES } = require('../config/pageAccess');

const SCOPE_MODE_VALUES = [...new Set(Object.values(SCOPE_MODES).flat())];

const adminSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    roles: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Role',
    }],
    refreshToken: {
      type: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isTemporaryPassword: {
      type: Boolean,
      default: false,
    },
    employeeId: {
      type: String,
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    // Firebase Cloud Messaging device tokens for push notifications — one
    // Admin can be signed in on multiple devices/browsers, so this is a list.
    // See utils/pushNotify.js.
    fcmTokens: [{
      token: { type: String, required: true },
      addedAt: { type: Date, default: Date.now },
      userAgent: { type: String, trim: true }
    }],
    // Person-wise page access on top of the roles: page + actions + data
    // scope. Managed from the Employee Manager; see config/pageAccess.js.
    // No default: "never set" (undefined) lets a not-yet-migrated login fall
    // back to its legacy crmGrants, while [] means "no grants".
    accessGrants: {
      type: [{
        _id: false,
        page: { type: String, enum: PAGE_CATALOG.map((p) => p.key), required: true },
        actions: [{ type: String, enum: ACTIONS }],
        scope: {
          mode: { type: String, enum: SCOPE_MODE_VALUES, required: true },
          clients: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Client' }],
          departments: [{ type: String, trim: true }],
        },
      }],
      default: undefined,
    },
    // LEGACY (before accessGrants) — read-only fallback until
    // scripts/migrations/migrateCrmGrants.js moves it to accessGrants.
    crmGrants: {
      type: [{
        _id: false,
        page: String,
        allClients: Boolean,
        clients: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Client' }],
        actions: [String],
      }],
      default: undefined,
    },
  },
  { timestamps: true }
);

// Hash password before saving
adminSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match user entered password to hashed password in database
adminSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate and hash password token
adminSchema.methods.getResetPasswordToken = function () {
  // Generate token
  const resetToken = crypto.randomBytes(20).toString('hex');

  // Hash token and set to resetPasswordToken field
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // Set expire (10 minutes)
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

const Admin = mongoose.model('Admin', adminSchema);

module.exports = Admin;
