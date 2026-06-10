import React, { useEffect, useState, useRef, useMemo } from 'react';
import { motion, useInView } from 'framer-motion';
import { useStatsCounter } from '../../hooks/usePublicContent';

// Lazy-load lucide-react once and cache — avoids the `import *` bundle inflation
const lucideRef = { current: null };
const getLucideIcon = (name) => lucideRef.current?.[name] || lucideRef.current?.HelpCircle || (() => null);



const Counter = ({ value, suffix = "" }) => {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  useEffect(() => {
    if (isInView) {
      let startTimestamp = null;
      const duration = 2000;
      const finalValue = parseInt(value) || 0;

      const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        
        // easeOutExpo
        const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
        
        setCount(Math.floor(easeProgress * finalValue));
        
        if (progress < 1) {
          window.requestAnimationFrame(step);
        } else {
          setCount(finalValue);
        }
      };
      window.requestAnimationFrame(step);
    }
  }, [isInView, value]);

  return (
    <span ref={ref}>
      {count}{suffix}
    </span>
  );
};

export default function StatsCounter() {
  const [iconsLoaded, setIconsLoaded] = useState(false);

  // Load Lucide module once, cache in module-level ref
  useEffect(() => {
    if (!lucideRef.current) {
      import('lucide-react').then(m => {
        lucideRef.current = m;
        setIconsLoaded(true);
      });
    } else {
      setIconsLoaded(true);
    }
  }, []);

  // React Query — cached for 5 minutes
  const { data: fetchedStats = [], isLoading } = useStatsCounter();

  const defaultStats = useMemo(() => [
    { value: 50, suffix: '+', label: 'Clients Served', icon: 'Users' },
    { value: 8,  suffix: '+', label: 'Services',       icon: 'Layers' },
    { value: 100,suffix: '%', label: 'Transparency',   icon: 'ShieldCheck' },
    { value: 3,  suffix: '+', label: "Years' Experience", icon: 'Clock' },
  ], []);

  const displayStats = fetchedStats.length > 0 ? fetchedStats : defaultStats;

  return (
    <section className="py-8 px-4 relative z-10">
      {/* Subtle Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[250px] bg-primary/5 blur-[100px] pointer-events-none rounded-full" />
      
      <div className="max-w-6xl mx-auto relative z-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {displayStats.map((stat, index) => {
          const IconComponent = getLucideIcon(stat.icon);
            return (
              <motion.div 
                key={stat._id || index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                className="bg-white dark:bg-app-card backdrop-blur-xl border border-slate-100 dark:border-app-border rounded-xl sm:rounded-2xl p-3 sm:p-5 flex flex-col sm:flex-row items-center sm:items-center text-center sm:text-left justify-center sm:justify-start gap-2 sm:gap-4 group hover:border-primary transition-all duration-300 shadow-sm dark:shadow-xl relative overflow-hidden"
              >
                {/* Inner glass highlight */}
                <div className="absolute inset-0 border border-slate-200 dark:border-app-border rounded-xl sm:rounded-2xl pointer-events-none" />

                {/* Icon Box */}
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:scale-110 group-hover:bg-primary group-hover:text-black transition-all duration-300 shrink-0 shadow-[0_0_15px_rgba(255,107,0,0.15)] relative z-10">
                  <IconComponent className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>

                {/* Text & Counter */}
                <div className="space-y-0.5 sm:space-y-1 relative z-10">
                  <div className="text-lg sm:text-2xl md:text-3xl font-bold font-heading text-primary transition-colors flex items-center justify-center sm:justify-start tracking-tight">
                    <Counter value={stat.value} suffix={stat.suffix} />
                  </div>
                  <div className="text-slate-800 dark:text-app-text text-[9px] sm:text-[11px] font-semibold uppercase tracking-[0.05em] sm:tracking-[0.15em] leading-tight px-1 sm:px-0">
                    {stat.label}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
