const Role = require('../models/Role');
const AuditLog = require('../models/AuditLog');
const logger = require('../utils/logger');

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
  'settings.manage'
];

exports.getPermissions = (req, res) => {
  res.json({ success: true, permissions: PERMISSIONS });
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

    const role = await Role.create({
      name: name.toUpperCase(),
      description,
      permissions: permissions || []
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
    const { description, permissions } = req.body;
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
