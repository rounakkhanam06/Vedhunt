import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, ChevronLeft, ChevronRight, Quote, MessageSquarePlus } from 'lucide-react';
import axios from 'axios';
import ReviewModal from './ReviewModal';

export default function Testimonials() {
  const [index, setIndex] = useState(0);
  const [testimonials, setTestimonials] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const fetchDynamic = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        const res = await axios.get(`${apiUrl}/testimonials/approved`);
        if (res.data && res.data.data) {
          setTestimonials(res.data.data);
        }
      } catch (err) {
        console.error('Failed to load testimonials', err);
      }
    };
    fetchDynamic();
  }, []);

  // Auto-advance carousel every 5 seconds
  useEffect(() => {
    if (testimonials.length === 0) return;
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [testimonials.length]);

  const next = () => setIndex((i) => (i + 1) % testimonials.length);
  const prev = () => setIndex((i) => (i - 1 + testimonials.length) % testimonials.length);

  const t = testimonials[index];

  if (!t) return null; // Don't render if empty

  return (
    <section
      className="pt-12 pb-4 md:pt-24 md:pb-8 bg-app-bg text-app-text overflow-hidden relative select-none border-t border-b border-app-border"
      id="testimonials"
    >
      {/* Background Ambient Glows */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[150px] pointer-events-none" />

      <div className="max-w-5xl mx-auto px-4 relative z-10">
        
        {/* Title and Write Review Button */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 md:mb-10 gap-4">
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-primary uppercase tracking-wider">
              CLIENT SAYS:
            </h2>
          </div>
          <div className="flex-shrink-0 flex justify-center md:justify-end">
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 hover:border-primary/40 rounded-full font-semibold transition-all duration-300"
            >
              <MessageSquarePlus className="w-5 h-5" />
              Write a Review
            </button>
          </div>
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
              <div className="relative bg-white dark:bg-app-card backdrop-blur-2xl rounded-[2rem] md:rounded-[2.5rem] rounded-tr-[3rem] md:rounded-tr-[4rem] p-5 md:p-8 shadow-[0_8px_30px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] text-left border border-slate-100 dark:border-white/10">
                
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
                    <h3 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white leading-tight">
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
                          <Star className="w-4 h-4 md:w-5 md:h-5 fill-primary text-primary" />
                        </motion.div>
                      ))}
                    </div>
                    <Quote className="w-8 h-8 md:w-10 md:h-10 text-primary opacity-90 fill-primary rotate-180" />
                  </div>

                  {/* Quote Text */}
                  <p className="text-sm md:text-base text-slate-700 dark:text-zinc-300 font-medium italic leading-relaxed relative z-10 line-clamp-5 md:line-clamp-none h-[110px] md:h-auto overflow-hidden">
                    "{t.quote}"
                  </p>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Carousel Controls */}
        <div className="mt-4 md:mt-8 flex items-center justify-center gap-6 relative z-20">
          <button 
            onClick={prev} 
            className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-app-bg border border-app-border flex items-center justify-center text-app-text hover:bg-primary hover:text-black hover:border-primary transition-all duration-300 shadow-md"
          >
            <ChevronLeft strokeWidth={1.5} className="w-4 h-4 md:w-5 md:h-5 -ml-0.5" />
          </button>
          
          {/* Pagination Dots */}
          <div className="flex gap-2 md:gap-3 flex-wrap justify-center max-w-[60vw]">
            {testimonials.map((_, i) => (
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
      
      {/* Review Modal */}
      <ReviewModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </section>
  );
}

