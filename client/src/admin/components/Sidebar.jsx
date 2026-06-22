import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, ChevronDown, ChevronRight, Activity,
  Briefcase, FileText, Wallet, ShieldCheck, Settings, LogOut, X,
  Image as ImageIcon, Tag, UserPlus, Scale, Share2, Mail, MessageCircle,
  User, Clock, CheckSquare, FileSpreadsheet, CreditCard, Award
} from 'lucide-react';
import { useAdminStore } from '../../store/useAdminStore';
import { usePermissions } from '../hooks/usePermissions';
import darkLogo from '../../assets/DarkthemeLogo.png';

const Sidebar = ({ isOpen, setIsOpen }) => {
  const { logout, admin } = useAdminStore();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const [openDropdowns, setOpenDropdowns] = useState({
    leads: true, 
    cms: false, pricing: false, careers: false, legal: false, servicesManagement: false, faq: false
  });

  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Auto-open the dropdown that contains the current active page on navigation
  useEffect(() => {
    setOpenDropdowns(prev => {
      const updated = { ...prev };
      navItems.forEach(item => {
        if (item.subItems && item.dropdownKey) {
          const isAnySubActive = item.subItems.some(sub => location.pathname === sub.path);
          if (isAnySubActive) {
            updated[item.dropdownKey] = true;
          }
        }
      });
      return updated;
    });
  }, [location.pathname]);

  const confirmLogout = async () => {
    setShowLogoutModal(false);
    await logout();
    navigate('/admin/login');
  };

  const toggleDropdown = (key) => {
    setOpenDropdowns(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const navItems = [
    { name: 'Overview', path: '/admin/dashboard', icon: LayoutDashboard }, // no specific perm required
    { name: 'Lead Manager (Ads)', path: '/admin/leads', icon: Users, requiredPermission: 'leads.view' },
    { name: 'Subscribers', path: '/admin/subscribers', icon: Mail, requiredPermission: 'leads.view' },
    {
      name: 'Services Management',
      icon: Briefcase,
      dropdownKey: 'servicesManagement',
      requiredPermission: 'services.manage',
      subItems: [
        { name: 'Main Services Page', path: '/admin/services' },
        { name: 'Service Subpages', path: '/admin/service-pages' },
      ]
    },
    { name: 'Portfolio Items', path: '/admin/portfolio', icon: ImageIcon, requiredPermission: 'portfolio.manage' },
    {
      name: 'Content Manager (CMS)',
      icon: FileText,
      dropdownKey: 'cms',
      requiredPermission: 'cms.manage',
      subItems: [
        { name: 'Manage Landing Page', path: '/admin/landing-page' },
        { name: 'Navbar Links', path: '/admin/navbar' },
        { name: 'Blogs', path: '/admin/blogs' },
        { name: 'Testimonials', path: '/admin/testimonials' },
        { name: 'Our Presence', path: '/admin/presence' },
        { name: 'About Page', path: '/admin/about' },
      ]
    },
    {
      name: 'FAQ Management',
      icon: MessageCircle,
      dropdownKey: 'faq',
      requiredPermission: 'cms.manage',
      subItems: [
        { name: 'FAQ Page', path: '/admin/faq' },
        { name: 'FAQ Inquiries', path: '/admin/faq-inquiries' }
      ]
    },
    {
      name: 'Legal & Compliance',
      icon: Scale,
      dropdownKey: 'legal',
      requiredPermission: 'legal.manage',
      subItems: [
        { name: 'Privacy Policy', path: '/admin/privacy-policy' },
        { name: 'Terms & Conditions', path: '/admin/terms-and-conditions' },
        { name: 'Cookie Policy', path: '/admin/cookie-policy' },
        { name: 'Data Processing Agreement', path: '/admin/data-processing-agreement' },
        { name: 'Refund & Billing Policy', path: '/admin/refund-policy' },
      ]
    },
    {
      name: 'Pricing Management',
      icon: Tag,
      dropdownKey: 'pricing',
      requiredPermission: 'pricing.manage',
      subItems: [
        { name: 'Home Pricing Cards', path: '/admin/home-pricing' },
        { name: 'Pricing Plan', path: '/admin/pricing' },
      ]
    },
    {
      name: 'Careers CMS',
      icon: UserPlus,
      dropdownKey: 'careers',
      requiredPermission: 'careers.manage',
      subItems: [
        { name: 'Career Hero', path: '/admin/career-hero' },
        { name: 'Life at Vedhunt', path: '/admin/life-at-vedhunt' },
        { name: 'Job Manager', path: '/admin/jobs' },
        { name: 'Applications', path: '/admin/applications' },
      ]
    },
    { name: 'Team Management', path: '/admin/team', icon: ShieldCheck, requiredPermission: 'team.manage' },
    { 
      name: 'HRMS (Module)', 
      icon: Users, 
      dropdownKey: 'hrms', 
      requiredPermission: 'team.manage',
      subItems: [
        { name: 'Employees List', path: '/admin/employees' },
        { name: 'Organization Tasks', path: '/admin/tasks' },
        { name: 'Productivity Reports', path: '/admin/manager-dashboard' }
      ]
    },
    { name: 'Role Management', path: '/admin/roles', icon: ShieldCheck, requiredPermission: 'roles.manage' },
    { name: 'Facebook Integration', path: '/admin/facebook-integration', icon: Share2, requiredPermission: 'settings.manage' },
    { name: 'Settings', path: '/admin/settings', icon: Settings, requiredPermission: 'settings.manage' },
  ];

  const isEmployeeOnly = admin?.roles?.some(r => r.name === 'EMPLOYEE');
  const renderedNavItems = isEmployeeOnly
    ? [
        { name: 'Dashboard', path: '/admin/ess-portal?tab=dashboard', icon: LayoutDashboard },
        { name: 'Attendance & Leave', path: '/admin/ess-portal?tab=attendance', icon: Clock },
        { name: 'My Tasks', path: '/admin/ess-portal?tab=tasks', icon: CheckSquare },
        { name: 'My Timesheet', path: '/admin/ess-portal?tab=timesheet', icon: FileSpreadsheet },
        { name: 'My Payslips', path: '/admin/ess-portal?tab=payslips', icon: CreditCard },
        { name: 'My Performance', path: '/admin/ess-portal?tab=performance', icon: Award },
        { name: 'My Profile', path: '/admin/ess-portal?tab=profile', icon: User },
      ]
    : navItems;

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
        fixed inset-y-0 left-0 z-50 w-[240px] flex flex-col transition-transform duration-300 ease-in-out overflow-y-auto
        ${isEmployeeOnly ? 'bg-[#FF6B00] border-none py-6 pl-4 pr-0' : 'bg-surface-container-low border-r border-outline-variant p-6'}
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className={`mb-12 flex justify-between items-start shrink-0 ${isEmployeeOnly ? 'pr-6' : 'pl-1'}`}>
          <div className="relative flex items-start">
            <img src={darkLogo} alt="Vedhunt Logo" className={`h-12 md:h-14 w-auto object-contain scale-[1.6] origin-left ${isEmployeeOnly ? 'brightness-0 invert' : ''}`} />
          </div>
          <button onClick={() => setIsOpen(false)} className={`${isEmployeeOnly ? 'text-white hover:text-white/80' : 'text-on-surface-variant hover:text-on-surface'} lg:hidden`} title="Close Sidebar">
            <X size={24} />
          </button>
        </div>

        <nav className={`flex-1 mt-4 pb-4 ${isEmployeeOnly ? 'space-y-0.5' : 'space-y-2 pr-2'}`}>
          {renderedNavItems.map((item) => {
            // Check permission for rendering this item
            if (item.requiredPermission && !can(item.requiredPermission)) {
              return null;
            }

            const Icon = item.icon;

            if (item.subItems) {
              const isAnySubActive = item.subItems.some(sub => location.pathname === sub.path);
              const isOpen = openDropdowns[item.dropdownKey];

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
                        // Sub items could also have requiredPermission if needed in future
                        if (subItem.requiredPermission && !can(subItem.requiredPermission)) {
                          return null;
                        }
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

            const isPathActive = location.pathname === item.path;
            const fullPathActive = (location.pathname + location.search) === item.path;
            const isDefaultActive = location.pathname === item.path.split('?')[0] && !location.search && item.path.includes('tab=dashboard');
            const isActive = item.path.includes('?') ? fullPathActive || isDefaultActive : isPathActive;
            
            if (isEmployeeOnly) {
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`
                    flex items-center gap-4 py-2.5 px-4 transition-all duration-300
                    ${isActive
                      ? 'bg-[#0F0F12] text-[#FF6B00] rounded-l-[30px] rounded-r-none relative before:content-[""] before:absolute before:right-0 before:-top-6 before:w-6 before:h-6 before:bg-transparent before:rounded-br-[30px] before:shadow-[15px_15px_0_15px_#0F0F12] after:content-[""] after:absolute after:right-0 after:-bottom-6 after:w-6 after:h-6 after:bg-transparent after:rounded-tr-[30px] after:shadow-[15px_-15px_0_15px_#0F0F12] font-bold'
                      : 'text-white/80 hover:text-white hover:bg-white/10 rounded-l-[30px] mr-4 font-medium'
                    }
                  `}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span>{item.name}</span>
                </Link>
              );
            }

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

        {isEmployeeOnly ? (
          <div className="mt-6 flex items-center justify-between p-4 bg-black/15 hover:bg-black/25 rounded-xl shrink-0 mt-auto cursor-pointer transition-colors mr-4">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 flex items-center justify-center text-white text-xl font-extrabold">
                {admin?.email?.charAt(0).toUpperCase()}
              </div>
              <div className="overflow-hidden">
                <p className="text-[13px] font-bold text-white truncate">{admin?.email}</p>
                <p className="text-[10px] uppercase tracking-widest text-white/50 truncate mt-0.5">
                  {admin?.roles?.map(r => r.name).join(', ') || admin?.role || 'User'}
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
        ) : (
          <div className="mt-6 flex items-center justify-between p-4 bg-surface-variant/30 hover:bg-surface-variant/50 rounded-xl shrink-0 mt-auto cursor-pointer transition-colors">
            <div className="flex items-center gap-4 overflow-hidden">
              <div className="w-10 h-10 rounded-full bg-admin-primary/20 flex items-center justify-center text-admin-primary font-bold">
                {admin?.email?.charAt(0).toUpperCase()}
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-bold text-on-surface truncate">{admin?.email}</p>
                <p className="text-[10px] uppercase tracking-widest text-on-primary-container truncate">
                  {admin?.roles?.map(r => r.name).join(', ') || admin?.role || 'User'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowLogoutModal(true)}
              className="text-on-surface-variant hover:text-error transition-colors p-2"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        )}
      </aside>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1A1A1A] border border-[#2D2D33] rounded-xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4 text-red-500">
                <LogOut size={32} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Confirm Logout</h3>
              <p className="text-gray-400 text-sm">Are you sure you want to log out of your admin account?</p>
            </div>
            
            <div className="p-6 border-t border-[#2D2D33] flex gap-3 bg-[#1A1A1A]">
              <button 
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-[#2D2D33] text-gray-300 hover:bg-[#2D2D33] hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={confirmLogout}
                className="flex-1 px-4 py-2.5 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold transition-colors cursor-pointer"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
