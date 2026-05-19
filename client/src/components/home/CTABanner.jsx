import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

export default function CTABanner() {
  const containerVariants = {
    hidden: { opacity: 0, y: 30, scale: 0.98 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.8,
        ease: [0.16, 1, 0.3, 1],
        staggerChildren: 0.15
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] }
    }
  };

  return (
    <section className="py-6 sm:py-10 px-4 sm:px-6 lg:px-8 bg-app-bg relative overflow-hidden">
      <div className="max-w-7xl mx-auto relative z-10">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
          variants={containerVariants}
          className="relative overflow-hidden rounded-[2.5rem] bg-primary p-8 sm:p-12 md:p-14 text-center lg:text-left shadow-2xl shadow-primary/20 border border-white/10"
        >
          {/* Right Column Concentric Rings Pattern (Stepped Fills) */}
          <div className="absolute top-1/2 -right-24 md:-right-36 -translate-y-1/2 w-[260px] h-[260px] sm:w-[360px] sm:h-[360px] md:w-[460px] md:h-[460px] lg:w-[520px] lg:h-[520px] flex items-center justify-center pointer-events-none z-0">
            <div className="absolute w-[100%] h-[100%] rounded-full bg-white/[0.05] backdrop-blur-[0.5px]" />
            <div className="absolute w-[80%] h-[80%] rounded-full bg-white/[0.08]" />
            <div className="absolute w-[60%] h-[60%] rounded-full bg-white/[0.12]" />
            <div className="absolute w-[40%] h-[40%] rounded-full bg-white/[0.18]" />
            <div className="absolute w-[22%] h-[22%] rounded-full bg-white/45" />
            <div className="absolute w-[8%] h-[8%] rounded-full bg-white shadow-[0_0_20px_rgba(255,255,255,0.6)]" />
          </div>

          <div className="relative z-10 max-w-xl space-y-6 sm:space-y-8">
            {/* Header Text Segment */}
            <div className="space-y-3">
              <motion.h2 
                variants={itemVariants} 
                className="text-2xl sm:text-3xl md:text-4xl font-black font-heading text-white tracking-tight leading-tight"
              >
                Ready to Grow Your Business?
              </motion.h2>
              <motion.p 
                variants={itemVariants} 
                className="text-white/85 text-xs sm:text-sm font-medium leading-relaxed max-w-md mx-auto lg:mx-0"
              >
                Book a free 30-minute discovery call. No commitment required.
              </motion.p>
            </div>

            {/* Buttons Row */}
            <motion.div 
              variants={itemVariants} 
              className="flex flex-col sm:flex-row gap-4 items-center justify-center lg:justify-start"
            >
              {/* Primary Call */}
              <Link
                to="/get-quote"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-4 pl-6 pr-11 py-3 bg-[#0B0B14] hover:bg-black text-white font-black text-xs uppercase tracking-wider rounded-full transition-all duration-300 shadow-xl hover:shadow-black/25 hover:-translate-y-0.5 group cursor-pointer border border-white/5 relative h-11"
              >
                <span>Book a discovery call</span>
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-gradient-to-b from-white to-neutral-200 shadow-[inset_0_-2px_4px_rgba(0,0,0,0.15),0_2px_4px_rgba(0,0,0,0.25)] flex items-center justify-center group-hover:scale-105 transition-transform">
                  <ArrowRight className="w-3.5 h-3.5 text-black group-hover:translate-x-0.5 transition-transform duration-300" />
                </div>
              </Link>

              {/* Secondary Call */}
              <Link
                to="/services"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-4 pl-6 pr-11 py-3 bg-[#0B0B14] hover:bg-black text-white font-black text-xs uppercase tracking-wider rounded-full transition-all duration-300 shadow-xl hover:shadow-black/25 hover:-translate-y-0.5 group cursor-pointer border border-white/5 relative h-11"
              >
                <span>Explore Services</span>
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-gradient-to-b from-white to-neutral-200 shadow-[inset_0_-2px_4px_rgba(0,0,0,0.15),0_2px_4px_rgba(0,0,0,0.25)] flex items-center justify-center group-hover:scale-105 transition-transform">
                  <ArrowRight className="w-3.5 h-3.5 text-black group-hover:translate-x-0.5 transition-transform duration-300" />
                </div>
              </Link>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
