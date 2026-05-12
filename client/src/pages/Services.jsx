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

      <div className="max-w-7xl mx-auto relative z-10">
        
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

        {/* Services Grid with Viewport Scroll Staggering */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          {SERVICES.map((srv) => {
            const IconComp = srv.icon;

            return (
              <motion.div
                key={srv.id}
                variants={scrollFadeUp}
                className="relative bg-app-card border border-app-border rounded-3xl overflow-hidden flex flex-col group transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_15px_35px_rgba(255,107,0,0.12)] hover:border-primary/40"
              >
                {/* Slanted Image Container */}
                <div 
                  className="h-[180px] w-full relative select-none border-b border-app-border/40 overflow-hidden"
                  style={{ clipPath: 'polygon(24% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 28%)' }}
                >
                  <img 
                    src={serviceImages[srv.id]} 
                    alt={srv.title} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
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
                    <span>Get Started</span>
                    <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-1.5" />
                  </Link>
                </div>

                {/* Bottom Border Glow Slide-In Accent */}
                <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-primary scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left z-20" />
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
