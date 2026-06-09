import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  ChevronDown, 
  Calendar, 
  Activity, 
  Layers, 
  CheckCircle,
  HelpCircle,
  Star,
  Quote,
  DollarSign,
  Zap,
  TrendingUp,
  Headphones
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { SERVICES } from '../constants';
import { SERVICE_DETAILS_DATA } from '../constants/serviceDetailsData';
import api from '../services/api';
import { getCountryFlag } from '../utils/getCountryFlag';

const TestimonialCarousel = ({ items }) => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!items || items.length === 0) return;
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % items.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [items]);

  const next = () => setIndex((i) => (i + 1) % items.length);
  const prev = () => setIndex((i) => (i - 1 + items.length) % items.length);

  const t = items[index];
  if (!t) return null;

  return (
    <div className="relative w-full overflow-hidden py-4">
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, x: 50, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -50, scale: 0.95 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="bg-brand-lightOrange dark:bg-primary/5 border border-app-border rounded-3xl p-6 sm:p-10 relative flex flex-col md:flex-row items-center gap-6 sm:gap-8 shadow-sm hover:shadow-xl hover:shadow-primary/5 hover:border-primary/30 transition-all duration-300"
        >
          <div className="absolute top-4 right-6 pointer-events-none">
            <Quote className="w-16 h-16 text-primary opacity-20" />
          </div>

          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border border-app-border flex-shrink-0 bg-app-bg shadow-sm relative">
            <img 
              src={t.avatar} 
              alt={t.author} 
              className="w-full h-full object-cover"
            />
          </div>

          <div className="space-y-4 text-center md:text-left flex-grow relative z-10">
            <div className="flex justify-center md:justify-start gap-1">
              {[1,2,3,4,5].map((star) => (
                <Star key={star} className="w-3.5 h-3.5 fill-primary text-primary drop-shadow-[0_0_4px_rgba(232,71,10,0.3)]" />
              ))}
            </div>

            <p className="text-xs sm:text-sm text-app-text font-medium leading-relaxed italic line-clamp-4 min-h-[4rem]">
              "{t.feedback || t.quote}"
            </p>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
              <div className="space-y-0.5">
                <h4 className="text-xs sm:text-sm font-bold text-app-text uppercase tracking-wide">
                  {t.author}
                </h4>
                <p className="text-[10px] text-app-text-muted font-bold uppercase tracking-widest flex items-center gap-1 justify-center md:justify-start">
                  {t.role}
                  {t.country && (
                    <span className="ml-1 inline-flex items-center gap-1 text-app-text-muted/80">
                      • {getCountryFlag(t.country)} {t.country}
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="mt-8 flex items-center justify-center gap-6">
        <button 
          onClick={prev} 
          className="w-10 h-10 rounded-full bg-app-card border border-app-border flex items-center justify-center text-app-text hover:bg-primary hover:text-black hover:border-primary transition-all shadow-md"
        >
          <LucideIcons.ChevronLeft className="w-5 h-5 -ml-0.5" />
        </button>
        <div className="flex gap-2 flex-wrap justify-center">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={`w-2 h-2 rounded-full transition-all duration-500 ${
                i === index ? 'w-8 bg-primary opacity-80' : 'bg-app-text-muted/30 hover:bg-app-text-muted/50'
              }`}
            />
          ))}
        </div>
        <button 
          onClick={next} 
          className="w-10 h-10 rounded-full bg-app-card border border-app-border flex items-center justify-center text-app-text hover:bg-primary hover:text-black hover:border-primary transition-all shadow-md"
        >
          <LucideIcons.ChevronRight className="w-5 h-5 -mr-0.5" />
        </button>
      </div>
    </div>
  );
};

const PhoneCarousel3D = ({ items }) => {
  const [activeIndex, setActiveIndex] = useState(1);

  const next = () => setActiveIndex((prev) => (prev + 1) % items.length);
  const prev = () => setActiveIndex((prev) => (prev - 1 + items.length) % items.length);

  const handleDragEnd = (e, info) => {
    if (info.offset.x > 50) {
      prev();
    } else if (info.offset.x < -50) {
      next();
    }
  };

  const activeItem = items[activeIndex];

  return (
    <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center mt-8 mb-4 overflow-hidden">
      
      {/* Left side: Info */}
      <div className="lg:col-span-5 space-y-6 text-center lg:text-left z-20 px-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeIndex}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.4 }}
            className="space-y-5"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
               <span className="text-primary text-[10px] font-bold uppercase tracking-widest">{activeItem.metric}</span>
            </div>
            
            <h3 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-app-text leading-tight font-heading">
              {activeItem.title}
            </h3>
            
            <p className="text-sm sm:text-base text-app-text-muted leading-relaxed font-medium">
              {activeItem.description}
            </p>
            
            <div className="pt-4 flex flex-wrap gap-4 justify-center lg:justify-start">
              <Link
                to="/get-quote"
                className="inline-flex items-center gap-2 px-6 py-3.5 bg-primary hover:bg-primary-hover text-black font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5"
              >
                <span>Request Similar App</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              {activeItem.appLink && (
                <a
                  href={activeItem.appLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3.5 bg-app-card hover:bg-[#222] border border-app-border hover:border-primary/50 text-app-text font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5"
                >
                  <span>Visit App</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Right side: Carousel */}
      <div className="lg:col-span-7 relative w-full h-[680px] flex items-center justify-center touch-pan-y">
        {items.map((port, idx) => {
          const offset = (idx - activeIndex + items.length) % items.length;
          // 0 is center, 1 is right, 2 is left (if 3 items)
          let position = offset === 0 ? 'center' : offset === 1 ? 'right' : 'left';
          
          let zIndex = position === 'center' ? 30 : 10;
          let scale = position === 'center' ? 1 : 0.85;
          let translateX = position === 'center' ? 0 : position === 'right' ? 180 : -180;
          let opacity = 1;

          return (
            <motion.div
              key={idx}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={handleDragEnd}
              animate={{
                zIndex,
                scale,
                x: translateX,
                opacity
              }}
              transition={{ type: "spring", stiffness: 200, damping: 25 }}
              className="absolute top-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing outline-none"
              onClick={() => {
                 if (position !== 'center') setActiveIndex(idx);
              }}
            >
              <div className={`relative w-[280px] h-[560px] rounded-[3rem] border-[10px] shadow-2xl overflow-hidden transition-all duration-300 pointer-events-none ${position === 'center' ? 'border-[#222] bg-black ring-4 ring-primary/40' : 'border-[#444] bg-[#222] opacity-60'}`}>
                {/* Phone Notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-6 bg-[#222] rounded-b-2xl z-20"></div>
                
                {port.iframeUrl ? (
                  <div className="w-full h-full relative z-10 pointer-events-auto">
                    <iframe 
                      src={port.iframeUrl} 
                      className="w-full h-full border-none bg-white overflow-hidden" 
                      title={port.title}
                      sandbox="allow-scripts allow-same-origin"
                      style={{ pointerEvents: 'none' }}
                      scrolling="no"
                    />
                  </div>
                ) : (
                  <img 
                    src={port.image} 
                    alt={port.title} 
                    className="w-full h-full object-cover relative z-10 pointer-events-none" 
                  />
                )}
              </div>
            </motion.div>
          );
        })}
        
        {/* Navigation Controls */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex items-center gap-4 z-50 pointer-events-none">
          <button onClick={prev} className="pointer-events-auto w-10 h-10 rounded-full bg-app-card/80 backdrop-blur-sm border border-app-border flex items-center justify-center text-app-text hover:text-primary hover:border-primary/50 transition-all shadow-lg hover:scale-110 active:scale-95 cursor-pointer">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button onClick={next} className="pointer-events-auto w-10 h-10 rounded-full bg-app-card/80 backdrop-blur-sm border border-app-border flex items-center justify-center text-app-text hover:text-primary hover:border-primary/50 transition-all shadow-lg hover:scale-110 active:scale-95 cursor-pointer">
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default function ServiceDetails() {
  const { slug } = useParams();
  const navigate = useNavigate();
  
  // Core state variables
  const [serviceMain, setServiceMain] = useState(null);
  const [serviceDetails, setServiceDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState('primary'); // 'primary' (One-Time / Starter) or 'secondary' (Support / Quarterly)
  const [activeFaq, setActiveFaq] = useState(null);
  const [showStickyCta, setShowStickyCta] = useState(false);

  // Sync route slug & content details
  useEffect(() => {
    let isMounted = true;
    
    const fetchServiceDetails = async () => {
      setLoading(true);
      const foundMain = SERVICES.find(s => s.slug === slug);
      
      if (!foundMain) {
        navigate('/services');
        return;
      }

      try {
        const response = await api.get(`/service-pages/${slug}`);
        if (isMounted) {
          setServiceMain(foundMain);
          setServiceDetails(response.data);
          window.scrollTo({ top: 0, behavior: 'instant' });
          setLoading(false);
        }
      } catch (error) {
        console.error('Failed to fetch service details from API, using fallback:', error);
        if (isMounted) {
          const foundDetails = SERVICE_DETAILS_DATA[slug];
          if (foundDetails) {
            setServiceMain(foundMain);
            setServiceDetails(foundDetails);
            window.scrollTo({ top: 0, behavior: 'instant' });
          } else {
            navigate('/services');
          }
          setLoading(false);
        }
      }
    };

    fetchServiceDetails();

    return () => {
      isMounted = false;
    };
  }, [slug, navigate]);

  // Handle sticky CTA visibility on scroll
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 550) {
        setShowStickyCta(true);
      } else {
        setShowStickyCta(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (!serviceMain || !serviceDetails) return null;

  const {
    title,
    subtitle,
    tagline,
    overview,
    highlights,
    subServices,
    process,
    pricing,
    portfolio,
    faqs,
    testimonial,
    testimonials
  } = serviceDetails;

  const validTestimonials = testimonials && testimonials.length > 0 
    ? testimonials 
    : (testimonial && testimonial.author ? [testimonial] : []);

  // Animation constants - Professional & sleek durations
  const fadeUp = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } }
  };

  const stagger = {
    visible: { transition: { staggerChildren: 0.08 } }
  };

  const scrollReveal = {
    hidden: { opacity: 0, y: 35 },
    visible: { 
      opacity: 1, 
      y: 0, 
      transition: { 
        duration: 0.8, 
        ease: [0.16, 1, 0.3, 1] 
      } 
    }
  };

  const staggerContainer = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.12,
        delayChildren: 0.05
      }
    }
  };

  const cardReveal = {
    hidden: { opacity: 0, y: 25 },
    visible: { 
      opacity: 1, 
      y: 0, 
      transition: { 
        duration: 0.6, 
        ease: [0.16, 1, 0.3, 1] 
      } 
    }
  };

  return (
    <div className="bg-app-bg text-app-text min-h-screen relative overflow-hidden font-sans selection:bg-primary/20 selection:text-primary">
      
      {/* Background Ambient Glows */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 dark:bg-primary/5 rounded-full filter blur-[120px] -translate-y-1/3 translate-x-1/3 pointer-events-none z-0" />
      <div className="absolute top-[40%] left-[-15%] w-[450px] h-[450px] bg-primary/4 dark:bg-primary/2 rounded-full filter blur-[100px] pointer-events-none z-0" />
      
      <AnimatePresence mode="wait">
        {loading ? (
          /* Premium Loading Skeleton */
          <motion.div 
            key="skeleton"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.25 } }}
            className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 relative z-10 space-y-12"
          >
            {/* Nav Skeleton */}
            <div className="h-4 w-32 bg-app-card rounded-md animate-pulse border border-app-border/40" />
            
            {/* Hero Skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              <div className="lg:col-span-7 space-y-4">
                <div className="h-6 w-24 bg-primary/10 border border-primary/20 rounded-full animate-pulse" />
                <div className="h-10 w-3/4 bg-app-card rounded-lg animate-pulse border border-app-border/40" />
                <div className="h-4 w-5/6 bg-app-card rounded-md animate-pulse border border-app-border/40" />
                <div className="h-4 w-2/3 bg-app-card rounded-md animate-pulse border border-app-border/40" />
                <div className="h-10 w-36 bg-app-card rounded-lg animate-pulse border border-app-border/40 pt-4" />
              </div>
              <div className="lg:col-span-5 h-64 bg-app-card rounded-2xl animate-pulse border border-app-border/40 hidden lg:block" />
            </div>
            
            {/* Highlights Strip Skeleton */}
            <div className="h-16 w-full bg-app-card rounded-xl animate-pulse border border-app-border/40" />
            
            {/* Overview Skeleton */}
            <div className="space-y-3 max-w-3xl mx-auto text-center">
              <div className="h-4 w-full bg-app-card rounded-md animate-pulse border border-app-border/40" />
              <div className="h-4 w-5/6 bg-app-card rounded-md animate-pulse border border-app-border/40 mx-auto" />
            </div>
          </motion.div>
        ) : (
          /* Actual High-Converting Premium Page Details */
          <motion.div
            key="content"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10"
          >
            {/* 1. Above the fold - Hero Container */}
            <div className="relative border-b border-app-border/40 bg-gradient-to-b from-brand-lightOrange/20 to-transparent dark:from-primary/2 dark:to-transparent">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-10 sm:pt-24 sm:pb-16">
                
                {/* Breadcrumbs Navigation */}
                <div className="mb-6 sm:mb-12">
                  <nav className="flex items-center gap-2 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-app-text-muted/60">
                    <Link to="/" className="hover:text-primary transition-colors">Home</Link>
                    <span>/</span>
                    <Link to="/services" className="hover:text-primary transition-colors">Services</Link>
                    <span>/</span>
                    <span className="text-app-text font-bold">{title}</span>
                  </nav>
                </div>

                {/* Hero Core Content */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
                  
                  {/* Hero Left Content */}
                  <motion.div 
                    initial="hidden"
                    animate="visible"
                    variants={stagger}
                    className="lg:col-span-7 space-y-5 sm:space-y-6"
                  >
                    <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                      <span className="text-primary text-[9px] font-bold uppercase tracking-widest">{subtitle}</span>
                    </motion.div>

                    <motion.h1 
                      variants={fadeUp} 
                      className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold font-heading text-app-text leading-tight tracking-tight"
                    >
                      {title}
                    </motion.h1>

                    <motion.p 
                      variants={fadeUp} 
                      className="text-xs sm:text-sm md:text-base text-app-text-muted leading-relaxed font-medium max-w-xl"
                    >
                      {tagline}
                    </motion.p>

                    <motion.div variants={fadeUp} className="pt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
                      <Link
                        to="/get-quote"
                        className="w-full sm:w-auto text-center px-6 py-3.5 sm:py-2.5 bg-primary hover:bg-primary-hover text-black font-bold text-[11px] sm:text-xs uppercase tracking-wider rounded-xl hover:shadow-[0_0_25px_rgba(232,71,10,0.4)] transition-all duration-300 transform hover:-translate-y-0.5 cursor-pointer"
                      >
                        Get Free Quote
                      </Link>
                      
                      <a
                        href="#overview"
                        className="w-full sm:w-auto text-center px-5 py-3.5 sm:py-2.5 bg-app-card hover:bg-app-card/80 border border-app-border text-app-text font-bold text-[11px] sm:text-xs uppercase tracking-wider rounded-xl transition-all duration-300 transform hover:-translate-y-0.5"
                      >
                        Explore Service
                      </a>
                    </motion.div>
                  </motion.div>

                  {/* Hero Right Graphic - Responsive Premium Layout */}
                  <div className="lg:col-span-5 hidden lg:block relative">
                    <div className="relative w-full aspect-[4/3] flex items-center justify-center group">
                      
                      {/* Abstract Premium Visuals */}
                      <div className="absolute inset-0 flex items-center justify-center p-8 z-10">
                        <div className="relative w-48 h-48 rounded-full border border-primary/20 flex items-center justify-center bg-gradient-to-br from-primary/5 to-transparent shadow-inner group-hover:scale-105 transition-transform duration-700">
                          
                          {/* Inner glowing circle */}
                          <div className="absolute w-36 h-36 rounded-full border border-primary/10 bg-app-bg flex items-center justify-center shadow-lg">
                            {serviceMain.icon && (
                              <serviceMain.icon className="w-16 h-16 text-primary drop-shadow-[0_0_15px_rgba(232,71,10,0.35)] animate-float" />
                            )}
                          </div>

                          {/* Outer orbit lines & nodes */}
                          <div className="absolute w-48 h-48 rounded-full border-t border-primary/30 animate-spin" style={{ animationDuration: '10s' }} />
                          <div className="absolute w-2.5 h-2.5 rounded-full bg-primary top-0 left-1/2 -translate-x-1/2 shadow-[0_0_10px_#E8470A]" />
                          <div className="absolute w-2 h-2 rounded-full bg-primary/50 bottom-4 right-8" />
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>

            {/* 2. Quick Highlights Strip */}
            <div className="bg-brand-lightOrange dark:bg-primary/5 border-y border-app-border py-6 sm:py-4 relative z-20">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-4 items-start sm:items-center justify-between text-center md:text-left">
                  {highlights.map((hl, idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row items-center gap-3 sm:gap-3 justify-center md:justify-start group p-3 sm:p-4 rounded-2xl hover:-translate-y-1 hover:bg-white/60 dark:hover:bg-[#1A1A2E]/80 hover:shadow-sm border border-transparent hover:border-primary/20 transition-all duration-300 cursor-default">
                      <div className="w-12 h-12 sm:w-10 sm:h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 text-primary group-hover:bg-primary group-hover:text-white group-hover:scale-110 transition-all duration-300 shadow-sm">
                        {idx === 0 && <DollarSign className="w-5 h-5" />}
                        {idx === 1 && <Zap className="w-5 h-5" />}
                        {idx === 2 && <TrendingUp className="w-5 h-5" />}
                        {idx === 3 && <Headphones className="w-5 h-5" />}
                      </div>
                      <div className="space-y-1 sm:space-y-0.5 text-center sm:text-left px-2 sm:px-0">
                        <h4 className="text-[11px] sm:text-xs font-bold text-app-text tracking-wide uppercase leading-snug group-hover:text-primary transition-colors duration-300">{hl.text}</h4>
                        <p className="text-[10px] sm:text-[10px] text-app-text-muted font-medium leading-relaxed sm:leading-none">{hl.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 3. Service Overview Section */}
            <motion.section 
              id="overview" 
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.25 }}
              variants={scrollReveal}
              className="py-10 sm:py-14 border-b border-app-border/40"
            >
              <div className="max-w-3xl mx-auto px-4 text-center space-y-6">
                <div className="inline-flex items-center gap-1.5 justify-center">
                  <span className="h-0.5 w-6 bg-primary rounded-full" />
                  <h2 className="text-xs font-bold uppercase text-primary tracking-[0.25em]">Service Overview</h2>
                  <span className="h-0.5 w-6 bg-primary rounded-full" />
                </div>
                
                <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-app-text tracking-tight font-heading">
                  Why {title} Matters for Your Business Strategy
                </h3>
                
                <div className="space-y-4 text-xs sm:text-sm text-app-text-muted leading-relaxed font-medium">
                  {overview.map((para, idx) => (
                    <p key={idx}>{para}</p>
                  ))}
                </div>
              </div>
            </motion.section>

            {/* 4. Sub-Services Grid Section */}
            <section className="py-10 sm:py-14 border-b border-app-border/40 bg-app-card/10">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                
                <motion.div 
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, amount: 0.25 }}
                  variants={scrollReveal}
                  className="text-center max-w-2xl mx-auto mb-12 sm:mb-16"
                >
                  <h2 className="text-xs font-bold uppercase text-primary tracking-[0.25em] mb-2">Our Capabilities</h2>
                  <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-app-text tracking-tight font-heading">
                    Comprehensive Sub-Services Matrix
                  </h3>
                  <p className="text-app-text-muted text-[11px] sm:text-xs font-medium mt-2">
                    Explore the specialized technical domains we handle under this service vertical.
                  </p>
                </motion.div>

                <motion.div 
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, amount: 0.15 }}
                  variants={staggerContainer}
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                >
                  {subServices.map((sub, idx) => {
                    // Try to resolve string icon from LucideIcons, or if it's already a component fallback, or default to Globe
                    let IconComp = LucideIcons.Globe;
                    if (typeof sub.icon === 'string' && LucideIcons[sub.icon]) {
                      IconComp = LucideIcons[sub.icon];
                    } else if (typeof sub.icon === 'object' || typeof sub.icon === 'function') {
                      IconComp = sub.icon;
                    }

                    return (
                      <motion.div
                        key={idx}
                        variants={cardReveal}
                        whileHover={{ y: -6, scale: 1.01 }}
                        className="bg-white dark:bg-app-card border border-slate-100 dark:border-app-border rounded-2xl p-5 hover:border-primary/30 transition-all duration-300 shadow-sm dark:shadow-md hover:shadow-lg dark:hover:shadow-lg group flex flex-col h-full cursor-default"
                      >
                        <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-app-bg border border-slate-100 dark:border-app-border flex items-center justify-center text-slate-500 dark:text-app-text-muted group-hover:text-primary group-hover:bg-primary/5 group-hover:border-primary/30 transition-all duration-300 mb-4 shadow-sm">
                          <IconComp className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" />
                        </div>
                        
                        <h4 className="text-sm sm:text-base font-bold text-app-text mb-2 group-hover:text-primary transition-colors">
                          {sub.title}
                        </h4>
                        
                        <p className="text-[11px] sm:text-xs text-slate-600 dark:text-app-text-muted leading-relaxed font-medium flex-grow">
                          {sub.description}
                        </p>
                      </motion.div>
                    );
                  })}
                </motion.div>

              </div>
            </section>

            {/* 5. Process Flow Section */}
            <section className="py-10 sm:py-14 border-b border-app-border/40 relative">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                
                <motion.div 
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, amount: 0.25 }}
                  variants={scrollReveal}
                  className="text-center max-w-2xl mx-auto mb-16"
                >
                  <h2 className="text-xs font-bold uppercase text-primary tracking-[0.25em] mb-2">Our Workflow</h2>
                  <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-app-text tracking-tight font-heading">
                    The Development & Execution Journey
                  </h3>
                  <p className="text-app-text-muted text-[11px] sm:text-xs font-medium mt-2">
                    How we systematically bring your operational objectives from blueprint to reality.
                  </p>
                </motion.div>

                <div className="relative">
                  {/* Connecting Line for Large Screens */}
                  <motion.div 
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    viewport={{ once: true, amount: 0.5 }}
                    transition={{ duration: 1.2, ease: "easeInOut", delay: 0.2 }}
                    className="absolute top-[28px] left-8 right-8 h-0.5 bg-dashed border-t border-dashed border-app-border hidden lg:block z-0 origin-left" 
                  />

                  {/* Connecting Vertical Line for Mobile/Tablet */}
                  <motion.div 
                    initial={{ scaleY: 0 }}
                    whileInView={{ scaleY: 1 }}
                    viewport={{ once: true, amount: 0.5 }}
                    transition={{ duration: 1.2, ease: "easeInOut", delay: 0.2 }}
                    className="absolute top-[28px] bottom-[28px] left-[27px] w-0.5 border-l border-dashed border-app-border block lg:hidden z-0 origin-top" 
                  />

                  <motion.div 
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.15 }}
                    variants={staggerContainer}
                    className="flex flex-col lg:grid lg:grid-cols-5 gap-6 lg:gap-8 relative z-10"
                  >
                    {process.map((step, idx) => (
                      <motion.div 
                        key={idx} 
                        variants={{
                          hidden: { opacity: 0, y: 30, scale: 0.9 },
                          visible: { 
                            opacity: 1, 
                            y: 0, 
                            scale: 1, 
                            transition: { type: "spring", stiffness: 100, damping: 15 } 
                          }
                        }}
                        className="flex flex-row lg:flex-col items-start text-left gap-6 lg:gap-0 lg:space-y-4 group relative"
                      >
                        
                        {/* Step Number Circle */}
                        <div className="w-14 h-14 shrink-0 rounded-full bg-app-bg border border-app-border flex items-center justify-center text-primary font-bold text-sm shadow-sm group-hover:border-primary group-hover:shadow-md transition-all duration-300 relative z-10">
                          <span className="relative z-10">{step.step}</span>
                          <div className="absolute inset-0.5 rounded-full bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        </div>

                        {/* Title & Description */}
                        <div className="space-y-1.5 pt-2 lg:pt-0">
                          <h4 className="text-[13px] sm:text-sm font-bold text-app-text uppercase tracking-wide group-hover:text-primary transition-colors">
                            {step.title}
                          </h4>
                          <p className="text-[11px] sm:text-[12px] text-app-text-muted leading-relaxed font-medium">
                            {step.desc}
                          </p>
                        </div>

                      </motion.div>
                    ))}
                  </motion.div>
                </div>

              </div>
            </section>

            {/* 6. Pricing Packages Section */}
            <section className="py-10 sm:py-14 border-b border-app-border/40 bg-app-card/5">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                
                <motion.div 
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, amount: 0.25 }}
                  variants={scrollReveal}
                  className="text-center max-w-2xl mx-auto mb-10"
                >
                  <h2 className="text-xs font-bold uppercase text-primary tracking-[0.25em] mb-2">Pricing Models</h2>
                  <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-app-text tracking-tight font-heading">
                    Transparent, Value-Optimized Packages
                  </h3>
                  <p className="text-app-text-muted text-[11px] sm:text-xs font-medium mt-2">
                    Choose the perfect scale for your project. No lock-ins or hidden technical commissions.
                  </p>
                  
                  {/* Dynamic Cycle Toggle */}
                  <div className="mt-8 inline-flex items-center p-1 rounded-xl bg-app-card border border-app-border">
                    <button
                      onClick={() => setBillingCycle('primary')}
                      className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-300 ${
                        billingCycle === 'primary' 
                          ? 'bg-primary text-black shadow-sm' 
                          : 'text-app-text-muted hover:text-app-text'
                      }`}
                    >
                      {pricing.toggleLabels.primary}
                    </button>
                    <button
                      onClick={() => setBillingCycle('secondary')}
                      className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-300 ${
                        billingCycle === 'secondary' 
                          ? 'bg-primary text-black shadow-sm' 
                          : 'text-app-text-muted hover:text-app-text'
                      }`}
                    >
                      {pricing.toggleLabels.secondary}
                    </button>
                  </div>
                </motion.div>

                {/* 3-Column Plan Grid */}
                <motion.div 
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, amount: 0.15 }}
                  variants={staggerContainer}
                  className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 items-stretch max-w-5xl mx-auto"
                >
                  {pricing.plans.map((plan, idx) => {
                    const price = billingCycle === 'primary' ? plan.priceOneTime : plan.priceSupport;
                    
                    return (
                      <motion.div
                        key={idx}
                        variants={cardReveal}
                        whileHover={{ y: -8, scale: 1.02 }}
                        className={`group relative rounded-[2.25rem] bg-app-card flex flex-col justify-between p-5 md:p-6 pb-4 md:pb-5 text-center shadow-2xl transition-all duration-300 cursor-default ${
                          plan.highlight 
                            ? 'border border-primary/50 ring-1 ring-primary/20 shadow-[0_15px_35px_rgba(232,71,10,0.15)]' 
                            : 'border border-app-border shadow-sm'
                        }`}
                      >
                        {/* Inner rounded container with overflow-hidden to clip background SVG waves/glows */}
                        <div className="absolute inset-0 rounded-[2.25rem] overflow-hidden pointer-events-none z-0">
                          {/* Subtle Ambient Glowing Wave Background */}
                          <svg className="absolute inset-0 w-full h-full opacity-20 pointer-events-none" viewBox="0 0 350 500" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <g filter="url(#glow-blur-card)">
                              <path d="M-50 400 C 50 300, 100 100, 200 200 C 300 300, 350 400, 450 300" stroke="url(#gradient-glow-card)" strokeWidth="6" strokeLinecap="round" />
                            </g>
                            <defs>
                              <filter id="glow-blur-card" x="-20%" y="-20%" width="140%" height="140%" filterUnits="userSpaceOnUse">
                                <feGaussianBlur stdDeviation="20" result="blur" />
                                <feMerge>
                                  <feMergeNode in="blur" />
                                  <feMergeNode in="SourceGraphic" />
                                </feMerge>
                              </filter>
                              <linearGradient id="gradient-glow-card" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
                                <stop offset="50%" stopColor="#E8470A" stopOpacity="0.3" />
                                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.1" />
                              </linearGradient>
                            </defs>
                          </svg>

                          {/* Ambient glow orbs */}
                          <div className="absolute top-10 left-10 w-32 h-32 bg-primary/5 rounded-full filter blur-xl pointer-events-none" />
                          {plan.highlight && (
                            <div className="absolute bottom-10 right-10 w-32 h-32 bg-primary/10 rounded-full filter blur-xl pointer-events-none" />
                          )}
                        </div>

                        {/* Float Badge for Growth Plan */}
                        {plan.highlight && (
                          <div className="absolute top-0 right-8 -translate-y-1/2 bg-primary text-black font-bold uppercase text-[8px] tracking-widest px-4 py-1 rounded-full shadow-md z-10">
                            Most Popular
                          </div>
                        )}

                        <div className="space-y-4 relative z-10">
                          {/* Title Segment */}
                          <div className="space-y-0.5">
                            <h4 className="text-lg sm:text-xl font-bold text-app-text tracking-tight leading-tight uppercase font-heading group-hover:text-primary transition-colors duration-300">{plan.title}</h4>
                            <span className="font-signature text-lg md:text-xl text-app-text-muted font-normal tracking-wide block leading-none pt-0">
                              {plan.title === 'Starter' && 'Perfect for local brands.'}
                              {plan.title === 'Growth' && 'Best value for scaling.'}
                              {plan.title === 'Enterprise' && 'Custom built for scale.'}
                            </span>
                          </div>

                          {/* Dynamic Price Display */}
                          <div className="py-2 border-y border-app-border">
                            <span className="text-xl sm:text-2xl font-bold text-app-text font-heading">{price}</span>
                          </div>

                          {/* Features Checklist */}
                          <div className="space-y-2.5 text-left pb-4">
                            <p className="text-[9px] font-bold text-app-text-muted uppercase tracking-widest">Key Deliverables</p>
                            <ul className="space-y-2">
                              {plan.features.map((feature, fIdx) => (
                                <li key={fIdx} className="flex items-start gap-2">
                                  <div className="w-3.5 h-3.5 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 text-app-text mt-0.5">
                                    <svg className="w-2 h-2 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                  </div>
                                  <span className="text-[11px] sm:text-xs text-app-text-muted font-medium leading-normal font-sans">
                                    {feature}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {/* CTA button */}
                        <div className="pt-2 mt-auto relative z-10">
                          <Link
                            to="/get-quote"
                            className="inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-full bg-[#E8470A] hover:bg-[#D63D08] text-white font-bold text-[10px] uppercase tracking-widest transition-all duration-300 shadow-[0_6px_15px_rgba(232,71,10,0.25)] hover:shadow-[0_10px_22px_rgba(232,71,10,0.4)] hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                          >
                            <span>Get Started</span>
                            <ArrowRight className="w-3.5 h-3.5 stroke-[3]" />
                          </Link>
                        </div>

                      </motion.div>
                    );
                  })}
                </motion.div>

              </div>
            </section>

            {/* 7. Portfolio / Case Studies Section */}
            <section className="py-10 sm:py-14 border-b border-app-border/40">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                
                <motion.div 
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, amount: 0.25 }}
                  variants={scrollReveal}
                  className="text-center max-w-2xl mx-auto mb-12 sm:mb-16"
                >
                  <h2 className="text-xs font-bold uppercase text-primary tracking-[0.25em] mb-2">Our Results</h2>
                  <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-app-text tracking-tight font-heading">
                    Real-World Proof & Case Studies
                  </h3>
                  <p className="text-app-text-muted text-[11px] sm:text-xs font-medium mt-2">
                    Examine how we transformed local client concepts into verified high-yielding operations.
                  </p>
                </motion.div>

                {slug === 'mobile-app-development' ? (
                  <PhoneCarousel3D items={portfolio} />
                ) : (
                  <motion.div 
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.15 }}
                    variants={staggerContainer}
                    className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto"
                  >
                    {portfolio.map((port, idx) => (
                      <motion.div 
                        key={idx}
                        variants={cardReveal}
                        whileHover={{ y: -6 }}
                        className="group bg-app-card border border-app-border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 cursor-default"
                      >
                        {/* Case Image or App Iframe Presentation */}
                        <div className="relative aspect-[16/10] w-full overflow-hidden bg-app-bg border-b border-app-border flex items-center justify-center">
                          {port.iframeUrl ? (
                            <div className="relative w-[320px] h-[650px] scale-[0.45] origin-top md:origin-center transform-gpu rounded-[2.5rem] border-[10px] border-black overflow-hidden shadow-2xl bg-black">
                              {/* Phone Notch */}
                              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-black rounded-b-2xl z-20"></div>
                              <iframe 
                                src={port.iframeUrl} 
                                className="w-full h-full border-none bg-white relative z-10" 
                                title={port.title}
                                sandbox="allow-scripts allow-same-origin"
                              />
                            </div>
                          ) : (
                            <>
                              <img 
                                src={port.image} 
                                alt={port.title} 
                                className="w-full h-full absolute inset-0 object-cover group-hover:scale-105 transition-transform duration-500" 
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                            </>
                          )}
                        </div>

                        {/* Content */}
                        <div className="p-5 space-y-3 z-10 relative bg-app-card">
                          <div className="inline-block bg-primary/10 border border-primary/20 rounded-md px-2.5 py-0.5">
                            <span className="text-primary text-[10px] font-bold uppercase tracking-wider">{port.metric}</span>
                          </div>
                          
                          <h4 className="text-sm sm:text-base font-bold text-app-text group-hover:text-primary transition-colors">
                            {port.title}
                          </h4>
                          
                          <p className="text-[11px] sm:text-xs text-app-text-muted leading-relaxed font-medium">
                            {port.description}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                )}

              </div>
            </section>

            {/* 8. FAQ Accordion Section */}
            <section className="py-10 sm:py-14 border-b border-app-border/40 bg-app-card/10">
              <div className="max-w-4xl mx-auto px-4">
                
                <motion.div 
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, amount: 0.25 }}
                  variants={scrollReveal}
                  className="text-center max-w-2xl mx-auto mb-12"
                >
                  <h2 className="text-xs font-bold uppercase text-primary tracking-[0.25em] mb-2">Answering Queries</h2>
                  <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-app-text tracking-tight font-heading">
                    Frequently Asked Questions
                  </h3>
                  <p className="text-app-text-muted text-[11px] sm:text-xs font-medium mt-2">
                    Have specific functional queries? Find transparent technical answers immediately.
                  </p>
                </motion.div>

                <motion.div 
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, amount: 0.15 }}
                  variants={staggerContainer}
                  className="space-y-4 max-w-3xl mx-auto"
                >
                  {faqs.map((faq, idx) => {
                    const isOpen = activeFaq === idx;
                    return (
                      <motion.div 
                        key={idx}
                        variants={cardReveal}
                        className={`bg-app-card border rounded-2xl overflow-hidden transition-all duration-300 ${
                          isOpen ? 'border-primary/45 shadow-sm' : 'border-app-border'
                        }`}
                      >
                        {/* Question Header */}
                        <button
                          onClick={() => setActiveFaq(isOpen ? null : idx)}
                          className="w-full py-4 px-5 text-left flex items-center justify-between gap-4 font-bold text-xs sm:text-sm text-app-text hover:text-primary transition-colors"
                        >
                          <span className="font-bold leading-snug">{faq.q}</span>
                          <ChevronDown className={`w-4 h-4 text-app-text-muted/65 transition-transform duration-300 ${isOpen ? 'rotate-180 text-primary' : ''}`} />
                        </button>

                        {/* Answer text container */}
                        <AnimatePresence initial={false}>
                          {isOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.25, ease: 'easeInOut' }}
                            >
                              <div className="px-5 pb-5 pt-1 text-[11px] sm:text-xs text-app-text-muted leading-relaxed font-medium border-t border-app-border/40">
                                {faq.a}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </motion.div>

              </div>
            </section>

            {/* 9. Client Testimonial Section */}
            {validTestimonials.length > 0 && (
              <section className="py-10 sm:py-14 border-b border-app-border/40">
                <div className="max-w-4xl mx-auto px-4">
                  {validTestimonials.length > 1 ? (
                    <TestimonialCarousel items={validTestimonials} />
                  ) : (
                    <motion.div 
                      initial="hidden"
                      whileInView="visible"
                      viewport={{ once: true, amount: 0.2 }}
                      variants={{
                        hidden: { opacity: 0, y: 40, scale: 0.95 },
                        visible: { 
                          opacity: 1, 
                          y: 0, 
                          scale: 1, 
                          transition: { 
                            duration: 0.8, 
                            ease: [0.16, 1, 0.3, 1],
                            staggerChildren: 0.15,
                            delayChildren: 0.1
                          } 
                        }
                      }}
                      whileHover={{ 
                        y: -6, 
                        scale: 1.01,
                        transition: { duration: 0.3, ease: "easeOut" }
                      }}
                      className="bg-brand-lightOrange dark:bg-primary/5 border border-app-border rounded-3xl p-6 sm:p-10 relative overflow-hidden flex flex-col md:flex-row items-center gap-6 sm:gap-8 shadow-sm hover:shadow-xl hover:shadow-primary/5 hover:border-primary/30 transition-all duration-300 cursor-default group"
                    >
                      
                      {/* Decorative Icon */}
                      <motion.div
                        variants={{
                          hidden: { opacity: 0, scale: 0.6, rotate: 15, x: 20 },
                          visible: { opacity: 0.1, scale: 1, rotate: 0, x: 0, transition: { duration: 1, ease: "easeOut" } }
                        }}
                        className="absolute top-4 right-6 pointer-events-none"
                      >
                        <Quote className="w-16 h-16 text-primary" />
                      </motion.div>

                      {/* Profile Image */}
                      <motion.div 
                        variants={{
                          hidden: { opacity: 0, scale: 0.5, rotate: -15 },
                          visible: { 
                            opacity: 1, 
                            scale: 1, 
                            rotate: 0,
                            transition: { type: "spring", stiffness: 100, damping: 15 } 
                          }
                        }}
                        className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border border-app-border flex-shrink-0 bg-app-bg shadow-sm relative group-hover:border-primary/40 transition-colors duration-300"
                      >
                        <img 
                          src={validTestimonials[0].avatar} 
                          alt={validTestimonials[0].author} 
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      </motion.div>

                      {/* Testimonial feedback */}
                      <div className="space-y-4 text-center md:text-left flex-grow relative z-10">
                        
                        {/* Stars */}
                        <motion.div 
                          variants={{
                            hidden: {},
                            visible: { transition: { staggerChildren: 0.08 } }
                          }}
                          className="flex justify-center md:justify-start gap-1"
                        >
                          {[1,2,3,4,5].map((star) => (
                            <motion.div
                              key={star}
                              variants={{
                                hidden: { opacity: 0, scale: 0.3, rotate: -35 },
                                visible: { 
                                  opacity: 1, 
                                  scale: 1, 
                                  rotate: 0,
                                  transition: { type: "spring", stiffness: 150, damping: 10 } 
                                }
                              }}
                            >
                              <Star className="w-3.5 h-3.5 fill-primary text-primary drop-shadow-[0_0_4px_rgba(232,71,10,0.3)]" />
                            </motion.div>
                          ))}
                        </motion.div>

                        <motion.p 
                          variants={{
                            hidden: { opacity: 0, y: 15 },
                            visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
                          }}
                          className="text-xs sm:text-sm text-app-text font-medium leading-relaxed italic"
                        >
                          "{validTestimonials[0].feedback || validTestimonials[0].quote}"
                        </motion.p>

                        <motion.div
                          variants={{
                            hidden: { opacity: 0, y: 15 },
                            visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
                          }}
                          className="space-y-0.5"
                        >
                          <h4 className="text-xs sm:text-sm font-bold text-app-text uppercase tracking-wide group-hover:text-primary transition-colors duration-300">
                            {validTestimonials[0].author}
                          </h4>
                          <p className="text-[10px] text-app-text-muted font-bold uppercase tracking-widest flex items-center justify-center md:justify-start gap-1">
                            {validTestimonials[0].role}
                            {validTestimonials[0].country && (
                              <span className="ml-1 inline-flex items-center gap-1 text-app-text-muted/80">
                                • {getCountryFlag(validTestimonials[0].country)} {validTestimonials[0].country}
                              </span>
                            )}
                          </p>
                        </motion.div>

                      </div>
                    </motion.div>
                  )}
                </div>
              </section>
            )}

            {/* 10. Final Call To Action (Cosmic Dark Space horizon layout) */}
            <section className="py-16 sm:py-24 bg-app-bg px-4 sm:px-6 lg:px-8 border-t border-app-border/40">
              <div className="max-w-5xl mx-auto">
                <motion.div 
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, amount: 0.25 }}
                  variants={{
                    hidden: { opacity: 0, y: 30 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } }
                  }}
                  className="relative overflow-hidden rounded-3xl bg-app-card border border-white/5 py-16 sm:py-20 text-center px-6 sm:px-12 md:px-16 shadow-2xl"
                >
                  {/* Space Starfield Effect */}
                  <div className="absolute inset-0 bg-transparent opacity-25 pointer-events-none z-0 bg-[radial-gradient(ellipse_at_center,_rgba(255,255,255,0.15)_1px,_transparent_1px)] bg-[size:20px_20px]" />

                  {/* Soft Spotlights / Aurora Beams */}
                  <div className="absolute inset-0 opacity-20 pointer-events-none overflow-hidden z-0">
                    <div className="absolute -top-1/2 left-1/4 w-[160px] h-[200%] bg-gradient-to-b from-white/10 via-white/5 to-transparent rotate-[25deg] blur-2xl" />
                    <div className="absolute -top-1/2 left-2/3 w-[220px] h-[200%] bg-gradient-to-b from-primary/10 via-primary/5 to-transparent rotate-[25deg] blur-3xl" />
                  </div>

                  {/* Glow Horizon Arc at Bottom */}
                  <div className="absolute -bottom-24 left-1/2 -translate-x-1/2 w-[160%] aspect-[4/1] rounded-[100%] border-t-2 border-primary bg-gradient-to-b from-primary/25 via-primary/5 to-transparent blur-[3px] opacity-80 pointer-events-none z-0" />

                  <div className="relative z-10 max-w-2xl mx-auto space-y-6 sm:space-y-8">
                    {/* Centered Heading */}
                    <h3 className="text-xl sm:text-2xl md:text-3xl font-bold font-heading text-app-text tracking-tight leading-tight">
                      Ready to Grow Your <span className="text-primary">Business Operations?</span>
                    </h3>
                    
                    {/* Centered Description */}
                    <p className="text-app-text-muted text-xs sm:text-sm leading-relaxed max-w-lg mx-auto font-medium">
                      Connect with our technical controller for a direct technical review and dynamic quote tailored for your business specifications.
                    </p>

                    {/* Centered Buttons Group */}
                    <div className="pt-2 flex flex-col sm:flex-row gap-4 items-center justify-center">
                      <Link
                        to="/get-quote"
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 bg-primary hover:bg-primary-hover text-black font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-primary/25 hover:shadow-primary/45 transition-all duration-300 transform hover:-translate-y-0.5 cursor-pointer"
                      >
                        <span>Get Free Quote Now</span>
                        <ArrowRight className="w-4 h-4" />
                      </Link>

                      <Link
                        to="/portfolio"
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 bg-app-card hover:bg-app-border/50 text-app-text border border-app-border hover:border-primary/30 font-bold text-xs uppercase tracking-wider rounded-xl transition-all duration-300 transform hover:-translate-y-0.5 cursor-pointer"
                      >
                        <span>Explore Portfolio</span>
                        <ArrowRight className="w-4 h-4 transition-transform" />
                      </Link>
                    </div>
                  </div>
                </motion.div>
              </div>
            </section>

            {/* 11. Sticky Get Quote Utility (Triggered on Scroll) */}
            <AnimatePresence>
              {showStickyCta && (
                <motion.div
                  initial={{ y: 80, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 80, opacity: 0 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="fixed bottom-6 left-4 right-4 sm:left-auto sm:right-6 bg-app-bg/95 backdrop-blur-md border border-app-border p-3 sm:p-4 rounded-2xl shadow-2xl z-50 flex items-center justify-between gap-4 max-w-xs sm:max-w-sm"
                >
                  <div className="space-y-0.5 hidden xs:block">
                    <p className="text-[9px] font-bold text-app-text-muted/65 uppercase tracking-widest">Selected Service</p>
                    <p className="text-xs font-bold text-app-text uppercase truncate max-w-[150px] sm:max-w-[200px]">{title}</p>
                  </div>
                  <Link
                    to="/get-quote"
                    className="w-full xs:w-auto px-4 py-2 bg-primary hover:bg-primary-hover text-black font-bold text-[10px] uppercase tracking-wider rounded-xl transition-all duration-300 text-center flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span>Get Quote</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
