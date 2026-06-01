import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import api from '../services/api';
import PricingCard from '../components/services/PricingCard';
import PricingCardSkeleton from '../components/skeletons/PricingCardSkeleton';
import EmptyState from '../components/ui/EmptyState';

export default function Pricing() {
  const [activeCategoryId, setActiveCategoryId] = useState('all');

  // Fetch Pricing Categories
  const { data: categoriesData, isLoading: categoriesLoading } = useQuery({
    queryKey: ['pricingCategories', 'public'],
    queryFn: async () => {
      const res = await api.get('/pricing/categories');
      return res.data.data;
    }
  });

  // Fetch Pricing Plans
  const { data: plansData, isLoading: plansLoading } = useQuery({
    queryKey: ['pricingPlans', 'public'],
    queryFn: async () => {
      const res = await api.get('/pricing');
      return res.data.data;
    }
  });

  const categories = useMemo(() => {
    const defaultCategories = [{ _id: 'all', name: 'All Services', seo: { metaTitle: 'All Services Pricing | Vedhunt', metaDescription: 'Explore our premium digital engineering pricing.' } }];
    return categoriesData ? [...defaultCategories, ...categoriesData] : defaultCategories;
  }, [categoriesData]);

  const filteredPlans = useMemo(() => {
    if (!plansData) return [];
    if (activeCategoryId === 'all') return plansData;
    return plansData.filter(plan => plan.category?._id === activeCategoryId);
  }, [plansData, activeCategoryId]);

  const activeCategory = categories.find(c => c._id === activeCategoryId) || categories[0];
  
  // Set SEO based on active category
  const metaTitle = activeCategory?.seo?.metaTitle || 'Pricing | Vedhunt';
  const metaDescription = activeCategory?.seo?.metaDescription || 'Transparent and competitive pricing for all premium digital engineering services.';
  const keywords = activeCategory?.seo?.keywords?.join(', ') || 'Pricing, Web Development Cost, Mobile App Pricing, SEO Pricing';

  return (
    <>
      <Helmet>
        <title>{metaTitle}</title>
        <meta name="description" content={metaDescription} />
        <meta name="keywords" content={keywords} />
        {/* Open Graph Meta Tags */}
        <meta property="og:title" content={metaTitle} />
        <meta property="og:description" content={metaDescription} />
      </Helmet>
      
      <div className="min-h-screen bg-app-bg text-app-text relative pt-36 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        
        {/* Universal Floating Mesh Backdrop */}
        <div className="absolute inset-0 mesh-grid opacity-35 pointer-events-none z-0" />

        {/* Decorative Orbs */}
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-primary/5 rounded-full filter blur-[150px] pointer-events-none z-0" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-primary/4 rounded-full filter blur-[150px] pointer-events-none z-0" />

        <div className="max-w-6xl mx-auto relative z-10 space-y-16">
          
          {/* Header Section */}
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <motion.span 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center text-primary text-[10px] font-black uppercase tracking-widest bg-primary/10 border border-primary/20 px-3 py-1 rounded-full"
            >
              Transparent & Economical
            </motion.span>
            
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-4xl md:text-5xl font-black font-heading text-app-text tracking-tight"
            >
              All Services <span className="text-primary text-gradient-orange">Pricing</span>
            </motion.h1>

            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-sm md:text-base text-app-text-muted leading-relaxed"
            >
              {activeCategory?._id === 'all' 
                ? 'Explore our comprehensive, premium service packages. We deliver elite digital engineering, creative branding, and automated financial intelligence at highly competitive, business-friendly price structures.'
                : activeCategory?.description || 'Explore competitive and premium packages for this service.'
              }
            </motion.p>
          </div>

          {/* Category Filter Tabs */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="w-max max-w-full mx-auto bg-app-card/60 backdrop-blur-md border border-app-border rounded-full shadow-lg relative px-1 sm:px-2"
          >
            <div className="flex flex-nowrap items-center justify-start gap-1 sm:gap-2 p-1 sm:p-1.5 overflow-x-auto snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {categoriesLoading ? (
                <div className="px-5 py-2 text-sm text-gray-400">Loading categories...</div>
              ) : (
                categories.map(category => (
                  <button
                    key={category._id}
                    onClick={() => setActiveCategoryId(category._id)}
                    className={`px-4 sm:px-5 py-2.5 sm:py-2 rounded-full text-[11px] sm:text-xs font-bold tracking-wider transition-all duration-300 cursor-pointer whitespace-nowrap shrink-0 snap-center ${
                      activeCategoryId === category._id
                        ? 'bg-primary text-black shadow-[0_0_20px_rgba(232,71,10,0.4)]'
                        : 'text-app-text-muted hover:text-app-text hover:bg-white/5'
                    }`}
                  >
                    {category.name}
                  </button>
                ))
              )}
            </div>
          </motion.div>

          {/* Pricing Cards Grid */}
          <AnimatePresence mode="wait">
            <motion.div 
              key={activeCategoryId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-stretch"
            >
              {plansLoading ? (
                [1, 2, 3].map(n => <PricingCardSkeleton key={n} />)
              ) : filteredPlans.length > 0 ? (
                filteredPlans.map((plan) => (
                  <PricingCard key={plan._id} plan={plan} categoryIcon={plan.category?.icon || 'web'} />
                ))
              ) : (
                <EmptyState 
                  message="No pricing plans found." 
                  subMessage="We are currently updating our packages for this category. Please check back later or contact us for a custom quote."
                />
              )}
            </motion.div>
          </AnimatePresence>

          {/* Custom Requirements Banner */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="relative overflow-hidden rounded-[2.5rem] bg-primary dark:bg-app-card border border-black/10 dark:border-white/10 px-6 py-10 md:py-14 text-center shadow-2xl max-w-5xl mx-auto"
          >
            {/* Subtle Ambient Glowing Wave Background */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-30 z-0" viewBox="0 0 1200 400" fill="none" xmlns="http://www.w3.org/2000/svg">
              <g filter="url(#glow-blur)">
                <path d="M-100 350 C 100 220, 200 50, 450 160 C 700 270, 850 360, 1300 230" stroke="url(#gradient-glow)" strokeWidth="8" strokeLinecap="round" />
                <path d="M-100 250 C 150 120, 320 310, 550 190 C 780 70, 950 140, 1300 90" stroke="url(#gradient-glow-2)" strokeWidth="4" strokeLinecap="round" opacity="0.7" />
              </g>
              <defs>
                <filter id="glow-blur" x="-20%" y="-20%" width="140%" height="140%" filterUnits="userSpaceOnUse">
                  <feGaussianBlur stdDeviation="30" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <linearGradient id="gradient-glow" x1="0%" y1="50%" x2="100%" y2="50%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
                  <stop offset="30%" stopColor="#E8470A" stopOpacity="0.4" />
                  <stop offset="70%" stopColor="#3b82f6" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#000000" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="gradient-glow-2" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.6" />
                  <stop offset="50%" stopColor="#E8470A" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#000000" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>

            {/* Radial ambient glow orbs */}
            <div className="absolute top-1/2 left-1/4 -translate-y-1/2 -translate-x-1/2 w-80 h-80 bg-primary/10 rounded-full filter blur-[120px] pointer-events-none z-0" />
            <div className="absolute top-1/2 right-1/4 -translate-y-1/2 translate-x-1/2 w-80 h-80 bg-blue-500/5 rounded-full filter blur-[120px] pointer-events-none z-0" />

            <div className="relative z-10 max-w-3xl mx-auto space-y-5">
              {/* Typography Section */}
              <div className="space-y-2">
                <h3 className="text-3xl md:text-5xl font-black font-heading text-black dark:text-white tracking-tight leading-tight">
                  Need a Custom Enterprise Solution?
                </h3>
                <span className="font-signature text-3xl md:text-5xl text-black/90 dark:text-white/90 font-normal tracking-wide block leading-none pt-1">
                  Like really, really custom.
                </span>
              </div>

              {/* Bullets Section / Features Row */}
              <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 text-black/90 dark:text-white/90 text-sm md:text-[15px] font-medium py-1 md:py-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center justify-center w-5 h-5 rounded-full bg-black/10 dark:bg-white/10 border border-black/20 dark:border-white/20 text-black dark:text-white shrink-0">
                    <svg className="w-3 h-3 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span>Multi-Service Integration</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center justify-center w-5 h-5 rounded-full bg-black/10 dark:bg-white/10 border border-black/20 dark:border-white/20 text-black dark:text-white shrink-0">
                    <svg className="w-3 h-3 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span>Custom SLA Agreements</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center justify-center w-5 h-5 rounded-full bg-black/10 dark:bg-white/10 border border-black/20 dark:border-white/20 text-black dark:text-white shrink-0">
                    <svg className="w-3 h-3 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span>Dedicated Offshore Teams</span>
                </div>
              </div>

              {/* Button Section */}
              <div className="pt-1">
                <Link
                  to="/get-quote"
                  className="inline-flex items-center gap-3 px-8 py-3.5 rounded-full bg-black dark:bg-[#E8470A] hover:bg-gray-800 dark:hover:bg-[#D63D08] text-white font-extrabold text-xs uppercase tracking-widest transition-all duration-300 shadow-[0_12px_30px_rgba(0,0,0,0.35)] dark:shadow-[0_12px_30px_rgba(232,71,10,0.35)] hover:-translate-y-1 active:translate-y-0"
                >
                  <span>Request Custom Estimate</span>
                  <svg className="w-4 h-4 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </Link>
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </>
  );
}
