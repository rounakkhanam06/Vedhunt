import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { useState } from 'react';
import { useEmployeeStore } from '../store/useEmployeeStore';
import { useTheme } from '../context/ThemeContext';
import {
  LayoutDashboard,
  Clock,
  CheckSquare,
  FileSpreadsheet,
  CreditCard,
  Award,
  User,
  LifeBuoy,
  UserCheck,
  AlertTriangle,
  LogOut,
  Sun,
  Moon,
  X,
  Menu
} from 'lucide-react';
import darkLogo from '../assets/logo_Square.jpg__1_-removebg-preview.png';
import NotificationBell from './components/NotificationBell';

const EmployeeLayout = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const { employee, logout } = useEmployeeStore();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/employee/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/employee/dashboard?tab=dashboard', icon: LayoutDashboard },
    { name: 'My Leads', path: '/employee/dashboard?tab=leads', icon: UserCheck },
    { name: 'Follow-ups', path: '/employee/dashboard?tab=followups', icon: AlertTriangle },
    { name: 'Attendance & Leave', path: '/employee/dashboard?tab=attendance', icon: Clock },
    { name: 'My Tasks', path: '/employee/dashboard?tab=tasks', icon: CheckSquare },
    { name: 'My Timesheet', path: '/employee/dashboard?tab=timesheet', icon: FileSpreadsheet },
    { name: 'My Payslips', path: '/employee/dashboard?tab=payslips', icon: CreditCard },
    { name: 'My Performance', path: '/employee/dashboard?tab=performance', icon: Award },
    { name: 'Assigned Tickets', path: '/employee/dashboard?tab=tickets', icon: LifeBuoy },
    { name: 'My Profile', path: '/employee/dashboard?tab=profile', icon: User },
  ];

  return (
    <div className="h-screen bg-app-bg text-app-text flex overflow-hidden">
      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-[280px] flex flex-col transition-transform duration-300 ease-in-out overflow-y-auto
        bg-primary border-none py-6 pl-4 pr-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:flex-shrink-0
      `}>
        <div className="mb-12 flex justify-between items-start shrink-0 pr-6">
          <div className="relative flex items-start">
            <img src={darkLogo} alt="Vedhunt Logo" className="h-12 md:h-14 w-auto object-contain scale-[1.6] origin-left brightness-0 invert" />
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="text-white hover:text-white/80 lg:hidden" title="Close Sidebar">
            <X size={24} />
          </button>
        </div>

        {/* The sidebar itself is a fixed brand-orange surface in both themes,
            so text/hover states on it stay fixed white rather than
            theme-reactive — only the active item (which "cuts out" onto the
            page background) switches with the theme. */}
        <nav className="flex-1 mt-4 pb-4 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const fullPathActive = (location.pathname + location.search) === item.path;
            const isDefaultActive = location.pathname === item.path.split('?')[0] && !location.search && item.path.includes('tab=dashboard');
            const isActive = fullPathActive || isDefaultActive;

            return (
              <Link
                key={item.name}
                to={item.path}
                className={`
                  flex items-center gap-4 py-2.5 px-4 transition-all duration-300 relative rounded-l-[30px]
                  before:content-[""] before:absolute before:right-0 before:-top-6 before:w-6 before:h-6 before:bg-transparent before:rounded-br-[30px] before:transition-all before:duration-300
                  after:content-[""] after:absolute after:right-0 after:-bottom-6 after:w-6 after:h-6 after:bg-transparent after:rounded-tr-[30px] after:transition-all after:duration-300
                  ${isActive
                    ? 'bg-app-bg text-primary mr-0 rounded-r-none before:shadow-[15px_15px_0_15px_var(--app-bg)] after:shadow-[15px_-15px_0_15px_var(--app-bg)] font-bold'
                    : 'bg-transparent text-white/80 hover:text-white hover:bg-white/10 mr-4 rounded-r-[30px] before:shadow-[15px_15px_0_15px_transparent] after:shadow-[15px_-15px_0_15px_transparent] font-medium'
                  }
                `}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer profile card */}
        <div className="mt-6 flex items-center justify-between p-4 bg-black/15 hover:bg-black/25 rounded-xl shrink-0 mt-auto cursor-pointer transition-colors mr-4">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 flex items-center justify-center text-white text-xl font-extrabold bg-white/15 rounded-full shrink-0">
              {employee?.email?.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-[13px] font-bold text-white truncate">{employee?.firstName || employee?.email}</p>
              <p className="text-[10px] uppercase tracking-widest text-white/60 truncate mt-0.5">
                Employee
              </p>
            </div>
          </div>
          <div className="flex items-center shrink-0">
            <button
              onClick={() => setShowLogoutModal(true)}
              className="text-white/80 hover:text-white transition-colors p-2"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="sticky top-0 z-40 h-16 flex items-center justify-between px-4 sm:px-6 bg-app-card/80 backdrop-blur-md border-b border-app-border">
          <div className="flex items-center gap-4 lg:hidden">
            <button onClick={() => setIsMobileMenuOpen(true)} className="text-app-text-muted hover:text-app-text">
              <Menu size={24} />
            </button>
            {/* This header sits on the theme-reactive card background (unlike
                the sidebar's fixed orange), so the logo only gets forced white
                in dark mode — in light mode it renders in its natural colors. */}
            <img src={darkLogo} alt="Vedhunt Logo" className="h-10 w-auto object-contain scale-[1.2] origin-left dark:brightness-0 dark:invert" />
          </div>
          <div className="hidden lg:block flex-1"></div>
          
          <div className="flex items-center gap-2 sm:gap-3 ml-auto">
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
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-app-bg">
          <Outlet />
        </div>
      </main>

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
  );
};

export default EmployeeLayout;
