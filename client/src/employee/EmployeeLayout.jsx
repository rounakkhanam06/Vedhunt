import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { useEmployeeStore } from '../store/useEmployeeStore';
import { useTheme } from '../context/ThemeContext';
import { LogOut, Sun, Moon, Menu, PanelLeftClose, PanelLeftOpen, Search, X } from 'lucide-react';
import BrandLogo from '../components/brand/BrandLogo';
import NotificationBell from './components/NotificationBell';
import { WorkTimerProvider, TimerHeaderChip, TimerFloatingWidget } from './components/WorkTimer';
import { visibleModules, modulePath } from './config/modules';
import { useAccess } from './lib/ess';

const EmployeeLayout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024;
    }
    return true;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const { employee, logout } = useEmployeeStore();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const access = useAccess();

  const handleLogout = async () => {
    await logout();
    navigate('/employee/login');
  };

  // Role permissions + segment decide the sidebar (see config/modules.js).
  const navItems = visibleModules(access);
  const filteredNavItems = navItems.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );
  const activeTab = new URLSearchParams(location.search).get('tab') || 'dashboard';
  const onDashboard = location.pathname === '/employee/dashboard';

  return (
    <WorkTimerProvider>
    <div className="h-screen bg-app-bg text-app-text flex overflow-hidden">
      {/* Mobile backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-xs lg:hidden transition-opacity duration-300 ease-in-out ${
          isSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:sticky top-0 inset-y-0 left-0 z-50 h-screen flex flex-col shrink-0
          bg-app-card border-r transition-[width,transform,opacity,border-color] duration-300 ease-in-out
          ${isSidebarOpen 
            ? 'w-64 sm:w-72 translate-x-0 opacity-100 border-app-border shadow-2xl lg:shadow-none pointer-events-auto' 
            : '-translate-x-full lg:translate-x-0 lg:w-0 opacity-0 overflow-hidden border-transparent pointer-events-none'
          }
        `}
      >
        <div className="w-64 sm:w-72 h-full flex flex-col p-5 shrink-0 overflow-y-auto">
          {/* Top Logo & Close Button */}
          <div className="flex items-center justify-between shrink-0 mb-6 px-1">
            <BrandLogo variant="auto" className="h-6" />
            <button 
              onClick={() => setIsSidebarOpen(false)} 
              className="text-app-text-muted hover:text-app-text transition-colors p-1.5 rounded-lg hover:bg-app-border/40 cursor-pointer" 
              title="Close Sidebar"
            >
              <PanelLeftClose size={18} />
            </button>
          </div>

          {/* Search Bar with Breathing Room */}
          <div className="relative mb-5 shrink-0">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted pointer-events-none" />
            <input
              type="text"
              placeholder="Search pages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-app-bg/60 border border-app-border rounded-xl pl-9 pr-8 py-2 text-xs text-app-text placeholder:text-app-text-muted focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/40 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-app-text-muted hover:text-app-text p-0.5 rounded transition-colors cursor-pointer"
                title="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Nav Items */}
          <nav className="flex-1 space-y-1.5 overflow-y-auto pr-1">
            {filteredNavItems.length === 0 ? (
              <div className="text-center py-6 px-2 text-xs text-app-text-muted">
                No pages matching &ldquo;{searchQuery}&rdquo;
              </div>
            ) : (
              filteredNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = onDashboard && activeTab === item.key;

                return (
                  <Link
                    key={item.key}
                    to={modulePath(item.key)}
                    onClick={() => {
                      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                        setIsSidebarOpen(false);
                      }
                    }}
                    className={`
                      relative group flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors duration-200
                      ${isActive
                        ? 'text-primary font-semibold'
                        : 'text-app-text-muted hover:text-app-text hover:bg-app-border/30'
                      }
                    `}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="employeeActiveNavPill"
                        className="absolute inset-0 bg-primary/10 border border-primary/25 rounded-xl shadow-sm shadow-primary/5"
                        transition={{
                          type: "spring",
                          stiffness: 380,
                          damping: 32,
                          mass: 0.8
                        }}
                      />
                    )}
                    <Icon className={`relative z-10 w-5 h-5 flex-shrink-0 transition-colors duration-200 ${isActive ? 'text-primary' : 'text-app-text-muted group-hover:text-app-text'}`} />
                    <span className="relative z-10 truncate">{item.name}</span>
                    {isActive && (
                      <motion.span
                        layoutId="employeeActiveNavDot"
                        className="relative z-10 ml-auto w-1.5 h-1.5 rounded-full bg-primary shrink-0"
                        transition={{
                          type: "spring",
                          stiffness: 380,
                          damping: 32,
                          mass: 0.8
                        }}
                      />
                    )}
                  </Link>
                );
              })
            )}
          </nav>

          {/* Footer profile card */}
          <div className="pt-4 mt-auto border-t border-app-border shrink-0">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-app-bg/50 border border-app-border/60 hover:border-app-border transition-colors">
              <div className="flex items-center gap-3 min-w-0 pr-2">
                <div className="w-9 h-9 flex items-center justify-center text-primary text-sm font-bold bg-primary/10 border border-primary/20 rounded-full shrink-0">
                  {employee?.email?.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-app-text truncate">
                    {employee?.firstName ? `${employee.firstName} ${employee.lastName || ''}`.trim() : employee?.email}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-app-text-muted truncate mt-0.5">
                    {employee?.segment && employee.segment !== 'General' ? `${employee.segment} · Employee` : 'Employee'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowLogoutModal(true)}
                className="text-app-text-muted hover:text-red-500 hover:bg-red-500/10 p-2 rounded-lg transition-colors shrink-0 cursor-pointer"
                title="Logout"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="sticky top-0 z-40 h-16 flex items-center justify-between px-4 sm:px-6 bg-app-card/80 backdrop-blur-md border-b border-app-border">
          <div className="flex items-center gap-3">
            {!isSidebarOpen && (
              <button 
                onClick={() => setIsSidebarOpen(true)} 
                className="text-app-text-muted hover:text-app-text transition-colors p-2 rounded-lg hover:bg-app-border/40 cursor-pointer flex items-center justify-center"
                title="Open Sidebar"
              >
                <PanelLeftOpen size={20} className="hidden lg:block" />
                <Menu size={22} className="lg:hidden" />
              </button>
            )}
            {!isSidebarOpen && (
              <div className="flex items-center gap-2">
                <BrandLogo variant="auto" className="h-6" />
              </div>
            )}
          </div>
          <div className="hidden lg:block flex-1"></div>

          <div className="flex items-center gap-2 sm:gap-3 ml-auto">
            <TimerHeaderChip />
            <button
              onClick={toggleTheme}
              className="text-app-text-muted hover:text-app-text transition-colors p-2 rounded-full hover:bg-app-border/30"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <NotificationBell />
          </div>
        </header>
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8 bg-app-bg min-w-0 max-w-full">
          <Outlet />
        </div>
      </main>

      <TimerFloatingWidget />

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-app-card border border-app-border rounded-xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4 text-red-500">
                <LogOut size={32} />
              </div>
              <h3 className="text-xl font-bold text-app-text mb-2">Confirm Logout</h3>
              <p className="text-app-text-muted text-sm">Are you sure you want to log out of your employee account?</p>
            </div>

            <div className="p-6 border-t border-app-border flex gap-3 bg-app-card">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-app-border text-app-text hover:bg-app-border/30 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 px-4 py-2.5 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold transition-colors cursor-pointer"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </WorkTimerProvider>
  );
};

export default EmployeeLayout;
