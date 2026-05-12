import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Sparkles, Check, Award, Users } from 'lucide-react';
import { SplineScene } from '@/components/ui/splite';
import { Spotlight } from '@/components/ui/spotlight';
import { EncryptedText } from '@/components/ui/encrypted-text';

const rotatingPhrases = [
  'Website Development',
  'Organic SEO & PPC Ads',
  'Mobile Application Development',
  'Indian & US Bookkeeping',
  'Power BI & SQL Automation'
];

export default function Hero() {
  const [textIndex, setTextIndex] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const sectionRef = useRef(null);

  // Detect reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Rotate text phrases every 4 seconds
  useEffect(() => {
    if (prefersReducedMotion) return;
    const interval = setInterval(() => {
      setTextIndex((prev) => (prev + 1) % rotatingPhrases.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [prefersReducedMotion]);

  return (
    <section ref={sectionRef} className="relative min-h-[90vh] flex items-center justify-center pt-10 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden bg-app-bg">

      {/* Optimized background glows - using transform instead of filter for better performance */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-primary/8 rounded-full blur-[140px] pointer-events-none will-change-transform" />
      <div className="absolute top-2/3 right-10 w-96 h-96 bg-primary/2 dark:bg-white/1.5 rounded-full blur-[140px] pointer-events-none will-change-transform" />
      <div className="absolute bottom-5 left-10 w-80 h-80 bg-primary/4 rounded-full blur-[120px] pointer-events-none will-change-transform" />

      <div className="absolute inset-0 mesh-grid opacity-75 pointer-events-none" />

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10 w-full">

        <div className="lg:col-span-7 space-y-8 text-left">

          {/* Reduced animations when user prefers less motion */}
          <motion.div
            initial={prefersReducedMotion ? {} : { opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.5 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-extrabold text-primary uppercase tracking-wider"
          >
            <Sparkles className={`w-3.5 h-3.5 ${prefersReducedMotion ? '' : 'animate-spin'}`} />
            <span>Vedhunt Infotech — Premium Full-Service Agency</span>
          </motion.div>

          <div className="space-y-3">
            <motion.h1
              initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: prefersReducedMotion ? 0 : 0.1, duration: prefersReducedMotion ? 0 : 0.6 }}
              className="text-4xl sm:text-5xl md:text-6xl font-black font-heading text-app-text leading-tight"
            >
              Transform Your Business <br />
              With High-Performance <br />
              <span className="block min-h-[4rem] sm:min-h-[4.5rem] md:min-h-[5rem] h-auto flex items-center py-1">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={textIndex}
                    initial={prefersReducedMotion ? {} : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={prefersReducedMotion ? {} : { opacity: 0 }}
                    transition={{ duration: prefersReducedMotion ? 0 : 0.25 }}
                    className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-primary block"
                  >
                    <EncryptedText
                      text={rotatingPhrases[textIndex]}
                      revealedClassName="text-primary text-gradient-orange"
                      encryptedClassName="text-primary/50 font-mono"
                      revealDelayMs={prefersReducedMotion ? 0 : 25}
                      flipDelayMs={prefersReducedMotion ? 0 : 20}
                    />
                  </motion.span>
                </AnimatePresence>
              </span>
            </motion.h1>

            <motion.p
              initial={prefersReducedMotion ? {} : { opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: prefersReducedMotion ? 0 : 0.25, duration: prefersReducedMotion ? 0 : 0.6 }}
              className="text-app-text-muted text-sm sm:text-base md:text-lg leading-relaxed max-w-xl font-sans"
            >
              We engineer beautiful web application layouts, drive targeted digital leads, manage outsource bookkeeping, and build custom database SQL reports. High standards at economical pricing structures.
            </motion.p>
          </div>

          <motion.div
            initial={prefersReducedMotion ? {} : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: prefersReducedMotion ? 0 : 0.4, duration: prefersReducedMotion ? 0 : 0.6 }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
            {[
              'Custom web & mobile development',
              'Strategic Google SEO audits',
              'Experienced financial compliances',
              'SQL, Python & Power BI reports'
            ].map((bullet, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs text-app-text-muted">
                <div className="w-4.5 h-4.5 rounded-full bg-primary/10 border border-primary/25 text-primary flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <span>{bullet}</span>
              </div>
            ))}
          </motion.div>

          <motion.div
            initial={prefersReducedMotion ? {} : { opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: prefersReducedMotion ? 0 : 0.45, duration: prefersReducedMotion ? 0 : 0.6 }}
            className="flex flex-wrap gap-4"
          >
            <Link
              to="/contact"
              className="px-7 py-3.5 bg-primary hover:bg-primary-hover text-black font-extrabold text-sm rounded-lg flex items-center gap-2 transition-all duration-300 hover:-translate-y-0.5 group cursor-pointer"
            >
              <span>Get Free Quote Now</span>
              <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>

            <Link
              to="/services"
              className="px-7 py-3.5 bg-app-card border border-app-border hover:bg-app-bg text-app-text font-bold text-sm rounded-lg flex items-center gap-2 transition-all duration-300 hover:-translate-y-0.5 shadow-sm"
            >
              <span>Our Tech Services</span>
            </Link>
          </motion.div>
        </div>

        <div className="hidden lg:flex lg:relative lg:col-span-5 items-center justify-center min-h-[420px] lg:opacity-100 lg:pointer-events-auto lg:z-10 lg:overflow-visible">

          <Spotlight className="-top-40 left-0 md:left-20 md:-top-20 opacity-40 dark:opacity-20 pointer-events-none" />

          <div className="w-full max-w-[480px] h-[450px] relative flex items-center justify-center select-none">

            <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 to-transparent dark:from-primary/2 rounded-full blur-2xl opacity-70 pointer-events-none will-change-transform" />

            <SplineScene
              scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
              className="w-full h-full pointer-events-auto"
            />
          </div>

          <motion.div
            initial={prefersReducedMotion ? {} : { opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: prefersReducedMotion ? 0 : 0.35, duration: prefersReducedMotion ? 0 : 0.8 }}
            className="hidden lg:flex absolute -right-2 md:-right-6 bottom-4 md:bottom-8 glass-panel p-3.5 rounded-2xl bg-app-card/85 dark:bg-app-card/90 border-app-border shadow-xl items-center gap-3.5 w-48 hover:-translate-y-1 transition-transform duration-300 animate-float pointer-events-auto z-20"
          >
            <div className="w-9 h-9 rounded-lg bg-green-500/10 border border-green-500/20 text-green-500 flex items-center justify-center shrink-0">
              <Users className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="text-base font-black text-app-text font-heading">500k+</div>
              <div className="text-[8px] text-app-text-muted font-black uppercase tracking-widest">Leads Driven</div>
            </div>
          </motion.div>

          <motion.div
            initial={prefersReducedMotion ? {} : { opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: prefersReducedMotion ? 0 : 0.5, duration: prefersReducedMotion ? 0 : 0.8 }}
            className="hidden lg:flex absolute -left-2 md:-left-6 top-4 md:top-8 glass-panel p-3.5 rounded-2xl bg-app-card/85 dark:bg-app-card/90 border-app-border shadow-xl items-center gap-3.5 w-48 hover:-translate-y-1 transition-transform duration-300 animate-float-delayed pointer-events-auto z-20"
          >
            <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
              <Award className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="text-base font-black text-app-text font-heading">99%</div>
              <div className="text-[8px] text-app-text-muted font-black uppercase tracking-widest">Client Retained</div>
            </div>
          </motion.div>

        </div>

      </div>
    </section>
  );
}
