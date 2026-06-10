import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import ScrollToTop from '../common/ScrollToTop';
import WhatsAppWidget from '../common/WhatsAppWidget';
import CookieConsent from '../common/CookieConsent';
import { initTracking } from '../../utils/tracking';

export default function MainLayout() {
  useEffect(() => {
    initTracking();
  }, []);

  return (
    <div className="min-h-screen bg-app-bg text-app-text-muted flex flex-col relative overflow-x-hidden">
      {/* Scroll Restorer */}
      <ScrollToTop />

      {/* Primary Navigation */}
      <Navbar />

      {/* Main Container with Hardware-Accelerated Page Transition Animations */}
      <main className="flex-grow">
        <div className="max-w-6xl mx-auto w-full h-full theme-transition">
          <Outlet />
        </div>
      </main>

      {/* Universal Footer */}
      <Footer />

      {/* Floating WhatsApp Widget */}
      <WhatsAppWidget />

      {/* Cookie Consent Banner */}
      <CookieConsent />
    </div>
  );
}
