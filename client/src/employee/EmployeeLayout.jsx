import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { useState } from 'react';
import { useEmployeeStore } from '../store/useEmployeeStore';
import { 
  LayoutDashboard, 
  Clock, 
  CheckSquare, 
  FileSpreadsheet, 
  CreditCard, 
  Award, 
  User, 
  LifeBuoy,
  LogOut, 
  X, 
  Menu 
} from 'lucide-react';
import darkLogo from '../assets/logo_Square.jpg__1_-removebg-preview.png';

const EmployeeLayout = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const { employee, logout } = useEmployeeStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/employee/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/employee/dashboard?tab=dashboard', icon: LayoutDashboard },
    { name: 'Attendance & Leave', path: '/employee/dashboard?tab=attendance', icon: Clock },
    { name: 'My Tasks', path: '/employee/dashboard?tab=tasks', icon: CheckSquare },
    { name: 'My Timesheet', path: '/employee/dashboard?tab=timesheet', icon: FileSpreadsheet },
    { name: 'My Payslips', path: '/employee/dashboard?tab=payslips', icon: CreditCard },
    { name: 'My Performance', path: '/employee/dashboard?tab=performance', icon: Award },
    { name: 'Assigned Tickets', path: '/employee/dashboard?tab=tickets', icon: LifeBuoy },
    { name: 'My Profile', path: '/employee/dashboard?tab=profile', icon: User },
  ];

  return (
    <div className="min-h-screen bg-[#0d0d0f] text-white flex">
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
        bg-[#FF8533] border-none py-6 pl-4 pr-0
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
                  flex items-center gap-4 py-2.5 px-4 transition-all duration-300
                  ${isActive
                    ? 'bg-[#0d0d0f] text-[#FF8533] rounded-l-[30px] rounded-r-none relative before:content-[""] before:absolute before:right-0 before:-top-6 before:w-6 before:h-6 before:bg-transparent before:rounded-br-[30px] before:shadow-[15px_15px_0_15px_#0d0d0f] after:content-[""] after:absolute after:right-0 after:-bottom-6 after:w-6 after:h-6 after:bg-transparent after:rounded-tr-[30px] after:shadow-[15px_-15px_0_15px_#0d0d0f] font-bold'
                    : 'text-white/80 hover:text-white hover:bg-white/10 rounded-l-[30px] mr-4 font-medium'
                  }
                `}
                onClick={() => setIsMobileMenuOpen(false)}
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
            <div className="w-10 h-10 flex items-center justify-center text-white text-xl font-extrabold bg-white/10 rounded-full shrink-0">
              {employee?.email?.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-[13px] font-bold text-white truncate">{employee?.firstName || employee?.email}</p>
              <p className="text-[10px] uppercase tracking-widest text-white/50 truncate mt-0.5">
                Employee
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowLogoutModal(true)}
            className="text-white/80 hover:text-white transition-colors p-2"
            title="Logout"
          >
            <LogOut size={20} />
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="lg:hidden h-16 flex items-center justify-between px-4 sm:px-6 bg-[#141416] border-b border-white/5">
          <img src={darkLogo} alt="Vedhunt Logo" className="h-8 w-auto" />
          <button onClick={() => setIsMobileMenuOpen(true)} className="text-gray-400 hover:text-white">
            <Menu size={24} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[#0d0d0f]">
          <Outlet />
        </div>
      </main>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1A1A1A] border border-[#2D2D33] rounded-xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4 text-red-500">
                <LogOut size={32} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Confirm Logout</h3>
              <p className="text-gray-400 text-sm">Are you sure you want to log out of your employee account?</p>
            </div>
            
            <div className="p-6 border-t border-[#2D2D33] flex gap-3 bg-[#1A1A1A]">
              <button 
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-[#2D2D33] text-gray-300 hover:bg-[#2D2D33] hover:text-white transition-colors cursor-pointer"
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
