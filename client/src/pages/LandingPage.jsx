import { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import { 
  CheckCircle2, 
  ArrowRight, 
  Phone, 
  MessageCircle, 
  Star,
  Users,
  TrendingUp,
  Award,
  AlertCircle,
  User,
  Mail,
  Briefcase,
  FileText
} from 'lucide-react';
import { LANDING_PAGES_CONFIG } from '../constants/landingPages';

export default function LandingPage() {
  const { slug } = useParams();
  const pageData = LANDING_PAGES_CONFIG[slug];
  
  const [isSubmitSuccess, setIsSubmitSuccess] = useState(false);
  const { register, handleSubmit, formState: { errors }, reset } = useForm();

  // Inject noindex meta tag
  useEffect(() => {
    let meta = document.querySelector('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'robots';
      document.head.appendChild(meta);
    }
    meta.content = 'noindex, nofollow';

    return () => {
      // Cleanup if they navigate away to a normal page
      if (meta) {
        meta.content = 'index, follow';
      }
    };
  }, []);

  if (!pageData) {
    return <Navigate to="/404" replace />;
  }

  const onSubmitForm = (data) => {
    console.log("Mock Form Submitted to Excel Backend: ", data);
    // User requested front-end only right now, so we just mock the success state
    setIsSubmitSuccess(true);
    reset();
    setTimeout(() => {
      setIsSubmitSuccess(false);
    }, 5000);
  };

  return (
    <div className="w-full relative">
      
      {/* 1. Hero Section */}
      <section className="relative pt-16 pb-12 px-4 md:px-8 text-center max-w-5xl mx-auto">
        <div className="absolute inset-0 mesh-grid opacity-30 pointer-events-none -z-10" />
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-bold tracking-widest uppercase mb-4">
            Special Offer Limited Time
          </div>
          <h1 className="text-4xl md:text-6xl font-black font-heading leading-tight text-app-text">
            {pageData.title}
          </h1>
          <p className="text-lg md:text-xl text-app-text-muted max-w-3xl mx-auto">
            {pageData.subtitle}
          </p>
          <div className="pt-8">
            <button 
              onClick={() => document.getElementById('lp-form').scrollIntoView({ behavior: 'smooth' })}
              className="px-8 py-4 bg-primary hover:bg-primary-hover text-black font-extrabold text-sm uppercase tracking-widest rounded-full transition-all shadow-xl hover:-translate-y-1 flex items-center gap-2 mx-auto"
            >
              {pageData.primaryCta} <ArrowRight className="w-5 h-5" />
            </button>
            <p className="text-[10px] text-app-text-muted mt-3 uppercase tracking-widest">No Credit Card Required</p>
          </div>
        </motion.div>
      </section>

      {/* 2. Trust Signals */}
      <section className="py-8 border-y border-app-border bg-app-card/50">
        <div className="max-w-6xl mx-auto px-4 flex flex-wrap justify-center gap-8 md:gap-16 opacity-70">
          <div className="flex items-center gap-2 text-sm font-bold text-app-text">
            <Users className="w-5 h-5 text-primary" /> 50+ Enterprise Clients
          </div>
          <div className="flex items-center gap-2 text-sm font-bold text-app-text">
            <Award className="w-5 h-5 text-primary" /> Google & Meta Partner
          </div>
          <div className="flex items-center gap-2 text-sm font-bold text-app-text">
            <TrendingUp className="w-5 h-5 text-primary" /> 100% ROI Focused
          </div>
        </div>
      </section>

      {/* 3. Problem -> Solution Section */}
      <section className="py-20 px-4 max-w-5xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="space-y-4"
          >
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-6">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-2xl font-bold text-app-text">The Problem</h3>
            <p className="text-app-text-muted leading-relaxed">{pageData.problem}</p>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="space-y-4 glass-panel p-8 rounded-3xl border border-primary/20 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-primary/5" />
            <div className="relative">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-6">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold text-app-text">The Vedhunt Solution</h3>
              <p className="text-app-text-muted leading-relaxed">{pageData.solution}</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 4. Service Highlights */}
      <section className="py-20 bg-app-card px-4 border-y border-app-border">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-black font-heading text-app-text">Why Choose Us?</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {pageData.highlights.map((highlight, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="bg-app-bg p-8 rounded-2xl border border-app-border hover:border-primary/50 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <h4 className="text-lg font-bold text-app-text mb-2">{highlight.title}</h4>
                <p className="text-sm text-app-text-muted leading-relaxed">{highlight.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Pricing Summary */}
      <section className="py-20 px-4 max-w-5xl mx-auto text-center">
        <h2 className="text-3xl font-black font-heading text-app-text mb-12">Flexible Plans for Every Stage</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {['Starter', 'Growth', 'Enterprise'].map((tier, idx) => (
            <div key={idx} className={`p-8 rounded-2xl border ${idx === 1 ? 'border-primary bg-primary/5 relative' : 'border-app-border bg-app-card'}`}>
              {idx === 1 && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary text-black text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                  Most Popular
                </div>
              )}
              <h4 className="text-xl font-bold text-app-text mb-2">{tier}</h4>
              <p className="text-xs text-app-text-muted mb-6">Perfect for scaling businesses.</p>
              <button 
                onClick={() => document.getElementById('lp-form').scrollIntoView({ behavior: 'smooth' })}
                className={`w-full py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-colors ${idx === 1 ? 'bg-primary text-black hover:bg-primary-hover' : 'bg-app-bg text-app-text border border-app-border hover:border-primary/50'}`}
              >
                Get Quote
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* 6. Social Proof */}
      <section className="py-20 bg-app-card px-4 border-y border-app-border">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-black font-heading text-app-text text-center mb-12">What Our Clients Say</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="p-8 rounded-2xl bg-app-bg border border-app-border relative">
              <div className="flex gap-1 text-primary mb-4">
                {[1,2,3,4,5].map(i => <Star key={i} className="w-4 h-4 fill-current" />)}
              </div>
              <p className="text-sm text-app-text-muted italic mb-6">
                "Vedhunt completely transformed our digital presence. Within 3 months, our inbound leads doubled, and the quality of the new website is unmatched."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20" />
                <div>
                  <h5 className="text-sm font-bold text-app-text">Rahul Desai</h5>
                  <p className="text-[10px] text-app-text-muted uppercase">CEO, TechNova</p>
                </div>
              </div>
            </div>
            <div className="p-8 rounded-2xl bg-app-bg border border-app-border relative">
              <div className="flex gap-1 text-primary mb-4">
                {[1,2,3,4,5].map(i => <Star key={i} className="w-4 h-4 fill-current" />)}
              </div>
              <p className="text-sm text-app-text-muted italic mb-6">
                "Their attention to detail and data-driven approach to marketing helped us lower our customer acquisition cost by 40%. Highly recommended."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20" />
                <div>
                  <h5 className="text-sm font-bold text-app-text">Priya Sharma</h5>
                  <p className="text-[10px] text-app-text-muted uppercase">Founder, Bloom Retail</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Lead Capture Form */}
      <section id="lp-form" className="py-24 px-4 max-w-3xl mx-auto relative">
        <div className="absolute inset-0 bg-primary/5 filter blur-[100px] rounded-full -z-10" />
        <div className="glass-panel p-8 md:p-12 rounded-3xl border border-primary/20 text-center">
          <h2 className="text-3xl font-black font-heading text-app-text mb-4">Ready to Grow?</h2>
          <p className="text-sm text-app-text-muted mb-8">Fill out the form below and our experts will contact you within 24 hours.</p>

          {isSubmitSuccess ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-12 flex flex-col items-center gap-4"
            >
              <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-app-text">Request Received!</h3>
              <p className="text-app-text-muted">We will be in touch shortly.</p>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-6 text-left">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-1.5 relative group">
                  <label className="text-[10px] font-extrabold text-app-text-muted/70 uppercase tracking-widest block">
                    Full Name <span className="text-primary">*</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-muted/50 group-focus-within:text-primary transition-colors" />
                    <input 
                      type="text" 
                      placeholder="e.g. Rahul Sharma"
                      className="w-full bg-transparent border-b-2 py-2 pl-7 text-app-text focus:outline-none focus:border-primary transition-colors text-sm font-bold placeholder:text-app-text-muted/20 border-app-border/70"
                      {...register('name', { required: true })}
                    />
                  </div>
                </div>
                <div className="space-y-1.5 relative group">
                  <label className="text-[10px] font-extrabold text-app-text-muted/70 uppercase tracking-widest block">
                    Phone Number <span className="text-primary">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-muted/50 group-focus-within:text-primary transition-colors" />
                    <input 
                      type="tel" 
                      placeholder="e.g. +91 98765 43210"
                      className="w-full bg-transparent border-b-2 py-2 pl-7 text-app-text focus:outline-none focus:border-primary transition-colors text-sm font-bold placeholder:text-app-text-muted/20 border-app-border/70"
                      {...register('phone', { required: true })}
                    />
                  </div>
                </div>
              </div>
              
              <div className="space-y-1.5 relative group">
                <label className="text-[10px] font-extrabold text-app-text-muted/70 uppercase tracking-widest block">
                  Email Address <span className="text-primary">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-muted/50 group-focus-within:text-primary transition-colors" />
                  <input 
                    type="email" 
                    placeholder="e.g. rahul@example.com"
                    className="w-full bg-transparent border-b-2 py-2 pl-7 text-app-text focus:outline-none focus:border-primary transition-colors text-sm font-bold placeholder:text-app-text-muted/20 border-app-border/70"
                    {...register('email', { required: true })}
                  />
                </div>
              </div>

              <div className="space-y-1.5 relative group">
                <label className="text-[10px] font-extrabold text-app-text-muted/70 uppercase tracking-widest block">
                  Service Needed
                </label>
                <div className="relative">
                  <Briefcase className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-muted/50 group-focus-within:text-primary transition-colors" />
                  <input 
                    type="text" 
                    defaultValue={pageData.title.split(' ')[0] + " Service"}
                    className="w-full bg-transparent border-b-2 py-2 pl-7 text-app-text focus:outline-none focus:border-primary transition-colors text-sm font-bold placeholder:text-app-text-muted/20 border-app-border/70"
                    {...register('service')}
                  />
                </div>
              </div>

              <div className="space-y-1.5 relative group">
                <label className="text-[10px] font-extrabold text-app-text-muted/70 uppercase tracking-widest block">
                  Message (Optional)
                </label>
                <div className="relative">
                  <FileText className="absolute left-0 top-3 w-4 h-4 text-app-text-muted/50 group-focus-within:text-primary transition-colors" />
                  <textarea 
                    rows="2"
                    placeholder="Briefly explain what you're looking for..."
                    className="w-full bg-transparent border-b-2 py-2 pl-7 text-app-text focus:outline-none focus:border-primary transition-all resize-none text-sm font-bold placeholder:text-app-text-muted/20 border-app-border/70"
                    {...register('message')}
                  />
                </div>
              </div>

              <button 
                type="submit"
                className="w-full py-3 bg-primary hover:bg-primary-hover text-black font-extrabold text-xs uppercase tracking-widest rounded-full transition-all duration-300 shadow-[0_10px_25px_rgba(232,71,10,0.22)] hover:shadow-[0_12px_35px_rgba(232,71,10,0.45)] hover:-translate-y-0.5 mt-8 flex items-center justify-center gap-2"
              >
                <span>{pageData.primaryCta}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      </section>

      {/* 8. Sticky Mobile CTA Bar */}
      <div className="md:hidden fixed bottom-0 left-0 w-full bg-app-card border-t border-app-border p-3 flex gap-3 z-50">
        <a 
          href="tel:+919876543210"
          className="flex-1 flex justify-center items-center gap-2 py-3 bg-app-bg border border-app-border rounded-lg text-app-text text-sm font-bold"
        >
          <Phone className="w-4 h-4" /> Call
        </a>
        <a 
          href="https://wa.me/919876543210"
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex justify-center items-center gap-2 py-3 bg-[#25D366] text-white rounded-lg text-sm font-bold"
        >
          <MessageCircle className="w-4 h-4" /> WhatsApp
        </a>
      </div>

    </div>
  );
}
