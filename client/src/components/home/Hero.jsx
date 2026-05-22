import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, Sparkles, Check, Award, Users, Play, Pause, Globe, Code, Cpu, Database } from 'lucide-react';
import heroImage from '../../assets/hero_modern.png';
import lightLogo from '../../assets/logo_Square.jpg__1_-removebg-preview.png';
import darkLogo from '../../assets/DarkthemeLogo.png';
import backgroundVideo from '../../assets/vedio/mp_.mp4';
import { useTheme } from '../../context/ThemeContext';
import { Spotlight } from '@/components/ui/spotlight';
import { EncryptedText } from '@/components/ui/encrypted-text';
import { useHero } from '../../hooks/useHero';

const rotatingPhrases = [
  'Website Development',
  'Organic SEO & PPC Ads',
  'Mobile Application Development',
  'Indian & US Bookkeeping',
  'Power BI & SQL Automation'
];

const FloatingIcon = ({ children, delay = 0, className = "" }) => (
  <motion.div
    initial={{ y: 0 }}
    animate={{ y: [-15, 15, -15] }}
    transition={{
      duration: 5,
      repeat: Infinity,
      ease: "easeInOut",
      delay
    }}
    className={`absolute pointer-events-none opacity-20 ${className}`}
  >
    {children}
  </motion.div>
);

export default function Hero() {
  const { theme } = useTheme();
  const [textIndex, setTextIndex] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const sectionRef = useRef(null);
  const videoRef = useRef(null);
  
  const { data: heroData, isLoading } = useHero();

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"]
  });

  const backgroundScale = useTransform(scrollYProgress, [0, 1], [1, 1.15]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const contentTranslate = useTransform(scrollYProgress, [0, 0.5], [0, -50]);

  // Detect reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Rotate text phrases every 4 seconds
  useEffect(() => {
    if (prefersReducedMotion) return;
    const interval = setInterval(() => {
      setTextIndex((prev) => (prev + 1) % rotatingPhrases.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [prefersReducedMotion]);

  return (
    <section 
      ref={sectionRef}
      style={{
        width: '100vw',
        marginLeft: 'calc(-50vw + 50%)',
        marginRight: 'calc(-50vw + 50%)',
      }}
      className="relative min-h-[50vh] md:min-h-[100vh] flex items-center pt-24 pb-4 md:pb-16 md:pt-28 overflow-hidden bg-app-bg"
    >
      {/* Full-Screen Video Background with Smooth Zoom */}
      <motion.div 
        style={{ scale: backgroundScale }}
        className="absolute inset-0 z-0 w-full h-full"
      >
        {heroData?.backgroundImageUrl ? (
          <img
            src={heroData.backgroundImageUrl}
            alt="Hero Background"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <video
            ref={videoRef}
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          >
            <source src={backgroundVideo} type="video/mp4" />
          </video>
        )}
        {/* Advanced Overlay System */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/95 via-black/60 to-black/95 z-1" />
        <div className="absolute inset-0 bg-black/50 z-1" />
      </motion.div>

      {/* Floating Elements for Visual Depth */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <FloatingIcon delay={0} className="top-1/4 right-[10%] text-primary">
          <Globe size={48} strokeWidth={1} />
        </FloatingIcon>
        <FloatingIcon delay={2} className="bottom-1/3 left-[5%] text-primary">
          <Code size={40} strokeWidth={1} />
        </FloatingIcon>
        <FloatingIcon delay={1} className="top-1/3 left-[15%] text-primary">
          <Cpu size={32} strokeWidth={1} />
        </FloatingIcon>
        <FloatingIcon delay={3} className="bottom-1/4 right-[20%] text-primary">
          <Database size={36} strokeWidth={1} />
        </FloatingIcon>
      </div>

      <Spotlight
        className="-top-40 left-0 md:left-60 md:-top-20"
        fill="white"
      />

      <motion.div 
        style={{ opacity: contentOpacity, y: contentTranslate }}
        className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex items-center min-h-[auto] sm:min-h-[60vh] md:min-h-[85vh]"
      >
        <div className="max-w-4xl w-full flex flex-col justify-center space-y-8 sm:space-y-10 text-left pt-8 pb-8 sm:py-0">
          {/* Tagline from Image - Fade in from Left */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="space-y-1"
          >
            <span className="text-[9.5px] sm:text-xs font-bold text-white/60 sm:text-app-text/50 tracking-[0.25em] sm:tracking-[0.4em] uppercase block mb-2 sm:mb-1">
              REAL VALUE. REAL CONTENT. REAL GROWTH
            </span>
          </motion.div>

          <div className="space-y-5 sm:space-y-6">
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
              className="text-[2.5rem] leading-[1.1] sm:text-5xl lg:text-7xl font-bold text-white font-heading tracking-tighter drop-shadow-2xl"
            >
              {heroData?.heading || (
                <>Build. Market. <span className="text-primary">Grow.</span></>
              )}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2, duration: 1, ease: [0.22, 1, 0.36, 1] }}
              className="max-w-xl text-[13px] sm:text-base text-white/90 sm:text-primary font-medium leading-relaxed drop-shadow-md whitespace-pre-line"
            >
              {heroData?.subheading || "We think beyond the boundaries, So join us to grow your business.\nAnd be smart and fast."}
            </motion.p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="flex flex-col sm:flex-row gap-3 sm:gap-5 w-full sm:w-auto pt-2 sm:pt-0"
          >
            <Link
              to={heroData?.primaryButtonLink || "/get-quote"}
              className="px-6 py-3.5 sm:px-10 sm:py-4 bg-primary hover:bg-primary-hover text-black font-black text-sm rounded-full flex items-center justify-center gap-2 sm:gap-3 transition-all duration-300 hover:scale-105 group shadow-[0_0_30px_rgba(255,107,0,0.3)] w-full sm:w-auto text-center"
            >
              <span>{heroData?.primaryButtonText || "Start Project"}</span>
              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>

            <Link
              to={heroData?.secondaryButtonLink || "/services"}
              className="px-6 py-3.5 sm:px-10 sm:py-4 bg-white/5 backdrop-blur-md border border-white/10 hover:bg-primary hover:border-primary hover:text-black text-white font-bold text-sm rounded-full flex items-center justify-center gap-3 transition-all duration-300 hover:scale-105 w-full sm:w-auto text-center shadow-lg hover:shadow-[0_0_30px_rgba(255,107,0,0.3)]"
            >
              <span>{heroData?.secondaryButtonText || "View Services"}</span>
            </Link>
          </motion.div>

          {/* Additional Description Text below buttons */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="max-w-3xl text-[11px] sm:text-sm text-white/50 sm:text-white/60 leading-relaxed sm:leading-relaxed font-medium tracking-wide mt-6 sm:mt-8 line-clamp-3 sm:line-clamp-none"
          >
            At our company, professionalism meets smart execution. We offer a wide range of high-quality services designed to simplify operations and support business growth under one trusted platform. We believe every business deserves a service partner that understands modern challenges and delivers practical, efficient solutions. Our multi-service expertise allows us to provide flexible, cost-effective, and scalable support across different industries. Your trusted partner for professional multi-service solutions.
          </motion.p>
        </div>
      </motion.div>

      {/* Video Control: Mute/Unmute - REMOVED AS PER USER REQUEST */}

      <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent z-10" />
    </section>
  );
}
