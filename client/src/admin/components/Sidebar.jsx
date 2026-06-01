import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Users, ChevronDown, ChevronRight, Activity, 
  Briefcase, FileText, Wallet, ShieldCheck, Settings, LogOut, X,
  Image as ImageIcon, Tag
} from 'lucide-react';
import { useAdminStore } from '../../store/useAdminStore';
import darkLogo from '../../assets/DarkthemeLogo.png';

const Sidebar = ({ isOpen, setIsOpen }) => {
  const { logout, admin } = useAdminStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [openDropdowns, setOpenDropdowns] = useState({ leads: true, cms: false, pricing: false });

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  const toggleDropdown = (key) => {
    setOpenDropdowns(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const navItems = [
    { name: 'Overview', path: '/admin/dashboard', icon: LayoutDashboard },
    { 
      name: 'Lead Manager', 
      icon: Users,
      dropdownKey: 'leads',
      subItems: [
        { name: 'Organic Leads', path: '/admin/leads/organic' },
        { name: 'Ad Leads (/lp/)', path: '/admin/leads/ads' },
      ]
    },
    { name: 'Campaign Performance', path: '/admin/campaigns', icon: Activity },
    { name: 'Service & Projects', path: '/admin/projects', icon: Briefcase },
    { 
      name: 'Content Manager (CMS)', 
      icon: FileText,
      dropdownKey: 'cms',
      subItems: [
        { name: 'Manage Landing Page', path: '/admin/landing-page' },
        { name: 'Navbar Links', path: '/admin/navbar' },
        { name: 'Services', path: '/admin/services' },
        { name: 'Portfolio Items', path: '/admin/portfolio' },
        { name: 'Blogs & Videos', path: '/admin/cms/content' },
        { name: 'Testimonials', path: '/admin/testimonials' },
        { name: 'Our Presence', path: '/admin/presence' },
        { name: 'About Page', path: '/admin/about' },
      ]
    },
    { name: 'Financials & Invoicing', path: '/admin/finance', icon: Wallet },
    { 
      name: 'Pricing Management', 
      icon: Tag,
      dropdownKey: 'pricing',
      subItems: [
        { name: 'Home Pricing Cards', path: '/admin/home-pricing' },
        { name: 'Pricing Plan', path: '/admin/pricing' },
      ]
    },
    { name: 'Team Management', path: '/admin/team', icon: ShieldCheck },
    { name: 'Settings', path: '/admin/settings', icon: Settings },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-[280px] bg-surface-container-low border-r border-outline-variant flex flex-col p-6 transition-transform duration-300 ease-in-out overflow-y-auto
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="mb-10 flex justify-between items-start shrink-0">
          <div className="flex items-center gap-2 mt-1">
            <img src={darkLogo} alt="Vedhunt Logo" className="h-16 w-auto object-contain max-w-[180px]" />
            <span className="bg-secondary text-black text-[10px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wider">Admin</span>
          </div>
          <button onClick={() => setIsOpen(false)} className="text-on-surface-variant hover:text-on-surface lg:hidden" title="Close Sidebar">
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 space-y-2 pr-2 mt-4 pb-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            
            if (item.subItems) {
              const isAnySubActive = item.subItems.some(sub => location.pathname === sub.path);
              const isOpen = openDropdowns[item.dropdownKey] || isAnySubActive;
              
              return (
                <div key={item.name} className="space-y-1">
                  <button
                    onClick={() => toggleDropdown(item.dropdownKey)}
                    className={`
                      w-full flex items-center justify-between gap-4 px-4 py-2 rounded-lg text-sm transition-all duration-200 cursor-pointer
                      ${isOpen
                        ? 'text-on-surface bg-surface-variant/30' 
                        : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/50'
                      }
                    `}
                  >
                    <div className="flex items-center gap-4">
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      <span className="font-medium">{item.name}</span>
                    </div>
                    {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                  
                  <div className={`ml-9 overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-96 opacity-100 mt-1' : 'max-h-0 opacity-0 mt-0'}`}>
                    <div className="space-y-1">
                      {item.subItems.map((subItem) => {
                        const isSubActive = location.pathname === subItem.path;
                        return (
                          <Link
                            key={subItem.name}
                            to={subItem.path}
                            className={`
                              block px-4 py-2 rounded-lg text-sm transition-all duration-200
                              ${isSubActive 
                                ? 'bg-secondary-container/10 text-secondary font-bold shadow-[0_0_10px_rgba(255,107,0,0.15)] active:scale-[0.98]' 
                                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/30'
                              }
                            `}
                          >
                            {subItem.name}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            }

            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`
                  flex items-center gap-4 px-4 py-2 rounded-lg text-sm transition-all duration-200
                  ${isActive 
                    ? 'bg-secondary-container/10 text-secondary font-bold shadow-[0_0_10px_rgba(255,107,0,0.15)] active:scale-[0.98]' 
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/50'
                  }
                `}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-6 flex items-center justify-between p-4 bg-surface-variant/30 rounded-xl shrink-0 mt-auto">
          <div className="flex items-center gap-4 overflow-hidden">
            <div className="w-10 h-10 rounded-full bg-admin-primary/20 flex items-center justify-center text-admin-primary font-bold">
              {admin?.email?.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-on-surface truncate">{admin?.email}</p>
              <p className="text-[10px] uppercase tracking-widest text-on-primary-container truncate">{admin?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="text-on-surface-variant hover:text-error transition-colors p-2"
            title="Logout"
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
