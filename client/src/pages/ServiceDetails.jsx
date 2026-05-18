import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, CheckCircle2, Globe, Clock, Zap, Shield, Cpu } from 'lucide-react';
import { SERVICES } from '../constants';
import PricingCard from '../components/services/PricingCard';
import FeatureList from '../components/services/FeatureList';
import ComparisonTable from '../components/services/ComparisonTable';

export default function ServiceDetails() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [service, setService] = useState(null);

  useEffect(() => {
    const foundService = SERVICES.find(s => s.slug === slug);
    if (foundService) {
      setService(foundService);
      window.scrollTo(0, 0);
    } else {
      navigate('/services');
    }
  }, [slug, navigate]);

  if (!service) return null;



  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.3
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] }
    }
  };

  return (
    <div className="bg-app-bg text-white min-h-screen relative overflow-hidden">
      {/* Background Ambient Glows */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/10 rounded-full filter blur-[150px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-primary/5 rounded-full filter blur-[150px] translate-y-1/2 -translate-x-1/2 pointer-events-none" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 relative z-10">
        {/* Navigation / Back Button */}
        <motion.div 
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-10"
        >
          <Link 
            to="/services" 
            className="inline-flex items-center gap-2 text-white/40 hover:text-primary transition-colors font-bold text-[10px] tracking-widest group"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
            <span>All Services</span>
          </Link>
        </motion.div>

        {/* Hero Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-24">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-6"
          >
            <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-primary text-[9px] font-bold tracking-widest">{service.subtitle}</span>
            </motion.div>

            <motion.h1 variants={itemVariants} className="text-4xl md:text-6xl font-bold font-heading leading-[1.1] tracking-tighter">
              {service.title.split(' & ').map((part, i) => (
                <span key={i} className="block">
                  {i === 1 && <span className="text-primary">& </span>}
                  {part}
                </span>
              ))}
            </motion.h1>

            <motion.p variants={itemVariants} className="text-base text-white/50 leading-relaxed max-w-lg font-medium">
              {service.description}
            </motion.p>

            <motion.div variants={itemVariants} className="flex flex-wrap gap-3 pt-2">
              <Link
                to="/get-quote"
                className="px-6 py-3 bg-primary hover:brightness-110 text-black font-bold text-xs rounded-lg transition-all duration-300 shadow-xl"
              >
                Create Project
              </Link>
              <button className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white font-bold text-xs rounded-lg border border-white/5 transition-all duration-300">
                View Process
              </button>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="relative hidden lg:block"
          >
            <div className="relative aspect-video rounded-2xl overflow-hidden bg-app-card border border-white/5 group">
              <div className="absolute inset-0 flex items-center justify-center p-12">
                {typeof service.icon === 'string' ? (
                  <img 
                    src={service.icon} 
                    alt={service.title} 
                    className="w-40 h-40 object-contain opacity-60 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700 drop-shadow-[0_0_30px_rgba(255,107,0,0.3)]" 
                  />
                ) : (
                  <service.icon className="w-32 h-32 text-white/20 group-hover:text-primary/40 group-hover:scale-110 transition-all duration-700" />
                )}
              </div>

              <div className="absolute inset-0 bg-gradient-to-t from-app-bg/80 to-transparent" />
              
              {/* Subtle tech patterns */}
              <div className="absolute top-4 right-4 flex gap-1">
                {[1,2,3].map(i => <div key={i} className="w-1 h-1 rounded-full bg-primary/30" />)}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Dynamic Pricing Section */}
        {service.pricingCards && (
          <section className="mb-24">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12 space-y-2"
            >
              <h2 className="text-2xl md:text-4xl font-bold font-heading tracking-tight">Service Packages</h2>
              <p className="text-white/30 text-[10px] max-w-lg mx-auto tracking-[0.2em] font-bold">Choose the perfect scale for your digital presence</p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {service.pricingCards.map((plan, i) => (
                <PricingCard key={i} plan={plan} />
              ))}
            </div>
          </section>
        )}

        {/* Features & Technologies Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 mb-24">
          {/* Features */}
          <section>
            <div className="mb-8">
              <h2 className="text-2xl font-bold font-heading tracking-tight mb-2">Core Features</h2>
              <div className="h-0.5 w-12 bg-primary rounded-full" />
            </div>
            <FeatureList features={service.features} />
          </section>

          {/* Technologies */}
          {service.technologies && (
            <section>
              <div className="mb-8">
                <h2 className="text-2xl font-bold font-heading tracking-tight mb-2">Tech Stack</h2>
                <div className="h-0.5 w-12 bg-primary rounded-full" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                {service.technologies.map((tech, i) => (
                  <motion.div
                    key={i}
                    whileHover={{ y: -5 }}
                    className="p-4 rounded-xl bg-app-card border border-white/5 flex flex-col items-center gap-3 group transition-all duration-300 hover:border-primary/20 shadow-md"
                  >
                    <img src={tech.icon} alt={tech.name} className="w-8 h-8 grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-500" />
                    <span className="text-[9px] font-bold text-white/30 group-hover:text-white transition-colors tracking-widest">{tech.name}</span>
                  </motion.div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Comparison Section */}
        <ComparisonTable />

        {/* Timeline Section */}
        {service.timeline && (
          <section className="mb-24">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <h2 className="text-2xl md:text-4xl font-bold font-heading mb-2 tracking-tight">The Development Journey</h2>
              <p className="text-white/30 text-[10px] tracking-[0.2em] font-bold">How we bring your vision to life</p>
            </motion.div>

            <div className="relative">
              <div className="absolute top-1/2 left-0 w-full h-px bg-white/5 -translate-y-1/2 hidden lg:block" />
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                {service.timeline.map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05 }}
                    className="relative group bg-app-card p-5 rounded-2xl border border-white/5 hover:border-primary/20 transition-all duration-500 shadow-md"
                  >
                    <div className="mb-4 w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center relative z-20 group-hover:border-primary transition-colors duration-500 shadow-lg">
                      <span className="text-lg font-bold text-primary group-hover:text-primary transition-colors">{item.step}</span>
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold font-heading tracking-tight">{item.title}</h4>
                      <p className="text-[11px] text-white/40 leading-relaxed group-hover:text-white/60 transition-colors font-medium">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Final CTA */}
        <motion.section
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="relative rounded-2xl overflow-hidden p-10 md:p-16 text-center border border-white/5"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-app-card to-app-bg z-0" />
          
          <div className="relative z-10 space-y-6">
            <h2 className="text-3xl md:text-5xl font-bold font-heading leading-tight tracking-tighter">
              Ready to Build Your <br /> <span className="text-primary">Next Big Idea?</span>
            </h2>
            <p className="text-white/40 text-sm max-w-xl mx-auto leading-relaxed font-medium">
              Join dozens of successful businesses that have scaled their operations with our premium engineering solutions.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link
                to="/get-quote"
                className="px-10 py-4 bg-primary hover:brightness-110 text-black font-bold text-sm rounded-lg transition-all duration-300 shadow-xl"
              >
                Get Free Quote
              </Link>
              <a 
                href="mailto:info@vedhunt.in" 
                className="flex items-center gap-2 text-white/40 hover:text-white transition-colors font-bold tracking-widest text-[10px]"
              >
                <span>Email our engineers</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </motion.section>

      </div>

    </div>
  );
}
