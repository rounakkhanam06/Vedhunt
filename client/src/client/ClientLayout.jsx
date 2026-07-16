import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { useClientStore } from '../store/useClientStore';
import logo from '../assets/DarkthemeLogo.png';
import {
  FileText,
  Rocket,
  RefreshCcw,
  LifeBuoy,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import clientApi from '../services/clientApi';
import ServiceAgreementAcceptance from './pages/ServiceAgreementAcceptance';

const TABS = [
  { id: 'billing',   label: 'Billing',    icon: FileText,      path: '/client/dashboard?tab=billing' },
  { id: 'projects',  label: 'Projects',   icon: Rocket,        path: '/client/dashboard?tab=projects' },
  { id: 'retainers', label: 'Retainers',  icon: RefreshCcw,    path: '/client/dashboard?tab=retainers' },
  { id: 'support',   label: 'Support',    icon: LifeBuoy,      path: '/client/dashboard?tab=support' },
  { id: 'agreement', label: 'Agreement',  icon: FileText,      path: '/client/dashboard?tab=agreement' },
];

const ClientLayout = () => {
  const { client, logout } = useClientStore();
  const navigate = useNavigate();
  const location = useLocation();

  const [agreement, setAgreement] = useState(null);
  const [checkingAgreement, setCheckingAgreement] = useState(true);

  useEffect(() => {
    fetchAgreement();
  }, [client]);

  const fetchAgreement = async () => {
    try {
      const { data } = await clientApi.get('/client/agreement');
      setAgreement(data);
    } catch (error) {
      console.error('Error fetching agreement:', error);
    } finally {
      setCheckingAgreement(false);
    }
  };

  const needsAgreement = 
    agreement && 
    (client?.acceptedAgreementVersion || 0) < agreement.version;

  const currentTab = new URLSearchParams(location.search).get('tab') || 'billing';

  const handleLogout = async () => {
    await logout();
    navigate('/client/login');
  };

  const handleTabClick = (tab) => {
    navigate(`/client/dashboard?tab=${tab.id}`);
  };

  if (checkingAgreement) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg-primary">
        <div className="w-12 h-12 rounded-full border-2 border-primary/20 border-t-[#FF5A1F] animate-spin" />
      </div>
    );
  }

  if (needsAgreement) {
    return (
      <ServiceAgreementAcceptance 
        agreement={agreement} 
        onAccept={() => fetchAgreement()} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary text-[#E5E2E1] font-sans flex flex-col">
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1A1A1A',
            color: '#FFFFFF',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
          },
          success: { iconTheme: { primary: '#FF6B00', secondary: '#1A1A1A' } },
        }}
      />

      {/* ── Top Navigation Bar ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 w-full h-14 sm:h-16 bg-bg-card/90 backdrop-blur-md border-b border-border-default flex items-center justify-between px-2 sm:px-4">
        {/* Left: Logo + Portal Label */}
        <div className="flex items-center h-full py-1">
          <img src={logo} alt="Vedhunt Logo" className="h-full w-auto object-contain scale-[1.15] sm:scale-[1.25] origin-left" />
          <span className="hidden lg:block text-primary text-[10px] leading-none font-bold tracking-wider uppercase border-l border-white/10 pl-3 ml-3 sm:ml-6">Client Portal</span>
        </div>

        {/* Center: Desktop Tab Navigation */}
        <nav className="hidden md:flex items-center gap-1 lg:gap-1.5">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab)}
                title={tab.label}
                className={`flex items-center gap-1.5 lg:gap-2 px-2.5 lg:px-4 py-2 rounded-lg text-xs lg:text-sm font-medium transition-all duration-200 cursor-pointer ${
                  active
                    ? 'bg-primary/15 text-primary border border-[#FF5A1F]/25'
                    : 'text-[#9CA3AF] hover:text-white hover:bg-bg-surface/50'
                }`}
              >
                <Icon size={14} className="shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right: Client name + Logout */}
        <div className="flex items-center gap-2 lg:gap-3">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-white text-xs lg:text-sm font-semibold leading-none">
              {client?.businessName || 'Client'}
            </span>
            <span className="hidden xl:block text-[#9CA3AF] text-[10px] mt-1">{client?.email}</span>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 lg:gap-2 px-2.5 lg:px-3 py-2 rounded-lg bg-bg-surface/50 border border-border-default text-[#9CA3AF] hover:text-[#EF4444] hover:border-[#EF4444]/30 transition-all text-xs lg:text-sm cursor-pointer"
            title="Logout"
          >
            <LogOut size={14} />
            <span className="hidden lg:block">Logout</span>
          </button>
        </div>
      </header>

      {/* ── Page Content ──────────────────────────────────────────────────── */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 md:py-8 pb-24 md:pb-8">
        <Outlet />
      </main>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-border-default py-4 px-6 text-center pb-24 md:pb-4">
        <p className="text-[#9CA3AF] text-xs">
          © {new Date().getFullYear()} Vedhunt Infotech — Client Portal.
        </p>
      </footer>

      {/* ── Mobile Bottom Navigation Bar ───────────────────────────────────── */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 z-50 bg-[#1A1F2B] border-t border-border-default px-4 flex justify-around items-center">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab)}
              className="flex flex-col items-center justify-center gap-1 flex-1 py-1 cursor-pointer transition-colors relative"
            >
              <Icon size={18} className={active ? 'text-primary' : 'text-[#9CA3AF]'} />
              <span className={`text-[10px] font-medium leading-none ${active ? 'text-primary font-semibold' : 'text-[#9CA3AF]'}`}>
                {tab.id === 'billing' ? 'Billing' : tab.id === 'projects' ? 'Projects' : tab.id === 'retainers' ? 'Retainers' : tab.id === 'support' ? 'Support' : 'Agreement'}
              </span>
              {active && (
                <span className="absolute top-0 w-8 h-[2px] bg-primary rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ClientLayout;
