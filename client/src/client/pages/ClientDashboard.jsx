import { lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { useClientStore } from '../../store/useClientStore';

const BillingTab    = lazy(() => import('../tabs/BillingTab'));
const ProjectsTab   = lazy(() => import('../tabs/ProjectsTab'));
const RetainersTab  = lazy(() => import('../tabs/RetainersTab'));
const SupportTab    = lazy(() => import('../tabs/SupportTab'));
const AgreementTab  = lazy(() => import('../tabs/AgreementTab'));

const TAB_COMPONENTS = {
  billing:   BillingTab,
  projects:  ProjectsTab,
  retainers: RetainersTab,
  support:   SupportTab,
  agreement: AgreementTab,
};

const TabLoader = () => (
  <div className="flex items-center justify-center h-48">
    <div className="w-8 h-8 border-2 border-primary/30 border-t-[#FF5A1F] rounded-full animate-spin" />
  </div>
);

const ClientDashboard = () => {
  const location = useLocation();
  const { client } = useClientStore();
  const currentTab = new URLSearchParams(location.search).get('tab') || 'billing';
  const ActiveTab = TAB_COMPONENTS[currentTab] || BillingTab;

  return (
    <div>
      {/* Welcome strip */}
      {client && (
        <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-[#FF5A1F]/[0.08] to-transparent border border-primary/10">
          <p className="text-white text-sm">
            Welcome back,{' '}
            <span className="font-semibold text-primary">{client.contactName}</span>
            {' '}—{' '}
            <span className="text-[#9CA3AF]">{client.businessName}</span>
          </p>
        </div>
      )}

      {/* Active Tab Content */}
      <Suspense fallback={<TabLoader />}>
        <ActiveTab />
      </Suspense>
    </div>
  );
};

export default ClientDashboard;
