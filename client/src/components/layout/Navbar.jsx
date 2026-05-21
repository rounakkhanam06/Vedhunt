import { useState, useEffect } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, ArrowRight, MessageSquareCode, Phone, Mail, Clock, ChevronDown } from 'lucide-react';
import { NAV_LINKS, SERVICES } from '../../constants';
import ThemeToggle from '../common/ThemeToggle';
import { useTheme } from '../../context/ThemeContext';
import lightLogo from '../../assets/logo_Square.jpg__1_-removebg-preview.png';
import darkLogo from '../../assets/DarkthemeLogo.png';

export default function Navbar() {
  const { theme } = useTheme();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isServicesExpanded, setIsServicesExpanded] = useState(false);
  const location = useLocation();

  // Track scroll position to trigger sticky navbar state changes
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Prevent background scrolling when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMobileMenuOpen]);

  return (
    <>
      {/* Top Contact Bar */}
      <div className="w-full bg-app-bg border-b border-app-border text-app-text-muted py-2 px-4 md:px-8 z-50 relative hidden sm:block">
        <div className="max-w-6xl mx-auto flex justify-between items-center text-[11px] font-medium tracking-wide">
          <div className="flex gap-6">
            <span className="flex items-center gap-1.5 hover:text-primary transition-colors cursor-pointer">
              <Phone className="w-3.5 h-3.5" /> +91 98765 43210
            </span>
            <span className="flex items-center gap-1.5 hover:text-primary transition-colors cursor-pointer">
              <Mail className="w-3.5 h-3.5" /> info@vedhunt.in
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Mon – Fri: 8:00am – 7:00pm
          </div>
        </div>
      </div>

      {/* Main Floating Header */}
      <header
        className={`fixed ${isScrolled ? 'top-2 sm:top-4' : 'top-4 sm:top-12'} left-1/2 -translate-x-1/2 w-full max-w-6xl z-40 transition-all duration-500 pointer-events-none px-4 md:px-8`}
      >
        <div className={`w-full flex justify-between items-center pointer-events-auto transition-all duration-500 px-4 py-0 sm:py-0 rounded-full shadow-xl ${
          isScrolled 
            ? 'bg-white/90 dark:bg-[#0B0B14]/90 backdrop-blur-xl border border-slate-200/50 dark:border-white/10' 
            : 'md:bg-transparent md:border-transparent md:shadow-none bg-white/70 dark:bg-[#1A1A2E]/30 backdrop-blur-md border border-slate-200/50 dark:border-primary/10'
        }`}>
          
          {/* Top Left: Logo Section */}
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2 group">
              <img
                src={theme === 'dark' || (location.pathname === '/' && !isScrolled) ? darkLogo : lightLogo}
                alt="Vedhunt Logo"
                className="h-16 sm:h-20 md:h-24 w-auto object-contain transition-transform duration-300 group-hover:scale-105 my-[-10px] sm:my-[-16px] md:my-[-24px]"
              />
            </Link>
          </div>

          {/* Centered Pill Navigation */}
          <div className="absolute left-1/2 -translate-x-1/2 hidden md:block">
            <nav 
              className={`flex items-center justify-center gap-1 h-7 px-1.5 rounded-full border shadow-2xl transition-all duration-500 ${
                isScrolled 
                  ? 'bg-white/90 dark:bg-[#0B0B14]/80 backdrop-blur-xl border-slate-200 dark:border-white/10' 
                  : 'bg-white/50 dark:bg-[#1A1A2E]/30 backdrop-blur-md border-slate-200/50 dark:border-primary/10'
              }`}
            >
              {NAV_LINKS.map((link) => {
                const isServices = link.path === '/services';
                return (
                  <NavLink
                    key={link.path}
                    to={link.path}
                    className={({ isActive }) =>
                      `flex items-center justify-center h-full px-4 rounded-full text-xs font-bold tracking-tight whitespace-nowrap transition-all duration-300 relative group/nav overflow-visible ${
                        isActive
                          ? 'text-black'
                          : 'text-slate-600 hover:text-black dark:text-white/70 dark:hover:text-white'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <motion.span
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          className="relative z-10 block"
                        >
                          {link.label}
                        </motion.span>
                        
                        {/* Active Background Pill - Smooth Layout Transition */}
                        {isActive && (
                          <motion.div
                            layoutId="activePill"
                            className="absolute inset-0 bg-primary rounded-full shadow-[0_0_15px_rgba(255,107,0,0.4)] z-0"
                            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                          />
                        )}

                        {/* Hover Underline Effect */}
                        {!isActive && (
                          <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0.5 bg-primary transition-all duration-300 group-hover/nav:w-1/2 rounded-full" />
                        )}

                        {/* Dropdown Menu for Services */}
                        {isServices && (
                          <div className="absolute top-full left-1/2 -translate-x-1/2 pt-3 w-72 opacity-0 translate-y-2 pointer-events-none group-hover/nav:opacity-100 group-hover/nav:translate-y-0 group-hover/nav:pointer-events-auto transition-all duration-300 z-50 cursor-default">
                            <div 
                              className="bg-white/95 dark:bg-[#1A1A2E]/95 backdrop-blur-2xl border border-app-border rounded-2xl p-2 shadow-[0_10px_40px_rgba(0,0,0,0.1)] dark:shadow-[0_10px_40px_rgba(0,0,0,0.3)] flex flex-col gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {SERVICES.map((srv) => {
                                const IconComponent = srv.icon;
                                return (
                                  <Link
                                    key={srv.slug}
                                    to={`/services/${srv.slug}`}
                                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-primary/10 text-app-text-muted hover:text-app-text dark:hover:text-primary transition-all duration-200 group/dropitem cursor-pointer"
                                  >
                                    <div className="w-8 h-8 rounded-lg bg-primary/10 dark:bg-primary/5 border border-primary/20 dark:border-primary/10 flex items-center justify-center text-primary group-hover/dropitem:scale-110 transition-transform shrink-0">
                                      {typeof IconComponent === 'object' || typeof IconComponent === 'function' ? (
                                        <IconComponent className="w-4 h-4" />
                                      ) : (
                                        <img src={IconComponent} alt={srv.title} className="w-4 h-4 object-contain" />
                                      )}
                                    </div>
                                    <div className="flex flex-col text-left overflow-hidden">
                                      <span className="text-xs font-bold text-app-text group-hover/dropitem:text-primary transition-colors truncate">{srv.title}</span>
                                      <span className="text-[10px] text-app-text-muted truncate">{srv.subtitle}</span>
                                    </div>
                                  </Link>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </nav>
          </div>

          {/* Top Right: CTA Section */}
          <div className="hidden md:flex items-center gap-4">
            <ThemeToggle />
            <Link
              to="/get-quote"
              className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary text-black text-xs font-black hover:bg-primary-hover transition-all duration-300 group shadow-[0_0_20px_rgba(255,107,0,0.2)] hover:shadow-[0_0_25px_rgba(255,107,0,0.4)]"
            >
              <span>Get Quote</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>

          {/* Mobile Navigation Trigger */}
          <div className="md:hidden flex items-center gap-3">
            <ThemeToggle />
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2.5 rounded-full bg-[#1A1A2E] border border-white/10 text-white/70 hover:text-primary transition-all shadow-xl"
              aria-label="Toggle mobile menu"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ duration: 0.2 }}
              className="md:hidden mt-4 w-full max-h-[80vh] overflow-y-auto bg-white/95 dark:bg-[#1A1A2E]/95 backdrop-blur-2xl border border-app-border/50 dark:border-white/10 rounded-3xl shadow-2xl pointer-events-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            >
              <div className="p-3 space-y-1.5">
                {NAV_LINKS.map((link) => {
                  const isServices = link.path === '/services';
                  return (
                    <div key={link.path} className="space-y-1">
                      {isServices ? (
                        <div className={`flex items-center justify-between px-5 py-3.5 rounded-2xl text-sm font-bold transition-all border border-transparent hover:border-primary ${
                          location.pathname === link.path
                            ? 'bg-primary text-black'
                            : 'text-slate-800 hover:bg-slate-100 hover:text-black dark:text-white/70 dark:hover:bg-white/5 dark:hover:text-white'
                        }`}>
                          <NavLink
                            to={link.path}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="flex-grow"
                          >
                            {link.label}
                          </NavLink>
                          <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsServicesExpanded(!isServicesExpanded); }}
                            className="p-1 rounded-full bg-slate-100 dark:bg-white/5 hover:text-primary transition-colors"
                          >
                            <ChevronDown className={`w-4 h-4 transition-transform ${isServicesExpanded ? 'rotate-180' : ''}`} />
                          </button>
                        </div>
                      ) : (
                        <NavLink
                          to={link.path}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className={({ isActive }) =>
                            `flex items-center justify-between px-5 py-3.5 rounded-2xl text-sm font-bold transition-all border border-transparent hover:border-primary ${
                              isActive
                                ? 'bg-primary text-black'
                                : 'text-slate-800 hover:bg-slate-100 hover:text-black dark:text-white/70 dark:hover:bg-white/5 dark:hover:text-white'
                            }`
                          }
                        >
                          <span>{link.label}</span>
                          {location.pathname === link.path && <ArrowRight className="w-4 h-4" />}
                        </NavLink>
                      )}

                      {/* Indented Submenu for Mobile Services */}
                      <AnimatePresence>
                        {isServices && isServicesExpanded && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="pl-4 pr-2 py-1 space-y-1 border-l-2 border-primary/20 ml-4 overflow-hidden"
                          >
                            {SERVICES.map((srv) => (
                              <Link
                                key={srv.slug}
                                to={`/services/${srv.slug}`}
                                onClick={() => setIsMobileMenuOpen(false)}
                                className="flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-medium text-slate-700 dark:text-white/70 hover:bg-primary/10 hover:text-primary transition-all border border-transparent hover:border-primary"
                              >
                                <span>{srv.title}</span>
                                <ArrowRight className="w-3 h-3 opacity-50" />
                              </Link>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
                
                <div className="pt-2">
                  <Link
                    to="/get-quote"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="w-full py-4 rounded-2xl font-black text-center bg-primary text-black flex items-center justify-center gap-2"
                  >
                    <MessageSquareCode className="w-4 h-4" />
                    <span>Get Free Quote</span>
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
    </>
  );
}
