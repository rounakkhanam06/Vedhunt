import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import ScrollToTop from '../common/ScrollToTop';
import WhatsAppWidget from '../common/WhatsAppWidget';
import CookieConsent from '../common/CookieConsent';
import { initTracking } from '../../utils/tracking';

const GA4_ID = 'G-9JFTTEVSL0';

export default function MainLayout() {
  const location = useLocation();

  // Initialize all tracking platforms (FB Pixel, Google Ads, etc.) once
  useEffect(() => {
    initTracking();
  }, []);

  // Track every SPA route change as a GA4 page_view
  useEffect(() => {
    if (typeof window.gtag === 'function') {
      window.gtag('config', GA4_ID, {
        page_path: location.pathname + location.search,
      });
    }
  }, [location]);

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
