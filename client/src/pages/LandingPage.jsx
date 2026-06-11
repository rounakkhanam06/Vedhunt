import { useEffect, useState } from 'react';
import { useParams, Navigate, useNavigate } from 'react-router-dom';
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
import api from '../services/api';

export default function LandingPage() {
  const { slug } = useParams();
  const pageData = LANDING_PAGES_CONFIG[slug];
  
  const [isSubmitSuccess, setIsSubmitSuccess] = useState(false);
  const { register, handleSubmit, formState: { errors }, reset } = useForm();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [pricingData, setPricingData] = useState(null);
  const [loadingPricing, setLoadingPricing] = useState(true);

  const [testimonials, setTestimonials] = useState([]);
  const [loadingTestimonials, setLoadingTestimonials] = useState(true);

  useEffect(() => {
    const fetchPricing = async () => {
      try {
        const response = await api.get(`/home-pricing?slug=${slug}`);
        if (response.data.success && response.data.data.length > 0) {
          setPricingData(response.data.data[0]);
        }
      } catch (error) {
        console.error('Error fetching pricing:', error);
      } finally {
        setLoadingPricing(false);
      }
    };
    fetchPricing();
  }, [slug]);

  useEffect(() => {
    const fetchTestimonials = async () => {
      try {
        const response = await api.get(`/testimonials/approved?page=${slug}`);
        if (response.data.success) {
          setTestimonials(response.data.data);
        }
      } catch (error) {
        console.error('Error fetching testimonials:', error);
      } finally {
        setLoadingTestimonials(false);
      }
    };
    fetchTestimonials();
  }, [slug]);

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

  const onSubmitForm = async (data) => {
    setIsSubmitting(true);
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const payload = {
        fullName: data.name,
        phone: data.phone,
        email: data.email,
        service: data.service,
        businessName: data.businessName,
        message: data.message,
        consent: data.consent,
        source: window.location.href,
        platform: 'Website',
        utmSource: urlParams.get('utm_source') || '',
        utmMedium: urlParams.get('utm_medium') || '',
        utmCampaign: urlParams.get('utm_campaign') || '',
        utmContent: urlParams.get('utm_content') || '',
        utmTerm: urlParams.get('utm_term') || ''
      };
      
      const res = await api.post('/leads', payload);
      if (res.data.success) {
        setIsSubmitSuccess(true);
        reset();
        
        // Trigger tracking
        if (window.trackConversion) {
          window.trackConversion({
            value: 0,
            currency: 'INR',
            service: data.service,
            source: 'Landing Page Form'
          });
        }
        
        if (window.fbq) {
          window.fbq('track', 'Lead', {
            content_name: data.service,
            currency: 'INR',
            value: 0
          });
        }
        
        navigate('/thank-you');
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      alert('Failed to submit form. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
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
      {pricingData ? (
        <section className="py-20 px-4 max-w-5xl mx-auto text-center">
          <h2 className="text-3xl font-black font-heading text-app-text mb-12">Flexible Plans for Every Stage</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {['starter', 'growth', 'enterprise'].map((tierKey, idx) => {
              const tier = pricingData.tiers[tierKey];
              const isPopular = idx === 1; // Assuming growth is popular, or we can use pricingData.popular
              return (
                <div key={tierKey} className={`p-8 rounded-2xl border flex flex-col ${isPopular ? 'border-primary bg-primary/5 relative' : 'border-app-border bg-app-card'}`}>
                  {isPopular && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary text-black text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                      Most Popular
                    </div>
                  )}
                  <h4 className="text-xl font-bold text-app-text mb-2 capitalize">{tierKey}</h4>
                  <div className="mb-6">
                    <span className="text-3xl font-black text-app-text">{tier.price}</span>
                    <span className="text-app-text-muted text-sm">{tier.period}</span>
                  </div>
                  
                  <ul className="text-left space-y-3 mb-8 flex-grow">
                    {tier.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <span className="text-sm text-app-text-muted leading-tight">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button 
                    onClick={() => document.getElementById('lp-form').scrollIntoView({ behavior: 'smooth' })}
                    className={`w-full py-3 rounded-full text-xs font-bold uppercase tracking-widest transition-colors ${isPopular ? 'bg-primary text-black hover:bg-primary-hover shadow-lg shadow-primary/20' : 'bg-app-bg text-app-text border border-app-border hover:border-primary/50'}`}
                  >
                    Get Quote
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      ) : !loadingPricing ? (
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
      ) : null}

      {/* 6. Social Proof */}
      {!loadingTestimonials && testimonials.length > 0 && (
        <section className="py-20 bg-app-card px-4 border-y border-app-border">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-black font-heading text-app-text text-center mb-12">What Our Clients Say</h2>
            <div className="grid md:grid-cols-2 gap-8">
              {testimonials.map((t) => (
                <div key={t._id} className="p-8 rounded-2xl bg-app-bg border border-app-border relative">
                  <div className="flex gap-1 text-primary mb-4">
                    {[1, 2, 3, 4, 5].map(i => <Star key={i} className="w-4 h-4 fill-current" />)}
                  </div>
                  <p className="text-sm text-app-text-muted italic mb-6">
                    "{t.quote}"
                  </p>
                  <div className="flex items-center gap-3">
                    {t.avatar ? (
                      <img src={t.avatar} alt={t.author} className="w-10 h-10 rounded-full object-cover border border-app-border" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                        {t.author.charAt(0)}
                      </div>
                    )}
                    <div>
                      <h5 className="text-sm font-bold text-app-text">{t.author}</h5>
                      <p className="text-[10px] text-app-text-muted uppercase tracking-wider">{t.role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

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
                  <label className="text-[10px] font-extrabold text-app-text-muted uppercase tracking-widest block">
                    Full Name <span className="text-primary">*</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-muted group-focus-within:text-primary transition-colors" />
                    <input 
                      type="text" 
                      placeholder="e.g. Rahul Sharma"
                      className="w-full bg-transparent border-b-2 py-2 pl-7 text-app-text focus:outline-none focus:border-primary transition-colors text-sm font-bold placeholder:text-app-text-muted/50 border-app-border"
                      {...register('name', { required: true })}
                    />
                  </div>
                </div>
                <div className="space-y-1.5 relative group">
                  <label className="text-[10px] font-extrabold text-app-text-muted uppercase tracking-widest block">
                    Phone Number <span className="text-primary">*</span>
                  </label>
                  <div className="relative flex items-center border-b-2 border-app-border focus-within:border-primary transition-colors">
                    <div className="flex items-center gap-1 pl-2 text-sm text-app-text-muted pr-2 border-r border-app-border">
                      <span className="text-lg leading-none">🇮🇳</span>
                      <span className="font-bold">+91</span>
                    </div>
                    <input 
                      type="tel" 
                      placeholder="98765 43210"
                      className="w-full bg-transparent py-2 pl-3 text-app-text focus:outline-none text-sm font-bold placeholder:text-app-text-muted/50"
                      {...register('phone', { required: true, pattern: /^[0-9]{10}$/ })}
                    />
                  </div>
                  {errors.phone && <span className="text-[10px] text-red-500">Please enter a valid 10-digit number</span>}
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-1.5 relative group">
                  <label className="text-[10px] font-extrabold text-app-text-muted uppercase tracking-widest block">
                    Email Address <span className="text-primary">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-muted group-focus-within:text-primary transition-colors" />
                    <input 
                      type="email" 
                      placeholder="e.g. rahul@example.com"
                      className="w-full bg-transparent border-b-2 py-2 pl-7 text-app-text focus:outline-none focus:border-primary transition-colors text-sm font-bold placeholder:text-app-text-muted/50 border-app-border"
                      {...register('email', { required: true })}
                    />
                  </div>
                </div>

                <div className="space-y-1.5 relative group">
                  <label className="text-[10px] font-extrabold text-app-text-muted uppercase tracking-widest block">
                    Business Name (Optional)
                  </label>
                  <div className="relative">
                    <Briefcase className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-muted group-focus-within:text-primary transition-colors" />
                    <input 
                      type="text" 
                      placeholder="e.g. TechNova Solutions"
                      className="w-full bg-transparent border-b-2 py-2 pl-7 text-app-text focus:outline-none focus:border-primary transition-colors text-sm font-bold placeholder:text-app-text-muted/50 border-app-border"
                      {...register('businessName')}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 relative group">
                <label className="text-[10px] font-extrabold text-app-text-muted uppercase tracking-widest block">
                  Service Needed
                </label>
                <div className="relative">
                  <Briefcase className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-muted group-focus-within:text-primary transition-colors" />
                  <input 
                    type="text" 
                    defaultValue={pageData.title.split(' ')[0] + " Service"}
                    className="w-full bg-transparent border-b-2 py-2 pl-7 text-app-text focus:outline-none focus:border-primary transition-colors text-sm font-bold placeholder:text-app-text-muted/50 border-app-border"
                    {...register('service')}
                  />
                </div>
              </div>

              <div className="space-y-1.5 relative group">
                <label className="text-[10px] font-extrabold text-app-text-muted uppercase tracking-widest block">
                  Message (Optional)
                </label>
                <div className="relative">
                  <FileText className="absolute left-0 top-3 w-4 h-4 text-app-text-muted group-focus-within:text-primary transition-colors" />
                  <textarea 
                    rows="2"
                    placeholder="Briefly explain what you're looking for..."
                    className="w-full bg-transparent border-b-2 py-2 pl-7 text-app-text focus:outline-none focus:border-primary transition-all resize-none text-sm font-bold placeholder:text-app-text-muted/50 border-app-border"
                    {...register('message')}
                  />
                </div>
              </div>

              <div className="flex items-start gap-2 mt-4">
                <input 
                  type="checkbox" 
                  id="consent" 
                  className="mt-1 accent-primary"
                  {...register('consent', { required: true })}
                />
                <label htmlFor="consent" className="text-xs text-app-text-muted">
                  I agree to be contacted by Vedhunt InfoTech regarding my inquiry.
                </label>
              </div>
              {errors.consent && <span className="text-[10px] text-red-500">You must agree to be contacted.</span>}

              <button 
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-primary hover:bg-primary-hover text-black font-extrabold text-xs uppercase tracking-widest rounded-full transition-all duration-300 shadow-[0_10px_25px_rgba(232,71,10,0.22)] hover:shadow-[0_12px_35px_rgba(232,71,10,0.45)] hover:-translate-y-0.5 mt-8 flex items-center justify-center gap-2 disabled:opacity-70 disabled:hover:-translate-y-0"
              >
                <span>{isSubmitting ? 'Submitting...' : pageData.primaryCta}</span>
                {!isSubmitting && <ArrowRight className="w-4 h-4" />}
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
