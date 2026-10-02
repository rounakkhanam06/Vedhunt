const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const Client = require('../models/Client');
const clientAuthMiddleware = require('../middleware/clientAuthMiddleware');
const { authLimiter } = require('../middleware/rateLimiter');
const logger = require('../utils/logger');
const { sendEmail } = require('../utils/sendEmail');

const router = express.Router();

// ─── Token generators (using CLIENT-specific secret) ─────────────────────────
// `tv` = the client's tokenVersion; bumping it (password change/reset) makes
// every token issued before unusable. Tokens without `tv` count as version 0.
const generateClientAccessToken = (id, tv = 0) => {
  const secret = process.env.JWT_CLIENT_SECRET || process.env.JWT_SECRET;
  return jwt.sign({ id, tv }, secret, {
    expiresIn: process.env.JWT_CLIENT_EXPIRES_IN || '15m',
  });
};

const generateClientRefreshToken = (id, tv = 0) => {
  const secret =
    process.env.JWT_CLIENT_REFRESH_SECRET ||
    process.env.JWT_CLIENT_SECRET ||
    process.env.JWT_SECRET;
  return jwt.sign({ id, tv }, secret, { expiresIn: '7d' });
};

// ─── Cookie helpers ───────────────────────────────────────────────────────────
const cookieOptions = (maxAge) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
  maxAge,
});

// ─── Safe client profile (no sensitive fields) ────────────────────────────────
const safeClientProfile = (client) => ({
  _id: client._id,
  clientId: client.clientId,
  businessName: client.businessName,
  contactName: client.contactName,
  email: client.email,
  phone: client.phone,
  isTemporaryPassword: client.isTemporaryPassword,
  acceptedAgreementVersion: client.acceptedAgreementVersion,
  createdAt: client.createdAt,
});

// ─────────────────────────────────────────────────────────────────────────────
// @route  POST /api/client/auth/login
// @access Public
// ─────────────────────────────────────────────────────────────────────────────
const loginMiddleware =
  process.env.NODE_ENV === 'production' ? [authLimiter] : [];

router.post('/login', ...loginMiddleware, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: 'Email and password are required' });
    }

    // Include password field explicitly (it's select: false)
    const client = await Client.findOne({ email: email.toLowerCase().trim() })
      .select('+password +refreshToken')
      .lean({ virtuals: false }); // lean for speed, virtuals not needed here

    if (!client || !(await bcrypt.compare(password, client.password))) {
      return res
        .status(401)
        .json({ success: false, message: 'Invalid email or password' });
    }

    if (!client.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Your account is inactive. Please contact support.',
      });
    }

    const accessToken = generateClientAccessToken(client._id, client.tokenVersion || 0);
    const refreshToken = generateClientRefreshToken(client._id, client.tokenVersion || 0);

    // Hash and store refresh token
    const salt = await bcrypt.genSalt(10);
    const hashedRefreshToken = await bcrypt.hash(refreshToken, salt);
    await Client.findByIdAndUpdate(client._id, {
      refreshToken: hashedRefreshToken,
    });

    res.cookie('clientToken', accessToken, cookieOptions(15 * 60 * 1000));
    res.cookie(
      'clientRefreshToken',
      refreshToken,
      cookieOptions(7 * 24 * 60 * 60 * 1000)
    );

    logger.info(`Client logged in: ${client.email}`);

    res.json({
      success: true,
      token: accessToken,
      mustResetPassword: client.isTemporaryPassword || false,
      client: safeClientProfile(client),
    });
  } catch (error) {
    logger.error('Client login error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// @route  POST /api/client/auth/refresh
// @access Public
// ─────────────────────────────────────────────────────────────────────────────
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken =
      req.cookies.clientRefreshToken || req.body.refreshToken;

    if (!refreshToken) {
      return res
        .status(401)
        .json({ success: false, message: 'No refresh token provided' });
    }

    const secret =
      process.env.JWT_CLIENT_REFRESH_SECRET ||
      process.env.JWT_CLIENT_SECRET ||
      process.env.JWT_SECRET;
    const decoded = jwt.verify(refreshToken, secret);

    const client = await Client.findById(decoded.id)
      .select('+refreshToken')
      .lean();

    if (!client || !client.isActive || !client.refreshToken) {
      return res
        .status(401)
        .json({ success: false, message: 'Invalid refresh token' });
    }

    const isMatch = await bcrypt.compare(refreshToken, client.refreshToken);
    // Issued before the last password change → revoked
    if (!isMatch || (decoded.tv || 0) !== (client.tokenVersion || 0)) {
      return res
        .status(401)
        .json({ success: false, message: 'Invalid refresh token' });
    }

    const accessToken = generateClientAccessToken(client._id, client.tokenVersion || 0);
    res.cookie('clientToken', accessToken, cookieOptions(15 * 60 * 1000));

    res.json({ success: true, token: accessToken });
  } catch (error) {
    logger.error('Client refresh token error:', error.message);
    res.status(401).json({ success: false, message: 'Invalid refresh token' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// @route  GET /api/client/auth/me
// @access Private
// ─────────────────────────────────────────────────────────────────────────────
router.get('/me', clientAuthMiddleware, (req, res) => {
  res.json({ success: true, client: safeClientProfile(req.client) });
});

// ─────────────────────────────────────────────────────────────────────────────
// @route  PUT /api/client/auth/profile
// @desc   Client updates their own contact details. Business name and email
//         (the login) stay admin-managed — they appear on invoices/agreement.
// @access Private
// ─────────────────────────────────────────────────────────────────────────────
router.put('/profile', clientAuthMiddleware, async (req, res) => {
  try {
    const contactName = typeof req.body.contactName === 'string' ? req.body.contactName.trim() : undefined;
    const phone = typeof req.body.phone === 'string' ? req.body.phone.replace(/[\s-]/g, '') : undefined;

    if (contactName !== undefined && (contactName.length < 2 || contactName.length > 50 || !/^[A-Za-z\s]+$/.test(contactName))) {
      return res.status(400).json({ success: false, message: 'Contact name must be 2–50 letters (no numbers or special characters).' });
    }
    if (phone !== undefined && phone !== '' && !/^\+?[1-9]\d{9,14}$/.test(phone)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid phone number (10-15 digits).' });
    }

    const client = await Client.findById(req.client._id);
    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    if (contactName !== undefined) client.contactName = contactName;
    if (phone !== undefined) client.phone = phone || undefined;
    await client.save();

    res.json({ success: true, message: 'Profile updated successfully', client: safeClientProfile(client) });
  } catch (error) {
    logger.error('Client update profile error:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: Object.values(error.errors)[0]?.message || error.message });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// @route  PUT /api/client/auth/password
// @desc   Change password (requires the current one). Bumps tokenVersion, so
//         sessions on other devices are signed out immediately.
// @access Private
// ─────────────────────────────────────────────────────────────────────────────
router.put('/password', clientAuthMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current password and new password are required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long.' });
    }

    const client = await Client.findById(req.client._id).select('+password');
    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }
    if (!(await client.matchPassword(currentPassword))) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    }
    if (await client.matchPassword(newPassword)) {
      return res.status(400).json({ success: false, message: 'New password must be different from the current one.' });
    }

    // New token version: every other device's tokens stop working at once;
    // this device continues with the fresh tokens issued below.
    client.tokenVersion = (client.tokenVersion || 0) + 1;
    const accessToken = generateClientAccessToken(client._id, client.tokenVersion);
    const refreshToken = generateClientRefreshToken(client._id, client.tokenVersion);

    client.password = newPassword;
    client.isTemporaryPassword = false;
    client.temporaryPasswordText = undefined; // admin vault must not keep a stale/known password
    client.refreshToken = await bcrypt.hash(refreshToken, await bcrypt.genSalt(10));
    await client.save();

    res.cookie('clientToken', accessToken, cookieOptions(15 * 60 * 1000));
    res.cookie('clientRefreshToken', refreshToken, cookieOptions(7 * 24 * 60 * 60 * 1000));

    logger.info(`Client changed password: ${client.email}`);
    res.json({ success: true, message: 'Password changed successfully.', token: accessToken });
  } catch (error) {
    logger.error('Client change password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// @route  POST /api/client/auth/logout
// @access Private
// ─────────────────────────────────────────────────────────────────────────────
router.post('/logout', clientAuthMiddleware, async (req, res) => {
  await Client.findByIdAndUpdate(req.client._id, { refreshToken: undefined });

  const clearOptions = {
    httpOnly: true,
    expires: new Date(0),
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
  };

  res.cookie('clientToken', '', clearOptions);
  res.cookie('clientRefreshToken', '', clearOptions);
  logger.info(`Client logged out: ${req.client.email}`);
  res.json({ success: true, message: 'Logged out successfully' });
});

// ─────────────────────────────────────────────────────────────────────────────
// @route  POST /api/client/auth/forgot-password
// @access Public
// ─────────────────────────────────────────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  try {
    const client = await Client.findOne({
      email: (req.body.email || '').toLowerCase().trim(),
    }).select('+resetPasswordToken +resetPasswordExpire');

    if (!client) {
      // Security: don't reveal whether email exists
      return res.json({
        success: true,
        message:
          'If that email is registered, a reset link has been sent.',
      });
    }

    const resetToken = client.getResetPasswordToken();
    await client.save({ validateBeforeSave: false });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${frontendUrl}/client/reset-password/${resetToken}`;

    try {
      await sendEmail({
        email: client.email,
        subject: 'Vedhunt Client Portal — Password Reset',
        message: `Hello ${client.contactName},\n\nClick the link below to reset your password (valid for 10 minutes):\n\n${resetUrl}\n\nIf you did not request this, please ignore this email.`,
      });
    } catch (emailErr) {
      client.resetPasswordToken = undefined;
      client.resetPasswordExpire = undefined;
      await client.save({ validateBeforeSave: false });
      logger.error('Client forgot-password email error:', emailErr);
      return res
        .status(500)
        .json({ success: false, message: 'Email could not be sent' });
    }

    res.json({
      success: true,
      message: 'If that email is registered, a reset link has been sent.',
    });
  } catch (error) {
    logger.error('Client forgot-password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// @route  PUT /api/client/auth/reset-password/:resettoken
// @access Public
// ─────────────────────────────────────────────────────────────────────────────
router.put('/reset-password/:resettoken', async (req, res) => {
  try {
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(req.params.resettoken)
      .digest('hex');

    const client = await Client.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() },
    }).select('+resetPasswordToken +resetPasswordExpire');

    if (!client) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid or expired reset token' });
    }

    client.password = req.body.password;
    client.isTemporaryPassword = false;
    client.temporaryPasswordText = undefined;
    client.resetPasswordToken = undefined;
    client.resetPasswordExpire = undefined;
    client.tokenVersion = (client.tokenVersion || 0) + 1; // sign out every existing session
    await client.save();

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    logger.error('Client reset-password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// @route  POST /api/client/auth/reset-temp-password
// @access Private
// ─────────────────────────────────────────────────────────────────────────────
router.post('/reset-temp-password', clientAuthMiddleware, async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters',
      });
    }

    const client = await Client.findById(req.client._id).select('+password');
    if (!client) {
      return res
        .status(404)
        .json({ success: false, message: 'Client not found' });
    }

    client.password = newPassword;
    client.isTemporaryPassword = false;
    client.temporaryPasswordText = undefined;
    await client.save();

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    logger.error('Client reset-temp-password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
