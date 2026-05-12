import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { WHY_CHOOSE_US } from '../../constants';

// Highly premium easing Count-Up number component triggering on entering viewport
function CountUpNumber({ end, suffix = '', duration = 1600 }) {
  const [count, setCount] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const elementRef = useRef(null);
  const [hasTriggered, setHasTriggered] = useState(false);

  // Detect reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (!elementRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasTriggered(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(elementRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!hasTriggered) return;

    // Skip animation for reduced motion preference - show final value instantly
    if (prefersReducedMotion) {
      setCount(end);
      return;
    }

    let startTime = null;
    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);

      // easeOutQuad mathematical deceleration
      const easeProgress = progress * (2 - progress);

      setCount(Math.floor(easeProgress * end));

      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };

    window.requestAnimationFrame(step);
  }, [hasTriggered, end, duration, prefersReducedMotion]);

  return (
    <span ref={elementRef}>
      {count}
      {suffix}
    </span>
  );
}

export default function WhyChooseUs() {

  const staggerContainer = {
    hidden: {},
    visible: {
      transition: { staggerChildren: 0.12 }
    }
  };

  const scrollFadeUp = {
    hidden: { opacity: 0, y: 35 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] }
    }
  };

  const scrollFadeLeft = {
    hidden: { opacity: 0, x: -45 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] }
    }
  };

  const scrollFadeRight = {
    hidden: { opacity: 0, x: 45 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] }
    }
  };

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-app-card/60 relative overflow-hidden border-t border-b border-app-border content-visibility-auto">
      {/* Glow Ambient Lights */}
      <div className="absolute top-1/3 left-10 w-96 h-96 bg-primary/3 rounded-full filter blur-[150px] pointer-events-none" />
      <div className="absolute bottom-1/3 right-10 w-96 h-96 bg-primary/3 rounded-full filter blur-[150px] pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* Header Block - Staggered scroll entry */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center mb-16">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={scrollFadeLeft}
            className="lg:col-span-7 text-left space-y-4"
          >
            <span className="text-xs font-bold text-primary uppercase tracking-widest bg-primary/10 border border-primary/25 px-3 py-1 rounded-full">
              Why Vedhunt Infotech
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold font-heading text-app-text leading-tight">
              We Don't Just Write Code. <br />
              We Engineer <span className="text-primary">Corporate Growth Pipelines.</span>
            </h2>
          </motion.div>
          
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={scrollFadeRight}
            className="lg:col-span-5 text-left md:text-right"
          >
            <p className="text-app-text-muted text-xs md:text-sm leading-relaxed max-w-md lg:ml-auto">
              Our diverse team coordinates design, lead generation, digital advertisements, legal bookkeepings, and automatic database structures under a unified operational standard.
            </p>
          </motion.div>
        </div>

        {/* Dynamic Infinite Moving Marquee - Left to Right */}
        <div className="w-full overflow-hidden py-4 relative pointer-events-auto fade-mask">
          <style>{`
            @keyframes marquee-right {
              0% { transform: translateX(-50%); }
              100% { transform: translateX(0%); }
            }
            .animate-marquee-right {
              animation: marquee-right 25s linear infinite;
            }
            .animate-marquee-right:hover {
              animation-play-state: paused;
            }
            .fade-mask {
              mask-image: linear-gradient(to right, transparent, #000 8%, #000 92%, transparent);
              -webkit-mask-image: linear-gradient(to right, transparent, #000 8%, #000 92%, transparent);
            }
          `}</style>
          
          <div className="flex gap-6 w-max animate-marquee-right">
            {/* Double the list of cards to make the scrolling seamless */}
            {[...WHY_CHOOSE_US, ...WHY_CHOOSE_US].map((item, idx) => {
              const IconComponent = item.icon;

              return (
                <div
                  key={idx}
                  className="glass-panel rounded-2xl p-6 md:p-8 hover:border-primary/25 transition-colors bg-app-bg/40 group flex flex-col justify-between h-72 relative w-[280px] sm:w-[320px] shrink-0"
                >
                  {/* Micro hovering icon */}
                  <div className="absolute top-4 right-4 text-gray-400 dark:text-gray-700 group-hover:text-primary/40 transition-colors duration-300">
                    <ArrowUpRight className="w-5 h-5" />
                  </div>

                  <div className="space-y-4 text-left">
                    {/* Icon Node */}
                    <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center orange-glow-sm">
                      <IconComponent className="w-5 h-5" />
                    </div>

                    <h3 className="text-base font-bold text-app-text font-heading">
                      {item.title}
                    </h3>
                  </div>

                  <p className="text-xs text-app-text-muted leading-relaxed text-left mt-4">
                    {item.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Large Stats / Trust Factor Strip - Staggered scroll entry with custom viewport-triggered count-up animation */}
        <motion.div 
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          className="mt-20 pt-12 border-t border-app-border grid grid-cols-2 md:grid-cols-4 gap-8"
        >
          {[
            { value: 140, suffix: '+', desc: 'Successful Deployments' },
            { value: 500, suffix: 'k+', desc: 'Validated Leads' },
            { value: 99, suffix: '%', desc: 'Client Retention Ratio' },
            { value: 4, suffix: ' Hrs', desc: 'Average Callback Response' }
          ].map((stat, idx) => (
            <motion.div 
              key={idx} 
              variants={scrollFadeUp}
              className="text-center md:text-left space-y-1.5"
            >
              <div className="text-2xl md:text-4xl font-black text-app-text font-heading tracking-tight flex items-center justify-center md:justify-start gap-1">
                <CountUpNumber end={stat.value} suffix={stat.suffix} />
                <span className="w-1.5 h-1.5 bg-primary rounded-full inline-block" />
              </div>
              <p className="text-[10px] md:text-xs text-app-text-muted/70 uppercase tracking-widest font-bold">
                {stat.desc}
              </p>
            </motion.div>
          ))}
        </motion.div>

      </div>
    </section>
  );
}
