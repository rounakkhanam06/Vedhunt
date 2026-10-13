const logger = require('../utils/logger');
const AuditLog = require('../models/AuditLog');

/**
 * Allow the request when the user holds `requiredPermission` — or, given an
 * array, any one of them (a page several roles can reach, e.g. the employee
 * list used by HR, task and performance screens). '*' always passes.
 */
const requirePermission = (requiredPermission) => {
  const anyOf = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];
  const label = anyOf.join("' or '");
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.permissions) {
        return res.status(403).json({
          success: false,
          message: 'User is not authorized (no permissions found)',
        });
      }

      // Check for wildcard '*' or specific permission
      const hasPermission = req.user.permissions.includes('*') || anyOf.some((p) => req.user.permissions.includes(p));

      if (!hasPermission) {
        // Log unauthorized attempt
        await AuditLog.create({
          adminId: req.user._id,
          action: 'UNAUTHORIZED_ACCESS',
          resource: anyOf.join(','),
          details: { originalUrl: req.originalUrl, method: req.method },
          ipAddress: req.ip
        });

        return res.status(403).json({
          success: false,
          message: `Forbidden: requires '${label}' permission`,
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
