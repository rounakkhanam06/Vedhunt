const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');
const Employee = require('../models/Employee');
const AuditLog = require('../models/AuditLog');
const employeeAuthMiddleware = require('../middleware/employeeAuthMiddleware');
const { authLimiter } = require('../middleware/rateLimiter');
const logger = require('../utils/logger');

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

const loginMiddleware = process.env.NODE_ENV === 'production' ? [authLimiter] : [];

router.post('/login', ...loginMiddleware, async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await Admin.findOne({ email }).populate('roles');
    if (admin && (await admin.matchPassword(password))) {
      if (!admin.isActive) {
        return res.status(401).json({ success: false, message: 'Account is inactive' });
      }
      
      // Mirrors PORTAL_ONLY_ROLES in server/routes/auth.js — anyone confined
      // to the Employee Portal there (plain employees, and BDs) must be able
      // to actually reach it here, regardless of which of those roles they hold.
      const PORTAL_ROLES = ['EMPLOYEE', 'BDE'];
      const hasPortalRole = admin.roles?.some(role => PORTAL_ROLES.includes(role.name));
      if (!hasPortalRole) {
        return res.status(403).json({ success: false, message: 'Access Denied: Standard administrators cannot login to the Employee Portal.' });
      }

      const accessToken = generateAccessToken(admin._id);
      const refreshToken = generateRefreshToken(admin._id);
      
      const salt = await bcrypt.genSalt(10);
      const hashedRefreshToken = await bcrypt.hash(refreshToken, salt);
      await Admin.updateOne({ _id: admin._id }, { $set: { refreshToken: hashedRefreshToken } });
      
      res.cookie('employeeToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        maxAge: 15 * 60 * 1000,
      });
      res.cookie('employeeRefreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      await AuditLog.create({ adminId: admin._id, action: 'LOGIN', resource: 'EmployeeAuth', ipAddress: req.ip });
      logger.info(`Employee logged in: ${admin.email}`);
      
      res.json({
        success: true,
        token: accessToken,
        mustResetPassword: admin.isTemporaryPassword || false,
        employee: {
          _id: admin._id,
          firstName: admin.firstName,
          lastName: admin.lastName,
          email: admin.email,
          employeeId: admin.employeeId
        }
      });
    } else {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
  } catch (error) {
    logger.error('Employee Login Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/me', employeeAuthMiddleware, async (req, res) => {
  res.json({
    success: true,
    employee: {
      _id: req.user._id,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      email: req.user.email,
      employeeId: req.user.employeeId,
      isTemporaryPassword: req.user.isTemporaryPassword
    }
  });
});

router.post('/logout', async (req, res) => {
  res.cookie('employeeToken', '', { httpOnly: true, expires: new Date(0) });
  res.cookie('employeeRefreshToken', '', { httpOnly: true, expires: new Date(0) });
  res.json({ success: true, message: 'Logged out successfully' });
});

router.post('/refresh-token', async (req, res) => {
  try {
    const refreshToken = req.cookies.employeeRefreshToken;
    if (!refreshToken) {
      return res.status(401).json({ success: false, message: 'No refresh token provided' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
    const admin = await Admin.findById(decoded.id).populate('roles');

    if (!admin || !admin.isActive) {
      return res.status(401).json({ success: false, message: 'User not found or inactive' });
    }

    const isMatch = await bcrypt.compare(refreshToken, admin.refreshToken);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }

    const accessToken = generateAccessToken(admin._id);
    res.cookie('employeeToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
      maxAge: 15 * 60 * 1000,
    });

    res.json({ success: true, token: accessToken });
  } catch (error) {
    logger.error('Refresh token error:', error.message);
    res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
  }
});

router.post('/reset-temp-password', employeeAuthMiddleware, async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long' });
    }
    const admin = await Admin.findById(req.user._id);
    if (!admin) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    admin.password = newPassword;
    admin.isTemporaryPassword = false;
    await admin.save();

    await Employee.findOneAndUpdate(
      { adminId: req.user._id },
      { tempPassword: newPassword }
    );

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    logger.error('Error resetting employee temp password:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
