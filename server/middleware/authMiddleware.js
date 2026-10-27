const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const Admin = require('../models/Admin');
const { isPortalOnly } = require('../config/permissions');
const { mustResetPassword, PASSWORD_RESET_REQUIRED } = require('../utils/tempPasswordGate');

const TEMP_PASSWORD_ALLOWED = ['/api/auth/me', '/api/auth/reset-temp-password', '/api/auth/logout'];

const buildAuth = ({ allowPortal = false } = {}) => async (req, res, next) => {
  try {
    let token = req.cookies.adminToken;

    // Check authorization header if token not in cookies (for cross-domain compatibility)
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorized, no token' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // A portal preview token (utils/portalPreview.js) is never an Admin panel login
    if (decoded.preview) return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
    req.user = await Admin.findById(decoded.id)
      .select('-password')
      .populate('roles');
    
    if (!req.user || !req.user.isActive) {
      return res.status(401).json({ success: false, message: 'Not authorized, user not active or found' });
    }

    // Flatten permissions from all roles and attach to user
    const permissionsSet = new Set();
    if (req.user.roles && req.user.roles.length > 0) {
      req.user.roles.forEach(role => {
        if (role.permissions && Array.isArray(role.permissions)) {
          role.permissions.forEach(perm => permissionsSet.add(perm));
        }
      });
    }
    req.user.permissions = Array.from(permissionsSet);

    // Employee Portal tokens are signed with the same secret, so refuse
    // portal-only logins here exactly as the Admin login does.
    if (!allowPortal && isPortalOnly(req.user.roles)) {
      return res.status(403).json({ success: false, message: 'Access Denied: Please use the Employee Portal.' });
    }

    if (mustResetPassword(req, req.user.isTemporaryPassword, TEMP_PASSWORD_ALLOWED)) {
      return res.status(403).json(PASSWORD_RESET_REQUIRED);
    }

    next();
  } catch (error) {
    logger.error('Auth middleware error:', error.message);
    res.status(401).json({ success: false, message: 'Not authorized, token failed' });
  }
};

const authMiddleware = buildAuth();
// For routers whose unguarded routes are self-service and also serve the
// Employee Portal (e.g. My Performance) — everything else stays permission-gated.
authMiddleware.allowPortal = buildAuth({ allowPortal: true });
// After allowPortal: keeps the routes behind it for Admin panel logins only
authMiddleware.adminPanelOnly = (req, res, next) => (isPortalOnly(req.user?.roles)
  ? res.status(403).json({ success: false, message: 'Access Denied: Please use the Employee Portal.' })
  : next());

module.exports = authMiddleware;
