import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cookie } from 'lucide-react';

export default function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if user has already accepted or rejected cookies
    const consent = localStorage.getItem('cookieConsent');
    if (!consent) {
      // Small delay for better UX before showing the banner
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookieConsent', 'accepted');
    setIsVisible(false);
  };

  const handleReject = () => {
    localStorage.setItem('cookieConsent', 'rejected');
    setIsVisible(false);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="fixed bottom-0 left-0 right-0 z-[100] p-3 md:p-4 pointer-events-none"
        >
          <div className="pointer-events-auto max-w-6xl mx-auto bg-[#0B0D12]/95 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-6 relative overflow-hidden">
            
            {/* Subtle orange glow effect in the background */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#FF5A1F]/10 rounded-full blur-[80px] -z-10 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-[#FF5A1F]/5 rounded-full blur-[60px] -z-10 pointer-events-none" />

            <div className="flex items-start md:items-center gap-4 flex-1 z-10">
              <div className="bg-[#FF5A1F]/10 border border-[#FF5A1F]/20 p-2.5 rounded-full hidden md:block flex-shrink-0">
                <Cookie className="w-6 h-6 text-[#FF5A1F]" />
              </div>
              <div className="flex-1">
                <h3 className="text-white text-base md:text-lg font-bold mb-1 flex items-center gap-2">
                  <Cookie className="w-5 h-5 text-[#FF5A1F] md:hidden flex-shrink-0" />
                  Life is better with cookies.
                </h3>
                <p className="text-gray-300/90 text-xs md:text-sm leading-relaxed max-w-3xl font-medium">
                  Most people would agree cookies make life better. For us, they help us make our site and marketing better. But if you don't like cookies, that's cool – you can let us know by clicking the buttons below!
                </p>
              </div>
            </div>
            <div className="flex flex-row gap-3 w-full md:w-auto mt-2 md:mt-0 z-10">
              <button
                onClick={handleReject}
                className="flex-1 md:flex-none px-5 py-2 rounded-lg border border-white/20 text-white text-sm font-semibold hover:bg-white/10 transition-colors duration-200"
              >
                Disable all
              </button>
              <button
                onClick={handleAccept}
                className="flex-1 md:flex-none px-5 py-2 rounded-lg bg-[#FF5A1F] text-white text-sm font-semibold hover:bg-[#E04610] transition-colors duration-200 shadow-[0_0_20px_rgba(255,90,31,0.3)] hover:shadow-[0_0_25px_rgba(255,90,31,0.4)]"
              >
                Allow all
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
