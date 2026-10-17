import { lazy, Suspense, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import employeeApi from '../../services/employeeApi';
import { CrmProvider, portalCrm } from '../../shared/crmAccess';
import { useAccess } from '../lib/ess';
import { Spinner } from '../components/PortalUI';

const LeadWorkspace = lazy(() => import('../../admin/pages/LeadWorkspace'));

/**
 * A lead opened from a granted lead page (/employee/team-leads/:id): the Admin
 * panel's lead workspace, with the person's own grant deciding what it shows.
 * Leads outside their scope answer "not found" from the server.
 */
export default function GrantedLeadWorkspace() {
  const { access, authEmployee } = useAccess();
  const value = useMemo(() => portalCrm(employeeApi, access, authEmployee), [access, authEmployee]);
  if (!value.can('leads', 'view')) return <Navigate to="/employee/dashboard?tab=dashboard" replace />;
  return (
    <CrmProvider value={value}>
      <Suspense fallback={<Spinner className="py-20" />}>
        <div className="p-2 sm:p-6">
          <LeadWorkspace />
        </div>
      </Suspense>
    </CrmProvider>
  );
}
