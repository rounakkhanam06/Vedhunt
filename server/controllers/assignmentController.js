const Admin = require('../models/Admin');
const Settings = require('../models/Settings');
const AssignmentRule = require('../models/AssignmentRule');
const logger = require('../utils/logger');
const { getBDERole, activeLeadCount } = require('../services/leadAssignment');

// @desc    List BD team members (dynamically, from the DB — not hardcoded)
// @route   GET /api/admin/assignment/bds
// @access  Private (leads.assign)
exports.getAssignableBDs = async (req, res, next) => {
  try {
    const bdeRole = await getBDERole();
    const bds = await Admin.find({ roles: bdeRole._id, isActive: true }).select('firstName lastName email');

    const withWorkload = await Promise.all(
      bds.map(async (bd) => ({
        _id: bd._id,
        firstName: bd.firstName,
        lastName: bd.lastName,
        email: bd.email,
        activeLeadCount: await activeLeadCount(bd._id)
      }))
    );

    res.status(200).json({ success: true, data: withWorkload });
  } catch (error) {
    logger.error('Error fetching assignable BDs:', error);
    next(error);
  }
};

// @desc    Get the auto-assign (round-robin) toggle
// @route   GET /api/admin/assignment/settings
// @access  Private (leads.assign)
exports.getAssignmentSettings = async (req, res, next) => {
  try {
    const settings = await Settings.findOne({ key: 'lead_assignment' });
    res.status(200).json({ success: true, data: settings?.value || { autoAssignEnabled: false } });
  } catch (error) {
    logger.error('Error fetching assignment settings:', error);
    next(error);
  }
};

// @desc    Update the auto-assign (round-robin) toggle
// @route   PUT /api/admin/assignment/settings
// @access  Private (leads.assign)
exports.updateAssignmentSettings = async (req, res, next) => {
  try {
    const autoAssignEnabled = !!req.body.autoAssignEnabled;
    const settings = await Settings.findOneAndUpdate(
      { key: 'lead_assignment' },
      { key: 'lead_assignment', value: { autoAssignEnabled } },
      { upsert: true, new: true }
    );
    res.status(200).json({ success: true, data: settings.value });
  } catch (error) {
    logger.error('Error updating assignment settings:', error);
    next(error);
  }
};

// @desc    List round-robin routing rules
// @route   GET /api/admin/assignment/rules
// @access  Private (leads.assign)
exports.listRules = async (req, res, next) => {
  try {
    const rules = await AssignmentRule.find({})
      .sort({ priority: 1, createdAt: 1 })
      .populate('bdPool', 'firstName lastName email');
    res.status(200).json({ success: true, data: rules });
  } catch (error) {
    logger.error('Error listing assignment rules:', error);
    next(error);
  }
};

// @desc    Create a round-robin routing rule
// @route   POST /api/admin/assignment/rules
// @access  Private (leads.assign)
exports.createRule = async (req, res, next) => {
  try {
    const { name, active, priority, matchService, matchSource, bdPool, maxActiveLeads } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Please provide a rule name' });
    }
    const rule = await AssignmentRule.create({
      name,
      active: active !== undefined ? !!active : true,
      priority: priority || 0,
      matchService: matchService || '',
      matchSource: matchSource || '',
      bdPool: Array.isArray(bdPool) ? bdPool : [],
      maxActiveLeads: maxActiveLeads === '' || maxActiveLeads == null ? null : Number(maxActiveLeads)
    });
    res.status(201).json({ success: true, data: rule });
  } catch (error) {
    logger.error('Error creating assignment rule:', error);
    next(error);
  }
};

// @desc    Update a round-robin routing rule
// @route   PUT /api/admin/assignment/rules/:id
// @access  Private (leads.assign)
exports.updateRule = async (req, res, next) => {
  try {
    const allowedUpdates = ['name', 'active', 'priority', 'matchService', 'matchSource', 'bdPool', 'maxActiveLeads'];
    const updates = {};
    for (const key of allowedUpdates) {
      if (key in req.body) updates[key] = req.body[key];
    }
    if ('maxActiveLeads' in updates && (updates.maxActiveLeads === '' || updates.maxActiveLeads == null)) {
      updates.maxActiveLeads = null;
    }

    const rule = await AssignmentRule.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!rule) {
      return res.status(404).json({ success: false, message: 'Rule not found' });
    }
    res.status(200).json({ success: true, data: rule });
  } catch (error) {
    logger.error('Error updating assignment rule:', error);
    next(error);
  }
};

// @desc    Delete a round-robin routing rule
// @route   DELETE /api/admin/assignment/rules/:id
// @access  Private (leads.assign)
exports.deleteRule = async (req, res, next) => {
  try {
    const rule = await AssignmentRule.findByIdAndDelete(req.params.id);
    if (!rule) {
      return res.status(404).json({ success: false, message: 'Rule not found' });
    }
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    logger.error('Error deleting assignment rule:', error);
    next(error);
  }
};
