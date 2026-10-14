import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Users, CalendarCheck, Clock, FileEdit, CalendarDays, Wallet, CheckSquare, BarChart3, Target, Briefcase,
} from 'lucide-react';
import api from '../../services/api';
import { usePermissions } from '../hooks/usePermissions';

// The HRMS pages, each behind the same permission as its route and sidebar
// entry (client/src/routes/index.jsx, Sidebar.jsx).
const HR_PAGES = [
  { label: 'Employees', desc: 'Profiles, roles, probation', path: '/admin/employees', permission: 'employees.view', icon: Users },
  { label: 'Leave Requests', desc: 'Approve or reject leave', path: '/admin/leave-requests', permission: 'leave.manage', icon: CalendarCheck, pending: 'leave' },
  { label: 'Attendance Roster', desc: 'Daily and monthly attendance', path: '/admin/attendance-roster', permission: 'attendance.manage', icon: Clock },
  { label: 'Correction Requests', desc: 'Attendance / timesheet fixes', path: '/admin/corrections', permission: 'attendance.manage', icon: FileEdit, pending: 'corrections' },
  { label: 'Holiday Calendar', desc: 'Company holidays', path: '/admin/holidays', permission: 'holidays.manage', icon: CalendarDays },
  { label: 'Payroll', desc: 'Runs, payslips, salary revisions', path: '/admin/payroll', permission: 'payroll.manage', icon: Wallet },
  { label: 'Organization Tasks', desc: 'Assign and track tasks', path: '/admin/tasks', permission: 'tasks.manage', icon: CheckSquare },
  { label: 'Productivity Reports', desc: 'Team work logs and hours', path: '/admin/manager-dashboard', permission: 'ess.manage', icon: BarChart3 },
  { label: 'Performance Cycles', desc: 'Reviews and KPI goals', path: '/admin/performance-cycles', permission: 'performance.manage', icon: Target },
  { label: 'Job Applications', desc: 'Careers page applicants', path: '/admin/applications', permission: 'careers.manage', icon: Briefcase },
];

const countPending = (rows) => (rows || []).filter((r) => r.status === 'Pending').length;

/**
 * Overview shortcuts for HR: every HRMS page the viewer may open, with the
 * number of requests waiting on them. Renders nothing for someone with no
 * HR permission.
 */
export default function HrQuickAccess() {
  const { can } = usePermissions();
  const pages = HR_PAGES.filter((p) => can(p.permission));

  const { data: pendingLeave } = useQuery({
    queryKey: ['admin', 'hr-overview', 'leave'],
    queryFn: () => api.get('/employees/admin/leave-requests').then((r) => countPending(r.data.leaveRequests)),
    enabled: can('leave.manage'),
  });
  const { data: pendingCorrections } = useQuery({
    queryKey: ['admin', 'hr-overview', 'corrections'],
    queryFn: () => api.get('/corrections', { params: { status: 'Pending' } }).then((r) => (r.data.requests || []).length),
    enabled: can('attendance.manage'),
  });
  const pending = { leave: pendingLeave, corrections: pendingCorrections };

  if (!pages.length) return null;
  return (
    <section>
      <h2 className="text-xl font-bold text-app-text mb-1">HR Workspace</h2>
      <p className="text-sm text-app-text-muted mb-4">Everything your role can manage — also under <span className="font-semibold">HRMS (Module)</span> in the sidebar.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {pages.map(({ label, desc, path, icon: Icon, pending: key }) => {
          const count = key ? pending[key] : 0;
          return (
            <Link
              key={path}
              to={path}
              className="bg-app-card border border-app-border rounded-xl p-4 flex items-start gap-3 hover:border-primary transition-colors group"
            >
              <div className="w-9 h-9 shrink-0 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Icon size={17} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-app-text group-hover:text-primary transition-colors">{label}</span>
                  {count > 0 && (
                    <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-500">{count} pending</span>
                  )}
                </div>
                <p className="text-xs text-app-text-muted mt-0.5">{desc}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
