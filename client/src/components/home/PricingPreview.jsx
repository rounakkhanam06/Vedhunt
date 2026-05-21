import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Check, ArrowRight, Laptop, Share2, TrendingUp } from 'lucide-react';

const serviceCategories = [
  {
    title: "Website Development",
    icon: Laptop,
    description: "High-performance web applications & corporate sites.",
    color: "from-blue-500/20",
    popular: false,
    tiers: {
      starter: {
        price: "₹15K-30K",
        period: "",
        features: [
          "Single/Multi-page Landing Site", 
          "Mobile Responsive Design", 
          "Basic SEO Setup", 
          "1 Month Free Support"
        ]
      },
      growth: {
        price: "₹35K-75K",
        period: "",
        features: [
          "Custom UI/UX Design", 
          "CMS Integration (WordPress/Webflow)", 
          "Advanced Speed Optimization", 
          "3 Months Priority Support"
        ]
      },
      enterprise: {
        price: "₹80K+",
        period: "",
        features: [
          "Full Custom Web Application", 
          "MERN / Next.js Stack", 
          "Advanced Security & Scalability", 
          "Dedicated Support & Maintenance"
        ]
      }
    }
  },
  {
    title: "Social Media Management",
    icon: Share2,
    description: "Viral content strategies & brand authority building.",
    color: "from-primary/20",
    popular: true,
    tiers: {
      starter: {
        price: "₹6K",
        period: "/mo",
        features: [
          "12 High-Quality Posts/Reels", 
          "2 Platforms (IG + FB)", 
          "Basic Hashtag Strategy", 
          "Monthly Analytics Report"
        ]
      },
      growth: {
        price: "₹12K",
        period: "/mo",
        features: [
          "20 Posts/Reels + Stories", 
          "3 Platforms (IG + FB + LI)", 
          "Community Engagement", 
          "Bi-Weekly Strategy Review"
        ]
      },
      enterprise: {
        price: "₹22K+",
        period: "/mo",
        features: [
          "Daily Posts + Premium Reels", 
          "4+ Social Platforms", 
          "Influencer Strategy Setup", 
          "Dedicated Account Manager"
        ]
      }
    }
  },
  {
    title: "Performance Marketing",
    icon: TrendingUp,
    description: "KPI-driven paid ad campaigns for maximum ROI.",
    color: "from-purple-500/20",
    popular: false,
    tiers: {
      starter: {
        price: "₹8K",
        period: "/mo",
        features: [
          "Meta OR Google Ads Setup", 
          "Ad Copy & Creative Guidance", 
          "Basic Pixel/Tracking Setup", 
          "Monthly Performance Review"
        ]
      },
      growth: {
        price: "₹18K",
        period: "/mo",
        features: [
          "Meta AND Google Ads Setup", 
          "A/B Testing & Retargeting", 
          "Advanced Conversion Tracking", 
          "Bi-Weekly Optimization Calls"
        ]
      },
      enterprise: {
        price: "₹35K+",
        period: "/mo",
        features: [
          "Omnichannel Scaling Setup", 
          "Custom Funnel Optimization", 
          "High-Budget Scaling Strategy", 
          "Real-Time Dashboard Access"
        ]
      }
    }
  }
];

export default function PricingPreview() {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  // Track active tab for each card index (default all to 'starter')
  const [activeTabs, setActiveTabs] = useState({ 0: 'starter', 1: 'starter', 2: 'starter' });
  const scrollContainerRef = useRef(null);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    // Only auto-scroll on mobile where it's actually a scrollable row
    if (window.innerWidth >= 640) return; // sm breakpoint

    let intervalId;
    const startScroll = () => {
      intervalId = setInterval(() => {
        if (!container) return;
        const maxScrollLeft = container.scrollWidth - container.clientWidth;
        if (container.scrollLeft >= maxScrollLeft - 10) {
          container.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
          container.scrollBy({ left: container.clientWidth * 0.85, behavior: 'smooth' });
        }
      }, 3000); // 3 seconds per slide
    };

    startScroll();

    const stopScroll = () => clearInterval(intervalId);

    container.addEventListener('mouseenter', stopScroll);
    container.addEventListener('mouseleave', startScroll);
    container.addEventListener('touchstart', stopScroll, { passive: true });
    container.addEventListener('touchend', startScroll, { passive: true });

    return () => {
      clearInterval(intervalId);
      container.removeEventListener('mouseenter', stopScroll);
      container.removeEventListener('mouseleave', startScroll);
      container.removeEventListener('touchstart', stopScroll);
      container.removeEventListener('touchend', startScroll);
    };
  }, []);

  return (
    <section className="pt-10 pb-2 px-4 bg-app-bg relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1000px] h-[400px] bg-primary/5 blur-[120px] pointer-events-none rounded-full" />
      
      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* Header */}
        <div className="text-center mb-6 space-y-2">
          <motion.h2 
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl font-black font-heading text-app-text tracking-tight"
          >
            Flexible <span className="text-primary">Pricing Plans</span>
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-app-text-muted text-sm max-w-2xl mx-auto"
          >
            Premium solutions built to fit your budget.
          </motion.p>
        </div>

        {/* Pricing Cards Grid (Compact & Interactive) */}
        <div 
          ref={scrollContainerRef}
          className="flex sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 overflow-x-auto snap-x snap-mandatory pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        >
          {serviceCategories.map((card, index) => {
            const currentTier = card.tiers[activeTabs[index]];

            return (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                className={`relative rounded-2xl overflow-hidden transition-all duration-500 min-w-[85vw] sm:min-w-0 snap-center ${
                  card.popular 
                    ? 'border-primary/50 shadow-[0_0_25px_rgba(255,107,0,0.15)] bg-app-card' 
                    : 'border-app-border hover:border-primary/50 bg-app-card'
                } border backdrop-blur-xl group flex flex-col ${
                  index === 2 ? 'sm:col-span-2 lg:col-span-1' : ''
                }`}
              >
                {/* Highlight Glow on Hover */}
                <div 
                  className={`absolute inset-0 bg-gradient-to-b ${card.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none`}
                />

                {card.popular && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-primary text-black text-[9px] font-bold uppercase tracking-widest px-3 py-0.5 rounded-b-lg shadow-[0_4px_10px_rgba(255,107,0,0.3)] z-20">
                    Most Popular
                  </div>
                )}

                <div className="p-5 relative z-10 flex flex-col flex-grow">
                  
                  {/* Tier Icon & Title */}
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      card.popular ? 'bg-primary text-black shadow-lg shadow-primary/20' : 'bg-app-bg text-app-text-muted border border-app-border group-hover:border-primary group-hover:text-primary'
                    } transition-colors duration-300`}>
                      <card.icon size={16} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-app-text tracking-tight leading-tight">{card.title}</h3>
                    </div>
                  </div>

                  <p className="text-app-text-muted text-[11px] mb-3 leading-snug min-h-[30px]">
                    {card.description}
                  </p>

                  {/* Tabs Switcher (Starter | Growth | Enterprise) */}
                  <div className="flex bg-app-bg p-1 rounded-lg border border-app-border mb-4">
                    {['starter', 'growth', 'enterprise'].map((tabKey) => (
                      <button
                        key={tabKey}
                        onClick={() => setActiveTabs(prev => ({ ...prev, [index]: tabKey }))}
                        className={`flex-1 py-1 text-[9px] font-bold uppercase tracking-wider rounded-md transition-all duration-300 ${
                          activeTabs[index] === tabKey
                            ? card.popular 
                              ? 'bg-primary text-black shadow-md' 
                              : 'bg-app-card text-app-text shadow-md border border-app-border'
                            : 'text-app-text-muted hover:text-app-text'
                        }`}
                      >
                        {tabKey}
                      </button>
                    ))}
                  </div>

                  {/* Price Display */}
                  <div className="mb-4 flex items-baseline h-[32px] items-center">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={currentTier.price}
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        transition={{ duration: 0.2 }}
                        className="flex items-baseline"
                      >
                        <span className="text-2xl md:text-3xl font-black text-app-text tracking-tight">{currentTier.price}</span>
                        <span className="text-app-text-muted/60 text-[10px] font-medium ml-1">{currentTier.period}</span>
                      </motion.div>
                    </AnimatePresence>
                  </div>

                  {/* Divider */}
                  <div className="w-full h-px bg-app-border mb-4" />

                  {/* Features List */}
                  <ul className="space-y-2 mb-5 flex-grow">
                    {currentTier.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <div className={`mt-0.5 rounded-full p-0.5 ${card.popular ? 'bg-primary/20 text-primary' : 'bg-app-bg border border-app-border text-app-text-muted'} shrink-0`}>
                          <Check size={8} strokeWidth={3} />
                        </div>
                        <span className="text-[11px] font-medium text-app-text-muted leading-tight">
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA Button */}
                  <Link 
                    to="/pricing"
                    className={`w-full py-2.5 rounded-xl flex items-center justify-center gap-2 text-[11px] font-bold transition-all duration-300 ${
                      card.popular 
                        ? 'bg-primary text-black hover:bg-app-text hover:text-app-bg shadow-[0_0_15px_rgba(255,107,0,0.3)]' 
                        : 'bg-app-bg text-app-text hover:border-primary border border-app-border'
                    }`}
                  >
                    Get Started
                    <ArrowRight size={12} className={hoveredIndex === index ? 'translate-x-1 transition-transform' : 'transition-transform'} />
                  </Link>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Global CTA */}
        <div className="flex justify-center">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
          >
            <Link 
              to="/pricing"
              className="group relative inline-flex items-center justify-center px-8 py-3.5 text-xs font-bold text-app-text transition-all duration-300 bg-app-bg border border-app-border rounded-full hover:border-primary overflow-hidden"
            >
              <div className="absolute inset-0 flex h-full w-full justify-center [transform:skew(-12deg)_translateX(-100%)] group-hover:duration-1000 group-hover:[transform:skew(-12deg)_translateX(100%)]">
                <div className="relative h-full w-8 bg-app-border/40" />
              </div>
              <span className="relative z-10 flex items-center gap-2 uppercase tracking-wider">
                View All Pricing
                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </span>
            </Link>
          </motion.div>
        </div>

      </div>
    </section>
  );
}
