const Admin = require('../models/Admin');
const { permissionsOf, missingGrants, ADMIN_PANEL_PERMISSIONS } = require('../config/permissions');
const { grantsOf, grantableActions } = require('../config/pageAccess');

/**
 * "You can't act on an account that has access you don't have."
 *
 * Resetting someone's password, changing their email, deactivating, demoting
 * or deleting them is only allowed when the actor holds every Admin-panel
 * permission the target's roles hold, and could hand out every person-wise
 * grant the target has. Otherwise the actor could take the account over and
 * use access they were never given. Portal-only permissions (own leads,
 * follow-ups, portal access) don't count — HR still manages BDEs.
 *
 * Returns an error message, or null when the action is allowed.
 */
async function outranksActor(actor, targetAdminId) {
  if (!targetAdminId) return null;
  if ((actor?.permissions || []).includes('*')) return null;
  const target = await Admin.findById(targetAdminId, { roles: 1, accessGrants: 1, crmGrants: 1 })
    .populate('roles', 'name permissions').lean();
  if (!target) return null;

  const targetPerms = permissionsOf(target.roles).filter((p) => p === '*' || ADMIN_PANEL_PERMISSIONS.includes(p));
  const missing = missingGrants(actor.permissions || [], targetPerms);
  const grantGaps = grantsOf(target)
    .filter((g) => !(g.actions || []).every((a) => grantableActions(actor, g.page).includes(a)))
    .map((g) => `${g.page} page access`);
  const gaps = [...missing.map((p) => (p === '*' ? 'Super Admin' : p)), ...grantGaps];
  return gaps.length
    ? `This account has access you don't have (${gaps.join(', ')}), so only someone with that access can change it.`
    : null;
}

module.exports = { outranksActor };
