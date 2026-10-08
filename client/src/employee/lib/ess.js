import { useQuery } from '@tanstack/react-query';
import employeeApi from '../../services/employeeApi';
import { useEmployeeStore } from '../../store/useEmployeeStore';

/**
 * Employee Self-Service data layer: one query key per resource, so every tab
 * and widget reading the same data shares one cached request instead of
 * refetching on each tab switch.
 */
const BASE = '/employee-portal/ess';

export const essGet = (path, config) => employeeApi.get(`${BASE}${path}`, config).then((r) => r.data);
export const essPost = (path, body, config) => employeeApi.post(`${BASE}${path}`, body, config).then((r) => r.data);
export const essPut = (path, body, config) => employeeApi.put(`${BASE}${path}`, body, config).then((r) => r.data);

export const apiError = (err, fallback = 'Something went wrong. Please try again.') =>
  err?.response?.data?.message || fallback;

export const essKeys = {
  profile: ['ess', 'profile'],
  leads: ['ess', 'leads'],
  lead: (id) => ['ess', 'lead', id],
  leadSearch: (q) => ['ess', 'lead-search', q],
  proposals: (leadId) => ['ess', 'proposals', leadId],
  today: ['ess', 'today'],
  timer: ['ess', 'timer'],
  activityTypes: ['ess', 'activity-types'],
  tasks: ['ess', 'tasks'],
  dayStats: (date) => ['ess', 'day-stats', date],
  worklogs: (date, page) => ['ess', 'worklogs', date, page],
  leave: ['ess', 'leave'],
  corrections: ['ess', 'corrections'],
  payslips: ['ess', 'payslips'],
  tickets: ['ess', 'tickets'],
  kpis: (period) => ['ess', 'kpis', period],
  team: ['ess', 'team'],
  projects: ['ess', 'projects'],
  performance: ['ess', 'performance'],
};

/** Permission/segment checks for the signed-in employee (same rules as the server). */
export function useAccess() {
  const employee = useEmployeeStore((s) => s.employee);
  const permissions = employee?.permissions || [];
  const can = (permission) => !permission || permissions.includes('*') || permissions.includes(permission);
  return {
    can,
    segment: employee?.segment || 'General',
    portalModules: employee?.portalModules ?? null, // null → portal defaults
    hasTeam: Boolean(employee?.hasTeam),
    hasProjects: Boolean(employee?.hasProjects),
    authEmployee: employee,
  };
}

export const useEssProfile = () =>
  useQuery({ queryKey: essKeys.profile, queryFn: () => essGet('/profile').then((d) => d.employee) });

export const useEssLeads = (enabled = true) =>
  useQuery({ queryKey: essKeys.leads, queryFn: () => essGet('/leads').then((d) => d.leads || []), enabled, staleTime: 30_000 });

export const useEssToday = (enabled = true) =>
  useQuery({ queryKey: essKeys.today, queryFn: () => essGet('/today'), enabled, staleTime: 30_000 });

export const useEssTimer = () =>
  useQuery({ queryKey: essKeys.timer, queryFn: () => essGet('/timer').then((d) => d.activeTimer), staleTime: 30_000 });

export const useActivityTypes = () =>
  useQuery({ queryKey: essKeys.activityTypes, queryFn: () => essGet('/activity-types').then((d) => d.types || []), staleTime: 10 * 60_000 });

export const useEssTasks = () =>
  useQuery({ queryKey: essKeys.tasks, queryFn: () => essGet('/tasks').then((d) => d.tasks || []) });

export const useEssLeave = () =>
  useQuery({ queryKey: essKeys.leave, queryFn: () => essGet('/leave-requests') });

export const useEssProjects = (enabled = true) =>
  useQuery({ queryKey: essKeys.projects, queryFn: () => essGet('/projects').then((d) => d.projects || []), enabled });

export const useCorrections = () =>
  useQuery({ queryKey: essKeys.corrections, queryFn: () => essGet('/corrections').then((d) => d.requests || []) });

/**
 * Fetches an authenticated PDF and either opens it in a new tab ("View") or
 * saves it. The tab is opened before the request so popup blockers allow it.
 */
export async function openPdf(url, { download = false, filename = 'document.pdf', http = employeeApi } = {}) {
  const tab = download ? null : window.open('', '_blank');
  try {
    const { data } = await http.get(url, { responseType: 'blob' });
    const href = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
    if (tab) {
      tab.location.href = href;
    } else {
      const a = document.createElement('a');
      a.href = href;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    setTimeout(() => URL.revokeObjectURL(href), 60_000);
  } catch (err) {
    tab?.close();
    throw err;
  }
}
