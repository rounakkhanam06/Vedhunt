const Role = require('../models/Role');

/**
 * The standard set of Employee-Portal-facing roles. Every one of these is
 * flagged isEmployeeRole: true, which is what makes it show up in the
 * Employee Manager's role picker and lets accounts holding it into the
 * Employee Portal (see employeeAuthMiddleware.js / employeeAuthRoutes.js)
 * while keeping it out of the Admin panel (see routes/auth.js).
 *
 * `ess.access` is the baseline every employee role carries — it's what
 * ties an Admin account to "this is an employee account" for permission
 * purposes; module-specific permissions (leads.view, followups.view, ...)
 * are added on top for roles that need them.
 */
const DEFAULT_EMPLOYEE_ROLES = [
  {
    name: 'EMPLOYEE',
    label: 'Employee',
    description: 'Default role for employees. Access limited to the ESS portal.',
    permissions: ['ess.access'],
    isSystem: true
  },
  {
    name: 'BDE',
    label: 'Business Development Executive',
    description: 'Business Development Executive — views and works only their own assigned leads.',
    permissions: ['ess.access', 'leads.view', 'followups.view']
  },
  {
    name: 'DIGITAL_MARKETING_EXECUTIVE',
    label: 'Digital Marketing Executive',
    description: 'Digital Marketing Executive.',
    permissions: ['ess.access']
  },
  {
    name: 'DEVELOPER',
    label: 'Developer',
    description: 'Developer.',
    permissions: ['ess.access']
  },
  {
    name: 'HR',
    label: 'HR',
    description: 'Human Resources.',
    permissions: ['ess.access']
  }
];

/**
 * Idempotent — get-or-create each default employee role. An existing role
 * (e.g. BDE, created earlier by seedBDTeam.js before this baseline existed)
 * keeps any custom permissions an admin has added since via Team
 * Management/RBAC — this only unions in the baseline permissions it's
 * missing, never removes one, and always (re)stamps isEmployeeRole/label so
 * a role created before those fields existed still gets picked up.
 */
async function ensureDefaultEmployeeRoles() {
  for (const def of DEFAULT_EMPLOYEE_ROLES) {
    const existing = await Role.findOne({ name: def.name });
    if (existing) {
      const missingPerms = def.permissions.filter(p => !existing.permissions.includes(p));
      const needsUpdate = !existing.isEmployeeRole || !existing.label || missingPerms.length > 0;
      if (needsUpdate) {
        existing.isEmployeeRole = true;
        if (!existing.label) existing.label = def.label;
        if (missingPerms.length > 0) existing.permissions = [...existing.permissions, ...missingPerms];
        await existing.save();
      }
      continue;
    }
    await Role.create({ ...def, isEmployeeRole: true });
  }
}

module.exports = { ensureDefaultEmployeeRoles, DEFAULT_EMPLOYEE_ROLES };
