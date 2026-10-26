import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { useClientStore } from '../store/useClientStore';
import logo from '../assets/DarkthemeLogo.png';
import {
  FileText,
  LayoutDashboard,
  Rocket,
  RefreshCcw,
  LifeBuoy,
  Target,
  ShieldCheck,
  BarChart3,
  ListChecks,
  Clock,
  UserCircle,
  LogOut,
  MoreHorizontal,
  Menu,
  X,
} from 'lucide-react';
import clientApi from '../services/clientApi';
import ServiceAgreementAcceptance from './pages/ServiceAgreementAcceptance';
import ClientNotificationBell from './components/ClientNotificationBell';

const TABS = [
  { id: 'overview',  label: 'Overview',   icon: LayoutDashboard, path: '/client/dashboard?tab=overview' },
  { id: 'performance', label: 'Performance', icon: BarChart3, path: '/client/dashboard?tab=performance' },
  { id: 'billing',   label: 'Billing',    icon: FileText,      path: '/client/dashboard?tab=billing' },
  { id: 'projects',  label: 'Projects',   icon: Rocket,        path: '/client/dashboard?tab=projects' },
  { id: 'retainers', label: 'Retainers',  icon: RefreshCcw,    path: '/client/dashboard?tab=retainers' },
  { id: 'work',      label: 'Work log',   icon: Clock,         path: '/client/dashboard?tab=work' },
  { id: 'support',   label: 'Support',    icon: LifeBuoy,      path: '/client/dashboard?tab=support' },
  { id: 'strategy',  label: 'Strategy',   icon: Target,        path: '/client/dashboard?tab=strategy' },
  { id: 'onboarding', label: 'Setup',     icon: ListChecks,    path: '/client/dashboard?tab=onboarding' },
  { id: 'kyc',       label: 'KYC',        icon: ShieldCheck,   path: '/client/dashboard?tab=kyc' },
  { id: 'agreement', label: 'Agreement',  icon: FileText,      path: '/client/dashboard?tab=agreement' },
  { id: 'account',   label: 'Account',    icon: UserCircle,    path: '/client/dashboard?tab=account' },
];

// Phones fit four tabs comfortably; the rest sit behind "More"
const MOBILE_PRIMARY_IDS = ['overview', 'performance', 'billing', 'support'];
const MOBILE_PRIMARY = TABS.filter((t) => MOBILE_PRIMARY_IDS.includes(t.id));
const MOBILE_MORE = TABS.filter((t) => !MOBILE_PRIMARY_IDS.includes(t.id));
// Desktop has room for a few more in the bar; the rest go under "More"
const DESKTOP_PRIMARY_IDS = ['overview', 'performance', 'billing', 'projects', 'retainers', 'support'];
const DESKTOP_PRIMARY = TABS.filter((t) => DESKTOP_PRIMARY_IDS.includes(t.id));
const DESKTOP_MORE = TABS.filter((t) => !DESKTOP_PRIMARY_IDS.includes(t.id));

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

  // Prefer the accepted version returned with the agreement (fresh from the
  // DB) over the store copy, which is only as recent as the last /me call.
  const acceptedVersion =
    agreement?.client?.acceptedAgreementVersion ?? client?.acceptedAgreementVersion ?? 0;
  const needsAgreement = agreement && acceptedVersion < agreement.version;

  const currentTab = new URLSearchParams(location.search).get('tab') || 'overview';

  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Only the person pressing Logout is asked to confirm — an expired session
  // still signs out silently (services/clientApi.js).
  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
      setConfirmLogout(false);
    }
    navigate('/client/login');
  };

  // Escape cancels the confirmation
  useEffect(() => {
    if (!confirmLogout) return undefined;
    const onKey = (e) => { if (e.key === 'Escape' && !loggingOut) setConfirmLogout(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmLogout, loggingOut]);

  const [moreOpen, setMoreOpen] = useState(false);
  const [deskMoreOpen, setDeskMoreOpen] = useState(false);

  const handleTabClick = (tab) => {
    setMoreOpen(false);
    setDeskMoreOpen(false);
    navigate(`/client/dashboard?tab=${tab.id}`);
  };

  // Escape closes the "More" sheet
  useEffect(() => {
    if (!moreOpen && !deskMoreOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { setMoreOpen(false); setDeskMoreOpen(false); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moreOpen, deskMoreOpen]);

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
        <nav className="hidden md:flex items-center gap-1 lg:gap-1.5" aria-label="Client portal">
          {DESKTOP_PRIMARY.map((tab) => {
            const Icon = tab.icon;
            const active = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab)}
                title={tab.label}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-1.5 lg:gap-2 px-2.5 lg:px-3 py-2 rounded-lg text-xs lg:text-sm font-medium transition-all duration-200 cursor-pointer ${
                  active
                    ? 'bg-primary/15 text-primary border border-[#FF5A1F]/25'
                    : 'text-[#9CA3AF] hover:text-white hover:bg-bg-surface/50'
                }`}
              >
                <Icon size={14} className="shrink-0" />
                <span className="hidden lg:inline">{tab.label}</span>
              </button>
            );
          })}
          <div className="relative">
            {(() => {
              const moreActive = deskMoreOpen || DESKTOP_MORE.some((t) => t.id === currentTab);
              return (
                <button
                  type="button" onClick={() => setDeskMoreOpen((o) => !o)} aria-haspopup="menu" aria-expanded={deskMoreOpen}
                  className={`flex items-center gap-1.5 px-2.5 lg:px-3 py-2 rounded-lg text-xs lg:text-sm font-medium cursor-pointer ${moreActive ? 'bg-primary/15 text-primary border border-[#FF5A1F]/25' : 'text-[#9CA3AF] hover:text-white hover:bg-bg-surface/50'}`}
                >
                  <MoreHorizontal size={14} /> <span className="hidden lg:inline">{DESKTOP_MORE.find((t) => t.id === currentTab)?.label || 'More'}</span>
                </button>
              );
            })()}
            {deskMoreOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setDeskMoreOpen(false)} aria-hidden="true" />
                <div role="menu" className="absolute right-0 mt-2 w-52 z-50 rounded-xl border border-border-default bg-[#1A1F2B] shadow-2xl p-1.5">
                  {DESKTOP_MORE.map((tab) => {
                    const Icon = tab.icon;
                    const active = currentTab === tab.id;
                    return (
                      <button key={tab.id} role="menuitem" onClick={() => handleTabClick(tab)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm cursor-pointer ${active ? 'bg-primary/15 text-primary' : 'text-[#E5E7EB] hover:bg-bg-surface/50'}`}>
                        <Icon size={15} /> {tab.label}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </nav>

        {/* Right: Client name + Logout */}
        <div className="flex items-center gap-2 lg:gap-3">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-white text-xs lg:text-sm font-semibold leading-none">
              {client?.businessName || 'Client'}
            </span>
            <span className="hidden xl:block text-[#9CA3AF] text-[10px] mt-1">{client?.email}</span>
          </div>

          <ClientNotificationBell />

          <button
            onClick={() => { setMoreOpen(false); setConfirmLogout(true); }}
            className="flex items-center gap-1.5 lg:gap-2 px-2.5 lg:px-3 py-2 rounded-lg bg-bg-surface/50 border border-border-default text-[#9CA3AF] hover:text-[#EF4444] hover:border-[#EF4444]/30 transition-all text-xs lg:text-sm cursor-pointer"
            title="Logout"
            aria-label="Logout"
            aria-haspopup="dialog"
          >
            <LogOut size={14} />
            <span className="hidden lg:block">Logout</span>
          </button>
        </div>
      </header>

      {/* ── Page Content ──────────────────────────────────────────────────── */}
      {client?.serviceStatus === 'Hold' && (
        <div role="status" className="w-full bg-[#F59E0B]/10 border-b border-[#F59E0B]/30 px-4 py-2.5 text-center text-sm text-white">
          <strong className="text-[#F59E0B]">Your account is on hold.</strong>{' '}
          {client.holdReason || 'Please clear any pending payment or contact us to resume service.'}{' '}
          <button type="button" onClick={() => handleTabClick({ id: 'billing' })} className="underline text-[#F59E0B] cursor-pointer">View billing</button>
        </div>
      )}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 md:py-8 pb-24 md:pb-8">
        <Outlet />
      </main>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-border-default py-4 px-6 text-center pb-24 md:pb-4">
        <p className="text-[#9CA3AF] text-xs">
          © {new Date().getFullYear()} Vedhunt Infotech — Client Portal.
        </p>
      </footer>

      {/* ── Logout confirmation ────────────────────────────────────────────── */}
      {confirmLogout && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onMouseDown={(e) => { if (e.target === e.currentTarget && !loggingOut) setConfirmLogout(false); }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="client-logout-title"
            aria-describedby="client-logout-desc"
            className="w-full max-w-sm rounded-xl border border-border-default bg-bg-card shadow-2xl overflow-hidden"
          >
            <div className="p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-[#EF4444]/10 flex items-center justify-center mx-auto mb-4 text-[#EF4444]">
                <LogOut size={26} />
              </div>
              <h3 id="client-logout-title" className="text-white text-lg font-bold mb-1.5">Log out?</h3>
              <p id="client-logout-desc" className="text-[#9CA3AF] text-sm">
                You&apos;ll be signed out of your Vedhunt client portal{client?.businessName ? ` (${client.businessName})` : ''} on this device.
              </p>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button
                type="button"
                autoFocus
                onClick={() => setConfirmLogout(false)}
                disabled={loggingOut}
                className="flex-1 px-4 py-2.5 rounded-lg border border-border-default text-white hover:bg-white/5 transition-colors text-sm font-medium cursor-pointer disabled:opacity-50"
              >
                Stay logged in
              </button>
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex-1 px-4 py-2.5 rounded-lg bg-[#EF4444] hover:bg-[#DC2626] text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-60"
              >
                {loggingOut ? 'Logging out…' : 'Log out'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile Bottom Navigation Bar ───────────────────────────────────── */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMoreOpen(false)} aria-hidden="true" />
      )}
      {moreOpen && (
        <div
          id="client-more-menu"
          role="menu"
          aria-label="More sections"
          className="md:hidden fixed left-3 right-3 z-50 rounded-2xl border border-border-default bg-[#1A1F2B] shadow-2xl p-2"
          style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom) + 0.5rem)' }}
        >
          {MOBILE_MORE.map((tab) => {
            const Icon = tab.icon;
            const active = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                role="menuitem"
                onClick={() => handleTabClick(tab)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium cursor-pointer transition-colors ${
                  active ? 'bg-primary/15 text-primary' : 'text-[#E5E7EB] hover:bg-bg-surface/50'
                }`}
              >
                <Icon size={18} className="shrink-0" />
                {tab.label}
              </button>
            );
          })}
        </div>
      )}
      <div
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#1A1F2B] border-t border-border-default px-1 flex justify-around items-stretch"
        style={{ height: 'calc(4rem + env(safe-area-inset-bottom))', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {MOBILE_PRIMARY.map((tab) => {
          const Icon = tab.icon;
          const active = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab)}
              aria-current={active ? 'page' : undefined}
              className="flex flex-col items-center justify-center gap-1 flex-1 min-w-0 py-1 cursor-pointer transition-colors relative"
            >
              <Icon size={20} className={active ? 'text-primary' : 'text-[#9CA3AF]'} />
              <span className={`text-[11px] font-medium leading-none truncate max-w-full ${active ? 'text-primary font-semibold' : 'text-[#9CA3AF]'}`}>
                {tab.label}
              </span>
              {active && <span className="absolute top-0 w-8 h-[2px] bg-primary rounded-full" />}
            </button>
          );
        })}
        {(() => {
          const moreActive = moreOpen || MOBILE_MORE.some((t) => t.id === currentTab);
          return (
            <button
              onClick={() => setMoreOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={moreOpen}
              aria-controls="client-more-menu"
              className="flex flex-col items-center justify-center gap-1 flex-1 min-w-0 py-1 cursor-pointer transition-colors relative"
            >
              <MoreHorizontal size={20} className={moreActive ? 'text-primary' : 'text-[#9CA3AF]'} />
              <span className={`text-[11px] font-medium leading-none ${moreActive ? 'text-primary font-semibold' : 'text-[#9CA3AF]'}`}>More</span>
              {moreActive && <span className="absolute top-0 w-8 h-[2px] bg-primary rounded-full" />}
            </button>
          );
        })()}
      </div>
    </div>
  );
};

export default ClientLayout;
