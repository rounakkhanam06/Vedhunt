import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import ScrollToTop from '../common/ScrollToTop';

export default function MainLayout() {

  return (
    <div className="min-h-screen bg-app-bg text-app-text-muted flex flex-col relative">
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
    </div>
  );
}
