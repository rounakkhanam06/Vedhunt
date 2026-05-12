import { useRef, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { SERVICES } from '../../constants';

// Import newly generated high-fidelity brand assets
import webDevImg from '../../assets/web_dev.webp';
import appDevImg from '../../assets/app_dev.webp';
import brandingImg from '../../assets/branding.webp';
import digitalMarketingImg from '../../assets/digital_marketing.webp';
import seoImg from '../../assets/seo.webp';
import accountingImg from '../../assets/accounting.webp';

const serviceImages = {
  'web-dev': webDevImg,
  'app-dev': appDevImg,
  'logo-brand': brandingImg,
  'digital-marketing': digitalMarketingImg,
  'seo': seoImg,
  'accounting-finance': accountingImg,
};

/**
 * LazyImage - Uses IntersectionObserver to lazy load images
 */
function LazyImage({ src, alt, className }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [shouldLoad, setShouldLoad] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    const element = imgRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px', threshold: 0 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={imgRef} className={`relative ${className}`}>
      {shouldLoad ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setIsLoaded(true)}
          className={`w-full h-full object-cover transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
        />
      ) : (
        <div className="w-full h-full bg-primary/5 animate-pulse" />
      )}
    </div>
  );
}

export default function ServicesPreview() {
  const previewServices = SERVICES.slice(0, 6);

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

  return (
    <section className="pt-12 pb-24 px-4 sm:px-6 lg:px-8 bg-app-bg relative overflow-hidden">
      {/* Background Subtle Ambient Glows */}
      <div className="absolute top-1/2 right-0 w-96 h-96 bg-primary/4 rounded-full filter blur-[130px] pointer-events-none" />
      <div className="absolute top-1/4 left-0 w-96 h-96 bg-primary/2 dark:bg-white/1 rounded-full filter blur-[130px] pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* Header Block with Scroll Animations */}
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={staggerContainer}
          className="text-center space-y-3 mb-20 max-w-2xl mx-auto"
        >
          <motion.div variants={scrollFadeUp} className="flex items-center justify-center gap-2">
            <span className="w-6 h-[2px] bg-primary" />
            <span className="text-xs font-extrabold text-primary uppercase tracking-widest">
              Our Services
            </span>
          </motion.div>
          
          <motion.h2 variants={scrollFadeUp} className="text-3xl md:text-5xl font-black font-heading text-app-text leading-tight">
            Services That Fit <span className="text-primary text-gradient-orange block sm:inline">Your Needs</span>
          </motion.h2>
        </motion.div>

        {/* Services Grid with Custom Scroll Animations */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          {previewServices.map((srv) => {
            const IconComp = srv.icon;

            return (
              <motion.div
                key={srv.id}
                variants={scrollFadeUp}
                className="relative bg-app-card border border-app-border rounded-3xl overflow-hidden flex flex-col group transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_15px_35px_rgba(255,107,0,0.12)] hover:border-primary/40"
              >
                {/* Slanted Image Placeholder Container */}
                <div
                  className="h-[180px] w-full relative select-none border-b border-app-border/40 overflow-hidden"
                  style={{ clipPath: 'polygon(24% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 28%)' }}
                >
                  <LazyImage
                    src={serviceImages[srv.id]}
                    alt={srv.title}
                    className="group-hover:scale-105 transition-transform duration-500"
                  />

                  {/* Subtle brand-orange tinting and lighting overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-primary/5 to-transparent pointer-events-none mix-blend-multiply" />
                  <div className="absolute inset-0 bg-gradient-to-t from-primary/15 via-transparent to-transparent pointer-events-none" />
                </div>

                {/* Circular Floating Brand Accent Icon Block */}
                <div className="absolute top-[180px] left-8 -translate-y-1/2 z-10 w-14 h-14 rounded-full bg-primary flex items-center justify-center text-white border-4 border-app-card shadow-lg orange-glow-sm transition-transform duration-300 group-hover:scale-105">
                  <IconComp className="w-5.5 h-5.5" />
                </div>

                {/* Content Section */}
                <div className="pt-10 px-8 pb-8 flex flex-col flex-grow text-left">
                  <h3 className="text-xl font-black font-heading text-app-text mb-3 leading-snug group-hover:text-primary transition-colors duration-300">
                    {srv.title}
                  </h3>
                  
                  <p className="text-xs text-app-text-muted leading-relaxed mb-6 flex-grow line-clamp-3">
                    {srv.shortDescription}
                  </p>

                  <Link
                    to="/contact"
                    className="inline-flex items-center gap-1.5 text-xs font-black text-primary hover:text-primary transition-colors mt-auto"
                  >
                    <span>Learn more</span>
                    <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-1.5" />
                  </Link>
                </div>

                {/* Bottom Border Glow Slide-In Accent */}
                <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-primary scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left z-20" />
              </motion.div>
            );
          })}
        </motion.div>

        {/* Dynamic Quote Banner with Scroll Entrance */}
        <motion.div 
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="mt-16 text-center max-w-xl mx-auto bg-app-card border border-app-border rounded-2xl py-4 px-6 text-xs text-app-text-muted flex flex-col sm:flex-row items-center justify-center gap-2.5 shadow-sm"
        >
          <span className="text-primary font-bold uppercase tracking-wider bg-primary/10 px-2 py-0.5 rounded-md shrink-0">
            Get Free Quote
          </span>
          <span>Submit a service request and receive an itemized proposal within 4 hours.</span>
          <Link to="/contact" className="text-primary font-bold hover:underline shrink-0">
            Submit inquiry →
          </Link>
        </motion.div>

      </div>
    </section>
  );
}
