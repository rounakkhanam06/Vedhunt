const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const Client = require('../models/Client');

/**
 * Client Portal Auth Middleware
 *
 * COMPLETELY ISOLATED from the admin authMiddleware:
 * - Reads `clientToken` cookie (not `adminToken`)
 * - Verifies with JWT_CLIENT_SECRET (not JWT_SECRET)
 * - Populates req.client (not req.user)
 * - Never touches Admin model
 */
const clientAuthMiddleware = async (req, res, next) => {
  try {
    let token = req.cookies.clientToken;

    // Fall back to Authorization header for cross-domain compatibility
    if (
      !token &&
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: 'Not authorized, no token' });
    }

    // Use a separate secret from admin JWT — critical for isolation
    const secret = process.env.JWT_CLIENT_SECRET || process.env.JWT_SECRET;
    const decoded = jwt.verify(token, secret);

    // Fetch client without sensitive fields
    req.client = await Client.findById(decoded.id).select(
      '-password -refreshToken -notes -resetPasswordToken -resetPasswordExpire'
    ).lean();

    if (!req.client) {
      return res
        .status(401)
        .json({ success: false, message: 'Client account not found' });
    }

    if (!req.client.isActive || req.client.deletedAt) {
      return res
        .status(401)
        .json({
          success: false,
          message: req.client.deletedAt
            ? 'This account has been closed.'
            : 'Your account has been suspended. Please contact Vedhunt support.',
        });
    }

    // Token issued before the last password change/reset/suspension → revoked
    if ((decoded.tv || 0) !== (req.client.tokenVersion || 0)) {
      return res
        .status(401)
        .json({ success: false, message: 'Session expired, please login again' });
    }

    next();
  } catch (error) {
    logger.error('Client auth middleware error:', error.message);
    if (error.name === 'TokenExpiredError') {
      return res
        .status(401)
        .json({ success: false, message: 'Session expired, please login again' });
    }
    res
      .status(401)
      .json({ success: false, message: 'Not authorized, invalid token' });
  }
};

module.exports = clientAuthMiddleware;
