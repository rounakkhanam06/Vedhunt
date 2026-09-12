const express = require('express');
const Admin = require('../models/Admin');
const Role = require('../models/Role');
const AuditLog = require('../models/AuditLog');
const authMiddleware = require('../middleware/authMiddleware');
const requirePermission = require('../middleware/requirePermission');
const logger = require('../utils/logger');

const router = express.Router();

// All team routes require authentication
router.use(authMiddleware);

// Employee-type accounts (any role flagged isEmployeeRole — EMPLOYEE, BDE,
// or a custom role created that way in Role Management) must be created via
// POST /api/employees, which also creates the linked Employee HR profile
// (attendance, payroll, ESS access). Creating them here would leave a login
// with no profile, breaking every Employee Portal page. Driven off the flag
// (not a hardcoded name list) so it stays correct as new employee roles are
// added — see Role.isEmployeeRole and utils/employeeRoles.js.
const assignsEmployeeRole = async (roleIds) => {
  if (!roleIds || roleIds.length === 0) return false;
  const employeeRoles = await Role.find({ isEmployeeRole: true }).select('_id');
  const employeeRoleIds = new Set(employeeRoles.map(r => r._id.toString()));
  return roleIds.some(id => employeeRoleIds.has(id.toString()));
};

// Accounts created from the Employee Manager (HRMS) carry an employeeId and
// have a linked Employee HR document — Team Management must not touch them
// (changing their roles or deleting the login here would desync them from
// that Employee record, or delete the login while leaving the Employee
// document orphaned). Those accounts are managed exclusively from
// /admin/employees, whose DELETE route removes both records together.
const isEmployeeManagedAccount = (admin) => Boolean(admin.employeeId);

// @route   GET /api/team
// @desc    Get all admins
// @access  Private
router.get('/', requirePermission('team.manage'), async (req, res) => {
  try {
    const admins = await Admin.find({}).select('-password').populate('roles');
    res.json({ success: true, admins });
  } catch (error) {
    logger.error('Error fetching team:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/team
// @desc    Create a new admin
// @access  Private
router.post('/', requirePermission('team.manage'), async (req, res) => {
  try {
    const { firstName, lastName, email, password, roles } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide first name, last name, email and password' });
    }

    const adminExists = await Admin.findOne({ email });
    if (adminExists) {
      return res.status(400).json({ success: false, message: 'Admin already exists' });
    }

    // Default to EDITOR role if none provided
    let assignedRoles = roles;
    if (!roles || roles.length === 0) {
      const defaultRole = await Role.findOne({ name: 'EDITOR' });
      if (defaultRole) {
        assignedRoles = [defaultRole._id];
      }
    }

    if (await assignsEmployeeRole(assignedRoles)) {
      return res.status(400).json({ success: false, message: 'Employee accounts must be created from the Employee Manager, not Team Management.' });
    }

    // Super Admin assignment check
    if (assignedRoles && assignedRoles.length > 0) {
      const superAdminRole = await Role.findOne({ name: 'SUPER_ADMIN' });
      if (superAdminRole && assignedRoles.includes(superAdminRole._id.toString())) {
        if (!req.user.permissions.includes('*')) {
          return res.status(403).json({ success: false, message: 'Only Super Admins can assign the SUPER_ADMIN role' });
        }
      }
    }

    const admin = await Admin.create({
      firstName,
      lastName,
      email,
      password,
      roles: assignedRoles || []
    });

    const populatedAdmin = await Admin.findById(admin._id).select('-password').populate('roles');

    await AuditLog.create({
      adminId: req.user._id,
      action: 'USER_CREATE',
      resource: 'Admin',
      afterSnapshot: populatedAdmin.toObject(),
      ipAddress: req.ip
    });

    res.status(201).json({
      success: true,
      admin: populatedAdmin
    });
  } catch (error) {
    logger.error('Error creating admin:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/team/:id
// @desc    Update admin (roles, isActive)
// @access  Private
router.put('/:id', requirePermission('team.manage'), async (req, res) => {
  try {
    const { roles, isActive } = req.body;
    const adminId = req.params.id;

    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }

    if (isEmployeeManagedAccount(admin)) {
      return res.status(400).json({ success: false, message: 'This is an HRMS employee account — manage its role from Employee Manager (admin/employees), not Team Management.' });
    }

    const beforeSnapshot = admin.toObject();

    if (roles !== undefined) {
      // Block granting an employee-type role here — a pure admin account
      // must never pick one up (see assignsEmployeeRole above).
      const wantsEmployeeRole = await assignsEmployeeRole(roles);
      if (wantsEmployeeRole) {
        return res.status(400).json({ success: false, message: 'Employee accounts must be created from the Employee Manager, not Team Management.' });
      }

      // Super Admin assignment check
      const superAdminRole = await Role.findOne({ name: 'SUPER_ADMIN' });
      const wantsToAssignSuperAdmin = superAdminRole && roles.includes(superAdminRole._id.toString());
      const hasSuperAdminCurrently = superAdminRole && admin.roles.includes(superAdminRole._id);

      if (wantsToAssignSuperAdmin && !hasSuperAdminCurrently) {
        if (!req.user.permissions.includes('*')) {
          return res.status(403).json({ success: false, message: 'Only Super Admins can assign the SUPER_ADMIN role' });
        }
      }

      if (hasSuperAdminCurrently && !wantsToAssignSuperAdmin) {
         if (!req.user.permissions.includes('*')) {
          return res.status(403).json({ success: false, message: 'Only Super Admins can remove the SUPER_ADMIN role' });
        }
      }

      admin.roles = roles;
    }

    if (isActive !== undefined) {
      admin.isActive = isActive;
    }

    await admin.save({ validateBeforeSave: false });

    const populatedAdmin = await Admin.findById(admin._id).select('-password').populate('roles');

    await AuditLog.create({
      adminId: req.user._id,
      action: 'USER_UPDATE',
      resource: 'Admin',
      beforeSnapshot,
      afterSnapshot: populatedAdmin.toObject(),
      ipAddress: req.ip
    });

    res.json({ success: true, admin: populatedAdmin });
  } catch (error) {
    logger.error('Error updating admin:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   DELETE /api/team/:id
// @desc    Delete admin
// @access  Private
router.delete('/:id', requirePermission('team.manage'), async (req, res) => {
  try {
    const adminId = req.params.id;
    
    // Prevent deleting oneself
    if (adminId === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot delete yourself' });
    }

    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }

    if (isEmployeeManagedAccount(admin)) {
      return res.status(400).json({ success: false, message: 'This is an HRMS employee account — delete it from Employee Manager (admin/employees) so the linked HR record is removed too.' });
    }

    const superAdminRole = await Role.findOne({ name: 'SUPER_ADMIN' });
    if (superAdminRole && admin.roles.includes(superAdminRole._id)) {
      if (!req.user.permissions.includes('*')) {
        return res.status(403).json({ success: false, message: 'Only Super Admins can delete a Super Admin' });
      }
    }

    const beforeSnapshot = admin.toObject();

    await Admin.deleteOne({ _id: adminId });

    await AuditLog.create({
      adminId: req.user._id,
      action: 'USER_DELETE',
      resource: 'Admin',
      beforeSnapshot,
      ipAddress: req.ip
    });

    res.json({ success: true, message: 'Admin removed' });
  } catch (error) {
    logger.error('Error deleting admin:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
