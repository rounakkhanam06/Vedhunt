import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Phone, 
  Mail, 
  ArrowRight, 
  AlertCircle, 
  MapPin, 
  Smartphone, 
  CheckCircle2 
} from 'lucide-react';
import { CONTACT_INFO } from '../constants';

// Inline premium custom SVG brand icons replacing removed brand icons in Lucide-React
const FacebookIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
);

const TwitterIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
  </svg>
);

const LinkedinIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect width="4" height="12" x="2" y="9" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);

export default function Contact() {
  const [isSubmitSuccess, setIsSubmitSuccess] = useState(false);
  const [submittedData, setSubmittedData] = useState(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm({
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      message: ''
    }
  });

  const onSubmitForm = (data) => {
    setSubmittedData(data);
    setIsSubmitSuccess(true);
    reset();
  };

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

  return (
    <div className="min-h-screen bg-app-bg text-app-text relative py-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
      
      {/* Universal Floating Particles Grid Backdrop */}
      <div className="absolute inset-0 mesh-grid opacity-35 pointer-events-none z-0" />

      {/* Decorative Orbs */}
      <div className="absolute -top-20 -left-20 w-[450px] h-[450px] bg-primary/5 rounded-full filter blur-[150px] pointer-events-none z-0" />
      <div className="absolute -bottom-40 right-20 w-96 h-96 bg-primary/4 rounded-full filter blur-[150px] pointer-events-none z-0" />

      <div className="max-w-6xl mx-auto relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-24 items-center">
          
          {/* Left Column: Contact Form with Minimalist Bottom-Border Inputs */}
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={staggerContainer}
            className="lg:col-span-6 space-y-10"
          >
            {/* Title Block */}
            <div className="space-y-4 text-left">
              <motion.span variants={scrollFadeUp} className="inline-flex items-center text-primary text-[10px] font-black uppercase tracking-widest bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded-full relative -translate-y-2">
                Get In Touch
              </motion.span>
              
              <motion.h1 
                variants={scrollFadeUp} 
                className="text-4xl md:text-5xl font-black font-heading text-app-text tracking-tight relative"
              >
                Contact
                <span className="absolute bottom-[-10px] left-0 w-16 h-[3px] bg-primary rounded-full" />
              </motion.h1>
            </div>

            <AnimatePresence mode="wait">
              {!isSubmitSuccess ? (
                <motion.form
                  key="contact-organic-form"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  onSubmit={handleSubmit(onSubmitForm)}
                  className="space-y-8"
                >
                  {/* First Name & Last Name (Side by Side) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                    {/* First Name */}
                    <div className="space-y-1.5 text-left relative group">
                      <label className="text-[10px] font-extrabold text-app-text-muted/70 uppercase tracking-widest block transition-colors group-focus-within:text-primary">
                        First Name <span className="text-primary">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Sruchan Kumar"
                        className={`w-full bg-transparent border-b-2 py-2.5 text-app-text focus:outline-none focus:border-primary transition-colors text-sm font-bold placeholder:text-app-text-muted/20 ${
                          errors.firstName ? 'border-red-500/50 focus:border-red-500' : 'border-app-border/70'
                        }`}
                        {...register('firstName', { required: 'First name is required' })}
                      />
                      {errors.firstName && (
                        <div className="flex items-center gap-1 text-[11px] text-red-500 mt-1 animate-pulse">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>{errors.firstName.message}</span>
                        </div>
                      )}
                    </div>

                    {/* Last Name */}
                    <div className="space-y-1.5 text-left relative group">
                      <label className="text-[10px] font-extrabold text-app-text-muted/70 uppercase tracking-widest block transition-colors group-focus-within:text-primary">
                        Last Name <span className="text-primary">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Polisetty"
                        className={`w-full bg-transparent border-b-2 py-2.5 text-app-text focus:outline-none focus:border-primary transition-colors text-sm font-bold placeholder:text-app-text-muted/20 ${
                          errors.lastName ? 'border-red-500/50 focus:border-red-500' : 'border-app-border/70'
                        }`}
                        {...register('lastName', { required: 'Last name is required' })}
                      />
                      {errors.lastName && (
                        <div className="flex items-center gap-1 text-[11px] text-red-500 mt-1 animate-pulse">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>{errors.lastName.message}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Email Address */}
                  <div className="space-y-1.5 text-left relative group">
                    <label className="text-[10px] font-extrabold text-app-text-muted/70 uppercase tracking-widest block transition-colors group-focus-within:text-primary">
                      Email Address <span className="text-primary">*</span>
                    </label>
                    <input
                      type="email"
                      placeholder="e.g. sruchan.polisetty@smscountry.com"
                      className={`w-full bg-transparent border-b-2 py-2.5 text-app-text focus:outline-none focus:border-primary transition-colors text-sm font-bold placeholder:text-app-text-muted/20 ${
                        errors.email ? 'border-red-500/50 focus:border-red-500' : 'border-app-border/70'
                      }`}
                      {...register('email', { 
                        required: 'Email address is required',
                        pattern: {
                          value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                          message: 'Please enter a valid email address'
                        }
                      })}
                    />
                    {errors.email && (
                      <div className="flex items-center gap-1 text-[11px] text-red-500 mt-1 animate-pulse">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>{errors.email.message}</span>
                      </div>
                    )}
                  </div>

                  {/* Phone Number */}
                  <div className="space-y-1.5 text-left relative group">
                    <label className="text-[10px] font-extrabold text-app-text-muted/70 uppercase tracking-widest block transition-colors group-focus-within:text-primary">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      placeholder="e.g. 915443428"
                      className={`w-full bg-transparent border-b-2 py-2.5 text-app-text focus:outline-none focus:border-primary transition-colors text-sm font-bold placeholder:text-app-text-muted/20 ${
                        errors.phone ? 'border-red-500/50 focus:border-red-500' : 'border-app-border/70'
                      }`}
                      {...register('phone', {
                        pattern: {
                          value: /^[+]?[0-9\s-]{8,15}$/,
                          message: 'Please enter a valid phone number'
                        }
                      })}
                    />
                    {errors.phone && (
                      <div className="flex items-center gap-1 text-[11px] text-red-500 mt-1 animate-pulse">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>{errors.phone.message}</span>
                      </div>
                    )}
                  </div>

                  {/* Questions or Comments */}
                  <div className="space-y-1.5 text-left relative group">
                    <label className="text-[10px] font-extrabold text-app-text-muted/70 uppercase tracking-widest block transition-colors group-focus-within:text-primary">
                      Questions or Comments <span className="text-primary">*</span>
                    </label>
                    <textarea
                      rows="3"
                      placeholder="Type your message here..."
                      className={`w-full bg-transparent border-b-2 py-2.5 text-app-text focus:outline-none focus:border-primary transition-all resize-none text-sm font-bold placeholder:text-app-text-muted/20 ${
                        errors.message ? 'border-red-500/50 focus:border-red-500' : 'border-app-border/70'
                      }`}
                      {...register('message', { required: 'Requirement message is required' })}
                    />
                    {errors.message && (
                      <div className="flex items-center gap-1 text-[11px] text-red-500 mt-1 animate-pulse">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>{errors.message.message}</span>
                      </div>
                    )}
                  </div>

                  {/* Pill-Shaped Organic Action Button with Nested Circle Icon */}
                  <div className="pt-4 text-left">
                    <button
                      type="submit"
                      className="relative inline-flex items-center justify-between pl-8 pr-2.5 py-2 bg-primary hover:bg-primary-hover text-black font-extrabold text-xs uppercase tracking-widest rounded-full transition-all duration-300 group shadow-[0_10px_25px_rgba(255,107,0,0.22)] hover:shadow-[0_12px_35px_rgba(255,107,0,0.45)] hover:-translate-y-0.5 cursor-pointer w-44"
                    >
                      <span className="font-extrabold">Submit</span>
                      <div className="w-8 h-8 rounded-full bg-black/10 flex items-center justify-center text-black group-hover:bg-black/20 transition-all duration-300">
                        <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                      </div>
                    </button>
                  </div>

                </motion.form>
              ) : (
                /* Interactive Success Overlay Card */
                <motion.div
                  key="contact-success-box"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="glass-panel rounded-3xl p-8 md:p-10 text-center space-y-6 flex flex-col items-center border border-primary/20 bg-app-card/85 shadow-2xl relative overflow-hidden"
                >
                  <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shadow-[0_0_35px_rgba(255,107,0,0.25)]">
                    <CheckCircle2 className="w-9 h-9 animate-bounce" />
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="text-xl md:text-2xl font-black font-heading text-app-text">Enquiry Submitted!</h3>
                    <p className="text-xs md:text-sm text-app-text-muted leading-relaxed max-w-sm">
                      Thank you for reaching out, <strong className="text-app-text">{submittedData?.firstName}</strong>. Our business engineering and finance analysts will review your query and respond in under 4 hours!
                    </p>
                  </div>

                  <div className="bg-app-bg border border-app-border rounded-xl p-4 text-left text-[11px] text-app-text-muted space-y-1.5 w-full max-w-xs font-sans">
                    <div className="text-primary font-black uppercase tracking-wider text-[9px] mb-1">Receipt Summary:</div>
                    <div><strong>Name:</strong> {submittedData?.firstName} {submittedData?.lastName}</div>
                    <div><strong>Email:</strong> {submittedData?.email}</div>
                    {submittedData?.phone && <div><strong>Phone:</strong> {submittedData?.phone}</div>}
                  </div>

                  <button
                    onClick={() => setIsSubmitSuccess(false)}
                    className="px-6 py-2.5 bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary hover:text-white rounded-full text-xs font-extrabold uppercase tracking-widest transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Submit New Inquiry</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

          </motion.div>

          {/* Right Column: Organic Floating Pebble Card inside Liquid Vector Wave */}
          <div className="lg:col-span-6 relative flex items-center justify-center min-h-[500px] w-full z-10 select-none">
            
            {/* Liquid Flowing Background Waves (SVG-Based with gradient brand themes) */}
            <svg 
              className="absolute inset-0 w-[125%] h-[125%] -translate-x-[10%] -translate-y-[10%] pointer-events-none z-0 opacity-90 dark:opacity-40" 
              viewBox="0 0 600 600" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                {/* Brand Primary Orange-to-Pink Fluid Gradient */}
                <linearGradient id="organicLiquidGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FF6B00" stopOpacity="0.9" />
                  <stop offset="65%" stopColor="#EA580C" stopOpacity="0.75" />
                  <stop offset="100%" stopColor="#9333EA" stopOpacity="0.9" /> {/* Elegant purple accent from reference */}
                </linearGradient>

                {/* Sub-Layer Soft Blue Gradient */}
                <linearGradient id="organicLiquidBack" x1="100%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#FF6B00" stopOpacity="0.1" />
                </linearGradient>
              </defs>

              {/* Background Fluid Blob */}
              <motion.path 
                d="M480,180 C540,280 500,420 380,480 C260,540 140,500 100,380 C60,260 120,140 240,100 C360,60 420,80 480,180 Z" 
                fill="url(#organicLiquidGrad)"
                animate={{
                  d: [
                    "M480,180 C540,280 500,420 380,480 C260,540 140,500 100,380 C60,260 120,140 240,100 C360,60 420,80 480,180 Z",
                    "M460,200 C520,310 520,390 400,460 C280,530 110,480 80,360 C50,240 140,120 260,90 C380,60 400,90 460,200 Z",
                    "M480,180 C540,280 500,420 380,480 C260,540 140,500 100,380 C60,260 120,140 240,100 C360,60 420,80 480,180 Z"
                  ]
                }}
                transition={{
                  duration: 8,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />

              {/* Back-layer fluid blob offset */}
              <motion.path 
                d="M430,150 C490,240 470,360 360,420 C250,480 150,440 110,330 C70,220 130,120 230,90 C330,60 370,60 430,150 Z" 
                fill="url(#organicLiquidBack)"
                animate={{
                  d: [
                    "M430,150 C490,240 470,360 360,420 C250,480 150,440 110,330 C70,220 130,120 230,90 C330,60 370,60 430,150 Z",
                    "M450,130 C510,220 450,380 340,440 C230,500 170,410 130,310 C90,210 110,140 210,110 C310,80 390,40 450,130 Z",
                    "M430,150 C490,240 470,360 360,420 C250,480 150,440 110,330 C70,220 130,120 230,90 C330,60 370,60 430,150 Z"
                  ]
                }}
                transition={{
                  duration: 12,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 0.5
                }}
              />

              {/* Floating circular decoration dot */}
              <motion.circle 
                cx="150" 
                cy="110" 
                r="22" 
                className="fill-primary/65 dark:fill-primary/45" 
                animate={{ y: [0, -12, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              />
            </svg>

            {/* Floating Glassmorphic Pebble-Shaped Contact Information Card */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-100px' }}
              variants={scrollFadeRight}
              animate={{ y: [0, -10, 0] }}
              transition={{
                y: { duration: 5, repeat: Infinity, ease: "easeInOut" },
                opacity: { duration: 0.5 },
                scale: { type: "spring", stiffness: 80 }
              }}
              className="relative z-10 w-full max-w-[440px] aspect-[4/5] bg-white text-zinc-900 rounded-[50%_40%_60%_40%_/_40%_60%_40%_60%] p-10 md:p-12 flex flex-col justify-center items-start shadow-3xl border border-white/60 dark:bg-zinc-950 dark:text-zinc-100 dark:border-zinc-800/80 hover:scale-[1.01] transition-transform duration-300"
            >
              
              {/* Pebble Card Header Block */}
              <div className="space-y-1 mb-8 text-left">
                <div className="w-12 h-[3px] bg-primary rounded-full mb-3" />
                <h3 className="text-3xl font-black font-heading tracking-wider uppercase text-zinc-950 dark:text-white leading-none">
                  VEDHUNT
                </h3>
              </div>

              {/* Content Address & direct Channels */}
              <div className="space-y-6 text-left w-full">
                
                {/* Physical Office Address */}
                <div className="flex gap-4 items-start">
                  <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                    <MapPin className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold font-sans text-zinc-800 dark:text-zinc-200 leading-relaxed">
                      Sector-11, Kopar Khairane,<br />
                      Navi Mumbai, Maharashtra,<br />
                      India - 400709
                    </p>
                  </div>
                </div>

                {/* Telephone Number */}
                <div className="flex gap-4 items-start">
                  <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                    <Smartphone className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <a 
                      href={`tel:${CONTACT_INFO.phone}`} 
                      className="text-sm font-black text-zinc-950 dark:text-white hover:text-primary transition-colors font-sans"
                    >
                      {CONTACT_INFO.phoneDisplay}
                    </a>
                  </div>
                </div>

                {/* Corporate Support Email */}
                <div className="flex gap-4 items-start">
                  <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                    <Mail className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <a 
                      href={`mailto:${CONTACT_INFO.email}`} 
                      className="text-sm font-black text-zinc-950 dark:text-white hover:text-primary transition-colors font-sans"
                    >
                      {CONTACT_INFO.email}
                    </a>
                  </div>
                </div>

              </div>

              {/* White Circular Social Media Icons (replicating reference perfectly) */}
              <div className="flex items-center gap-3.5 mt-10">
                {[
                  { icon: FacebookIcon, href: 'https://facebook.com' },
                  { icon: TwitterIcon, href: 'https://twitter.com' },
                  { icon: LinkedinIcon, href: 'https://linkedin.com' }
                ].map((social, idx) => (
                  <a 
                    key={idx}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`w-10 h-10 rounded-full bg-zinc-100 hover:bg-primary border border-zinc-200 hover:border-primary text-zinc-700 hover:text-black flex items-center justify-center shadow-md transition-all duration-300 hover:-translate-y-1 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-primary dark:hover:text-black ${
                      idx === 0 ? 'ml-3.5' : ''
                    }`}
                  >
                    <social.icon className="w-4 h-4" />
                  </a>
                ))}
              </div>

            </motion.div>
          </div>

        </div>
      </div>
    </div>
  );
}
