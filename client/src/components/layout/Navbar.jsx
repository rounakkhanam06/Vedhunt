import { useState, useEffect } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, ArrowRight, MessageSquareCode } from 'lucide-react';
import { NAV_LINKS } from '../../constants';
import ThemeToggle from '../common/ThemeToggle';
import { useTheme } from '../../context/ThemeContext';
import lightLogo from '../../assets/logo_Square.jpg__1_-removebg-preview.png';
import darkLogo from '../../assets/DarkthemeLogo.png';

export default function Navbar() {
  const { theme } = useTheme();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  // Track scroll position to trigger sticky navbar state changes
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      {/* Main Floating Header */}
      <header
        className={`fixed top-4 left-1/2 -translate-x-1/2 w-full max-w-6xl z-50 transition-all duration-500 pointer-events-none px-4 md:px-8`}
      >
        <div className="w-full flex justify-between items-center pointer-events-auto">
          
          {/* Top Left: Logo Section */}
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2 group">
              <img
                src={theme === 'dark' ? darkLogo : lightLogo}
                alt="Vedhunt Logo"
                className="h-10 sm:h-12 w-auto object-contain transition-transform duration-300 group-hover:scale-105"
              />
            </Link>
          </div>

          {/* Centered Pill Navigation */}
          <div className="absolute left-1/2 -translate-x-1/2 hidden md:block">
            <nav 
              className={`flex items-center gap-1 px-2 py-1.5 rounded-full border shadow-2xl transition-all duration-500 ${
                isScrolled 
                  ? 'bg-app-bg/80 backdrop-blur-xl border-app-border' 
                  : 'bg-app-card/30 backdrop-blur-md border-primary/10'
              }`}
            >
              {NAV_LINKS.map((link) => (
                <NavLink
                  key={link.path}
                  to={link.path}
                  className={({ isActive }) =>
                    `px-4 py-1.5 rounded-full text-xs font-bold tracking-tight transition-all duration-300 relative group overflow-visible ${
                      isActive
                        ? 'text-black'
                        : 'text-app-text-muted hover:text-app-text'
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
                        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0.5 bg-primary transition-all duration-300 group-hover:w-1/2 rounded-full" />
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>

          {/* Top Right: CTA Section */}
          <div className="hidden md:flex items-center gap-4">
            <ThemeToggle />
            <Link
              to="/contact"
              className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-primary text-black text-xs font-black hover:bg-primary-hover transition-all duration-300 group shadow-[0_0_20px_rgba(255,107,0,0.2)] hover:shadow-[0_0_25px_rgba(255,107,0,0.4)]"
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
              className="p-2.5 rounded-full bg-app-card border border-app-border text-app-text-muted hover:text-primary transition-all shadow-xl"
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
              className="md:hidden mt-4 w-full bg-app-card/95 backdrop-blur-2xl border border-app-border rounded-3xl shadow-2xl overflow-hidden pointer-events-auto"
            >
              <div className="p-3 space-y-1.5">
                {NAV_LINKS.map((link) => (
                  <NavLink
                    key={link.path}
                    to={link.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center justify-between px-5 py-3.5 rounded-2xl text-sm font-bold transition-all ${
                        isActive
                          ? 'bg-primary text-black'
                          : 'text-app-text-muted hover:bg-white/5 hover:text-app-text'
                      }`
                    }
                  >
                    <span>{link.label}</span>
                    {location.pathname === link.path && <ArrowRight className="w-4 h-4" />}
                  </NavLink>
                ))}
                
                <div className="pt-2">
                  <Link
                    to="/contact"
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
