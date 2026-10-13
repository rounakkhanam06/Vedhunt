const mongoose = require('mongoose');
const Role = require('../models/Role');
const { permissionsOf, missingGrants } = require('../config/permissions');

/**
 * Error message when `user` tries to assign roles carrying permissions they
 * don't hold themselves (Team Management / Employee Manager), else null —
 * so an HR or admin login can't promote anyone, including itself, past its
 * own access. Super Admins ('*') may assign anything.
 */
async function grantError(user, roleIds = []) {
  const ids = (Array.isArray(roleIds) ? roleIds : [roleIds]).filter((id) => mongoose.Types.ObjectId.isValid(id));
  if (!ids.length || user?.permissions?.includes('*')) return null;
  const roles = await Role.find({ _id: { $in: ids } }, { name: 1, permissions: 1 }).lean();
  const missing = missingGrants(user?.permissions || [], permissionsOf(roles));
  if (!missing.length) return null;
  return `You can't assign a role with access you don't have yourself (${missing.join(', ')}).`;
}

module.exports = { grantError };
