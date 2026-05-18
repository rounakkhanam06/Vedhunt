import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { SERVICES } from '../constants';
import ServiceCard from '../components/services/ServiceCard';

// Image Assets
import webDevImg from '../assets/web_dev.webp';
import appDevImg from '../assets/app_dev.webp';
import marketingImg from '../assets/marketing.webp';
import digitalMarketingImg from '../assets/digital_marketing.webp';
import accountingImg from '../assets/accounting.webp';
import automationImg from '../assets/automation.webp';

const serviceImages = {
  'web-dev': webDevImg,
  'app-dev': appDevImg,
  'social-media': marketingImg,
  'performance-marketing': digitalMarketingImg,
  'accounting-finance': accountingImg,
  'mis-reporting': automationImg,
};

export default function Services() {
  const staggerContainer = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const scrollFadeUp = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
    }
  };

  return (
    <div className="bg-app-bg text-app-text-muted min-h-screen py-24 px-4 sm:px-6 lg:px-8 mesh-grid relative overflow-hidden">
      {/* Background Ambient Glows */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-primary/5 rounded-full filter blur-[150px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/2 dark:bg-white/2 rounded-full filter blur-[150px] pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* Banner Section */}
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={staggerContainer}
          className="text-center max-w-3xl mx-auto mb-20"
        >
          <motion.span variants={scrollFadeUp} className="text-primary text-xs font-black uppercase tracking-[0.2em] bg-primary/10 border border-primary/20 px-4 py-1.5 rounded-full">
            Our Capabilities
          </motion.span>
          <motion.h1 variants={scrollFadeUp} className="text-4xl md:text-6xl font-black font-heading text-app-text mt-6 mb-6 leading-tight">
            High Performance Solutions at <span className="text-primary text-gradient-orange">Economical Prices</span>
          </motion.h1>
          <motion.p variants={scrollFadeUp} className="text-app-text-muted text-sm md:text-base leading-relaxed max-w-2xl mx-auto">
            We take pride in our hands-on tech expertise, proactive customer communication, and premium engineering. Explore how we scale business operations through custom solutions.
          </motion.p>
        </motion.div>

        {/* Services Grid */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10"
        >
          {SERVICES.map((srv) => (
            <motion.div key={srv.id} variants={scrollFadeUp}>
              <ServiceCard 
                service={srv} 
                image={serviceImages[srv.id]} 
              />
            </motion.div>
          ))}
        </motion.div>

        {/* Dynamic CTA bottom card */}
        <motion.div
          initial={{ opacity: 0, y: 35 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="mt-32 glass-panel rounded-3xl p-8 md:p-16 text-center bg-gradient-to-r from-app-card via-app-card/95 to-app-bg border border-app-border relative overflow-hidden orange-glow shadow-2xl"
        >
          <div className="absolute -top-10 -left-10 w-40 h-40 bg-primary/10 rounded-full filter blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-primary/10 rounded-full filter blur-3xl pointer-events-none" />

          <div className="max-w-2xl mx-auto space-y-8 relative z-10">
            <h3 className="text-3xl md:text-4xl font-black font-heading text-app-text">
              Not Finding a Specific Technical Capability?
            </h3>
            <p className="text-app-text-muted text-sm md:text-base leading-relaxed">
              We specialize in custom web applications, custom API pipelines, scraping scripts, and specialized corporate bookkeeping architectures. Connect with our principal engineers for a custom scope.
            </p>
            <div className="pt-4">
              <Link
                to="/get-quote"
                className="px-10 py-4 bg-primary hover:bg-primary-hover text-black font-black text-sm uppercase tracking-widest rounded-xl hover:shadow-[0_0_30px_rgba(255,107,0,0.5)] transition-all duration-300 inline-block cursor-pointer transform hover:-translate-y-1"
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
