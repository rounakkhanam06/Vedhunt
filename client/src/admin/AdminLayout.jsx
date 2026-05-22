import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu, Search, Bell } from 'lucide-react';
import Sidebar from './components/Sidebar';

const AdminLayout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-admin-bg text-on-surface font-sans">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      
      <div className="flex flex-col min-h-screen lg:ml-[280px]">
        {/* TopNavBar Shell */}
        <header className="sticky top-0 z-40 w-full h-16 bg-surface/80 backdrop-blur-md border-b border-outline-variant flex justify-between items-center px-6">
          <div className="flex items-center gap-6">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="text-on-surface-variant hover:text-on-surface focus:outline-none lg:hidden"
            >
              <Menu size={24} />
            </button>
            <span className="text-xl font-bold text-on-surface hidden sm:block">Admin Dashboard</span>
            
            <div className="relative hidden lg:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant w-4 h-4" />
              <input 
                className="bg-[#121215] border border-[#2D2D33] rounded-lg pl-10 pr-4 py-2 text-sm focus:border-secondary focus:ring-0 w-64 transition-all text-on-surface placeholder:text-on-surface-variant outline-none" 
                placeholder="Global system search..." 
                type="text" 
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="w-10 h-10 flex items-center justify-center text-on-surface-variant hover:text-secondary transition-colors">
              <Bell size={20} />
            </button>
            <div className="h-8 w-[1px] bg-outline-variant"></div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#00FF94] animate-pulse"></div>
              <span className="text-[10px] tracking-widest font-medium text-[#00FF94]">SYSTEM ONLINE</span>
            </div>
          </div>
        </header>
        
        {/* Page Body */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
