import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import ctaImage from '../../assets/Gemini_Generated_Image_jbm779jbm779jbm7-removebg-preview.webp';

export default function CTABanner() {
  const containerVariants = {
    hidden: { opacity: 0, scale: 0.98 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.8,
        ease: [0.16, 1, 0.3, 1],
        staggerChildren: 0.15
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] }
    }
  };

  return (
    <section className="py-4 md:py-8 px-4 sm:px-6 lg:px-8 bg-app-bg relative overflow-hidden">
      {/* Subtle Ambient Glow */}
      <div className="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[250px] h-[250px] bg-primary/5 rounded-full filter blur-[80px] pointer-events-none animate-pulse" />

      <div className="max-w-5xl mx-auto relative z-10">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
          variants={containerVariants}
          className="relative overflow-hidden rounded-2xl border border-app-border bg-[#F5F5F7]/80 dark:bg-[#12121F]/80 p-4 md:p-6 py-6 md:py-8 text-center lg:text-left orange-glow shadow-md backdrop-blur-md"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
            
            {/* Left Column: Centralized Text & CTA Content */}
            <div className="lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left space-y-4 relative z-20">
              <div className="space-y-1.5">
                <motion.h2 
                  variants={itemVariants} 
                  className="text-xl sm:text-2xl md:text-3xl font-black font-heading text-app-text tracking-tight leading-tight"
                >
                  Ready to Grow Your Business?
                </motion.h2>
                <motion.p 
                  variants={itemVariants} 
                  className="text-app-text-muted text-xs sm:text-sm max-w-sm sm:max-w-md lg:max-w-none leading-relaxed"
                >
                  Book a free 30-minute discovery call. No commitment required.
                </motion.p>
              </div>

              <motion.div variants={itemVariants} className="pt-1">
                <Link
                  to="/get-quote"
                  className="inline-flex items-center gap-1.5 px-6 py-2 bg-black hover:bg-neutral-900 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-black font-bold text-xs rounded-full transition-all duration-300 shadow-sm hover:shadow-md hover:-translate-y-0.5 group cursor-pointer"
                >
                  <span>Get Free Consultation</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
              </motion.div>
            </div>

            {/* Right Column: Visual CTA Image Asset */}
            <div className="lg:col-span-5 relative flex h-[160px] md:h-[200px] w-full items-center justify-center overflow-hidden bg-transparent z-10">
              <motion.img
                src={ctaImage}
                alt="Ready to Grow Your Business"
                className="h-full w-auto object-contain max-h-[160px] md:max-h-[200px] drop-shadow-[0_10px_20px_rgba(0,0,0,0.12)] dark:drop-shadow-[0_8px_16px_rgba(232,71,10,0.15)] pointer-events-none select-none"
                animate={{
                  y: [0, -6, 0]
                }}
                transition={{
                  duration: 5,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
            </div>

          </div>
        </motion.div>
      </div>
    </section>
  );
}
