// "View as client / employee" for Super Admins (utils/portalPreview.js).
// Mounted at /api/admin/portal-preview.
const express = require('express');
const mongoose = require('mongoose');
const authMiddleware = require('../middleware/authMiddleware');
const requirePermission = require('../middleware/requirePermission');
const Client = require('../models/Client');
const Employee = require('../models/Employee');
const Admin = require('../models/Admin');
const { signPreview, PREVIEW_TTL } = require('../utils/portalPreview');
const { recordAudit } = require('../services/audit');
const logger = require('../utils/logger');

const router = express.Router();
router.use(authMiddleware, requirePermission('*'));

const isId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * @route  POST /api/admin/portal-preview/client/:id
 * @desc   A 30-minute, read-only token to open the Client Portal as this client.
 */
router.post('/client/:id', async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ success: false, message: 'Client not found' });
    const client = await Client.findById(req.params.id).select('businessName clientId isActive deletedAt tokenVersion').lean();
    if (!client) return res.status(404).json({ success: false, message: 'Client not found' });
    if (!client.isActive || client.deletedAt) {
      return res.status(409).json({ success: false, message: 'This client cannot log in (suspended or archived), so there is no portal to preview.' });
    }
    const token = signPreview({ kind: 'client', id: client._id, tv: client.tokenVersion || 0, by: req.user._id });
    await recordAudit(req, 'PORTAL_PREVIEW', 'Client', client.clientId || client._id, null, { portal: 'client', businessName: client.businessName });
    res.json({ success: true, data: { token, expiresIn: PREVIEW_TTL, name: client.businessName } });
  } catch (error) {
    logger.error('Client portal preview error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @route  POST /api/admin/portal-preview/employee/:id   (Employee id, or the login's Admin id)
 * @desc   A 30-minute, read-only token to open the Employee Portal as this person.
 */
router.post('/employee/:id', async (req, res) => {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ success: false, message: 'Employee not found' });
    const employee = await Employee.findById(req.params.id).select('adminId firstName lastName employeeId').lean();
    const login = await Admin.findById(employee?.adminId || req.params.id).select('firstName lastName employeeId isActive').populate('roles', 'isEmployeeRole permissions').lean();
    if (!login) return res.status(404).json({ success: false, message: 'This employee has no portal login.' });
    if (!login.isActive) return res.status(409).json({ success: false, message: "This employee's access is deactivated, so there is no portal to preview." });
    const hasPortal = Boolean(login.employeeId) || (login.roles || []).some((r) => r.isEmployeeRole || (r.permissions || []).includes('ess.access'));
    if (!hasPortal) return res.status(409).json({ success: false, message: 'This login does not use the Employee Portal.' });

    const name = [login.firstName, login.lastName].filter(Boolean).join(' ');
    const token = signPreview({ kind: 'employee', id: login._id, by: req.user._id });
    await recordAudit(req, 'PORTAL_PREVIEW', 'Employee', login.employeeId || login._id, null, { portal: 'employee', name });
    res.json({ success: true, data: { token, expiresIn: PREVIEW_TTL, name } });
  } catch (error) {
    logger.error('Employee portal preview error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
