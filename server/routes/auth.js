const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');
const AuditLog = require('../models/AuditLog');
const authMiddleware = require('../middleware/authMiddleware');
const { authLimiter } = require('../middleware/rateLimiter');
const logger = require('../utils/logger');
const { sendEmail } = require('../utils/sendEmail');

const router = express.Router();

const generateAccessToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  });
};

const generateRefreshToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, {
    expiresIn: '7d',
  });
};

// @route   POST /api/auth/login
// @desc    Auth admin & get token
// @access  Public
const loginMiddleware = process.env.NODE_ENV === 'production' ? [authLimiter] : [];
router.post('/login', ...loginMiddleware, async (req, res) => {
  try {
    const { email, password } = req.body;

    const admin = await Admin.findOne({ email }).populate('roles');

    if (admin && (await admin.matchPassword(password))) {
      if (!admin.isActive) {
        return res.status(401).json({ success: false, message: 'Account is inactive' });
      }

      const accessToken = generateAccessToken(admin._id);
      const refreshToken = generateRefreshToken(admin._id);

      // Hash refresh token before saving
      const salt = await bcrypt.genSalt(10);
      admin.refreshToken = await bcrypt.hash(refreshToken, salt);
      await admin.save({ validateBeforeSave: false });

      // Calculate permissions for frontend response
      const permissionsSet = new Set();
      if (admin.roles && admin.roles.length > 0) {
        admin.roles.forEach(role => {
          if (role.permissions && Array.isArray(role.permissions)) {
            role.permissions.forEach(perm => permissionsSet.add(perm));
          }
        });
      }
      const permissions = Array.from(permissionsSet);

      res.cookie('adminToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        maxAge: 15 * 60 * 1000, // 15 mins
      });

      res.cookie('adminRefreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      await AuditLog.create({
        adminId: admin._id,
        action: 'LOGIN',
        resource: 'Auth',
        ipAddress: req.ip
      });

      logger.info(`Admin logged in: ${admin.email}`);

      res.json({
        success: true,
        token: accessToken,
        admin: {
          _id: admin._id,
          firstName: admin.firstName,
          lastName: admin.lastName,
          email: admin.email,
          roles: admin.roles,
          permissions,
        },
      });
    } else {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/auth/refresh-token
// @desc    Refresh access token
// @access  Public
router.post('/refresh-token', async (req, res) => {
  try {
    const refreshToken = req.cookies.adminRefreshToken || req.body.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ success: false, message: 'No refresh token provided' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
    const admin = await Admin.findById(decoded.id);

    if (!admin || !admin.isActive || !admin.refreshToken) {
      return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }

    const isMatch = await bcrypt.compare(refreshToken, admin.refreshToken);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }

    const accessToken = generateAccessToken(admin._id);

    res.cookie('adminToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
      maxAge: 15 * 60 * 1000,
    });

    res.json({
      success: true,
      token: accessToken
    });
  } catch (error) {
    logger.error('Refresh token error:', error.message);
    res.status(401).json({ success: false, message: 'Invalid refresh token' });
  }
});

// @route   GET /api/auth/me
// @desc    Get current logged in admin
// @access  Private
router.get('/me', authMiddleware, async (req, res) => {
  res.json({
    success: true,
    admin: {
      _id: req.user._id,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      email: req.user.email,
      roles: req.user.roles,
      permissions: req.user.permissions,
    },
  });
});

// @route   POST /api/auth/forgotpassword
// @desc    Forgot password
// @access  Public
router.post('/forgotpassword', async (req, res) => {
  try {
    const admin = await Admin.findOne({ email: req.body.email });

    if (!admin) {
      return res.status(404).json({ success: false, message: 'There is no user with that email' });
    }

    // Get reset token
    const resetToken = admin.getResetPasswordToken();

    await admin.save({ validateBeforeSave: false });

    // Create reset url
    // In production, process.env.FRONTEND_URL would be used
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${frontendUrl}/admin/reset-password/${resetToken}`;

    const message = `You are receiving this email because you (or someone else) has requested the reset of a password. Please make a PUT request to: \n\n ${resetUrl}`;

    try {
      await sendEmail({
        email: admin.email,
        subject: 'Password reset token',
        message,
      });

      res.status(200).json({ success: true, data: 'Email sent' });
    } catch (err) {
      console.log(err);
      admin.resetPasswordToken = undefined;
      admin.resetPasswordExpire = undefined;

      await admin.save({ validateBeforeSave: false });

      return res.status(500).json({ success: false, message: 'Email could not be sent' });
    }
  } catch (error) {
    logger.error('Forgot password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/auth/resetpassword/:resettoken
// @desc    Reset password
// @access  Public
router.put('/resetpassword/:resettoken', async (req, res) => {
  try {
    // Get hashed token
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(req.params.resettoken)
      .digest('hex');

    const admin = await Admin.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!admin) {
      return res.status(400).json({ success: false, message: 'Invalid token' });
    }

    // Set new password
    admin.password = req.body.password;
    admin.resetPasswordToken = undefined;
    admin.resetPasswordExpire = undefined;
    await admin.save();

    res.status(200).json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    logger.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/auth/logout
// @desc    Logout admin / clear cookie
// @access  Public
router.post('/logout', authMiddleware, async (req, res) => {
  if (req.user) {
    req.user.refreshToken = undefined;
    await req.user.save({ validateBeforeSave: false });

    await AuditLog.create({
      adminId: req.user._id,
      action: 'LOGOUT',
      resource: 'Auth',
      ipAddress: req.ip
    });
  }

  res.cookie('adminToken', '', {
    httpOnly: true,
    expires: new Date(0),
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
  });
  
  res.cookie('adminRefreshToken', '', {
    httpOnly: true,
    expires: new Date(0),
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
  });

  res.json({ success: true, message: 'Logged out successfully' });
});

module.exports = router;
