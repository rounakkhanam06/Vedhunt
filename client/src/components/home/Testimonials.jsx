import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, ChevronLeft, ChevronRight, Quote } from 'lucide-react';
import { TESTIMONIALS } from '../../constants';

export default function Testimonials() {
  const [index, setIndex] = useState(0);

  // Auto-advance carousel every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % TESTIMONIALS.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const next = () => setIndex((i) => (i + 1) % TESTIMONIALS.length);
  const prev = () => setIndex((i) => (i - 1 + TESTIMONIALS.length) % TESTIMONIALS.length);

  const t = TESTIMONIALS[index];

  return (
    <section
      className="py-16 md:py-24 bg-app-bg text-app-text overflow-hidden relative select-none border-t border-b border-app-border"
      id="testimonials"
    >
      {/* Background Ambient Glows */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[150px] pointer-events-none" />

      <div className="max-w-5xl mx-auto px-4 relative z-10">
        
        {/* Title */}
        <div className="text-center mb-6 md:mb-10">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-primary uppercase tracking-wider">
            CLIENT SAYS:
          </h2>
        </div>

        {/* Carousel Container - More compact height */}
        <div className="relative flex items-center justify-center w-full pt-10 md:pt-14 pb-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              initial={{ opacity: 0, x: 50, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -50, scale: 0.95 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="w-full max-w-2xl px-4 md:px-8"
            >
              {/* The Card - More compact padding */}
              <div className="relative bg-white/60 dark:bg-[#0a0a0a]/40 backdrop-blur-2xl rounded-[2rem] md:rounded-[2.5rem] rounded-tr-[3rem] md:rounded-tr-[4rem] p-5 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] text-left border border-white/60 dark:border-white/10">
                
                {/* Orange Corner Accent */}
                <div className="absolute top-0 right-0 w-2/3 md:w-1/2 h-full border-t-[4px] md:border-t-[6px] border-r-[4px] md:border-r-[6px] border-primary opacity-80 rounded-tr-[3rem] md:rounded-tr-[4rem] rounded-br-[2.5rem] pointer-events-none" />
                
                {/* Top Left Profile Image Overlapping */}
                <div className="absolute -top-12 left-8 md:-top-16 md:-left-4 w-24 h-24 md:w-32 md:h-32 rounded-full border-[4px] border-primary overflow-hidden bg-white/80 dark:bg-black/50 backdrop-blur-xl shadow-xl z-20">
                  <img
                    src={t.avatar}
                    alt={t.author}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Content Area */}
                <div className="pt-12 md:pt-0 pl-0 md:pl-32">
                  {/* Name and Country - Compact spacing */}
                  <div className="mb-3">
                    <h3 className="text-xl md:text-2xl font-bold text-[#00204a] dark:text-white leading-tight">
                      {t.author}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-base md:text-lg">{t.countryFlag}</span>
                      <span className="text-xs md:text-sm font-medium text-slate-600 dark:text-zinc-400">
                        {t.country}
                      </span>
                    </div>
                  </div>

                  {/* Stars and Quote Icon - Compact spacing */}
                  <div className="flex justify-between items-center mb-3 pr-2">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((_, i) => (
                        <motion.div
                          key={`${index}-star-${i}`}
                          initial={{ opacity: 0, scale: 0, rotate: -45 }}
                          animate={{ opacity: 1, scale: 1, rotate: 0 }}
                          transition={{ delay: i * 0.1, type: 'spring', stiffness: 200, damping: 10 }}
                        >
                          <Star className="w-4 h-4 md:w-5 md:h-5 fill-[#00204a] text-[#00204a] dark:fill-primary dark:text-primary" />
                        </motion.div>
                      ))}
                    </div>
                    <Quote className="w-8 h-8 md:w-10 md:h-10 text-[#00204a] opacity-90 fill-[#00204a] dark:text-primary dark:fill-primary rotate-180" />
                  </div>

                  {/* Quote Text */}
                  <p className="text-sm md:text-base text-slate-700 dark:text-zinc-300 font-medium italic leading-relaxed relative z-10">
                    "{t.quote}"
                  </p>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Carousel Controls */}
        <div className="mt-8 flex items-center justify-center gap-6 relative z-20">
          <button 
            onClick={prev} 
            className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-app-bg border border-app-border flex items-center justify-center text-app-text hover:bg-primary hover:text-black hover:border-primary transition-all duration-300 shadow-md"
          >
            <ChevronLeft strokeWidth={1.5} className="w-4 h-4 md:w-5 md:h-5 -ml-0.5" />
          </button>
          
          {/* Pagination Dots */}
          <div className="flex gap-2 md:gap-3">
            {TESTIMONIALS.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                className={`w-2 h-2 md:w-2.5 md:h-2.5 rounded-full transition-all duration-500 ${
                  i === index ? 'w-8 md:w-10 bg-primary opacity-80' : 'bg-slate-300 dark:bg-white/20 hover:bg-slate-400 dark:hover:bg-white/40'
                }`}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>

          <button 
            onClick={next} 
            className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-app-bg border border-app-border flex items-center justify-center text-app-text hover:bg-primary hover:text-black hover:border-primary transition-all duration-300 shadow-md"
          >
            <ChevronRight strokeWidth={1.5} className="w-4 h-4 md:w-5 md:h-5 -mr-0.5" />
          </button>
        </div>

      </div>
    </section>
  );
}

