import { createContext, useContext } from 'react';
import api from '../services/api';
import { usePermissions } from '../admin/hooks/usePermissions';
import { useAdminStore } from '../store/useAdminStore';

/**
 * The Admin panel's pages that can be granted per person run in two places:
 * the Admin panel, with the access the person's role gives, and the Employee
 * Portal, for people given person-wise grants (page + actions + scope;
 * server/config/pageAccess.js). A page reads which API to call, which links
 * to use and which buttons to show from this context. The default value is
 * the Admin panel, so admin routes need no provider.
 *
 * The server enforces the same rules on every request; this context only
 * decides what is shown.
 */
const ADMIN_CRM = { http: api, base: '/admin', root: '', full: true, can: () => true };

const CrmContext = createContext(ADMIN_CRM);
export const CrmProvider = CrmContext.Provider;
export const useCrm = () => useContext(CrmContext);

// Role permission names the shared screens check, mapped onto the matching grant
const PERM_TO_GRANT = {
  'leads.view': ['leads', 'view'], 'leads.assign': ['leads', 'assign'], 'leads.delete': ['leads', 'delete'],
  'employees.view': ['employees', 'view'], 'employees.sensitive': ['employees', 'sensitive'],
};

/**
 * Context value for the Employee Portal from the person's grant summary
 * ({ invoices: { actions, mode }, leads: { actions, mode }, ... } as sent by
 * /employee/auth/me) and their own login (`me`, for "my lead" checks).
 * A new client can't belong to a fixed client list, so creating clients
 * needs an all-clients grant (the server refuses it otherwise too).
 */
export function portalCrm(http, grants, me) {
  const can = (page, action) => {
    const grant = grants?.[page];
    if (!grant?.actions?.includes(action)) return false;
    if (page === 'clients' && action === 'create') return grant.mode === 'all';
    return true;
  };
  // What the shared screens ask with role permission names; anything not
  // mapped (Super Admin-only, import, account management) stays hidden.
  const perm = (p) => {
    if (PERM_TO_GRANT[p]) return can(...PERM_TO_GRANT[p]);
    if (p === 'leads.viewAll') return grants?.leads?.mode === 'all';
    return false;
  };
  return {
    http,
    base: '/employee-portal/crm',
    root: '/employee-portal/grants',
    full: false,
    can,
    perm,
    me,
    leadPath: (id) => `/employee/team-leads/${id}`,
    leadsHome: '/employee/dashboard?tab=grant-leads',
  };
}

/**
 * For the shared Admin screens: the API and its root, role-style permission
 * checks, the signed-in person and lead links — from the Admin panel (the
 * role), or from the portal grant.
 *   can(rolePermission)                    e.g. can('leads.assign')
 *   allowed(rolePermission, page, action)  one action: the role permission in
 *                                          the Admin panel, the grant in the portal
 */
export function usePageAccess() {
  const ctx = useCrm();
  const { can } = usePermissions();
  const { admin } = useAdminStore();
  if (ctx.full) {
    return {
      http: ctx.http, root: '', can, allowed: (rolePermission) => can(rolePermission), me: admin, inPortal: false,
      leadPath: (id) => `/admin/leads/${id}`, leadsHome: '/admin/leads',
    };
  }
  return {
    http: ctx.http, root: ctx.root, can: ctx.perm, allowed: (_rolePermission, page, action) => ctx.can(page, action), me: ctx.me, inPortal: true,
    leadPath: ctx.leadPath, leadsHome: ctx.leadsHome,
  };
}
export const useLeadAccess = usePageAccess;
