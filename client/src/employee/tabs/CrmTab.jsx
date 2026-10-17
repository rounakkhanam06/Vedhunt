import { lazy, Suspense, useMemo, useState } from 'react';
import employeeApi from '../../services/employeeApi';
import { CrmProvider, portalCrm } from '../../shared/crmAccess';
import { useAccess } from '../lib/ess';
import { Spinner } from '../components/PortalUI';

// The Admin panel's pages, run against the portal's scoped APIs.
const PAGES = {
  clients: lazy(() => import('../../admin/pages/ClientManager')),
  invoices: lazy(() => import('../../admin/pages/InvoiceManager')),
  projects: lazy(() => import('../../admin/pages/ProjectManager')),
  retainers: lazy(() => import('../../admin/pages/RetainerManager')),
  tickets: lazy(() => import('../../admin/pages/SupportDeskManager')),
  payments: lazy(() => import('../../admin/pages/PaymentVerificationManager')),
  agreements: lazy(() => import('../../admin/pages/ManageAgreement')),
  followups: lazy(() => import('../../admin/pages/FollowUpsManager')),
  'lead-activity': lazy(() => import('../../admin/pages/LeadActivity')),
  payroll: lazy(() => import('../../admin/pages/PayrollManager')),
  employees: lazy(() => import('../../admin/pages/EmployeeManager')),
  leave: lazy(() => import('../../admin/pages/LeaveRequestsManager')),
  attendance: lazy(() => import('../../admin/pages/AttendanceManager')),
  corrections: lazy(() => import('../../admin/pages/CorrectionRequestsManager')),
  'bank-changes': lazy(() => import('../../admin/pages/BankChangeRequestsManager')),
  holidays: lazy(() => import('../../admin/components/HolidayCalendar')),
  tasks: lazy(() => import('../../admin/pages/AdminTasks')),
  productivity: lazy(() => import('../../admin/pages/ManagerDashboard')),
};
const LeadsManager = lazy(() => import('../../admin/pages/LeadsManager'));
const UnassignedLeadsManager = lazy(() => import('../../admin/pages/UnassignedLeadsManager'));
const PerformanceCycleManager = lazy(() => import('../../admin/pages/PerformanceCycleManager'));
const PerformanceGoalAssigner = lazy(() => import('../../admin/pages/PerformanceGoalAssigner'));
const CompanyPerformanceMatrix = lazy(() => import('../../admin/pages/CompanyPerformanceMatrix'));

/** Granted Performance page: the Admin panel's three performance views, limited to the grant's scope. */
function GrantedPerformance() {
  const views = [
    { key: 'matrix', label: 'Scores & reviews', render: () => <CompanyPerformanceMatrix /> },
    { key: 'goals', label: 'KPI goals', render: () => <PerformanceGoalAssigner /> },
    { key: 'cycles', label: 'Cycles', render: () => <PerformanceCycleManager /> },
  ];
  return <SubTabs views={views} label="Performance views" />;
}

function SubTabs({ views, label }) {
  const [view, setView] = useState(views[0].key);
  const current = views.find((v) => v.key === view) || views[0];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label={label}>
        {views.map((v) => (
          <button key={v.key} type="button" role="tab" aria-selected={current.key === v.key} onClick={() => setView(v.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
              current.key === v.key ? 'bg-primary text-white border-primary' : 'border-app-border text-app-text-muted hover:border-primary/40'
            }`}>
            {v.label}
          </button>
        ))}
      </div>
      {current.render()}
    </div>
  );
}

/** Granted Leads page: the same lead views as the Admin panel, limited to the grant's scope. */
function GrantedLeads({ canAssign }) {
  const views = [
    { key: 'working', label: 'Working', render: () => <LeadsManager key="working" stageGroup="working" /> },
    { key: 'raw', label: 'Raw', render: () => <LeadsManager key="raw" stageGroup="raw" /> },
    { key: 'all', label: 'All stages', render: () => <LeadsManager key="all" /> },
    ...(canAssign ? [{ key: 'unassigned', label: 'Unassigned', render: () => <UnassignedLeadsManager /> }] : []),
  ];
  return <SubTabs views={views} label="Lead views" />;
}

/**
 * A page granted to this person (Employee Manager → Page Access). It shows
 * only the data and actions they were given; the server enforces the same
 * scope on every request.
 */
export default function CrmTab({ page }) {
  const { access, authEmployee } = useAccess();
  const value = useMemo(() => portalCrm(employeeApi, access, authEmployee), [access, authEmployee]);
  const Page = PAGES[page];
  return (
    <CrmProvider value={value}>
      <Suspense fallback={<Spinner />}>
        {page === 'leads' ? <GrantedLeads canAssign={value.can('leads', 'assign')} />
          : page === 'performance' ? <GrantedPerformance />
            : <Page />}
      </Suspense>
    </CrmProvider>
  );
}
