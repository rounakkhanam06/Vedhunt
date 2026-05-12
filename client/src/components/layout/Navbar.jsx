import { useState, useEffect } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Phone, Mail, ArrowRight } from 'lucide-react';
import { NAV_LINKS, CONTACT_INFO } from '../../constants';
import ThemeToggle from '../common/ThemeToggle';
import { useTheme } from '../../context/ThemeContext';
import lightLogo from '../../assets/logo_Square.jpg__1_-removebg-preview.png';
import darkLogo from '../../assets/DarkthemeLogo.png';

export default function Navbar() {
  const { theme } = useTheme();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Track scroll position to trigger sticky navbar state changes
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      {/* Top Banner Contact Information */}
      <div className="hidden md:flex bg-app-card border-b border-app-border py-2 px-6 text-xs text-app-text-muted justify-between items-center z-50 relative">
        <div className="flex items-center gap-6">
          <a href={`tel:${CONTACT_INFO.phone}`} className="flex items-center gap-1.5 hover:text-primary transition-colors duration-200">
            <Phone className="w-3.5 h-3.5 text-primary" />
            {CONTACT_INFO.phoneDisplay}
          </a>
          <a href={`mailto:${CONTACT_INFO.email}`} className="flex items-center gap-1.5 hover:text-primary transition-colors duration-200">
            <Mail className="w-3.5 h-3.5 text-primary" />
            {CONTACT_INFO.email}
          </a>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[10px] bg-primary/10 border border-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">
            Lead Generation Specialists
          </span>
          <span className="text-gray-500 dark:text-gray-600">|</span>
          <span>{CONTACT_INFO.hours}</span>
        </div>
      </div>

      {/* Main Sticky Header */}
      <header
        className={`sticky top-0 w-full z-50 transition-all duration-300 ${
          isScrolled
            ? 'bg-app-bg/85 backdrop-blur-md border-b border-app-border shadow-lg shadow-black/5 dark:shadow-black/30 py-3'
            : 'bg-transparent border-b border-transparent py-5'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            {/* Logo Section */}
            <Link to="/" className="flex items-center gap-2 group relative z-50 h-12 sm:h-14 overflow-visible">
              <img
                src={theme === 'dark' ? darkLogo : lightLogo}
                alt="Vedhunt Infotech"
                className="h-[90px] sm:h-[120px] max-w-none w-auto object-contain transition-all duration-300"
              />
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-8">
              {NAV_LINKS.map((link) => (
                <NavLink
                  key={link.path}
                  to={link.path}
                  className={({ isActive }) =>
                    `text-sm font-semibold tracking-wide transition-all duration-300 relative py-1.5 ${
                      isActive
                        ? 'text-primary'
                        : 'text-app-text-muted hover:text-app-text'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {link.label}
                      {/* Active underline indicator */}
                      {isActive && (
                        <motion.div
                          layoutId="navActiveUnderline"
                          className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"
                          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                        />
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </nav>

            {/* CTA Button & ThemeToggle Header Desktop */}
            <div className="hidden md:flex items-center gap-4">
              <ThemeToggle />
              <Link
                to="/contact"
                className="relative px-5 py-2.5 rounded-lg text-sm font-bold tracking-wide overflow-hidden group transition-all duration-300 border border-primary text-app-text bg-transparent hover:bg-primary hover:text-black flex items-center gap-1.5 hover:shadow-[0_0_20px_rgba(255,107,0,0.4)]"
              >
                <span>Get Free Quote</span>
                <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </div>

            {/* Mobile Menu Action Icon */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-app-text-muted hover:text-primary transition-colors focus:outline-none relative z-50"
              aria-label="Toggle mobile menu"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="md:hidden absolute top-full left-0 w-full bg-app-bg border-b border-app-border shadow-xl overflow-hidden backdrop-blur-lg"
            >
              <div className="px-4 pt-4 pb-6 space-y-3">
                {NAV_LINKS.map((link) => (
                  <NavLink
                    key={link.path}
                    to={link.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `block px-4 py-3 rounded-lg text-base font-semibold tracking-wide transition-all ${
                        isActive
                          ? 'bg-primary/10 text-primary border-l-4 border-primary pl-3'
                          : 'text-app-text-muted hover:bg-app-card hover:text-app-text'
                      }`
                    }
                  >
                    {link.label}
                  </NavLink>
                ))}

                <div className="pt-4 border-t border-app-border px-4 space-y-4">
                  {/* Theme toggling field in Mobile view */}
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-sm font-semibold text-app-text">Theme Mode</span>
                    <ThemeToggle />
                  </div>

                  <div className="flex flex-col gap-2.5 text-xs text-app-text-muted">
                    <a href={`tel:${CONTACT_INFO.phone}`} className="flex items-center gap-2 py-1">
                      <Phone className="w-4 h-4 text-primary" />
                      {CONTACT_INFO.phoneDisplay}
                    </a>
                    <a href={`mailto:${CONTACT_INFO.email}`} className="flex items-center gap-2 py-1">
                      <Mail className="w-4 h-4 text-primary" />
                      {CONTACT_INFO.email}
                    </a>
                  </div>

                  <Link
                    to="/contact"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="w-full py-3 rounded-lg font-bold text-center bg-primary text-black block hover:bg-primary-hover shadow-lg transition-all duration-300"
                  >
                    Get Free Quote
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
