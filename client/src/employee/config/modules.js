import { BarChart3, PhoneCall, LayoutDashboard, Clock, CheckSquare, FileSpreadsheet, CreditCard, Award, User, LifeBuoy, UserCheck, AlertTriangle, UsersRound, FolderKanban, Building2, Receipt, Briefcase, RefreshCw, Headset, BadgeCheck, FileSignature, Kanban, ClipboardList, Activity, Wallet, Contact, CalendarCheck, CalendarClock, FilePen, Landmark, CalendarDays, ListTodo, Gauge, Target } from 'lucide-react';

/**
 * Employee Portal module matrix — which sidebar modules a person sees.
 *   - `always`: Dashboard and My Profile, shown to everyone
 *   - `requiresTeam`: only for someone who is a reporting manager
 *     (`orPermission`: or anyone holding that permission)
 *   - `requiresProjects`: only for a Project Manager / team member on a project
 *   - `crmPage`: a page granted to this person (Employee Manager → Page
 *     Access), shown whatever their role or its module list says
 *   - `permission`: needs that role permission (same check the API enforces)
 *   - otherwise, if any of the person's roles lists modules in Admin →
 *     Role Management, exactly those are shown; if none does, the defaults
 *     apply (`hideForSegments` hides a module for those departments).
 */
export const EMPLOYEE_MODULES = [
  { key: 'dashboard', name: 'Dashboard', icon: LayoutDashboard, always: true },
  { key: 'raw-leads', name: 'Raw Leads', icon: UserCheck, permission: 'leads.view' },
  { key: 'working-leads', name: 'Working Leads', icon: UserCheck, permission: 'leads.view' },
  { key: 'dropped-hold-leads', name: 'Dropped & Hold', icon: UserCheck, permission: 'leads.view' },
  { key: 'followups', name: 'Follow-ups', icon: AlertTriangle, permission: 'followups.view' },
  { key: 'my-calls', name: 'My Call Log', icon: PhoneCall, permission: 'leads.view' },
  { key: 'attendance', name: 'Attendance & Leave', icon: Clock },
  { key: 'tasks', name: 'My Tasks', icon: CheckSquare },
  { key: 'timesheet', name: 'My Timesheet', icon: FileSpreadsheet },
  { key: 'payslips', name: 'My Payslips', icon: CreditCard },
  { key: 'performance', name: 'My Performance', icon: Award },
  // Client tickets belong to delivery/support work, not the BD lead pipeline.
  { key: 'tickets', name: 'Assigned Tickets', icon: LifeBuoy, hideForSegments: ['BD'] },
  { key: 'projects', name: 'My Projects', icon: FolderKanban, requiresProjects: true },
  { key: 'team', name: 'Team Approvals', icon: UsersRound, requiresTeam: true },
  { key: 'team-performance', name: 'My Team Performance', icon: BarChart3, requiresTeam: true, orPermission: 'team.performance' },
  { key: 'crm-clients', name: 'Clients', icon: Building2, crmPage: 'clients' },
  { key: 'crm-invoices', name: 'Invoices', icon: Receipt, crmPage: 'invoices' },
  { key: 'crm-projects', name: 'Client Projects', icon: Briefcase, crmPage: 'projects' },
  { key: 'crm-retainers', name: 'Retainers', icon: RefreshCw, crmPage: 'retainers' },
  { key: 'crm-tickets', name: 'Support Desk', icon: Headset, crmPage: 'tickets' },
  { key: 'crm-payments', name: 'Payment Verification', icon: BadgeCheck, crmPage: 'payments' },
  { key: 'crm-agreements', name: 'Client Agreements', icon: FileSignature, crmPage: 'agreements' },
  // Lead pages granted per person (own / team / all leads)
  { key: 'grant-leads', name: 'Lead Pipeline', icon: Kanban, crmPage: 'leads' },
  { key: 'grant-followups', name: 'Team Follow-ups', icon: ClipboardList, crmPage: 'followups' },
  { key: 'grant-lead-activity', name: 'Lead Activity', icon: Activity, crmPage: 'lead-activity' },
  // Payroll granted per person (View / Sensitive / Process), scoped to employees
  { key: 'grant-payroll', name: 'Payroll', icon: Wallet, crmPage: 'payroll' },
  // HRMS pages granted per person (scoped to employees)
  { key: 'grant-employees', name: 'Employees', icon: Contact, crmPage: 'employees' },
  { key: 'grant-leave', name: 'Leave Requests', icon: CalendarCheck, crmPage: 'leave' },
  { key: 'grant-attendance', name: 'Attendance Roster', icon: CalendarClock, crmPage: 'attendance' },
  { key: 'grant-corrections', name: 'Correction Requests', icon: FilePen, crmPage: 'corrections' },
  { key: 'grant-bank-changes', name: 'Bank Change Requests', icon: Landmark, crmPage: 'bank-changes' },
  { key: 'grant-holidays', name: 'Holiday Calendar', icon: CalendarDays, crmPage: 'holidays' },
  { key: 'grant-tasks', name: 'Organization Tasks', icon: ListTodo, crmPage: 'tasks' },
  { key: 'grant-productivity', name: 'Productivity Reports', icon: Gauge, crmPage: 'productivity' },
  { key: 'grant-performance', name: 'Team Performance Reviews', icon: Target, crmPage: 'performance' },
  { key: 'profile', name: 'My Profile', icon: User, always: true },
];

export const modulePath = (key) => `/employee/dashboard?tab=${key}`;

export function canAccessModule(module, { can, segment, portalModules, hasTeam, hasProjects, access }) {
  if (!module) return false;
  if (module.always) return true;
  if (module.crmPage) return Boolean(access?.[module.crmPage]?.actions?.includes('view'));
  if (module.requiresTeam) return Boolean(hasTeam) || Boolean(module.orPermission && can(module.orPermission));
  if (module.requiresProjects && !hasProjects) return false;
  if (module.permission && !can(module.permission)) return false;
  if (Array.isArray(portalModules)) return portalModules.includes(module.key);
  return !(module.hideForSegments || []).includes(segment);
}

export const visibleModules = (access) => EMPLOYEE_MODULES.filter((m) => canAccessModule(m, access));
