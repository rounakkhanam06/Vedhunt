import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWhyChooseUs } from '../../hooks/usePublicContent';

// Dynamically resolve Lucide icons by name without pulling the entire library.
// This avoids the `import * as LucideIcons` wildcard that inflates chunk size.
const resolveIcon = (name) => {
  try {
    // eslint-disable-next-line no-eval -- safe: name comes from trusted DB string
    return require(`lucide-react`)[name] || require('lucide-react').HelpCircle;
  } catch {
    return null;
  }
};

let _lucideModule = null;
const getLucideIcon = (name) => {
  if (!_lucideModule) {
    // Import is cached after first call — no repeated dynamic imports
    import('lucide-react').then(m => { _lucideModule = m; });
    return null;
  }
  return _lucideModule[name] || _lucideModule.HelpCircle;
};

/**
 * WhyChooseUs - Updated with dynamic data fetching from DB.
 */
export default function WhyChooseUs() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);
  const [lucideIcons, setLucideIcons] = useState(null);

  // Load Lucide icons once, cache in state
  useEffect(() => {
    import('lucide-react').then(m => setLucideIcons(m));
  }, []);

  const resolveIcon = useCallback((name) => {
    if (!lucideIcons) return null;
    return lucideIcons[name] || lucideIcons.HelpCircle;
  }, [lucideIcons]);

  // React Query — cached for 5 minutes, no re-fetch on re-mount
  const { data: whyData } = useWhyChooseUs();

  const features = useMemo(() => whyData?.cards || [], [whyData]);
  const header = useMemo(() => whyData?.header || {
    tagline: 'Why Vedhunt',
    heading: 'Engineering Success with',
    highlightText: 'Precision'
  }, [whyData]);

  // Debounced resize listener — prevents 60fps state updates on window resize
  useEffect(() => {
    let timer;
    const handleResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setIsMobile(window.innerWidth < 640), 150);
    };
    window.addEventListener('resize', handleResize, { passive: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Auto-play interval for mobile slider
  useEffect(() => {
    if (!isMobile || features.length === 0) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % features.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [isMobile, features.length]);

  // Animation Variants for Desktop Grid
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: [0.25, 1, 0.5, 1] }
    }
  };

  // Animation Variants for Mobile Slider
  const slideVariants = {
    enter: { x: '100%', opacity: 0 },
    center: { 
      x: 0, 
      opacity: 1, 
      transition: { type: 'spring', stiffness: 300, damping: 30 } 
    },
    exit: { 
      x: '-100%', 
      opacity: 0, 
      transition: { duration: 0.5 } 
    }
  };

  // Reusable card content component to avoid duplication
  const CardContent = ({ feature }) => {
    const Icon = resolveIcon(feature.icon) || (() => null);
    
    return (
      <>
        {/* Subtle Gradient Background on Hover */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl" />

        {/* Icon Wrapper */}
        <div className="mb-6 w-16 h-16 rounded-2xl bg-primary/10 dark:bg-white/5 flex items-center justify-center text-primary shadow-inner group-hover:bg-primary group-hover:text-black transition-all duration-500 transform group-hover:rotate-3">
          <Icon size={28} strokeWidth={2.5} />
        </div>

        {/* Title */}
        <h3 className="text-xl font-black font-heading text-primary mb-3 transition-colors duration-300 relative z-10">
          {feature.title}
        </h3>

        {/* Description */}
        <p className="text-slate-600 dark:text-app-text text-sm leading-relaxed font-medium relative z-10">
          {feature.desc || feature.description}
        </p>

        {/* Bottom Accent Line */}
        <div className="absolute bottom-0 left-0 w-0 h-1 bg-primary group-hover:w-full transition-all duration-700 rounded-b-2xl" />
      </>
    );
  };

  return (
    <section className="pt-2 sm:pt-4 pb-12 px-4 bg-app-bg relative overflow-hidden mesh-grid">
      {/* Background Ambient Glows */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-primary/5 rounded-full filter blur-[150px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/2 dark:bg-white/2 rounded-full filter blur-[150px] pointer-events-none" />
      
      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* Section Header */}
        <div className="text-center mb-12 sm:mb-16 md:mb-20 space-y-4">
          <motion.span 
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-primary text-xs font-black uppercase tracking-[0.3em] bg-primary/10 px-4 py-1.5 rounded-full"
          >
            {header.tagline}
          </motion.span>
          <motion.h2 
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-3xl sm:text-4xl md:text-5xl font-black font-heading text-app-text leading-tight"
          >
            {header.heading} <span className="text-primary">{header.highlightText}</span>
          </motion.h2>
          <motion.div 
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, duration: 0.8 }}
            className="w-24 h-1 bg-primary mx-auto rounded-full"
          />
        </div>

        {/* Feature Grid / Slider */}
        {isMobile ? (
          <div className="relative w-full h-[260px] flex items-center justify-center overflow-hidden">
            <AnimatePresence mode="wait">
              {features.map((feature, index) => {
                if (index !== currentIndex) return null;
                return (
                  <motion.div
                    key={index}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    className="absolute w-full group relative bg-white dark:bg-app-card rounded-2xl p-8 shadow-sm dark:shadow-lg border border-slate-100 dark:border-app-border flex flex-col items-start text-left"
                  >
                    <CardContent feature={feature} />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        ) : (
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
            className="grid grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {features.map((feature, index) => (
              <motion.div
                key={index}
                variants={itemVariants}
                className="group relative bg-white dark:bg-app-card rounded-2xl p-8 shadow-sm dark:shadow-lg border border-slate-100 dark:border-app-border hover:border-primary hover:shadow-xl dark:hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 flex flex-col items-start text-left"
              >
                <CardContent feature={feature} />
              </motion.div>
            ))}
          </motion.div>
        )}

      </div>
    </section>
  );
}
