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
  const [hoveredId, setHoveredId] = useState(null);
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

        {/* Desktop View: Expanding Flex Accordion (lg and up) */}
        <div className="hidden lg:flex flex-col gap-8">
          {[0, 1].map(rowIndex => (
            <motion.div
              key={rowIndex}
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              className="flex flex-row gap-8 items-center h-[400px]"
            >
              {previewServices.slice(rowIndex * 3, rowIndex * 3 + 3).map((srv) => {
                const IconComp = srv.icon;
                const isHovered = hoveredId === srv.id;
                const isAnyHovered = hoveredId !== null;

                return (
                  <motion.div
                    layout
                    key={srv.id}
                    variants={scrollFadeUp}
                    onMouseEnter={() => setHoveredId(srv.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    style={{ 
                      flex: isHovered ? 1.25 : (isAnyHovered ? 0.875 : 1),
                      height: isHovered ? '100%' : '80%',
                    }}
                    className="relative rounded-lg overflow-hidden flex flex-col group transition-all duration-500 ease-out border border-white/5 bg-app-card shadow-[0_10px_30px_rgba(0,0,0,0.5)]"
                  >
                    {/* Full Background Image */}
                    <div className="absolute inset-0 z-0 overflow-hidden">
                      <LazyImage
                        src={serviceImages[srv.id]}
                        alt={srv.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-in-out"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-app-bg via-app-bg/80 to-transparent z-10" />
                    </div>

                    {/* Content Overlay */}
                    <div className="relative z-20 mt-auto p-6 flex flex-col transform transition-transform duration-500 group-hover:-translate-y-2">
                      <div className="mb-4 w-10 h-10 rounded-lg bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white group-hover:bg-white/20 transition-all duration-500">
                        <IconComp className="w-5 h-5" />
                      </div>

                      <h3 className="text-2xl font-black font-heading text-white mb-2 leading-tight transition-colors duration-300">
                        {srv.title}
                      </h3>
                      
                      <p className="text-sm text-white/70 leading-relaxed mb-4 line-clamp-2 group-hover:text-white/90 transition-colors duration-300">
                        {srv.shortDescription}
                      </p>

                      <Link
                        to="/services"
                        className="inline-flex items-center gap-2 text-sm font-bold text-white transition-colors mt-auto opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 duration-500 delay-75"
                      >
                        <span>Explore more</span>
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          ))}
        </div>

        {/* Mobile & Tablet Fallback (Grid) */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          className="grid lg:hidden grid-cols-1 md:grid-cols-2 gap-6"
        >
          {previewServices.map((srv) => {
            const IconComp = srv.icon;

            return (
              <motion.div
                key={srv.id}
                variants={scrollFadeUp}
                className="relative rounded-lg overflow-hidden flex flex-col group transition-all duration-500 ease-out hover:scale-[1.03] hover:shadow-[0_20px_40px_rgba(255,107,0,0.15)] min-h-[320px] border border-white/5 bg-app-card"
              >
                {/* Full Background Image */}
                <div className="absolute inset-0 z-0 overflow-hidden">
                  <LazyImage
                    src={serviceImages[srv.id]}
                    alt={srv.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-in-out"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-app-bg via-app-bg/80 to-transparent z-10" />
                </div>

                {/* Content Overlay */}
                <div className="relative z-20 mt-auto p-6 flex flex-col transform transition-transform duration-500 group-hover:-translate-y-2">
                  <div className="mb-4 w-10 h-10 rounded-lg bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white group-hover:bg-white/20 transition-all duration-500">
                    <IconComp className="w-5 h-5" />
                  </div>

                  <h3 className="text-xl md:text-2xl font-black font-heading text-white mb-2 leading-tight transition-colors duration-300">
                    {srv.title}
                  </h3>
                  
                  <p className="text-sm text-white/70 leading-relaxed mb-4 line-clamp-2 group-hover:text-white/90 transition-colors duration-300">
                    {srv.shortDescription}
                  </p>

                  <Link
                    to="/services"
                    className="inline-flex items-center gap-2 text-sm font-bold text-white transition-colors mt-auto opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 duration-500 delay-75"
                  >
                    <span>Explore more</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
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
