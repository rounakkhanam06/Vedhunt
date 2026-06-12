const logger = require('../utils/logger');
const AuditLog = require('../models/AuditLog');

const requirePermission = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.permissions) {
        return res.status(403).json({
          success: false,
          message: 'User is not authorized (no permissions found)',
        });
      }

      // Check for wildcard '*' or specific permission
      const hasPermission = req.user.permissions.includes('*') || req.user.permissions.includes(requiredPermission);

      if (!hasPermission) {
        // Log unauthorized attempt
        await AuditLog.create({
          adminId: req.user._id,
          action: 'UNAUTHORIZED_ACCESS',
          resource: requiredPermission,
          details: { originalUrl: req.originalUrl, method: req.method },
          ipAddress: req.ip
        });

        return res.status(403).json({
          success: false,
          message: `Forbidden: requires '${requiredPermission}' permission`,
        });
      }

      next();
    } catch (error) {
      logger.error('requirePermission middleware error:', error.message);
      res.status(500).json({ success: false, message: 'Server error during authorization' });
    }
  };
};

module.exports = requirePermission;
