import { Outlet } from 'react-router-dom';
import { Phone } from 'lucide-react';
import { useState, useEffect } from 'react';
import ScrollToTop from '../common/ScrollToTop';
import { useTheme } from '../../context/ThemeContext';
import { useContactInfo } from '../../context/ContactInfoContext';
import lightLogo from '../../assets/logo_Square.jpg__1_-removebg-preview.png';
import darkLogo from '../../assets/DarkthemeLogo.png';
import WhatsAppWidget from '../common/WhatsAppWidget';
import { initTracking } from '../../utils/tracking';

export default function LandingPageLayout() {
  const { theme } = useTheme();
  const { contactInfo } = useContactInfo();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    initTracking();
    
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);


  return (
    <div className="min-h-screen bg-app-bg text-app-text flex flex-col relative overflow-x-hidden">
      <ScrollToTop />
      
      {/* Minimal Header */}
      <header className={`w-full px-6 md:px-12 flex items-center justify-between border-b border-app-border bg-app-bg/80 backdrop-blur-md z-50 sticky top-0 transition-all duration-300 ${isScrolled ? 'py-2 shadow-md' : 'py-4'}`}>
        <img 
          src={theme === 'dark' ? darkLogo : lightLogo} 
          alt="Vedhunt Logo" 
          className={`object-contain transition-all duration-300 ${isScrolled ? 'h-8 md:h-10' : 'h-12 md:h-16'}`}
        />
        <a 
          href={`tel:${contactInfo.phone}`} 
          className="flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-full transition-colors text-sm font-bold"
        >
          <Phone className="w-4 h-4" />
          <span className="hidden sm:inline">{contactInfo.phoneDisplay}</span>
        </a>
      </header>

      {/* Main Content */}
      <main className="flex-grow">
        <Outlet />
      </main>

      {/* Minimal Footer */}
      <footer className="w-full py-8 text-center border-t border-app-border bg-app-card mt-12 pb-24 md:pb-8">
        <div className="max-w-4xl mx-auto px-4 flex flex-col items-center gap-4">
          <img 
            src={theme === 'dark' ? darkLogo : lightLogo} 
            alt="Vedhunt Logo" 
            className="h-12 md:h-16 opacity-50 grayscale"
          />
          <p className="text-xs text-app-text-muted">
            &copy; {new Date().getFullYear()} Vedhunt. All rights reserved.
          </p>
          <div className="flex gap-4 text-xs text-app-text-muted underline">
            <a href="/privacy-policy">Privacy Policy</a>
            <a href="/terms-of-service">Terms of Service</a>
          </div>
        </div>
      </footer>

      {/* Floating WhatsApp Widget */}
      <WhatsAppWidget />
    </div>
  );
}
