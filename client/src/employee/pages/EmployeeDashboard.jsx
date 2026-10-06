import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Clock, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import employeeAvatar from '../../assets/033a13e9af4efbb035a04c3777c4934d-removebg-preview.png';
import { Spinner } from '../components/PortalUI';
import { useEssProfile, useAccess, essPost, apiError } from '../lib/ess';
import { EMPLOYEE_MODULES, canAccessModule } from '../config/modules';
import HomeTab from '../tabs/HomeTab';
import LeadListsTab from '../tabs/LeadListsTab';
import TicketsTab from '../tabs/TicketsTab';
import AttendanceTab from '../tabs/AttendanceTab';
import TasksTab from '../tabs/TasksTab';
import TimesheetTab from '../tabs/TimesheetTab';
import PayslipsTab from '../tabs/PayslipsTab';
import PerformanceTab from '../tabs/PerformanceTab';
import ProfileTab from '../tabs/ProfileTab';
import TeamApprovalsTab from '../tabs/TeamApprovalsTab';
import ProjectsTab from '../tabs/ProjectsTab';

const TABS = {
  dashboard: HomeTab,
  'raw-leads': (props) => <LeadListsTab view="raw" {...props} />,
  'working-leads': (props) => <LeadListsTab view="working" {...props} />,
  followups: (props) => <LeadListsTab view="followups" {...props} />,
  tickets: TicketsTab,
  attendance: AttendanceTab,
  tasks: TasksTab,
  timesheet: TimesheetTab,
  payslips: PayslipsTab,
  performance: PerformanceTab,
  profile: ProfileTab,
  team: TeamApprovalsTab,
  projects: ProjectsTab,
};

function WelcomeBanner({ employee }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const todayLog = employee.attendance?.find((a) => new Date(a.date).toDateString() === new Date().toDateString());
  const isClockedIn = todayLog && !todayLog.clockOut;
  const isClockedOut = todayLog && todayLog.clockOut;

  const handleClockInOut = async () => {
    setBusy(true);
    try {
      const res = await essPost('/attendance/clock');
      toast.success(res.message);
      ['profile', 'timer', 'day-stats', 'worklogs'].forEach((k) => queryClient.invalidateQueries({ queryKey: ['ess', k] }));
    } catch (error) {
      toast.error(apiError(error, 'Attendance request failed.'));
    } finally {
      setBusy(false);
    }
  };

  // Fixed brand-orange gradient in both themes — text/buttons here stay fixed white/dark.
  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-[#FF8533] to-[#FF6B00] p-5 sm:p-6 rounded-2xl border-none shadow-lg mb-6 flex flex-col md:flex-row justify-between items-start md:items-center">
      <div className="relative z-10 max-w-lg space-y-1.5">
        <p className="text-white/90 text-xs font-medium tracking-wide">
          {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-1">Welcome back, {employee.firstName}!</h1>
        <p className="text-white/90 text-xs sm:text-sm font-medium">Always stay updated in your employee portal</p>
        <div className="pt-3">
          <button
            onClick={handleClockInOut}
            disabled={isClockedOut || busy}
            className={`px-5 py-2 rounded-full font-bold text-xs transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-2 ${
              isClockedOut ? 'bg-white/20 text-white/60 cursor-not-allowed border border-white/30'
                : isClockedIn ? 'bg-white text-rose-600 hover:bg-rose-50'
                  : 'bg-white text-primary hover:bg-orange-50'
            }`}
          >
            <Clock size={16} />
            {isClockedOut ? 'Clocked Out Today' : isClockedIn ? 'Clock Out Now' : 'Clock In Now'}
          </button>
        </div>
      </div>
      <div className="absolute right-0 bottom-0 top-0 w-1/3 md:w-1/3 lg:w-1/4 hidden sm:flex justify-end items-end pointer-events-none">
        <img src={employeeAvatar} alt="" className="object-contain h-[120%] max-h-[160px] object-right-bottom mix-blend-luminosity opacity-90"
          style={{ filter: 'drop-shadow(-5px 5px 10px rgba(0,0,0,0.2))' }} />
      </div>
    </div>
  );
}

/** Employee Portal shell: profile load, welcome banner, and the role-gated tab content. */
export default function EmployeeDashboard() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const access = useAccess();
  const { data: employee, isLoading, isError } = useEssProfile();
  const activeTab = searchParams.get('tab') || 'dashboard';

  // Deep link from a notification — ?leadId=... jumps straight to that lead's workspace.
  useEffect(() => {
    const leadId = searchParams.get('leadId');
    if (leadId) navigate(`/employee/leads/${leadId}`, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) return <Spinner className="py-20" />;

  if (isError || !employee) {
    return (
      <div className="text-center py-20 bg-app-bg text-app-text flex flex-col justify-center items-center gap-4">
        <ShieldAlert size={48} className="text-primary" />
        <h2 className="text-xl font-bold">No Employee Link Found</h2>
        <p className="text-app-text-muted">Please contact HR to map your login account to your operational employee ID.</p>
      </div>
    );
  }

  // Same matrix as the sidebar — a hand-typed ?tab= for a hidden module falls back to the dashboard.
  const module = EMPLOYEE_MODULES.find((m) => m.key === activeTab);
  if (!module || !canAccessModule(module, access)) return <Navigate to="/employee/dashboard?tab=dashboard" replace />;
  const Tab = TABS[activeTab];

  return (
    <div className="bg-app-bg text-app-text p-2 sm:p-6 space-y-6">
      <WelcomeBanner employee={employee} />
      {/* key: a tile click that changes only the filters remounts the tab with them */}
      <Tab key={location.search} employee={employee} />
    </div>
  );
}
