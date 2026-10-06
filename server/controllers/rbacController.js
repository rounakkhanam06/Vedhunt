const Role = require('../models/Role');
const AuditLog = require('../models/AuditLog');
const logger = require('../utils/logger');
const { SEGMENTS, PORTAL_MODULES, PORTAL_MODULE_KEYS } = require('../utils/employeeSegments');

// Unknown keys are dropped; an empty list means "use the portal defaults".
const cleanPortalModules = (value) =>
  (Array.isArray(value) ? [...new Set(value.filter((k) => PORTAL_MODULE_KEYS.includes(k)))] : undefined);

// Available permissions in the system
const PERMISSIONS = [
  'team.manage',
  'roles.manage',
  'services.manage',
  'portfolio.manage',
  'cms.manage',
  'pricing.manage',
  'careers.manage',
  'legal.manage',
  'leads.view',
  'leads.viewAll',
  'leads.assign',
  'followups.view',
  'settings.manage',
  'payroll.manage',
  'ess.access'
];

exports.getPermissions = (req, res) => {
  res.json({ success: true, permissions: PERMISSIONS, segments: SEGMENTS, portalModules: PORTAL_MODULES });
};

exports.getRoles = async (req, res) => {
  try {
    const roles = await Role.find({});
    res.json({ success: true, roles });
  } catch (error) {
    logger.error('Error fetching roles:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.createRole = async (req, res) => {
  try {
    const { name, description, permissions } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Role name is required' });
    }

    const roleExists = await Role.findOne({ name: name.toUpperCase() });
    if (roleExists) {
      return res.status(400).json({ success: false, message: 'Role already exists' });
    }

    // Check if user has all the permissions they are trying to assign
    const userPerms = req.user.permissions;
    if (!userPerms.includes('*')) {
      for (const p of (permissions || [])) {
        if (!userPerms.includes(p)) {
          return res.status(403).json({ success: false, message: `Cannot grant permission you don't have: ${p}` });
        }
      }
    }

    // A role holding the '*' wildcard must never be flagged isEmployeeRole —
    // that flag is what lets the Employee Manager assign a role directly
    // (see routes/employeeRoutes.js), and an HRMS-created account must never
    // be able to end up with full admin access.
    const finalPermissions = permissions || [];
    const isEmployeeRole = Boolean(req.body.isEmployeeRole) && !finalPermissions.includes('*');

    const role = await Role.create({
      name: name.toUpperCase(),
      label: req.body.label || name,
      description,
      permissions: finalPermissions,
      isEmployeeRole,
      segment: SEGMENTS.includes(req.body.segment) ? req.body.segment : undefined,
      portalModules: cleanPortalModules(req.body.portalModules),
    });

    await AuditLog.create({
      adminId: req.user._id,
      action: 'ROLE_CREATE',
      resource: 'Role',
      afterSnapshot: role.toObject(),
      ipAddress: req.ip
    });

    res.status(201).json({ success: true, role });
  } catch (error) {
    logger.error('Error creating role:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.updateRole = async (req, res) => {
  try {
    const { description, permissions, isEmployeeRole, label } = req.body;
    const roleId = req.params.id;

    const role = await Role.findById(roleId);
    if (!role) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }

    if (role.name === 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Cannot modify the SUPER_ADMIN role' });
    }

    // Privilege escalation check
    const userPerms = req.user.permissions;
    if (!userPerms.includes('*')) {
      for (const p of (permissions || [])) {
        if (!userPerms.includes(p)) {
          return res.status(403).json({ success: false, message: `Cannot grant permission you don't have: ${p}` });
        }
      }
    }

    const beforeSnapshot = role.toObject();

    role.description = description !== undefined ? description : role.description;
    role.permissions = permissions !== undefined ? permissions : role.permissions;
    role.label = label !== undefined ? label : role.label;
    if (isEmployeeRole !== undefined) {
      role.isEmployeeRole = Boolean(isEmployeeRole);
    }
    if (req.body.segment !== undefined) {
      role.segment = SEGMENTS.includes(req.body.segment) ? req.body.segment : undefined;
    }
    if (req.body.portalModules !== undefined) {
      role.portalModules = cleanPortalModules(req.body.portalModules);
    }
    // Same wildcard guard as createRole — never let a '*' role be pickable
    // from the Employee Manager.
    if (role.permissions.includes('*')) {
      role.isEmployeeRole = false;
    }

    await role.save();

    await AuditLog.create({
      adminId: req.user._id,
      action: 'ROLE_UPDATE',
      resource: 'Role',
      beforeSnapshot,
      afterSnapshot: role.toObject(),
      ipAddress: req.ip
    });

    res.json({ success: true, role });
  } catch (error) {
    logger.error('Error updating role:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.deleteRole = async (req, res) => {
  try {
    const roleId = req.params.id;

    const role = await Role.findById(roleId);
    if (!role) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }

    if (role.isSystem) {
      return res.status(403).json({ success: false, message: 'Cannot delete system roles' });
    }

    const beforeSnapshot = role.toObject();

    await Role.deleteOne({ _id: roleId });

    await AuditLog.create({
      adminId: req.user._id,
      action: 'ROLE_DELETE',
      resource: 'Role',
      beforeSnapshot,
      ipAddress: req.ip
    });

    res.json({ success: true, message: 'Role deleted' });
  } catch (error) {
    logger.error('Error deleting role:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
