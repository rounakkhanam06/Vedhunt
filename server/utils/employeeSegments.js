/**
 * Employee segments — the "department / segment" axis of the Employee Portal.
 * A role's permissions decide which modules exist for someone (leads.view →
 * lead pipeline, etc.); the segment decides which workflows and KPIs a
 * shared module (Dashboard, Performance) shows inside it.
 *
 * Kept free of model imports so Role.js can require it without a cycle.
 */
const SEGMENTS = ['BD', 'Marketing', 'Technology', 'Operations', 'Management', 'General'];

// Used when a role predates the `segment` field (or an admin never set one).
const DEFAULT_ROLE_SEGMENTS = {
  BDE: 'BD',
  DIGITAL_MARKETING_EXECUTIVE: 'Marketing',
  DEVELOPER: 'Technology',
  HR: 'Operations',
  EMPLOYEE: 'General',
  PROJECT_MANAGER: 'Technology',
  MIS_FINANCE: 'Operations',
  DIRECTOR: 'Management',
};

/**
 * The segment for a user's (populated) roles. People often hold the generic
 * EMPLOYEE role *plus* a specific one (EMPLOYEE + BDE), so a specific
 * segment always beats 'General': explicit role segments first, then the
 * default for well-known role names, then "has leads.view" → BD.
 */
function resolveSegment(roles = []) {
  const specific = (segment) => segment && segment !== 'General' && SEGMENTS.includes(segment);
  const explicit = roles.map((r) => r?.segment).find(specific);
  if (explicit) return explicit;
  const byName = roles.map((r) => DEFAULT_ROLE_SEGMENTS[r?.name]).find(specific);
  if (byName) return byName;
  if (roles.some((role) => role?.permissions?.includes('leads.view'))) return 'BD';
  return 'General';
}

// Employee Portal modules an admin can switch on/off per role (Role Manager).
// Keys match client/src/employee/config/modules.js. Dashboard and My Profile
// are always shown; lead modules additionally need their permission.
const PORTAL_MODULES = [
  { key: 'raw-leads', label: 'Raw Leads' },
  { key: 'working-leads', label: 'Working Leads' },
  { key: 'followups', label: 'Follow-ups' },
  { key: 'attendance', label: 'Attendance & Leave' },
  { key: 'tasks', label: 'My Tasks' },
  { key: 'timesheet', label: 'My Timesheet' },
  { key: 'payslips', label: 'My Payslips' },
  { key: 'performance', label: 'My Performance' },
  { key: 'tickets', label: 'Assigned Tickets' },
  { key: 'projects', label: 'My Projects' },
];
const PORTAL_MODULE_KEYS = PORTAL_MODULES.map((m) => m.key);

/**
 * Modules the person's roles switch on, or null when none of their roles
 * restricts modules (then the portal's built-in defaults apply).
 */
function resolvePortalModules(roles = []) {
  const configured = roles.filter((r) => Array.isArray(r?.portalModules) && r.portalModules.length);
  if (!configured.length) return null;
  return [...new Set(configured.flatMap((r) => r.portalModules))].filter((k) => PORTAL_MODULE_KEYS.includes(k));
}

module.exports = { SEGMENTS, DEFAULT_ROLE_SEGMENTS, PORTAL_MODULES, PORTAL_MODULE_KEYS, resolveSegment, resolvePortalModules };
