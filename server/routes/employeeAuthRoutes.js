const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');
const Employee = require('../models/Employee');
const Project = require('../models/Project');
const AuditLog = require('../models/AuditLog');
const employeeAuthMiddleware = require('../middleware/employeeAuthMiddleware');
const { authLimiter } = require('../middleware/rateLimiter');
const logger = require('../utils/logger');
const crypto = require('crypto');
const { sendEmail } = require('../utils/sendEmail');
const { resolveSegment, resolvePortalModules } = require('../utils/employeeSegments');

const router = express.Router();

// Same rule as the login route: who may use the Employee Portal at all
const hasPortalAccess = (admin) =>
  Boolean(admin?.employeeId) || (admin?.roles || []).some((role) => role.isEmployeeRole || role.permissions?.includes('ess.access'));

// A user-chosen password must never sit readable in the HR "password vault" —
// that field only makes sense for admin-issued temporary passwords.
const clearPasswordVault = (adminId) =>
  Employee.updateOne({ adminId }, { $unset: { tempPassword: 1 } }).catch((e) => logger.error('Vault clear failed:', e.message));

const forgotLimiter = process.env.NODE_ENV === 'production' ? [authLimiter] : [];

// @route   POST /api/employee/auth/forgot-password
// @desc    Email a reset link (same response whether or not the email exists)
router.post('/forgot-password', ...forgotLimiter, async (req, res) => {
  const generic = { success: true, message: 'If that email belongs to an employee account, a reset link has been sent.' };
  try {
    const email = String(req.body.email || '').toLowerCase().trim();
    if (!email) return res.status(400).json({ success: false, message: 'Please enter your email.' });

    const admin = await Admin.findOne({ email }).populate('roles');
    if (!admin || !admin.isActive || !hasPortalAccess(admin)) return res.json(generic);

    const resetToken = admin.getResetPasswordToken();
    await Admin.updateOne({ _id: admin._id }, { $set: { resetPasswordToken: admin.resetPasswordToken, resetPasswordExpire: admin.resetPasswordExpire } });

    const resetUrl = `${(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '')}/employee/reset-password/${resetToken}`;
    try {
      await sendEmail({
        email: admin.email,
        subject: 'Reset your Vedhunt Employee Portal password',
        message: `Hello ${admin.firstName || ''},\n\nA password reset was requested for your Employee Portal account.\n\nReset it here (valid for 10 minutes):\n${resetUrl}\n\nIf you didn't ask for this, you can ignore this email — your password won't change.\n\n— Vedhunt`,
      });
    } catch (err) {
      await Admin.updateOne({ _id: admin._id }, { $unset: { resetPasswordToken: 1, resetPasswordExpire: 1 } });
      logger.error('Employee reset email failed:', err.message);
      return res.status(500).json({ success: false, message: 'Email could not be sent. Please try again later.' });
    }
    res.json(generic);
  } catch (error) {
    logger.error('Employee forgot-password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/employee/auth/reset-password/:token
router.put('/reset-password/:token', async (req, res) => {
  try {
    const password = String(req.body.password || '');
    if (password.length < 6) return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });

    const hashed = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const admin = await Admin.findOne({ resetPasswordToken: hashed, resetPasswordExpire: { $gt: Date.now() } }).populate('roles');
    if (!admin || !hasPortalAccess(admin)) return res.status(400).json({ success: false, message: 'This reset link is invalid or has expired.' });

    admin.password = password;
    admin.isTemporaryPassword = false;
    admin.resetPasswordToken = undefined;
    admin.resetPasswordExpire = undefined;
    admin.refreshToken = undefined; // sign out existing sessions
    await admin.save();
    await clearPasswordVault(admin._id);
    await AuditLog.create({ adminId: admin._id, action: 'PASSWORD_RESET', resource: 'EmployeeAuth', ipAddress: req.ip }).catch(() => {});

    res.json({ success: true, message: 'Password reset. You can now log in with your new password.' });
  } catch (error) {
    logger.error('Employee reset-password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/employee/auth/password   (logged in)
router.put('/password', employeeAuthMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ success: false, message: 'Current password and new password are required.' });
    if (String(newPassword).length < 6) return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long.' });

    const admin = await Admin.findById(req.user._id);
    if (!admin) return res.status(404).json({ success: false, message: 'User not found.' });
    if (!(await admin.matchPassword(currentPassword))) return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    if (await admin.matchPassword(newPassword)) return res.status(400).json({ success: false, message: 'New password must be different from the current one.' });

    admin.password = newPassword;
    admin.isTemporaryPassword = false;
    await admin.save();
    await clearPasswordVault(admin._id);
    await AuditLog.create({ adminId: admin._id, action: 'PASSWORD_CHANGE', resource: 'EmployeeAuth', ipAddress: req.ip }).catch(() => {});

    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (error) {
    logger.error('Employee change-password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

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
      
      const hasPortalRole = Boolean(admin.employeeId) || admin.roles?.some(role => role.isEmployeeRole || role.permissions?.includes('ess.access'));
      if (!hasPortalRole) {
        return res.status(403).json({ success: false, message: 'Access Denied: Standard administrators cannot login to the Employee Portal.' });
      }

      const permissionsSet = new Set();
      admin.roles?.forEach(role => {
        (role.permissions || []).forEach(perm => permissionsSet.add(perm));
      });

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
          employeeId: admin.employeeId,
          isTemporaryPassword: Boolean(admin.isTemporaryPassword),
          permissions: Array.from(permissionsSet),
          segment: resolveSegment(admin.roles),
          portalModules: resolvePortalModules(admin.roles),
          ...(await portalFlags(admin._id))
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

// Which optional portal tabs apply: Team Approvals (is someone's reporting
// manager) and My Projects (is a PM or team member on any project).
async function portalFlags(adminId) {
  const me = await Employee.findOne({ adminId }, { _id: 1 }).lean();
  if (!me) return { hasTeam: false, hasProjects: false };
  const [team, projects] = await Promise.all([
    Employee.exists({ reportingManager: me._id }),
    Project.exists({ $or: [{ projectManager: me._id }, { teamMembers: me._id }] }),
  ]);
  return { hasTeam: Boolean(team), hasProjects: Boolean(projects) };
}

router.get('/me', employeeAuthMiddleware, async (req, res) => {
  const flags = await portalFlags(req.user._id);
  res.json({
    success: true,
    employee: {
      _id: req.user._id,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      email: req.user.email,
      employeeId: req.user.employeeId,
      isTemporaryPassword: req.user.isTemporaryPassword,
      permissions: req.user.permissions,
      segment: req.user.segment,
      portalModules: req.user.portalModules,
      ...flags
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

    await clearPasswordVault(admin._id);

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    logger.error('Error resetting employee temp password:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
