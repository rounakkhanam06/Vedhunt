import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Users, ChevronDown, ChevronRight, Activity,
  Briefcase, FileText, Wallet, ShieldCheck, Settings, LogOut, X,
  Image as ImageIcon, Tag, UserPlus, Scale, Share2, Mail, MessageCircle,
  User, Clock, CheckSquare, FileSpreadsheet, CreditCard, Award, Building2,
  Gauge, Search
} from 'lucide-react';
import { useAdminStore } from '../../store/useAdminStore';
import { usePermissions } from '../hooks/usePermissions';
import BrandLogo from '../../components/brand/BrandLogo';

const Sidebar = ({ isOpen, setIsOpen }) => {
  const { logout, admin } = useAdminStore();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [openDropdowns, setOpenDropdowns] = useState({
    leads: true,
    clientPortal: false,
    cms: false, pricing: false, careers: false, legal: false, servicesManagement: false, faq: false, audit: false
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
    { name: 'Overview', path: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Management Dashboard', path: '/admin/management-dashboard', icon: Gauge, requiredPermission: '*' },
    {
      name: 'Leads Management',
      icon: Users,
      dropdownKey: 'leads',
      requiredPermission: 'leads.view',
      subItems: [
        { name: 'Raw Leads', path: '/admin/leads' },
        { name: 'Working Leads', path: '/admin/leads/working' },
        { name: 'Unassigned Leads', path: '/admin/leads/unassigned' },
        { name: 'All Leads', path: '/admin/leads/all', requiredPermission: '*' },
        { name: 'Lead Activity', path: '/admin/lead-activity', requiredPermission: 'leads.assign' },
        { name: 'Follow-ups', path: '/admin/follow-ups', requiredPermission: 'leads.assign' },
        { name: 'Subscribers', path: '/admin/subscribers' }
      ]
    },
    {
      name: 'Audit & Logs',
      icon: ShieldCheck,
      dropdownKey: 'audit',
      requiredPermission: '*',
      subItems: [
        { name: 'Activity Log', path: '/admin/audit/activity' },
        { name: 'Assignment Log', path: '/admin/audit/assignments' },
      ]
    },
    {
      name: 'Client Portal (CRM)',
      icon: Building2,
      dropdownKey: 'clientPortal',
      requiredPermission: 'cms.manage',
      subItems: [
        { name: 'Client Accounts', path: '/admin/clients' },
        { name: 'Client Service Agreement', path: '/admin/service-agreement' },
        { name: 'Invoice Manager', path: '/admin/invoices' },
        { name: 'Project Tracker', path: '/admin/projects' },
        { name: 'Retainers', path: '/admin/retainers' },
        { name: 'Support Desk', path: '/admin/support-desk' },
        { name: 'Payment Verification', path: '/admin/payment-verification' },
      ]
    },
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
        { name: 'Client Portal Terms & Privacy', path: '/admin/portal-legal/client-terms' },
        { name: 'Employee Portal Terms & Privacy', path: '/admin/portal-legal/employee-terms' },
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
    { 
      name: 'HRMS (Module)', 
      icon: Users, 
      dropdownKey: 'hrms', 
      requiredPermission: 'team.manage',
      subItems: [
        { name: 'Employees List', path: '/admin/employees' },
        { name: 'Payroll', path: '/admin/payroll', requiredPermission: 'payroll.manage' },
        { name: 'Attendance Roster', path: '/admin/attendance-roster' },
        { name: 'Bank Change Requests', path: '/admin/bank-change-requests' },
        { name: 'Correction Requests', path: '/admin/corrections' },
        { name: 'Organization Tasks', path: '/admin/tasks' },
        { name: 'Productivity Reports', path: '/admin/manager-dashboard' },
        { name: 'Performance Cycles', path: '/admin/performance-cycles' },
        { name: 'KPI Goal Assigner', path: '/admin/performance-goals' },
        { name: 'Company Performance Matrix', path: '/admin/performance-matrix' },
      ]
    },
    { name: 'Team Management', path: '/admin/team', icon: ShieldCheck, requiredPermission: 'team.manage' },
    { name: 'Role Management', path: '/admin/roles', icon: ShieldCheck, requiredPermission: 'roles.manage' },
    { name: 'Facebook Integration', path: '/admin/facebook-integration', icon: Share2, requiredPermission: 'settings.manage' },
    { name: 'Settings', path: '/admin/settings', icon: Settings, requiredPermission: 'settings.manage' },
  ];

  const isEmployee = admin?.roles?.some(r => r.name === 'EMPLOYEE');
  const isEmployeeOnly = isEmployee && admin?.roles?.length === 1;

  const baseNavItems = [...navItems];

  const renderedNavItems = isEmployeeOnly
    ? [
        { name: 'Dashboard', path: '/employee/dashboard?tab=dashboard', icon: LayoutDashboard },
        { name: 'Attendance & Leave', path: '/employee/dashboard?tab=attendance', icon: Clock },
        { name: 'My Tasks', path: '/employee/dashboard?tab=tasks', icon: CheckSquare },
        { name: 'My Timesheet', path: '/employee/dashboard?tab=timesheet', icon: FileSpreadsheet },
        { name: 'My Payslips', path: '/employee/dashboard?tab=payslips', icon: CreditCard },
        { name: 'My Performance', path: '/employee/dashboard?tab=performance', icon: Award },
        { name: 'My Profile', path: '/employee/dashboard?tab=profile', icon: User },
      ]
    : baseNavItems;

  const trimmedQuery = searchQuery.trim().toLowerCase();

  const filteredNavItems = useMemo(() => {
    return renderedNavItems.map(item => {
      if (item.requiredPermission && !can(item.requiredPermission)) {
        return null;
      }

      if (item.subItems) {
        const permittedSubItems = item.subItems.filter(sub => 
          !sub.requiredPermission || can(sub.requiredPermission)
        );

        if (permittedSubItems.length === 0) return null;

        if (!trimmedQuery) {
          return { ...item, subItems: permittedSubItems };
        }

        const parentMatches = item.name.toLowerCase().includes(trimmedQuery);
        const matchingSubItems = permittedSubItems.filter(sub =>
          sub.name.toLowerCase().includes(trimmedQuery)
        );

        if (parentMatches || matchingSubItems.length > 0) {
          return {
            ...item,
            subItems: parentMatches ? permittedSubItems : matchingSubItems
          };
        }

        return null;
      }

      if (!trimmedQuery || item.name.toLowerCase().includes(trimmedQuery)) {
        return item;
      }

      return null;
    }).filter(Boolean);
  }, [renderedNavItems, trimmedQuery, can]);

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
        fixed inset-y-0 left-0 z-50 flex flex-col transition-all duration-300 ease-in-out overflow-y-auto
        bg-app-card border-r border-app-border
        ${isOpen 
          ? 'w-[280px] p-5 translate-x-0 shadow-2xl' 
          : '-translate-x-full w-0 p-0 border-none overflow-hidden'
        }
      `}>
        <div className="flex items-center justify-between shrink-0 mb-6 px-1">
          <BrandLogo variant="auto" className="h-6" />
          <button onClick={() => setIsOpen(false)} className="text-app-text-muted hover:text-app-text transition-colors p-1.5 rounded-lg hover:bg-app-border/40 cursor-pointer" title="Close Sidebar">
            <X size={18} />
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative mb-4 shrink-0">
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

        <nav className={`flex-1 space-y-1 overflow-y-auto pr-1 pb-4`}>
          {filteredNavItems.length === 0 ? (
            <div className="text-center py-8 px-2 text-xs text-app-text-muted">
              No pages matching &ldquo;{searchQuery}&rdquo;
            </div>
          ) : (
            filteredNavItems.map((item) => {
              const Icon = item.icon;

              if (item.subItems) {
                const isAnySubActive = item.subItems.some(sub => location.pathname === sub.path);
                const isDropdownOpen = trimmedQuery.length > 0 || openDropdowns[item.dropdownKey];

                return (
                  <div key={item.name} className="space-y-1">
                    <button
                      onClick={() => toggleDropdown(item.dropdownKey)}
                      className={`
                        w-full flex items-center justify-between gap-3 px-3.5 py-2 rounded-xl text-sm transition-all duration-200 cursor-pointer
                        ${isDropdownOpen
                          ? 'text-app-text bg-app-border/30 font-medium'
                          : 'text-app-text-muted hover:text-app-text hover:bg-app-border/30'
                        }
                      `}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon className="w-5 h-5 flex-shrink-0" />
                        <span className="truncate">{item.name}</span>
                      </div>
                      {isDropdownOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    </button>

                    <div className={`ml-6 pl-2 border-l border-app-border/50 overflow-hidden transition-all duration-300 ease-in-out ${isDropdownOpen ? 'max-h-96 opacity-100 mt-1 space-y-1' : 'max-h-0 opacity-0 mt-0'}`}>
                      {item.subItems.map((subItem) => {
                        const isSubActive = location.pathname === subItem.path;
                        return (
                          <Link
                            key={subItem.name}
                            to={subItem.path}
                            onClick={() => {
                              if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                                setIsOpen(false);
                              }
                            }}
                            className={`
                              block px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 truncate
                              ${isSubActive
                                ? 'bg-primary/10 text-primary font-semibold border border-primary/20 shadow-xs'
                                : 'text-app-text-muted hover:text-app-text hover:bg-app-border/30'
                              }
                            `}
                          >
                            {subItem.name}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              }

            const isPathActive = location.pathname === item.path;
            const fullPathActive = (location.pathname + location.search) === item.path;
            const isDefaultActive = location.pathname === item.path.split('?')[0] && !location.search && item.path.includes('tab=dashboard');
            const isActive = item.path.includes('?') ? fullPathActive || isDefaultActive : isPathActive;
            
            return (
              <Link
                key={item.name}
                to={item.path}
                onClick={() => {
                  if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                    setIsOpen(false);
                  }
                }}
                className={`
                  relative group flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm transition-colors duration-200
                  ${isActive
                    ? 'text-primary font-semibold'
                    : 'text-app-text-muted hover:text-app-text hover:bg-app-border/30 font-medium'
                  }
                `}
              >
                {isActive && (
                  <motion.div
                    layoutId="adminActiveNavPill"
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
                    layoutId="adminActiveNavDot"
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

        <div className="mt-auto pt-4 border-t border-app-border shrink-0">
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-app-bg/50 border border-app-border/60 hover:border-app-border transition-colors">
            <div className="flex items-center gap-3 overflow-hidden pr-2">
              <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                {admin?.email?.charAt(0).toUpperCase()}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-app-text truncate">{admin?.email}</p>
                <p className="text-[10px] uppercase tracking-wider text-app-text-muted truncate mt-0.5">
                  {admin?.roles?.map(r => r.name).join(', ') || admin?.role || 'User'}
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
      </aside>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-app-card border border-app-border rounded-xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4 text-red-500">
                <LogOut size={32} />
              </div>
              <h3 className="text-xl font-bold text-app-text mb-2">Confirm Logout</h3>
              <p className="text-app-text-muted text-sm">Are you sure you want to log out of your admin account?</p>
            </div>
            
            <div className="p-6 border-t border-app-border flex gap-3 bg-app-card">
              <button 
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-app-border text-app-text hover:bg-app-border/30 transition-colors cursor-pointer"
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
