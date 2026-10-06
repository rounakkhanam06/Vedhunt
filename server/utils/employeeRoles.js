const Role = require('../models/Role');
const Settings = require('../models/Settings');
const { DEFAULT_ROLE_SEGMENTS } = require('./employeeSegments');

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
  },
  {
    name: 'PROJECT_MANAGER',
    label: 'Project Manager',
    description: 'Project Manager / Technology — projects, tasks, tickets and delivery.',
    permissions: ['ess.access']
  },
  {
    name: 'MIS_FINANCE',
    label: 'MIS / Finance / Operations',
    description: 'MIS, finance and operations — assigned tasks, reports and operational workflows.',
    permissions: ['ess.access']
  },
  {
    name: 'DIRECTOR',
    label: 'Director / Management',
    description: 'Director / management — company-level visibility as granted by permission.',
    permissions: ['ess.access']
  }
];

// Names of the defaults already seeded. Each default is seeded exactly once:
// after that the role belongs to the admin (Role Manager) — edits and even
// deletions stick across restarts instead of being "repaired" here.
const SEEDED_KEY = 'employee_roles_seeded';
// The original five, which the old start-up code always treated as employee roles.
const LEGACY_EMPLOYEE_ROLES = ['EMPLOYEE', 'BDE', 'DIGITAL_MARKETING_EXECUTIVE', 'DEVELOPER', 'HR'];

async function ensureDefaultEmployeeRoles() {
  const record = await Settings.findOne({ key: SEEDED_KEY }).lean();
  const seeded = new Set(record?.value || []);
  const pending = DEFAULT_EMPLOYEE_ROLES.filter((def) => !seeded.has(def.name));
  if (!pending.length) return;

  for (const def of pending) {
    const existing = await Role.findOne({ name: def.name });
    if (existing && (!existing.isEmployeeRole || existing.permissions.includes('*')) && !LEGACY_EMPLOYEE_ROLES.includes(def.name)) {
      // A same-named Admin-panel role already exists — leave it exactly as it is.
    } else if (existing) {
      // Created before this seeding existed — fill in only what it lacks, once.
      let changed = false;
      if (!existing.isEmployeeRole) { existing.isEmployeeRole = true; changed = true; }
      if (!existing.label) { existing.label = def.label; changed = true; }
      if (!existing.segment && DEFAULT_ROLE_SEGMENTS[def.name]) { existing.segment = DEFAULT_ROLE_SEGMENTS[def.name]; changed = true; }
      const missingPerms = def.permissions.filter((p) => !existing.permissions.includes(p));
      if (missingPerms.length) { existing.permissions = [...existing.permissions, ...missingPerms]; changed = true; }
      if (changed) await existing.save();
    } else {
      await Role.create({ ...def, isEmployeeRole: true, segment: DEFAULT_ROLE_SEGMENTS[def.name] });
    }
    seeded.add(def.name);
  }
  await Settings.findOneAndUpdate({ key: SEEDED_KEY }, { $set: { value: [...seeded] } }, { upsert: true });
}

module.exports = { ensureDefaultEmployeeRoles, DEFAULT_EMPLOYEE_ROLES };
