const AuditLog = require('../models/AuditLog');
const Employee = require('../models/Employee');
const logger = require('../utils/logger');
const { clockInReport, dayBounds } = require('../services/clockInReport');

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
    // Date range (whole calendar days, server timezone / IST; both ends included)
    const from = dayBounds(req.query.dateFrom);
    const to = dayBounds(req.query.dateTo);
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = from.start;
      if (to) query.createdAt.$lte = to.end;
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

// @desc    Employees who have not clocked in on a day (attendance clock-in, not panel login)
// @route   GET /api/audit/not-clocked-in?date=YYYY-MM-DD&employeeId=
// @access  Private (audit.view)
exports.getNotClockedIn = async (req, res, next) => {
  try {
    const report = await clockInReport(req.query.date || undefined, { employeeId: req.query.employeeId || undefined });
    if (!report) return res.status(400).json({ success: false, message: 'date must be YYYY-MM-DD' });
    res.status(200).json({ success: true, data: report });
  } catch (error) {
    logger.error('Error building not-clocked-in report:', error);
    next(error);
  }
};

// @desc    Employee picker for the audit filters (adminId filters the log, _id the clock-in report)
// @route   GET /api/audit/employees
// @access  Private (audit.view)
exports.getAuditEmployees = async (req, res, next) => {
  try {
    const people = await Employee.find({}, 'employeeId firstName lastName adminId').sort({ firstName: 1 }).lean();
    res.status(200).json({
      success: true,
      data: people.map((p) => ({ _id: p._id, adminId: p.adminId, employeeId: p.employeeId, name: `${p.firstName} ${p.lastName}`.trim() })),
    });
  } catch (error) {
    logger.error('Error listing audit employees:', error);
    next(error);
  }
};
