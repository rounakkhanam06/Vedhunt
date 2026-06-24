import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Menu, Search, Bell, User } from 'lucide-react';
import Sidebar from './components/Sidebar';
import { Toaster } from 'react-hot-toast';
import { useAdminStore } from '../store/useAdminStore';

const AdminLayout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const navigate = useNavigate();
  const { admin } = useAdminStore();
  const isEmployee = admin?.roles?.some(r => r.name === 'EMPLOYEE');
  const isEmployeeOnly = isEmployee && admin?.roles?.length === 1;

  return (
    <div className="min-h-screen bg-admin-bg text-on-surface font-sans">
      <Toaster 
        position="top-right" 
        toastOptions={{
          style: {
            background: '#1A1A1A',
            color: '#FFFFFF',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
          },
          success: {
            iconTheme: {
              primary: '#FF6B00',
              secondary: '#1A1A1A',
            },
          },
        }} 
      />
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      
      <div className={`flex flex-col min-h-screen transition-all duration-300 ${isSidebarOpen ? 'lg:ml-[240px]' : 'lg:ml-0'}`}>
        {/* TopNavBar Shell */}
        <header className="sticky top-0 z-40 w-full h-16 bg-surface/80 backdrop-blur-md border-b border-outline-variant flex justify-between items-center px-6">
          <div className="flex items-center gap-6">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="text-on-surface-variant hover:text-on-surface focus:outline-none"
              title="Toggle Sidebar"
            >
              <Menu size={24} />
            </button>
            <span className="text-xl font-bold text-on-surface hidden sm:block">
              {isEmployeeOnly ? 'Employee Dashboard' : 'Admin Dashboard'}
            </span>
            

          </div>

          <div className="flex items-center gap-3 sm:gap-4 relative">
            <button className="w-10 h-10 flex items-center justify-center text-on-surface-variant hover:text-secondary transition-colors">
              <Bell size={20} />
            </button>
            
            {/* Profile Dropdown */}
            <div className="relative">
              <button 
                onClick={() => navigate(isEmployeeOnly ? '/employee/dashboard?tab=profile' : '/admin/profile')}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-[#1A1A1A] border border-[#2D2D33] text-on-surface hover:ring-1 hover:ring-[#FF6B00] transition-all cursor-pointer"
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
