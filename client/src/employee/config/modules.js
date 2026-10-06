import { LayoutDashboard, Clock, CheckSquare, FileSpreadsheet, CreditCard, Award, User, LifeBuoy, UserCheck, AlertTriangle, UsersRound, FolderKanban } from 'lucide-react';

/**
 * Employee Portal module matrix — which sidebar modules a person sees.
 *   - `always`: Dashboard and My Profile, shown to everyone
 *   - `requiresTeam`: only for someone who is a reporting manager
 *   - `requiresProjects`: only for a Project Manager / team member on a project
 *   - `permission`: needs that role permission (same check the API enforces)
 *   - otherwise, if any of the person's roles lists modules in Admin →
 *     Role Management, exactly those are shown; if none does, the defaults
 *     apply (`hideForSegments` hides a module for those departments).
 */
export const EMPLOYEE_MODULES = [
  { key: 'dashboard', name: 'Dashboard', icon: LayoutDashboard, always: true },
  { key: 'raw-leads', name: 'Raw Leads', icon: UserCheck, permission: 'leads.view' },
  { key: 'working-leads', name: 'Working Leads', icon: UserCheck, permission: 'leads.view' },
  { key: 'followups', name: 'Follow-ups', icon: AlertTriangle, permission: 'followups.view' },
  { key: 'attendance', name: 'Attendance & Leave', icon: Clock },
  { key: 'tasks', name: 'My Tasks', icon: CheckSquare },
  { key: 'timesheet', name: 'My Timesheet', icon: FileSpreadsheet },
  { key: 'payslips', name: 'My Payslips', icon: CreditCard },
  { key: 'performance', name: 'My Performance', icon: Award },
  // Client tickets belong to delivery/support work, not the BD lead pipeline.
  { key: 'tickets', name: 'Assigned Tickets', icon: LifeBuoy, hideForSegments: ['BD'] },
  { key: 'projects', name: 'My Projects', icon: FolderKanban, requiresProjects: true },
  { key: 'team', name: 'Team Approvals', icon: UsersRound, requiresTeam: true },
  { key: 'profile', name: 'My Profile', icon: User, always: true },
];

export const modulePath = (key) => `/employee/dashboard?tab=${key}`;

export function canAccessModule(module, { can, segment, portalModules, hasTeam, hasProjects }) {
  if (!module) return false;
  if (module.always) return true;
  if (module.requiresTeam) return Boolean(hasTeam);
  if (module.requiresProjects && !hasProjects) return false;
  if (module.permission && !can(module.permission)) return false;
  if (Array.isArray(portalModules)) return portalModules.includes(module.key);
  return !(module.hideForSegments || []).includes(segment);
}

export const visibleModules = (access) => EMPLOYEE_MODULES.filter((m) => canAccessModule(m, access));
