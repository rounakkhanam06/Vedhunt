const AuditLog = require('../models/AuditLog');
const logger = require('../utils/logger');

// @desc    Get all audit logs with pagination and optional filters
// @route   GET /api/audit
// @access  Private (Super Admin)
exports.getAuditLogs = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const startIndex = (page - 1) * limit;

    const query = {};

    if (req.query.adminId && req.query.adminId !== 'All') {
      query.adminId = req.query.adminId;
    }
    if (req.query.action && req.query.action !== 'All') {
      query.action = req.query.action;
    }
    if (req.query.resource && req.query.resource !== 'All') {
      query.resource = req.query.resource;
    }
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      query.$or = [
        { action: searchRegex },
        { resource: searchRegex },
        { ipAddress: searchRegex }
      ];
    }

    const totalLogs = await AuditLog.countDocuments(query);
    const logs = await AuditLog.find(query)
      .sort({ createdAt: -1 })
      .skip(startIndex)
      .limit(limit)
      .populate('adminId', 'firstName lastName email');

    res.status(200).json({
      success: true,
      count: logs.length,
      totalLogs,
      totalPages: Math.ceil(totalLogs / limit),
      currentPage: page,
      data: logs
    });
  } catch (error) {
    logger.error('Error fetching audit logs:', error);
    next(error);
  }
};
