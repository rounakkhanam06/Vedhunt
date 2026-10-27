/**
 * Every permission a role can be given in Role Management, grouped the way
 * the Role Manager shows them. Each admin page/API checks exactly one of
 * these (see client/src/routes/index.jsx and the requirePermission calls), so
 * any page can be granted to any role. '*' (Super Admin) is not listed — it
 * can't be handed out from here.
 *
 * `adminPanel: false` marks permissions that only matter inside the Employee
 * Portal (BD lead work, portal access) — an HRMS-created account needs at
 * least one *other* permission to be let into the Admin panel (routes/auth.js).
 */
const PERMISSION_GROUPS = [
  {
    group: 'Leads & Sales',
    permissions: [
      { key: 'leads.view', label: 'Leads (own / raw / working)', adminPanel: false },
      { key: 'leads.viewAll', label: 'All Leads (every BDE)' },
      { key: 'leads.assign', label: 'Lead Assignment, Activity & Follow-up reports' },
      { key: 'leads.import', label: 'Import Leads (CSV / Excel)' },
      { key: 'leads.delete', label: 'Delete Leads' },
      { key: 'leads.reactivate', label: 'Reactivate Dropped / Lost Leads', adminPanel: false },
      { key: 'followups.view', label: 'Follow-Ups', adminPanel: false },
      { key: 'team.performance', label: 'BDE Team Performance (all BDEs)' },
    ],
  },
  {
    group: 'HR (HRMS)',
    permissions: [
      { key: 'employees.view', label: 'Employees List (view, IDs masked)' },
      { key: 'employees.manage', label: 'Add / Edit / Delete Employees' },
      { key: 'employees.sensitive', label: 'Employee PAN, Aadhaar, Bank & Salary' },
      { key: 'leave.manage', label: 'Leave Requests' },
      { key: 'attendance.manage', label: 'Attendance Roster & Correction Requests' },
      { key: 'bankchanges.manage', label: 'Bank Change Requests' },
      { key: 'tasks.manage', label: 'Organization Tasks' },
      { key: 'performance.manage', label: 'Performance Cycles, KPI Goals & Matrix' },
      { key: 'holidays.manage', label: 'Holiday Calendar' },
      { key: 'payroll.manage', label: 'Payroll & Payslips' },
      { key: 'ess.manage', label: 'Productivity Reports (all staff)' },
    ],
  },
  {
    group: 'Administration',
    permissions: [
      { key: 'team.manage', label: 'Team Management (admin logins)' },
      { key: 'roles.manage', label: 'Role Management' },
      { key: 'settings.manage', label: 'Settings' },
      { key: 'audit.view', label: 'Audit & Logs' },
      { key: 'dashboard.management', label: 'Leads Overview' },
      { key: 'finance.view', label: 'Revenue & Earnings (Overview dashboard)' },
    ],
  },
  {
    group: 'Website & Client Portal',
    permissions: [
      { key: 'cms.manage', label: 'Content Manager (CMS) & Client Portal (CRM)' },
      // Viewing the KPI report comes with access to the client; changing it needs this
      { key: 'kpi.manage', label: 'Client KPI — edit setup, budgets & report entries' },
      { key: 'newsletter.manage', label: 'Newsletter Subscribers (view, manage, broadcast)' },
      { key: 'services.manage', label: 'Services Management' },
      { key: 'portfolio.manage', label: 'Portfolio Items' },
      { key: 'pricing.manage', label: 'Pricing Management' },
      { key: 'careers.manage', label: 'Careers CMS' },
      { key: 'legal.manage', label: 'Legal & Compliance' },
    ],
  },
  {
    group: 'Employee Portal',
    permissions: [
      { key: 'ess.access', label: 'Employee Portal Access (ESS)', adminPanel: false },
    ],
  },
];

const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap((g) => g.permissions);
const PERMISSIONS = ALL_PERMISSIONS.map((p) => p.key);
const ADMIN_PANEL_PERMISSIONS = ALL_PERMISSIONS.filter((p) => p.adminPanel !== false).map((p) => p.key);

// What `team.manage` used to cover before HR was split out — the one-time
// migration in utils/permissionMigration.js gives these to every role that
// had team.manage, so nobody loses access.
const LEGACY_TEAM_MANAGE = [
  'employees.view', 'employees.manage', 'employees.sensitive', 'leave.manage', 'attendance.manage',
  'bankchanges.manage', 'tasks.manage', 'performance.manage',
];

/** Flattened permissions of a user's (populated) roles. */
function permissionsOf(roles = []) {
  const set = new Set();
  for (const role of roles || []) {
    for (const perm of role?.permissions || []) set.add(perm);
  }
  return [...set];
}

const hasPermission = (perms = [], key) => perms.includes('*') || perms.includes(key);

/** True when the roles grant anything usable in the Admin panel. */
const grantsAdminPanel = (perms = []) => perms.includes('*') || perms.some((p) => ADMIN_PANEL_PERMISSIONS.includes(p));

/**
 * True for a login that belongs in the Employee Portal only: every role is
 * an employee role and none of them grants an Admin-panel permission. Such
 * a login is refused by the Admin login (routes/auth.js) and by every Admin
 * API (authMiddleware.js) — portal tokens are signed the same way, so the
 * API check is what keeps a portal token out of the Admin APIs.
 */
const isPortalOnly = (roles = []) => {
  const hasPortalOnlyRole = roles?.some((role) => role?.isEmployeeRole);
  const hasAdminRole = roles?.some((role) => role && !role.isEmployeeRole);
  return Boolean(hasPortalOnlyRole && !hasAdminRole && !grantsAdminPanel(permissionsOf(roles)));
};

/**
 * The permissions in `rolePerms` that `granterPerms` doesn't hold — a user
 * can only hand out (assign/create) access they have themselves.
 */
const missingGrants = (granterPerms = [], rolePerms = []) =>
  granterPerms.includes('*') ? [] : rolePerms.filter((p) => !granterPerms.includes(p));

module.exports = {
  PERMISSION_GROUPS,
  PERMISSIONS,
  ADMIN_PANEL_PERMISSIONS,
  LEGACY_TEAM_MANAGE,
  permissionsOf,
  hasPermission,
  grantsAdminPanel,
  isPortalOnly,
  missingGrants,
};
