import { motion } from 'framer-motion';
import { useRef, useEffect, useState, useCallback } from 'react';
import { TESTIMONIALS } from '../../constants';

// Sub-component for individual testimonial cards - optimized with IntersectionObserver
function TestimonialCard({ t, idx, isVisible }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: isVisible ? 1 : 0.6, scale: isVisible ? 1 : 0.95 }}
      transition={{ type: "spring", stiffness: 220, damping: 28, mass: 0.8 }}
      className="bg-app-card/95 border border-app-border text-app-text rounded-[2rem] p-6 md:p-8 w-[290px] md:w-[385px] h-[270px] md:h-[310px] flex flex-col justify-between relative shadow-2xl hover:border-primary/40 hover:shadow-[0_0_40px_rgba(255,107,0,0.06)] transition-colors duration-300 pointer-events-auto"
      style={{ flexShrink: 0 }}
    >
      <div className="space-y-4">
        <p className="text-xs sm:text-sm md:text-[15px] text-app-text-muted leading-relaxed font-normal">
          "{t.quote}"
        </p>
      </div>

      <div className="flex justify-between items-end">
        <div className="flex items-center gap-3.5 z-10">
          <img
            src={t.avatar}
            alt={t.author}
            className="w-10 h-10 rounded-full object-cover border border-app-border select-none bg-app-bg"
            draggable="false"
            loading="lazy"
          />
          <div>
            <h4 className="text-sm md:text-base font-bold text-app-text font-heading leading-tight">
              {t.author}
            </h4>
            <p className="text-[9px] md:text-[10px] text-app-text-muted/80 font-medium uppercase tracking-widest mt-0.5">
              {t.role}
            </p>
          </div>
        </div>

        <svg
          className="w-14 h-14 text-app-text/5 absolute bottom-4 right-4 pointer-events-none select-none"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-4.765 2.627-4.765 5.959h4.765v9.89h-9.978zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-4.795 2.627-4.795 5.959h4.795v9.89h-9.996z" />
        </svg>
      </div>
    </motion.div>
  );
}

export default function Testimonials() {
  const viewportRef = useRef(null);
  const rafRef = useRef(null);

  const [isMobile, setIsMobile] = useState(false);
  const [visibleCard, setVisibleCard] = useState(0);

  // Optimized layout detection with debounced resize
  useEffect(() => {
    const handleLayout = () => {
      setIsMobile(window.innerWidth < 768);
    };

    handleLayout();
    const timer = setTimeout(handleLayout, 100);

    window.addEventListener('resize', handleLayout);
    return () => {
      window.removeEventListener('resize', handleLayout);
      clearTimeout(timer);
    };
  }, []);

  // Optimized scroll handler using requestAnimationFrame
  const handleScroll = useCallback(() => {
    if (rafRef.current) return;

    rafRef.current = requestAnimationFrame(() => {
      if (viewportRef.current) {
        const scrollCenter = viewportRef.current.scrollLeft + (viewportRef.current.clientWidth / 2);
        const cardWidth = isMobile ? 322 : 417; // card (290/385) + gap (32)
        setVisibleCard(Math.floor(scrollCenter / cardWidth));
      }
      rafRef.current = null;
    });
  }, [isMobile]);

  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return (
    <section
      className="py-14 sm:py-16 bg-app-bg text-app-text overflow-hidden relative select-none border-t border-b border-app-border"
      id="testimonials"
    >
      {/* Optimized background glows */}
      <div className="absolute top-1/3 right-10 w-96 h-96 bg-[#FF6B00]/3 rounded-full blur-[150px] pointer-events-none will-change-transform" />
      <div className="absolute bottom-1/3 left-10 w-96 h-96 bg-[#FF6B00]/3 rounded-full blur-[150px] pointer-events-none will-change-transform" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-10 pointer-events-none relative z-10 text-left"
      >
        <span className="text-xs font-bold text-[#FF6B00] uppercase tracking-widest bg-[#FF6B00]/10 border border-[#FF6B00]/25 px-3 py-1 rounded-full">
          Testimonials
        </span>
        <h2 className="text-3xl md:text-5xl font-extrabold font-heading text-app-text tracking-tight mt-4 leading-tight">
          What our clients <br />
          say about <span className="text-gradient-orange">Vedhunt.</span>
        </h2>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        ref={viewportRef}
        onScroll={handleScroll}
        className="w-full overflow-x-auto scrollbar-none relative z-10 px-4 md:px-12 select-none"
        style={{ scrollBehavior: 'smooth' }}
      >
        <div className="flex gap-8 py-8 w-max items-center pr-24">
          {TESTIMONIALS.map((t, idx) => (
            <TestimonialCard
              key={idx}
              t={t}
              idx={idx}
              isVisible={idx === visibleCard || idx === visibleCard + 1}
            />
          ))}
        </div>
      </motion.div>
    </section>
  );
}
