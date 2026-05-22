const express = require('express');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const authMiddleware = require('../middleware/authMiddleware');
const { authLimiter } = require('../middleware/rateLimiter');
const logger = require('../utils/logger');

const router = express.Router();

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

// @route   POST /api/auth/login
// @desc    Auth admin & get token
// @access  Public
const loginMiddleware = process.env.NODE_ENV === 'production' ? [authLimiter] : [];
router.post('/login', ...loginMiddleware, async (req, res) => {
  try {
    const { email, password } = req.body;

    const admin = await Admin.findOne({ email });

    if (admin && (await admin.matchPassword(password))) {
      if (!admin.isActive) {
        return res.status(401).json({ success: false, message: 'Account is inactive' });
      }

      const token = generateToken(admin._id);

      res.cookie('adminToken', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // true in production
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      logger.info(`Admin logged in: ${admin.email}`);

      res.json({
        success: true,
        admin: {
          _id: admin._id,
          email: admin.email,
          role: admin.role,
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

// @route   GET /api/auth/me
// @desc    Get current logged in admin
// @access  Private
router.get('/me', authMiddleware, async (req, res) => {
  res.json({
    success: true,
    admin: {
      _id: req.user._id,
      email: req.user.email,
      role: req.user.role,
    },
  });
});

// @route   POST /api/auth/logout
// @desc    Logout admin / clear cookie
// @access  Public
router.post('/logout', (req, res) => {
  res.cookie('adminToken', '', {
    httpOnly: true,
    expires: new Date(0),
  });
  res.json({ success: true, message: 'Logged out successfully' });
});

module.exports = router;
