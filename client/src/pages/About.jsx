import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, ArrowRight, Code, Share2, Megaphone, Palette, Calculator, BarChart3, Cpu, Play, Tv } from 'lucide-react';
import { EncryptedText } from '@/components/ui/encrypted-text';

// Import newly generated transparent background team illustration
import teamImg from '../assets/team_about-removebg-preview.webp';
import compImg1 from '../assets/Gemini_Generated_Image_y4beazy4beazy4be-removebg-preview.webp';
import compImg2 from '../assets/Gemini_Generated_Image_jbm779jbm779jbm7-removebg-preview.webp';
import { ShieldCheck, Award as AwardIcon } from 'lucide-react';

export default function About() {
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

  const scrollFadeLeft = {
    hidden: { opacity: 0, x: -45 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] }
    }
  };

  const scrollFadeRight = {
    hidden: { opacity: 0, x: 45 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] }
    }
  };

  const imageReveal = {
    hidden: { scale: 0.85, opacity: 0 },
    visible: {
      scale: 1,
      opacity: 1,
      transition: { duration: 1.1, ease: [0.16, 1, 0.3, 1] }
    }
  };

  const whatWeDoServices = [
    {
      title: 'Web & Mobile Engineering',
      desc: 'High-performing, responsive, and scalable web and mobile applications tailored to your brand and business goals.',
      icon: Code,
    },
    {
      title: 'Social Media Management',
      desc: 'Strategic content, engagement, and analytics to strengthen your brand presence across Facebook, Instagram, LinkedIn, and more.',
      icon: Share2,
    },
    {
      title: 'Paid Ads & PPC Campaigns',
      desc: 'Data-backed campaigns across Google, Meta, and LinkedIn Ads that drive leads, conversions, and long-term brand value.',
      icon: Megaphone,
    },
    {
      title: 'Logo Designing & Branding',
      desc: 'Creative and memorable designs that communicate your vision and values effectively to your targeted audience.',
      icon: Palette,
    },
    {
      title: 'Accounting & Financial Services',
      desc: 'Transparent financial management, outsourced bookkeeping, and compliance reporting services for smooth business operations.',
      icon: Calculator,
    },
    {
      title: 'MIS & Reporting Services',
      desc: 'Smart dashboards and automated insights to enable quick, data-driven, and highly effective executive decision-making.',
      icon: BarChart3,
    },
    {
      title: 'Enterprise Process Automation',
      desc: 'Streamlining business workflows through powerful automation and custom business intelligence tools (SQL, Power BI, Python) to save time and eliminate errors.',
      icon: Cpu,
    }
  ];

  return (
    <div className="bg-app-bg text-app-text-muted min-h-screen pt-24 pb-8 sm:pb-12 px-4 sm:px-6 lg:px-8 mesh-grid relative overflow-hidden">
      
      {/* Dynamic Floating Gradient Glow Backgrounds */}
      <div className="absolute top-1/4 -right-20 w-96 h-96 bg-primary/8 rounded-full filter blur-[150px] animate-pulse pointer-events-none" />
      <div className="absolute bottom-1/4 -left-20 w-[450px] h-[450px] bg-primary/4 dark:bg-white/2 rounded-full filter blur-[150px] pointer-events-none" />
      
      {/* Floating Blur Circles */}
      <div className="absolute top-10 left-1/3 w-3 h-3 bg-primary/30 rounded-full filter blur-sm animate-bounce" style={{ animationDuration: '6s' }} />
      <div className="absolute bottom-20 right-1/3 w-4 h-4 bg-primary/25 rounded-full filter blur-md animate-ping" style={{ animationDuration: '9s' }} />

      <div className="max-w-6xl mx-auto relative z-10">

        {/* Hero Section Split Layout (Tolak inspired with Scroll triggers) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center mb-28">
          
          {/* Left Column Content - Staggered scroll entry */}
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={staggerContainer}
            className="lg:col-span-6 space-y-6 text-left"
          >
            
            {/* Tagline / Subtitle */}
            <motion.div variants={scrollFadeUp} className="flex items-center gap-2">
              <span className="w-6 h-[2px] bg-primary" />
              <span className="text-xs font-extrabold text-primary uppercase tracking-widest">
                Who We Are
              </span>
            </motion.div>

            {/* Bottom Text Reveal Title on scroll */}
            <h1 className="text-4xl md:text-5xl font-black font-heading text-app-text leading-tight tracking-tight flex flex-col gap-1.5">
              <EncryptedText 
                text="Creative Solutions" 
                revealedClassName="text-app-text"
                encryptedClassName="text-primary/60 font-mono"
                revealDelayMs={30}
              />
              <EncryptedText 
                text="Driven by Data & Engineering" 
                revealedClassName="text-primary text-gradient-orange"
                encryptedClassName="text-primary/60 font-mono"
                revealDelayMs={20}
              />
            </h1>

            {/* Main Narrative paragraph on scroll */}
            <motion.p 
              variants={scrollFadeUp}
              className="text-xs md:text-sm text-app-text leading-relaxed"
            >
              Vedhunt InfoTech provides successful business solutions to its clients to scale their profitability. It’s a trusted agency which provides customized services to businesses across India.
            </motion.p>

            {/* Structured Capabilities checklist on scroll */}
            <motion.div 
              variants={scrollFadeUp}
              className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2"
            >
              {[
                'Web & App Engineering',
                'Creative Brand Identity',
                'Performance Ads & PPC',
                'SEO Search Dominance',
                'Outsource Bookkeeping',
                'SQL & Power BI Automation'
              ].map((item, idx) => (
                <div key={idx} className="flex items-center gap-2.5 text-xs text-app-text font-medium">
                  <div className="w-5 h-5 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                  <span>{item}</span>
                </div>
              ))}
            </motion.div>

            {/* CTA Button Hover Animations */}
            <motion.div 
              variants={scrollFadeUp}
              className="pt-6"
            >
              <Link
                to="/get-quote"
                className="relative inline-flex items-center gap-2 px-8 py-4 bg-primary hover:bg-primary-hover text-black font-extrabold text-xs uppercase tracking-wider rounded-lg transition-all duration-300 hover:shadow-[0_0_25px_rgba(255,107,0,0.45)] group cursor-pointer overflow-hidden"
              >
                {/* Gloss slide overlay on hover */}
                <span className="absolute inset-0 bg-white/10 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out" />
                <span>Get Solution</span>
                <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1.5" />
              </Link>
            </motion.div>

          </motion.div>

          {/* Right Column (Tolak curved rounded image design with Scroll animation) */}
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={staggerContainer}
            className="lg:col-span-6 relative flex items-center justify-center"
          >
            
            {/* Curved absolute frame offset around circle */}
            <div className="absolute -top-6 -left-6 -bottom-6 -right-6 border-[3px] border-dashed border-primary/25 rounded-full pointer-events-none animate-spin" style={{ animationDuration: '40s' }} />

            {/* Glowing Accent Orb underneath circle */}
            <div className="absolute inset-4 rounded-full bg-primary/15 filter blur-2xl animate-pulse pointer-events-none" />

            {/* Large Circle image mask with robust orange stroke */}
            <motion.div 
              variants={imageReveal}
              className="relative w-full max-w-[420px] aspect-square rounded-full border-[10px] border-primary overflow-hidden shadow-[0_20px_50px_rgba(255,107,0,0.25)] group transition-transform duration-500 hover:scale-[1.02]"
            >
              <img
                src={teamImg}
                alt="Vedhunt Creative Team"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              />
              {/* Sleek warm dark brand-orange overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-primary/15 via-transparent to-transparent pointer-events-none mix-blend-multiply" />
            </motion.div>

            {/* Floating Live Stat Bubble 1: Retention */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.8, x: -30 }}
              whileInView={{ opacity: 1, scale: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ type: 'spring', stiffness: 100, delay: 0.5 }}
              className="absolute top-10 left-0 bg-app-card border border-app-border rounded-2xl p-4 shadow-xl flex items-center gap-3 orange-glow-sm hover:border-primary/35 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-sm">
                99%
              </div>
              <div className="text-left">
                <p className="text-[10px] font-extrabold text-primary uppercase tracking-wider">Client</p>
                <p className="text-xs font-black text-app-text">Retention</p>
              </div>
            </motion.div>

            {/* Floating Live Stat Bubble 2: Projects */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.8, x: 30 }}
              whileInView={{ opacity: 1, scale: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ type: 'spring', stiffness: 100, delay: 0.6 }}
              className="absolute bottom-10 right-0 bg-app-card border border-app-border rounded-2xl p-4 shadow-xl flex items-center gap-3 orange-glow-sm hover:border-primary/35 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-sm">
                140+
              </div>
              <div className="text-left">
                <p className="text-[10px] font-extrabold text-primary uppercase tracking-wider">Active</p>
                <p className="text-xs font-black text-app-text">Projects</p>
              </div>
            </motion.div>

          </motion.div>

        </div>

        {/* About Our Company Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center mb-28 text-left">
          
          {/* Left Column: Overlapping Offset Double Images */}
          <div className="lg:col-span-6 relative flex items-center justify-center min-h-[400px] sm:min-h-[480px]">
            
            {/* Fluid Flowing Wave & Halftone Dotted Layer Design (from reference image) */}
            <svg 
              className="absolute -left-16 lg:-left-24 top-1/2 -translate-y-1/2 w-[130%] h-[120%] pointer-events-none z-0 opacity-80 dark:opacity-25" 
              viewBox="0 0 600 500" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                {/* Halftone Dot Grid Pattern */}
                <pattern id="halftonePattern" x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
                  <circle cx="2" cy="2" r="1.5" className="fill-primary/20 dark:fill-primary/10" />
                </pattern>
                
                {/* Flowing Blue-to-Orange Linear Gradient for outlines */}
                <linearGradient id="waveLineGrad" x1="0%" y1="50%" x2="100%" y2="50%">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.8" />
                  <stop offset="60%" stopColor="#60A5FA" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#FF6B00" stopOpacity="0.6" />
                </linearGradient>

                {/* Soft Gradient Mask for Halftone */}
                <linearGradient id="halftoneFade" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#FF6B00" stopOpacity="0.1" />
                </linearGradient>
              </defs>

              {/* Halftone / Dotted Overlay Shape */}
              <path 
                d="M -20 100 Q 150 40, 220 220 T 480 300 L 480 480 L -20 480 Z" 
                fill="url(#halftonePattern)" 
                className="opacity-90 motion-safe:animate-pulse"
                style={{ animationDuration: '6s' }}
              />

              {/* Flowing Outlines & Bezier Curves */}
              <path 
                d="M -50 220 Q 120 80, 240 280 T 550 240" 
                stroke="url(#waveLineGrad)" 
                strokeWidth="5" 
                strokeLinecap="round" 
                fill="none"
              />
              
              <path 
                d="M -50 245 Q 120 105, 240 305 T 550 265" 
                stroke="url(#waveLineGrad)" 
                strokeWidth="1.5" 
                strokeDasharray="4 8"
                strokeLinecap="round" 
                fill="none"
                className="opacity-70"
              />

              <path 
                d="M -50 195 Q 120 55, 240 255 T 550 215" 
                stroke="#3B82F6" 
                strokeWidth="2" 
                strokeLinecap="round" 
                fill="none"
                className="opacity-40"
              />

              <path 
                d="M -50 220 Q 120 80, 240 280 T 550 240 L 550 500 L -50 500 Z" 
                fill="url(#halftoneFade)" 
                className="opacity-20"
              />
            </svg>
            
            {/* Base Double-Image Canvas */}
            <div className="relative w-full max-w-[420px] aspect-square flex items-center justify-center z-10">
              
              {/* Back Image (Offset Top-Left) */}
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-80px' }}
                variants={scrollFadeLeft}
                className="absolute top-0 left-0 w-[68%] aspect-[4/3] rounded-3xl overflow-hidden border-4 border-app-card shadow-2xl z-10 transition-all duration-300 group cursor-pointer"
              >
                <img 
                  src={compImg1} 
                  alt="Vedhunt Engineering Team" 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-primary/10 via-transparent to-transparent pointer-events-none" />
              </motion.div>

              {/* Front Image (Offset Bottom-Right) */}
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-80px' }}
                variants={scrollFadeRight}
                className="absolute bottom-0 right-0 w-[68%] aspect-[4/3] rounded-3xl overflow-hidden border-4 border-app-card shadow-2xl z-20 hover:z-30 transition-all duration-300 group cursor-pointer"
              >
                <img 
                  src={compImg2} 
                  alt="Vedhunt Strategy Team" 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-primary/10 via-transparent to-transparent pointer-events-none" />
              </motion.div>

              {/* Overlapping Central Badge (Transparent, Glassmorphic, and Animated Float) */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-15">
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  animate={{ y: [0, -8, 0] }}
                  transition={{
                    y: { duration: 4, repeat: Infinity, ease: "easeInOut" },
                    opacity: { duration: 0.5 },
                    scale: { type: "spring", stiffness: 100 }
                  }}
                  viewport={{ once: true }}
                  className="glass-panel bg-app-card/35 backdrop-blur-xl border border-app-border rounded-2xl p-6 shadow-[0_20px_50px_rgba(255,107,0,0.22)] flex flex-col items-center justify-center text-center w-36 h-36 orange-glow-sm hover:border-primary/50 transition-colors duration-300"
                >
                  <div className="text-3xl md:text-4xl font-black text-primary font-heading leading-none">5+</div>
                  <div className="text-[9px] font-extrabold text-app-text uppercase tracking-widest mt-1">Years Of</div>
                  <div className="text-xs font-black text-app-text-muted">Excellence</div>
                </motion.div>
              </div>

            </div>
          </div>

          {/* Right Column: Company Content Block */}
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={staggerContainer}
            className="lg:col-span-6 space-y-6"
          >
            {/* Tagline / Subtitle */}
            <motion.div variants={scrollFadeUp} className="flex items-center gap-2">
              <span className="text-xs font-extrabold text-primary uppercase tracking-widest">
                About Our Company
              </span>
              <span className="w-8 h-[2px] bg-primary" />
            </motion.div>

            {/* Main Header with Scroll Encrypted Text Animation */}
            <motion.h2 
              variants={scrollFadeUp}
              className="text-3xl md:text-4xl font-black font-heading text-app-text leading-tight flex flex-col gap-1"
            >
              <EncryptedText 
                text="Empowering Businesses" 
                revealedClassName="text-app-text"
                encryptedClassName="text-primary/60 font-mono"
                revealDelayMs={25}
              />
              <EncryptedText 
                text="Through Smart Technology & Ethical Strategy" 
                revealedClassName="text-primary text-gradient-orange"
                encryptedClassName="text-primary/60 font-mono"
                revealDelayMs={15}
              />
            </motion.h2>

            {/* Core Description (Second Image text) */}
            <motion.div 
              variants={scrollFadeUp}
              className="space-y-4 text-xs md:text-sm text-app-text leading-relaxed"
            >
              <p>
                At <strong className="text-app-text font-black">Vedhunt InfoTech</strong>, we believe technology isn't just about code — it's about creating meaningful impact.
              </p>
              <p>
                We are a <strong className="text-primary font-bold">next-generation IT, Digital Marketing, and Automation solutions company</strong> helping businesses streamline operations, boost digital presence, and accelerate growth through intelligent, ethical, and scalable solutions.
              </p>
              <p>
                Founded with a vision to <strong className="text-app-text font-black">bridge the gap between technology and business success</strong>, Vedhunt InfoTech has evolved into a trusted partner for startups, SMEs, and enterprises across multiple industries.
              </p>
              <p>
                Our team of innovators, strategists, and engineers work together to design and deliver end-to-end digital solutions that transform how organizations operate and grow.
              </p>
            </motion.div>

            {/* Checklist items (First image details) */}
            <motion.div 
              variants={scrollFadeUp} 
              className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/15 text-primary flex items-center justify-center shrink-0 orange-glow-sm">
                  <ShieldCheck className="w-4.5 h-4.5 stroke-[2.5]" />
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-xs md:text-sm font-extrabold text-app-text font-heading">Certified Company</h4>
                  <p className="text-[10px] md:text-xs text-app-text-muted leading-relaxed">
                    Industry-certified security compliance & standard-driven procedures.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/15 text-primary flex items-center justify-center shrink-0 orange-glow-sm">
                  <AwardIcon className="w-4.5 h-4.5 stroke-[2.5]" />
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-xs md:text-sm font-extrabold text-app-text font-heading">Award Ceremony</h4>
                  <p className="text-[10px] md:text-xs text-app-text-muted leading-relaxed">
                    Recognized for excellence in automation & performance-driven marketing.
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Signature Badge Founder Detail */}
            <motion.div 
              variants={scrollFadeUp} 
              className="flex items-center gap-4 pt-6 border-t border-app-border/40"
            >
              <div className="flex items-center justify-center px-4 py-2 bg-primary/5 rounded-xl border border-primary/10 select-none">
                <span className="font-signature text-3xl font-medium text-primary/75 tracking-wider">
                  Rakesh Kumar
                </span>
              </div>
              <div className="text-left space-y-0.5">
                <h5 className="text-xs md:text-sm font-extrabold text-app-text font-heading">Rakesh Kumar</h5>
                <p className="text-[10px] md:text-xs text-app-text-muted">Chairman & Founder Tech, Vedhunt</p>
              </div>
            </motion.div>

          </motion.div>

        </div>

        {/* Corporate Intro Presentation Section */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={staggerContainer}
          className="mb-28 relative"
        >
          {/* Subtle back ambient glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-primary/8 rounded-full filter blur-[140px] pointer-events-none" />

          <div className="glass-panel rounded-3xl p-8 md:p-12 bg-gradient-to-br from-app-card/90 via-app-card/75 to-app-bg border border-app-border relative overflow-hidden orange-glow shadow-2xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              
              {/* Left Column: Copy & Metadata */}
              <div className="lg:col-span-5 text-left space-y-6">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold text-primary uppercase tracking-widest bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-md flex items-center gap-1.5">
                    <Tv className="w-3.5 h-3.5" />
                    <span>Video Presentation</span>
                  </span>
                  <span className="w-8 h-[2px] bg-primary" />
                </div>

                <h3 className="text-2xl md:text-3xl font-black font-heading text-app-text leading-tight">
                  Watch Our 2-Minute <span className="text-primary text-gradient-orange">Company Introduction</span>
                </h3>

                <p className="text-xs md:text-sm text-app-text-muted leading-relaxed">
                  Take a quick virtual tour of Vedhunt InfoTech. Discover our advanced workspace, metrically proven software engineering standards, result-oriented marketing models, and compliant bookkeeping workflows.
                </p>

                <div className="space-y-3.5 pt-2">
                  {[
                    '2 Minutes of clear, concise strategic overview',
                    'Direct insights into our operational workflows',
                    'Real-world examples of our software & marketing platforms',
                    'A message from our executive leadership team'
                  ].map((bullet, bIdx) => (
                    <div key={bIdx} className="flex items-start gap-2.5 text-xs text-app-text font-medium">
                      <div className="w-5 h-5 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 mt-0.5">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                      <span>{bullet}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-4 flex items-center gap-4 text-xs font-bold text-app-text">
                  <div className="px-3.5 py-2 bg-app-bg border border-app-border rounded-xl">
                    Duration: <span className="text-primary">2:15 Mins</span>
                  </div>
                  <div className="px-3.5 py-2 bg-app-bg border border-app-border rounded-xl">
                    Format: <span className="text-primary">Full HD</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Premium Mock Player Frame & Iframe Embed */}
              <div className="lg:col-span-7 relative">
                
                {/* Visual Accent Corner Highlights */}
                <div className="absolute -top-1.5 -right-1.5 w-10 h-10 border-t-[3px] border-r-[3px] border-primary rounded-tr-2xl pointer-events-none z-20" />
                <div className="absolute -bottom-1.5 -left-1.5 w-10 h-10 border-b-[3px] border-l-[3px] border-primary rounded-bl-2xl pointer-events-none z-20" />
                
                {/* Glowing border frame wrapping */}
                <div className="relative rounded-2xl overflow-hidden border border-app-border shadow-[0_20px_50px_rgba(255,107,0,0.18)] bg-black/95 select-none transition-transform duration-500 hover:scale-[1.01] group">
                  
                  {/* Top Bar of player mock */}
                  <div className="bg-[#121212] px-4 py-3 border-b border-white/5 flex items-center justify-between z-10 relative">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                    </div>
                    <div className="text-[10px] text-white/40 font-mono tracking-widest uppercase flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                      <span>Vedhunt Media player</span>
                    </div>
                    <div className="w-10" />
                  </div>

                  {/* Aspect Ratio video wrapper */}
                  <div className="aspect-video w-full relative">
                    <iframe 
                      className="w-full h-full border-0 absolute inset-0"
                      src="https://www.youtube.com/embed/hb6CFtZnj2c?autoplay=0&rel=0&modestbranding=1" 
                      title="Vedhunt InfoTech Corporate Intro"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-view; web-share" 
                      allowFullScreen
                    />
                  </div>

                  {/* Player Bottom Control Strip Overlay (Adds elite design appeal) */}
                  <div className="bg-[#121212] px-5 py-3 border-t border-white/5 flex items-center justify-between text-white/60 text-[10px] font-mono">
                    <div className="flex items-center gap-3">
                      <Play className="w-3.5 h-3.5 text-primary fill-primary" />
                      <span className="text-white/80">LIVE TOUR</span>
                    </div>
                    <div className="flex-grow mx-6 bg-white/10 h-1 rounded-full overflow-hidden relative">
                      <div className="absolute top-0 left-0 bottom-0 bg-primary w-[35%]" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span>02:15</span>
                      <span className="bg-primary/20 text-primary border border-primary/35 px-1.5 py-0.5 rounded text-[8px] font-bold">1080P</span>
                    </div>
                  </div>

                </div>
              </div>

            </div>
          </div>
        </motion.div>

        {/* What We Do Section */}
        <div className="mb-28 text-left space-y-12">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={scrollFadeUp}
            className="max-w-3xl space-y-4"
          >
            <span className="text-[10px] font-extrabold text-primary uppercase tracking-widest bg-primary/10 px-2.5 py-1 rounded-md">
              What We Do
            </span>
            <h2 className="text-3xl md:text-4xl font-black font-heading text-app-text leading-tight">
              Comprehensive Technology & Financial Solutions
            </h2>
            <p className="text-xs md:text-sm text-app-text-muted leading-relaxed">
              Vedhunt InfoTech provides successful business solutions to its clients to scale their profitability. It’s a trusted agency which provides customized services to businesses across India.
            </p>
          </motion.div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          >
            {whatWeDoServices.map((service, idx) => {
              const ServiceIcon = service.icon;
              return (
                <motion.div 
                  key={idx} 
                  variants={scrollFadeUp}
                  className="glass-panel rounded-2xl p-6 bg-app-card/45 border border-app-border hover:border-primary/30 hover:-translate-y-1.5 transition-all duration-300 group relative overflow-hidden flex flex-col justify-between min-h-[220px]"
                >
                  {/* Subtle orb background on hover */}
                  <div className="absolute -bottom-10 -right-10 w-24 h-24 bg-primary/3 rounded-full filter blur-xl group-hover:bg-primary/6 transition-colors" />
                  
                  <div className="space-y-4">
                    <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/15 text-primary flex items-center justify-center orange-glow-sm group-hover:bg-primary group-hover:text-black transition-all duration-300">
                      <ServiceIcon className="w-5.5 h-5.5" />
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="text-sm md:text-base font-extrabold text-app-text font-heading group-hover:text-primary transition-colors duration-200">
                        {service.title}
                      </h3>
                      <p className="text-[11px] md:text-xs text-app-text-muted leading-relaxed">
                        {service.desc}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>

        {/* Vision & Mission Section (Slide on scroll from edges with custom offset diagonal corner brackets) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-28">
          
          {/* Vision card - slides from left */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={scrollFadeLeft}
            className="glass-panel rounded-3xl p-8 md:p-10 text-left bg-gradient-to-br from-app-card/60 via-app-card/30 to-transparent border border-app-border relative overflow-visible group hover:border-primary/30 transition-all duration-300 hover:shadow-[0_15px_30px_rgba(255,107,0,0.06)]"
          >
            {/* Masked internal container for blur circle */}
            <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
              <div className="absolute -top-10 -right-10 w-28 h-28 bg-primary/5 rounded-full filter blur-2xl group-hover:bg-primary/10 transition-colors" />
            </div>

            {/* Premium Corner Brackets matching website branding theme (diagonal top-right and bottom-left layout) */}
            <div className="absolute -top-1.5 -right-1.5 w-12 h-12 border-t-[4px] border-r-[4px] border-primary rounded-tr-3xl pointer-events-none transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:scale-105" />
            <div className="absolute -bottom-1.5 -left-1.5 w-12 h-12 border-b-[4px] border-l-[4px] border-primary rounded-bl-3xl pointer-events-none transition-transform duration-300 group-hover:-translate-x-1 group-hover:translate-y-1 group-hover:scale-105" />

            <span className="text-[10px] font-extrabold text-primary uppercase tracking-widest bg-primary/10 px-2.5 py-1 rounded-md">
              Our Vision
            </span>
            <h3 className="text-2xl font-black font-heading text-app-text mt-4 mb-3 leading-snug">
              Grow Smarter, Faster & More Ethically
            </h3>
            <p className="text-xs md:text-sm text-app-text-muted leading-relaxed">
              To become a globally recognized technology partner that empowers organizations to leverage digital systems securely and ethically, fostering massive organic business scale.
            </p>
          </motion.div>

          {/* Mission card - slides from right */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={scrollFadeRight}
            className="glass-panel rounded-3xl p-8 md:p-10 text-left bg-gradient-to-br from-app-card/60 via-app-card/30 to-transparent border border-app-border relative overflow-visible group hover:border-primary/30 transition-all duration-300 hover:shadow-[0_15px_30px_rgba(255,107,0,0.06)]"
          >
            {/* Masked internal container for blur circle */}
            <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
              <div className="absolute -top-10 -right-10 w-28 h-28 bg-primary/5 rounded-full filter blur-2xl group-hover:bg-primary/10 transition-colors" />
            </div>

            {/* Premium Corner Brackets matching website branding theme (diagonal top-right and bottom-left layout) */}
            <div className="absolute -top-1.5 -right-1.5 w-12 h-12 border-t-[4px] border-r-[4px] border-primary rounded-tr-3xl pointer-events-none transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:scale-105" />
            <div className="absolute -bottom-1.5 -left-1.5 w-12 h-12 border-b-[4px] border-l-[4px] border-primary rounded-bl-3xl pointer-events-none transition-transform duration-300 group-hover:-translate-x-1 group-hover:translate-y-1 group-hover:scale-105" />

            <span className="text-[10px] font-extrabold text-primary uppercase tracking-widest bg-primary/10 px-2.5 py-1 rounded-md">
              Our Mission
            </span>
            <h3 className="text-2xl font-black font-heading text-app-text mt-4 mb-3 leading-snug">
              Simplifying Core Digital Processes
            </h3>
            <p className="text-xs md:text-sm text-app-text-muted leading-relaxed">
              To deliver innovative, result-driven solutions using modern technologies that simplify business processes, enhance productivity, and maximize client profitability with zero compromises.
            </p>
          </motion.div>

        </div>

        {/* Why Choose Us Block (Staggered items slide on scroll) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center mb-12 text-left">
          
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={scrollFadeLeft}
            className="lg:col-span-5 space-y-4"
          >
            <span className="text-[10px] font-extrabold text-primary uppercase tracking-widest bg-primary/10 px-2.5 py-1 rounded-md">
              Our Edge
            </span>
            <h2 className="text-2xl md:text-3xl font-black font-heading text-app-text leading-tight">
              Why Scaled Brands Trust Vedhunt InfoTech
            </h2>
            <p className="text-xs text-app-text-muted leading-relaxed">
              We eliminate technical bottlenecks by uniting engineering precision, marketing strategy, and transparent reporting systems under one single cohesive roof.
            </p>
          </motion.div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={staggerContainer}
            className="lg:col-span-7 flex flex-col relative w-full"
          >
            {[
              { step: '01', title: 'End-to-End Ownership', desc: 'From wireframes and strategic plans to high-availability production deployments.' },
              { step: '02', title: 'Dedicated Domain Experts', desc: 'Seniors and principal architects leading app design, automation, and bookkeeping.' },
              { step: '03', title: '100% Tailored Strategies', desc: 'No cookie-cutter templates. Custom digital models to solve your explicit bottlenecks.' },
              { step: '04', title: 'Ethical Digital Practices', desc: 'Absolute compliance, semantic code structure, and honest metric-supported dashboards.' }
            ].map((box, bidx) => {
              // Staircase horizontal offsets for desktop, staggering left to use left-side space
              const mlClass = bidx === 0 ? 'lg:ml-72' : bidx === 1 ? 'lg:ml-48' : bidx === 2 ? 'lg:ml-24' : 'ml-0';
              const zIndexClass = bidx === 0 ? 'z-10' : bidx === 1 ? 'z-20' : bidx === 2 ? 'z-30' : 'z-40';
              
              return (
                <motion.div 
                  key={bidx} 
                  variants={scrollFadeUp}
                  className={`relative glass-panel bg-app-card/95 backdrop-blur-md border border-app-border rounded-2xl p-4 md:p-5 shadow-lg hover:border-primary/30 transition-all duration-300 hover:shadow-[0_15px_30px_rgba(255,107,0,0.12)] hover:z-50 w-full max-w-[480px] ${mlClass} ${zIndexClass} group`}
                  style={{ 
                    marginTop: bidx > 0 ? '-20px' : '0px',
                  }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 text-left">
                      <h4 className="text-xs md:text-sm font-extrabold text-app-text font-heading flex items-center gap-2 group-hover:text-primary transition-colors">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                        <span>{box.title}</span>
                      </h4>
                      <p className="text-[10px] md:text-[11px] text-app-text-muted leading-relaxed max-w-[380px]">
                        {box.desc}
                      </p>
                    </div>

                    {/* Step tag watermark */}
                    <div className="text-2xl font-black font-heading text-primary/10 select-none group-hover:text-primary/25 group-hover:scale-105 transition-all duration-300">
                      {box.step}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>

        </div>



      </div>
    </div>
  );
}
