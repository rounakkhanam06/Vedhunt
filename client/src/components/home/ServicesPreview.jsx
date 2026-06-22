import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

// Image Assets
import webDevImg from '../../assets/web_dev.webp';
import appDevImg from '../../assets/app_dev.webp';
import marketingImg from '../../assets/marketing.webp';
import digitalMarketingImg from '../../assets/digital_marketing.webp';
import accountingImg from '../../assets/accounting.webp';
import automationImg from '../../assets/automation.webp';

import { useHomeServices, useHomeServicesSection } from '../../hooks/usePublicContent';
import ServiceCard from '../services/ServiceCard';


const serviceImages = {
  'web-dev': webDevImg,
  'app-dev': appDevImg,
  'social-media': marketingImg,
  'performance-marketing': digitalMarketingImg,
  'accounting-finance': accountingImg,
  'mis-reporting': automationImg,
};

export default function ServicesPreview() {
  const { data: services = [], isLoading: servicesLoading } = useHomeServices();
  const { data: headerDataRaw, isLoading: headerLoading } = useHomeServicesSection();
  const isLoading = servicesLoading || headerLoading;

  const headerData = headerDataRaw || {
    tagline: 'Our Expertise',
    heading: 'Services That Fit',
    highlightText: 'Your Business',
    description: 'From digital transformation to financial clarity, we provide end-to-end technical solutions designed to scale your operations and maximize ROI.'
  };

  const staggerContainer = {
    hidden: {},
    visible: {
      transition: { staggerChildren: 0.1 }
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
    <section className="pt-8 sm:pt-12 pb-2 sm:pb-6 px-4 sm:px-6 lg:px-8 bg-app-bg relative overflow-hidden">
      {/* Background Subtle Ambient Glows */}
      <div className="absolute top-1/2 right-0 w-96 h-96 bg-primary/5 rounded-full filter blur-[130px] pointer-events-none" />
      <div className="absolute top-1/4 left-0 w-96 h-96 bg-primary/2 dark:bg-white/1 rounded-full filter blur-[130px] pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* Header Block */}
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          variants={staggerContainer}
          className="text-center space-y-4 mb-12 sm:mb-16 md:mb-20 max-w-3xl mx-auto"
        >
          <motion.div variants={scrollFadeUp} className="flex items-center justify-center gap-3">
            <span className="w-8 h-[2px] bg-primary" />
            <span className="text-xs font-black text-primary uppercase tracking-[0.3em]">
              {headerData.tagline}
            </span>
            <span className="w-8 h-[2px] bg-primary" />
          </motion.div>
          
          <motion.h2 variants={scrollFadeUp} className="text-3xl sm:text-5xl md:text-6xl font-black font-heading text-app-text leading-tight">
            {headerData.heading} <span className="text-primary text-gradient-orange">{headerData.highlightText}</span>
          </motion.h2>

          <motion.p variants={scrollFadeUp} className="text-app-text-muted text-xs sm:text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
            {headerData.description}
          </motion.p>
        </motion.div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {!isLoading && services.map((srv, idx) => (
            <motion.div 
              key={srv.id_string || srv._id} 
              variants={scrollFadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.05 }}
              transition={{ delay: idx * 0.08 }}
            >
              <ServiceCard 
                service={srv} 
                image={srv.imageUrl || serviceImages[srv.id_string] || webDevImg}
              />
            </motion.div>
          ))}
          {isLoading && [...Array(6)].map((_, idx) => (
             <div key={idx} className="h-72 bg-white/5 rounded-2xl animate-pulse"></div>
          ))}
        </div>

        {/* View All Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="mt-8 sm:mt-12 text-center"
        >
          <Link
            to="/services"
            className="inline-flex items-center gap-2 px-5 py-2.5 sm:px-8 sm:py-4 bg-white/5 hover:bg-white/10 text-app-text font-black text-xs sm:text-sm uppercase tracking-widest rounded-xl border border-white/10 transition-all duration-300 group"
          >
            <span>Explore All Services</span>
            <span className="w-5 h-5 rounded-full bg-primary flex items-center justify-center group-hover:scale-110 transition-transform">
              <span className="w-1.5 h-1.5 bg-black rounded-full" />
            </span>
          </Link>
        </motion.div>

      </div>
    </section>
  );
}
