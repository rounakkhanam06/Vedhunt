import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Menu, Search, User, Sun, Moon } from 'lucide-react';
import Sidebar from './components/Sidebar';
import NotificationBell from './components/NotificationBell';
import { Toaster } from 'react-hot-toast';
import { useAdminStore } from '../store/useAdminStore';
import { useTheme } from '../context/ThemeContext';

const AdminLayout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const navigate = useNavigate();
  const { admin } = useAdminStore();
  const { theme, toggleTheme } = useTheme();
  const isEmployee = admin?.roles?.some(r => r.name === 'EMPLOYEE');
  const isEmployeeOnly = isEmployee && admin?.roles?.length === 1;

  return (
    <div className="min-h-screen bg-app-bg text-app-text font-sans transition-colors duration-200">
      <Toaster 
        position="top-right" 
        toastOptions={{
          className: 'dark:!bg-[#1A1A1A] dark:!text-white dark:!border-[#2D2D33] !bg-white !text-gray-900 !border-gray-200',
          style: {
            border: '1px solid rgba(150, 150, 150, 0.2)',
            borderRadius: '8px',
          },
          success: {
            iconTheme: {
              primary: '#FF6B00',
              secondary: 'transparent',
            },
          },
        }} 
      />
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      
      <div className={`flex flex-col flex-1 transition-all duration-300 ${isSidebarOpen ? 'lg:ml-[280px]' : 'lg:ml-0'}`}>
        {/* TopNavBar Shell */}
        <header className="sticky top-0 z-40 w-full h-16 bg-app-card/80 backdrop-blur-md border-b border-app-border flex justify-between items-center px-6 transition-colors duration-200">
          <div className="flex items-center gap-6">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="text-app-text-muted hover:text-app-text focus:outline-none transition-colors"
              title="Toggle Sidebar"
            >
              <Menu size={24} />
            </button>
            <span className="text-xl font-bold text-app-text hidden sm:block">
              {isEmployeeOnly ? 'Employee Dashboard' : 'Admin Dashboard'}
            </span>
            

          </div>

          <div className="flex items-center gap-3 sm:gap-4 relative">
            <button
              onClick={toggleTheme}
              className="text-app-text-muted hover:text-app-text transition-colors p-2 rounded-full hover:bg-app-border/30"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <NotificationBell />

            {/* Profile Dropdown */}
            <div className="relative">
              <button 
                onClick={() => navigate(isEmployeeOnly ? '/employee/dashboard?tab=profile' : '/admin/profile')}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-app-card border border-app-border text-app-text hover:ring-1 hover:ring-[#FF6B00] transition-all cursor-pointer"
              >
                <User size={18} />
              </button>
            </div>


          </div>
        </header>
        
        {/* Page Body */}
        <main className="flex-1 p-6 space-y-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
