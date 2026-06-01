import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { contentService } from '../services/contentService';
import ServiceCard from '../components/services/ServiceCard';

// Image Assets
import webDevImg from '../assets/web_dev.webp';
import appDevImg from '../assets/app_dev.webp';
import marketingImg from '../assets/marketing.webp';
import digitalMarketingImg from '../assets/digital_marketing.webp';
import accountingImg from '../assets/accounting.webp';
import automationImg from '../assets/automation.webp';
import servicesHeroImg from '../assets/services/services-new-hero.png';

const serviceImages = {
  'web-dev': webDevImg,
  'app-dev': appDevImg,
  'social-media': marketingImg,
  'performance-marketing': digitalMarketingImg,
  'accounting-finance': accountingImg,
  'mis-reporting': automationImg,
};

const SkeletonCard = () => (
  <div className="bg-app-card rounded-2xl border border-app-border flex flex-col h-full overflow-hidden animate-pulse">
    {/* Top Image Area */}
    <div className="h-32 w-full bg-white/5" />
    
    {/* Content Area */}
    <div className="p-5 flex flex-col flex-grow relative">
      {/* Icon Placeholder */}
      <div className="mb-4 w-12 h-12 rounded-xl bg-white/10 -mt-11 relative z-20" />
      
      {/* Title Placeholder */}
      <div className="h-5 w-2/3 bg-white/10 rounded-md mb-4" />
      
      {/* Description Placeholder */}
      <div className="space-y-2 mb-4 flex-grow">
        <div className="h-3 w-full bg-white/5 rounded-md" />
        <div className="h-3 w-5/6 bg-white/5 rounded-md" />
      </div>

      {/* Subservices Placeholder */}
      <div className="h-8 w-full bg-white/5 rounded-lg mb-5" />

      {/* CTA Placeholder */}
      <div className="h-3 w-24 bg-white/10 rounded-md" />
    </div>
  </div>
);

export default function Services() {
  const [services, setServices] = useState([]);
  const [heroData, setHeroData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [servicesRes, heroRes] = await Promise.all([
          contentService.getServicesPublic('services'),
          contentService.getServicesHero()
        ]);
        setServices(servicesRes.data || []);
        if (heroRes.data) {
          setHeroData(heroRes.data);
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);
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
    <div className="bg-app-bg text-app-text-muted min-h-screen py-16 sm:py-24 px-4 sm:px-6 lg:px-8 mesh-grid relative overflow-hidden">
      {/* Background Ambient Glows */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-primary/5 rounded-full filter blur-[150px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/2 dark:bg-white/2 rounded-full filter blur-[150px] pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* Banner Section */}
        <div className="flex flex-col-reverse md:flex-row items-center justify-between max-w-6xl mx-auto mb-16 sm:mb-24 gap-10 md:gap-16 relative">
          
          {/* Text Content */}
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
            variants={staggerContainer}
            className="flex-1 text-center md:text-left z-10"
          >
            <div className="mb-4 sm:mb-6">
              <motion.span variants={scrollFadeUp} className="inline-block text-primary text-[10px] sm:text-xs font-semibold uppercase tracking-[0.2em] bg-primary/10 border border-primary/20 px-4 py-1.5 rounded-full">
                {heroData?.badgeText || 'Our Capabilities'}
              </motion.span>
            </div>
            <motion.h1 variants={scrollFadeUp} className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-medium font-heading text-app-text mb-6 leading-tight">
              {heroData?.headingTop || 'High Performance Solutions at'} <span className="text-primary text-gradient-orange font-semibold">{heroData?.headingHighlight || 'Economical Prices'}</span>
            </motion.h1>
            <motion.p variants={scrollFadeUp} className="text-app-text-muted text-xs sm:text-sm md:text-base leading-relaxed max-w-xl mx-auto md:mx-0 whitespace-pre-line">
              {heroData?.description || 'We take pride in our hands-on tech expertise, proactive customer communication, and premium engineering. Explore how we scale business operations through custom solutions.'}
            </motion.p>
          </motion.div>

          {/* Hero Image Area */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            whileInView={{ opacity: 1, scale: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="flex-1 w-full max-w-sm md:max-w-lg lg:max-w-xl relative flex justify-center md:justify-end"
          >
            {/* Background Circle Shades */}
            <div className="absolute top-[45%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 md:w-80 md:h-80 bg-gradient-to-tr from-primary/30 to-primary/5 rounded-full blur-xl pointer-events-none" />
            <div className="absolute top-[45%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56 md:w-72 md:h-72 border border-primary/20 rounded-full pointer-events-none" />
            <div className="absolute top-[45%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[140%] bg-primary/10 blur-[100px] rounded-full pointer-events-none" />
            
            {/* Main Image */}
            <img 
              src={servicesHeroImg} 
              alt="Vedhunt Services" 
              className="relative z-10 w-full h-auto object-contain drop-shadow-2xl animate-float-slow"
            />
            
            {/* Bottom Outline / Ground Glow for UI/UX */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-3/4 h-6 bg-primary/30 blur-2xl rounded-[50%] pointer-events-none z-0" />
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-2/3 h-[2px] bg-gradient-to-r from-transparent via-primary/80 to-transparent opacity-70 pointer-events-none z-20" />
            
          </motion.div>
          
        </div>

        {/* Services Grid */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 lg:gap-10"
        >
          {!isLoading ? (
            services.map((srv, idx) => (
              <motion.div 
                key={srv.id_string || srv._id} 
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.1 }}
                transition={{ delay: idx * 0.1 }}
                variants={scrollFadeUp}
              >
                <ServiceCard 
                  service={srv} 
                  image={srv.imageUrl || serviceImages[srv.id_string] || webDevImg} 
                />
              </motion.div>
            ))
          ) : (
            [...Array(6)].map((_, idx) => (
              <div key={idx}>
                <SkeletonCard />
              </div>
            ))
          )}
        </motion.div>

        {/* Dynamic CTA bottom card */}
        <motion.div
          initial={{ opacity: 0, y: 35 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="mt-16 sm:mt-24 md:mt-28 glass-panel rounded-3xl py-8 sm:py-10 md:py-12 px-6 sm:px-10 text-center bg-app-card border border-app-border relative overflow-hidden orange-glow shadow-2xl"
        >
          <div className="absolute -top-10 -left-10 w-40 h-40 bg-primary/10 rounded-full filter blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-primary/10 rounded-full filter blur-3xl pointer-events-none" />

          <div className="max-w-2xl mx-auto space-y-4 sm:space-y-5 relative z-10">
            <h3 className="text-xl sm:text-2xl md:text-3xl font-bold font-heading text-app-text">
              Not Finding a Specific Technical Capability?
            </h3>
            <p className="text-app-text-muted text-[11px] sm:text-xs md:text-sm leading-relaxed">
              We specialize in custom web applications, custom API pipelines, scraping scripts, and specialized corporate bookkeeping architectures. Connect with our principal engineers for a custom scope.
            </p>
            <div className="pt-2">
              <Link
                to="/get-quote"
                className="px-6 py-2.5 bg-primary hover:bg-primary-hover text-black font-bold text-xs uppercase tracking-wider rounded-xl hover:shadow-[0_0_30px_rgba(255,107,0,0.5)] transition-all duration-300 inline-block cursor-pointer transform hover:-translate-y-1"
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
