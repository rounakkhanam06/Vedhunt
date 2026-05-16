import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { SERVICES } from '../constants';

// Import newly generated high-fidelity brand assets
import webDevImg from '../assets/web_dev.webp';
import appDevImg from '../assets/app_dev.webp';
import brandingImg from '../assets/branding.webp';
import digitalMarketingImg from '../assets/digital_marketing.webp';
import seoImg from '../assets/seo.webp';
import accountingImg from '../assets/accounting.webp';
import automationImg from '../assets/automation.webp';

const serviceImages = {
  'web-dev': webDevImg,
  'app-dev': appDevImg,
  'logo-brand': brandingImg,
  'digital-marketing': digitalMarketingImg,
  'seo': seoImg,
  'accounting-finance': accountingImg,
  'enterprise-automation': automationImg,
};

export default function Services() {
  const [hoveredId, setHoveredId] = useState(null);

  const staggerContainer = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.12
      }
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
    <div className="bg-app-bg text-app-text-muted min-h-screen py-24 px-4 sm:px-6 lg:px-8 mesh-grid relative overflow-hidden">
      {/* Background Ambient Glows */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-primary/5 rounded-full filter blur-[150px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/2 dark:bg-white/2 rounded-full filter blur-[150px] pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10">
        
        {/* Banner Section with Scroll Trigger */}
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={staggerContainer}
          className="text-center max-w-3xl mx-auto mb-20"
        >
          <motion.span variants={scrollFadeUp} className="text-primary text-xs font-extrabold uppercase tracking-widest bg-primary/10 border border-primary/20 px-3.5 py-1 rounded-full">
            Our Capabilities
          </motion.span>
          <motion.h1 variants={scrollFadeUp} className="text-4xl md:text-5xl font-extrabold font-heading text-app-text mt-4 mb-6 leading-tight">
            High Performance Solutions at <span className="text-primary text-gradient-orange">Economical Prices</span>
          </motion.h1>
          <motion.p variants={scrollFadeUp} className="text-app-text-muted text-xs md:text-sm leading-relaxed">
            We take pride in our hands-on tech expertise, proactive customer communication, and premium engineering. Explore how we scale business operations through custom solutions.
          </motion.p>
        </motion.div>

        {/* Desktop View: Expanding Flex Accordion (lg and up) */}
        <div className="hidden lg:flex flex-col gap-8">
          {Array.from({ length: Math.ceil(SERVICES.length / 3) }).map((_, rowIndex) => {
            const rowServices = SERVICES.slice(rowIndex * 3, rowIndex * 3 + 3);
            const placeholders = 3 - rowServices.length;

            return (
              <motion.div
                key={`row-${rowIndex}`}
                variants={staggerContainer}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-60px' }}
                className="flex flex-row gap-8 items-center h-[400px]"
              >
                {rowServices.map((srv) => {
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
                        <img
                          src={serviceImages[srv.id]}
                          alt={srv.title}
                          loading="lazy"
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
                          to="/contact"
                          className="inline-flex items-center gap-2 text-sm font-bold text-white transition-colors mt-auto opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 duration-500 delay-75"
                        >
                          <span>Get Started</span>
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </motion.div>
                  );
                })}

                {/* Invisible Spacer Divs for Incomplete Rows */}
                {Array.from({ length: placeholders }).map((_, i) => (
                  <div key={`spacer-${rowIndex}-${i}`} style={{ flex: 1, height: '80%' }} className="pointer-events-none opacity-0" />
                ))}
              </motion.div>
            );
          })}
        </div>

        {/* Mobile & Tablet Fallback (Grid) */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          className="grid lg:hidden grid-cols-1 md:grid-cols-2 gap-6"
        >
          {SERVICES.map((srv) => {
            const IconComp = srv.icon;

            return (
              <motion.div
                key={srv.id}
                variants={scrollFadeUp}
                className="relative rounded-lg overflow-hidden flex flex-col group transition-all duration-500 ease-out hover:scale-[1.03] hover:shadow-[0_20px_40px_rgba(255,107,0,0.15)] min-h-[320px] border border-white/5 bg-app-card"
              >
                {/* Full Background Image */}
                <div className="absolute inset-0 z-0 overflow-hidden">
                  <img
                    src={serviceImages[srv.id]}
                    alt={srv.title}
                    loading="lazy"
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
                    to="/contact"
                    className="inline-flex items-center gap-2 text-sm font-bold text-white transition-colors mt-auto opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 duration-500 delay-75"
                  >
                    <span>Get Started</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Dynamic CTA bottom card with Scroll Entry */}
        <motion.div
          initial={{ opacity: 0, y: 35 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="mt-24 glass-panel rounded-3xl p-8 md:p-12 text-center bg-gradient-to-r from-app-card via-app-card/95 to-app-bg border border-app-border relative overflow-hidden orange-glow shadow-xl"
        >
          <div className="absolute -top-10 -left-10 w-40 h-40 bg-primary/10 rounded-full filter blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-primary/10 rounded-full filter blur-3xl pointer-events-none" />

          <div className="max-w-2xl mx-auto space-y-6 relative z-10">
            <h3 className="text-2xl md:text-3xl font-extrabold font-heading text-app-text">
              Not Finding a Specific Technical Capability?
            </h3>
            <p className="text-app-text-muted text-xs leading-relaxed">
              We specialize in custom web applications, custom API pipelines, scraping scripts, and specialized corporate bookkeeping architectures. Connect with our principal engineers for a custom scope.
            </p>
            <div className="pt-2">
              <Link
                to="/contact"
                className="px-8 py-3.5 bg-primary hover:bg-primary-hover text-black font-extrabold text-sm rounded-lg hover:shadow-[0_0_25px_rgba(255,107,0,0.45)] transition-all duration-300 inline-block cursor-pointer"
              >
                Connect with our Engineers
              </Link>
            </div>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
