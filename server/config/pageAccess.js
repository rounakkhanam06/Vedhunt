/**
 * Person-wise page access ("access grants").
 *
 * On top of their role, a login can be granted individual pages with
 * individual actions, limited to a data scope. Grants are stored on
 * Admin.accessGrants, managed from Admin → Employees, and the pages open in
 * the Employee Portal (never the Admin panel).
 *
 * A page's access is the broader of two things:
 *   - the role: `roleScope(user, action)` — 'all' for full access, 'own' for
 *     the role's built-in own-data access (leads.view = own leads), or null;
 *   - the person's grant for that action, with its scope.
 * So a grant only ever adds access, and every role keeps exactly what it had.
 *
 * Scope types (what a grant can be limited to):
 *   client   → 'clients' (records whose client_ref is listed) | 'all'
 *   lead     → 'own' | 'team' (their reporting tree) | 'all'
 *   employee → 'reports' | 'departments' | 'all'   (Phase 4)
 *   global   → 'all'                               (Phase 5)
 *
 * Never grantable (stay role-only, since each one can be used to hand out more
 * access): Role Management, Team Management, Settings, Facebook Integration.
 * Lead import also stays role-only. Sensitive HR data (PAN, Aadhaar, bank,
 * salary) will be its own action, never implied by View (Phase 4).
 */
const mongoose = require('mongoose');

const SCOPE_MODES = {
  client: ['all', 'clients'],
  lead: ['own', 'team', 'all'],
  employee: ['reports', 'departments', 'all'],
  global: ['all'],
};

const ACTIONS = ['view', 'create', 'edit', 'delete', 'assign', 'sensitive', 'process'];
const CRUD = ['view', 'create', 'edit', 'delete'];

const hasPermission = (user, perm) => {
  const perms = user?.permissions || [];
  return perms.includes('*') || perms.includes(perm);
};
const anyPermission = (user, list) => list.some((p) => hasPermission(user, p));

// Role access to the lead pages, exactly as the Admin panel had it before grants
const leadsRoleScope = (user, action) => {
  if (action === 'view' || action === 'edit') {
    if (hasPermission(user, 'leads.viewAll')) return 'all';
    return hasPermission(user, 'leads.view') ? 'own' : null;
  }
  if (action === 'assign') return hasPermission(user, 'leads.assign') ? 'all' : null;
  if (action === 'delete') return hasPermission(user, 'leads.delete') ? 'all' : null;
  return null;
};

const PAGE_CATALOG = [
  { key: 'clients', label: 'Clients', group: 'Client CRM', basePermission: 'cms.manage', actions: CRUD, scope: 'client' },
  { key: 'invoices', label: 'Invoices', group: 'Client CRM', basePermission: 'cms.manage', actions: CRUD, scope: 'client' },
  { key: 'projects', label: 'Projects', group: 'Client CRM', basePermission: 'cms.manage', actions: CRUD, scope: 'client' },
  { key: 'retainers', label: 'Retainers', group: 'Client CRM', basePermission: 'cms.manage', actions: CRUD, scope: 'client' },
  { key: 'tickets', label: 'Support Tickets', group: 'Client CRM', basePermission: 'cms.manage', actions: CRUD, scope: 'client' },
  // Approve / reject a payment proof = edit
  { key: 'payments', label: 'Payment Verification', group: 'Client CRM', basePermission: 'cms.manage', actions: ['view', 'edit'], scope: 'client' },
  // Per-client agreement details (the global agreement template stays role-only)
  { key: 'agreements', label: 'Client Agreements', group: 'Client CRM', basePermission: 'cms.manage', actions: ['view', 'edit'], scope: 'client' },

  // Raw / Working / Unassigned / All leads and the lead workspace
  { key: 'leads', label: 'Leads', group: 'Leads', actions: ['view', 'edit', 'assign', 'delete'], scope: 'lead', roleScope: leadsRoleScope },
  // Follow-ups page: follow-up queue, compliance and BD reports; Edit = manage follow-up tasks
  { key: 'followups', label: 'Follow-ups', group: 'Leads', actions: ['view', 'edit'], scope: 'lead',
    roleScope: (user) => (hasPermission(user, 'leads.assign') ? 'all' : null) },
  // Lead Activity: call log and BD activity reports
  { key: 'lead-activity', label: 'Lead Activity', group: 'Leads', actions: ['view'], scope: 'lead',
    roleScope: (user) => (anyPermission(user, ['leads.assign', 'dashboard.management']) ? 'all' : null) },

  // Payroll, in three separate actions. View = the payroll screen with every
  // amount hidden; Sensitive = salary figures, salary history and payslip PDFs;
  // Process = generate, adjust, approve, hold, resend, mark paid and revise
  // salaries. Process is refused unless Sensitive is ticked too. Payroll
  // settings stay with the role (payroll.manage).
  { key: 'payroll', label: 'Payroll', group: 'HRMS', basePermission: 'payroll.manage', actions: ['view', 'sensitive', 'process'], scope: 'employee',
    requires: { process: ['sensitive'] } },

  // ── HRMS (Phase 4). Scope: direct reports, selected departments or all
  // employees, never the person's own record (utils/employeeScope.js).
  // Employees: View, plus Sensitive (PAN, Aadhaar, bank, salary) as its own
  // action. Creating, editing and deleting employees stays with the role —
  // each can change a login, a role or a reporting line.
  { key: 'employees', label: 'Employees', group: 'HRMS', actions: ['view', 'sensitive'], scope: 'employee',
    roleScope: (user, action) => (action === 'view'
      ? (anyPermission(user, ['employees.view', 'employees.manage']) ? 'all' : null)
      : (hasPermission(user, 'employees.sensitive') ? 'all' : null)) },
  // Edit = approve / reject
  { key: 'leave', label: 'Leave Requests', group: 'HRMS', basePermission: 'leave.manage', actions: ['view', 'edit'], scope: 'employee' },
  { key: 'attendance', label: 'Attendance Roster', group: 'HRMS', basePermission: 'attendance.manage', actions: ['view'], scope: 'employee' },
  { key: 'corrections', label: 'Correction Requests', group: 'HRMS', basePermission: 'attendance.manage', actions: ['view', 'edit'], scope: 'employee' },
  // Account numbers need Sensitive; approving a change needs Sensitive too
  { key: 'bank-changes', label: 'Bank Change Requests', group: 'HRMS', basePermission: 'bankchanges.manage', actions: ['view', 'sensitive', 'edit'], scope: 'employee',
    requires: { edit: ['sensitive'] } },
  { key: 'holidays', label: 'Holiday Calendar', group: 'HRMS', basePermission: 'holidays.manage', actions: ['view', 'create', 'delete'], scope: 'global' },
  // Create = assign a task, Edit = change a task's status
  { key: 'tasks', label: 'Organization Tasks', group: 'HRMS', basePermission: 'tasks.manage', actions: ['view', 'create', 'edit'], scope: 'employee' },
  { key: 'productivity', label: 'Productivity Reports', group: 'HRMS', basePermission: 'ess.manage', actions: ['view'], scope: 'employee' },
  // Edit = KPI goals, manual actuals, manager reviews. Cycles and the company-wide sync stay with the role.
  { key: 'performance', label: 'Performance', group: 'HRMS', basePermission: 'performance.manage', actions: ['view', 'edit'], scope: 'employee' },
];
const PAGES = new Map(PAGE_CATALOG.map((p) => [p.key, p]));

/** What the role alone gives on this page for this action: 'all' | 'own' | null. */
function roleScopeOf(user, pageKey, action) {
  const page = PAGES.get(pageKey);
  if (!page || !page.actions.includes(action)) return null;
  if (page.roleScope) return page.roleScope(user, action);
  return hasPermission(user, page.basePermission) ? 'all' : null;
}

/** Full (unscoped) access to a page through the role. */
const hasBaseAccess = (user, pageKey, action = 'view') => roleScopeOf(user, pageKey, action) === 'all';

const toIds = (list) => [...new Set((list || []).map((v) => String(v?._id || v)))].filter((id) => mongoose.Types.ObjectId.isValid(id));

/**
 * A login's grants in the current shape. Logins saved before access grants
 * existed still carry `crmGrants` ({ page, allClients, clients, actions });
 * they are read as the equivalent client-scoped grants until the migration
 * (scripts/migrations/migrateCrmGrants.js) rewrites them. Once accessGrants
 * is set — even to [] — the legacy field is ignored, so a revoke can't be
 * undone by old data.
 */
function grantsOf(user) {
  if (Array.isArray(user?.accessGrants)) return user.accessGrants;
  return (user?.crmGrants || []).map((g) => ({
    page: g.page,
    actions: g.actions || [],
    scope: g.allClients ? { mode: 'all' } : { mode: 'clients', clients: g.clients || [] },
  }));
}

/**
 * Clean grants from a request body: known pages, actions the page has,
 * 'view' implied by any other action, a scope mode valid for the page, and
 * one entry per page. Entries that would grant nothing are dropped — that
 * is also how access is revoked.
 */
function normalizeGrants(input) {
  if (!Array.isArray(input)) return { error: 'grants must be a list' };
  const byPage = new Map();
  for (const raw of input) {
    const page = PAGES.get(raw?.page);
    if (!page) return { error: `This page can't be granted: ${raw?.page}` };
    let actions = (raw.actions || []).filter((a) => page.actions.includes(a));
    if (!actions.length) continue;
    if (!actions.includes('view')) actions.push('view');
    actions = page.actions.filter((a) => actions.includes(a));
    // Some actions only make sense together; these must be ticked explicitly, never added silently
    for (const [action, needs] of Object.entries(page.requires || {})) {
      const missing = actions.includes(action) ? needs.filter((n) => !actions.includes(n)) : [];
      if (missing.length) return { error: `${page.label}: "${action}" also needs "${missing.join('", "')}" to be ticked.` };
    }

    const mode = raw.scope?.mode;
    if (!SCOPE_MODES[page.scope].includes(mode)) return { error: `Pick who/what ${page.label} covers.` };
    const scope = { mode };
    if (mode === 'clients') {
      scope.clients = toIds(raw.scope.clients);
      if (!scope.clients.length) continue;
    }
    if (mode === 'departments') {
      scope.departments = [...new Set((raw.scope.departments || []).map((d) => String(d).trim()).filter(Boolean))];
      if (!scope.departments.length) continue;
    }
    byPage.set(page.key, { page: page.key, actions, scope });
  }
  return { value: [...byPage.values()] };
}

// Breadth of a lead scope, to keep the broader of role and grant
const LEAD_RANK = { own: 1, team: 2, all: 3 };

/**
 * What `user` may do with `action` on `pageKey`:
 *   null                       → full access through the role (unscoped)
 *   { mode, clients?, ... }    → limited to this scope (role and grant combined)
 *   false                      → no access
 */
function pageScope(user, pageKey, action) {
  const page = PAGES.get(pageKey);
  if (!page || !page.actions.includes(action)) return false;
  const role = roleScopeOf(user, pageKey, action);
  if (role === 'all') return null;

  const grant = grantsOf(user).find((g) => g.page === pageKey);
  let granted = null;
  if (grant && (grant.actions || []).includes(action) && SCOPE_MODES[page.scope].includes(grant.scope?.mode)) {
    const mode = grant.scope.mode;
    granted = { mode };
    if (mode === 'clients') granted.clients = toIds(grant.scope.clients);
    if (mode === 'departments') granted.departments = [...(grant.scope.departments || [])];
  }

  if (!role) return granted || false;
  // Role gives a partial scope (e.g. own leads): keep whichever is broader
  if (!granted) return { mode: role };
  return (LEAD_RANK[granted.mode] || 0) > (LEAD_RANK[role] || 0) ? granted : { mode: role };
}

/** The broader of several page/action scopes (a route several pages share). */
function widestScope(user, pairs) {
  let best = false;
  for (const [pageKey, action] of pairs) {
    const s = pageScope(user, pageKey, action);
    if (s === null) return null;
    if (s && (!best || (LEAD_RANK[s.mode] || 0) > (LEAD_RANK[best.mode] || 0))) best = s;
  }
  return best;
}

/**
 * Compact form for the Employee Portal: the pages a person was granted and
 * the actions they can use there (role and grant combined). Pages their role
 * already covers in full are left out — those live in the Admin panel.
 */
function grantSummary(user) {
  const out = {};
  for (const g of grantsOf(user)) {
    const page = PAGES.get(g.page);
    if (!page || hasBaseAccess(user, g.page) || !g.actions?.length) continue;
    const actions = page.actions.filter((a) => pageScope(user, g.page, a) !== false);
    if (actions.includes('view')) out[g.page] = { actions, mode: pageScope(user, g.page, 'view')?.mode || 'all' };
  }
  return out;
}

/**
 * What the granting user may hand out: pages whose View they hold in full,
 * and on each, only the actions they hold in full themselves.
 */
const grantableActions = (granter, pageKey) => {
  const page = PAGES.get(pageKey);
  return page ? page.actions.filter((a) => hasBaseAccess(granter, pageKey, a)) : [];
};
const grantablePages = (granter) => PAGE_CATALOG.filter((p) => grantableActions(granter, p.key).includes('view'));

/** The legacy crmGrants shape converted to accessGrants (used by the migration). */
const fromLegacyCrmGrants = (crmGrants = []) => normalizeGrants(crmGrants.map((g) => ({
  page: g.page,
  actions: g.actions,
  scope: g.allClients ? { mode: 'all' } : { mode: 'clients', clients: g.clients },
})));

module.exports = {
  SCOPE_MODES, ACTIONS, PAGE_CATALOG,
  hasPermission, roleScopeOf, hasBaseAccess, grantsOf, normalizeGrants, pageScope, widestScope,
  grantSummary, grantableActions, grantablePages, fromLegacyCrmGrants,
};
