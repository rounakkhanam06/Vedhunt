import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PricingCard from '../components/services/PricingCard';

const ALL_PRICING_CATEGORIES = [
  { id: 'all', label: 'All Services' },
  { id: 'web', label: 'Web Development' },
  { id: 'app', label: 'Mobile Apps' },
  { id: 'branding', label: 'Branding & UI/UX' },
  { id: 'marketing', label: 'Marketing & SEO' },
  { id: 'finance', label: 'Accounting & BI' }
];

const ALL_PRICING_PLANS = [
  // Web Development
  {
    category: 'web',
    title: 'WordPress Website',
    tech: 'Elementor · WooCommerce · Responsive',
    price: '₹15,000+',
    features: [
      'Custom theme setup & design',
      'Elementor page builder',
      'WooCommerce support',
      'Responsive mobile layout',
      'SEO plugins support',
      'Contact forms integration',
      '2 rounds of revisions',
      'Delivery in 7–10 working days'
    ],
    highlight: false
  },
  {
    category: 'web',
    title: 'React / Framework Website',
    tech: 'Next.js · React · Tailwind · Custom CMS',
    price: '₹30,000+',
    features: [
      'Custom UI/UX design from scratch',
      'Built on React / Next.js',
      'SEO-friendly architecture',
      'Component-based scalable architecture',
      'Fully responsive design',
      'API integrations',
      'Admin panel / CMS',
      'Analytics setup',
      '3 rounds of revisions',
      'Delivery in 10–20 working days'
    ],
    highlight: true
  },
  {
    category: 'web',
    title: 'E-Commerce Custom Portal',
    tech: 'Next.js · Node.js · Advanced Payment Gateways',
    price: '₹50,000+',
    features: [
      'Custom multivendor / enterprise store',
      'Advanced filtering & search engines',
      'Multiple payment gateway integrations',
      'Inventory & order management CMS',
      'High-speed edge caching',
      'Automated email & SMS notifications',
      'Dedicated support & maintenance',
      'Delivery in 20–30 working days'
    ],
    highlight: false
  },

  // Mobile Apps
  {
    category: 'app',
    title: 'Cross-Platform Mobile App',
    tech: 'React Native / Flutter · iOS & Android',
    price: '₹60,000+',
    features: [
      'Single codebase for iOS & Android',
      'Custom intuitive UI/UX design',
      'REST API / GraphQL backend integration',
      'Real-time push notifications',
      'Social media logins & auth',
      'App Store & Google Play deployment',
      '3 months post-launch support'
    ],
    highlight: true
  },
  {
    category: 'app',
    title: 'Enterprise Native Application',
    tech: 'Swift · Kotlin · High Performance Native',
    price: '₹1,20,000+',
    features: [
      'Dedicated native iOS & Android apps',
      'Ultra-high performance & fluid micro-animations',
      'Offline storage & complex cloud syncing',
      'Advanced hardware integration (Camera/GPS/Biometrics)',
      'Bank-grade security encryption',
      'Dedicated project manager & architect',
      '6 months post-launch VIP support'
    ],
    highlight: false
  },

  // Branding & UI/UX
  {
    category: 'branding',
    title: 'Startup Brand Identity Kit',
    tech: 'Vector Logo · Typography · Color Guidelines',
    price: '₹15,000+',
    features: [
      '3 Custom vector logo concepts',
      'Primary & secondary color palette selection',
      'Typography & font pairing guidelines',
      'Business card & letterhead design',
      'Social media profile & cover banners',
      'Full copyright ownership & source files',
      'Delivery in 5–7 working days'
    ],
    highlight: false
  },
  {
    category: 'branding',
    title: 'Complete Enterprise UI/UX',
    tech: 'Figma Design System · Wireframing · Prototyping',
    price: '₹40,000+',
    features: [
      'Comprehensive user research & flow mapping',
      'High-fidelity interactive Figma prototypes',
      'Complete modular design system & token setup',
      'Developer-ready asset handoff',
      'Responsive desktop, tablet & mobile layouts',
      'Usability testing & 4 revision rounds',
      'Delivery in 15–20 working days'
    ],
    highlight: true
  },

  // Marketing & SEO
  {
    category: 'marketing',
    title: 'Local SEO & Organic Growth',
    tech: 'On-Page SEO · Backlinks · Google My Business',
    price: '₹15,000/mo',
    features: [
      'Comprehensive website technical SEO audit',
      'Targeted keyword research & mapping',
      'Google My Business optimization',
      'High-authority white-hat backlink building',
      'Monthly organic traffic & ranking reports',
      'Continuous on-page content optimization',
      'Dedicated SEO specialist'
    ],
    highlight: false
  },
  {
    category: 'marketing',
    title: 'Performance PPC & Social Ads',
    tech: 'Google Ads · Meta PPC · LinkedIn Scaling',
    price: '₹30,000/mo',
    features: [
      'Laser-targeted ad campaign strategy & setup',
      'High-converting ad creative design & copywriting',
      'Custom multi-channel retargeting funnels',
      'A/B testing & continuous conversion optimization',
      'Detailed bi-weekly ROI & ROAS audits',
      'Pixel tracking & advanced analytics setup',
      'Cancel anytime with 30-day notice'
    ],
    highlight: true
  },

  // Accounting & BI
  {
    category: 'finance',
    title: 'Outsource Bookkeeping & Tax',
    tech: 'GST · TDS · GAAP · Monthly Compliance',
    price: '₹15,000/mo',
    features: [
      'Dedicated professional accountant',
      'Monthly bank & ledger reconciliation',
      'GST computation & statutory tax filings',
      'Payroll processing & TDS compliance',
      'Monthly Profit & Loss and Balance Sheet reports',
      'Audit readiness & CA representation support',
      'Secure cloud accounting software setup'
    ],
    highlight: false
  },
  {
    category: 'finance',
    title: 'Custom Power BI & Automation',
    tech: 'Python ETL · SQL Warehousing · Power BI',
    price: '₹45,000+',
    features: [
      'Automated data ingestion pipelines (ETL)',
      'Custom interactive Power BI executive dashboards',
      'SQL database architecture & query optimization',
      'Python scripts for automated web scraping / reporting',
      'Real-time automated alerts via Email & Slack',
      'Complete documentation & team training session',
      '3 months post-delivery maintenance'
    ],
    highlight: true
  }
];

export default function Pricing() {
  const [activeCategory, setActiveCategory] = useState('all');

  const filteredPlans = activeCategory === 'all' 
    ? ALL_PRICING_PLANS 
    : ALL_PRICING_PLANS.filter(plan => plan.category === activeCategory);

  return (
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
            Explore our comprehensive, premium service packages. We deliver elite digital engineering, creative branding, and automated financial intelligence at highly competitive, business-friendly price structures.
          </motion.p>
        </div>

        {/* Category Filter Tabs */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-wrap items-center justify-center gap-2 p-1.5 bg-app-card/60 backdrop-blur-md border border-app-border rounded-full max-w-4xl mx-auto shadow-lg"
        >
          {ALL_PRICING_CATEGORIES.map(category => (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className={`px-5 py-2 rounded-full text-xs font-bold tracking-wider transition-all duration-300 cursor-pointer ${
                activeCategory === category.id
                  ? 'bg-primary text-black shadow-[0_0_20px_rgba(232,71,10,0.4)]'
                  : 'text-app-text-muted hover:text-app-text hover:bg-white/5'
              }`}
            >
              {category.label}
            </button>
          ))}
        </motion.div>

        {/* Pricing Cards Grid */}
        <AnimatePresence mode="wait">
          <motion.div 
            key={activeCategory}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-stretch"
          >
            {filteredPlans.map((plan, idx) => (
              <PricingCard key={`${plan.title}-${idx}`} plan={plan} />
            ))}
          </motion.div>
        </AnimatePresence>

        {/* Custom Requirements Banner */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-panel rounded-3xl p-8 md:p-12 text-center space-y-6 max-w-4xl mx-auto border border-primary/20 bg-app-card/40 relative overflow-hidden shadow-2xl"
        >
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 rounded-full filter blur-2xl pointer-events-none" />
          
          <h3 className="text-2xl md:text-3xl font-black font-heading text-app-text">Need a Custom Enterprise Solution?</h3>
          <p className="text-sm text-app-text-muted max-w-2xl mx-auto leading-relaxed">
            Have a complex project that requires multi-service integration, custom SLA agreements, or dedicated offshore engineering teams? Let's discuss your exact architecture.
          </p>

          <div>
            <a
              href="/get-quote"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-primary hover:bg-primary-hover text-black font-extrabold text-xs uppercase tracking-widest transition-all duration-300 shadow-[0_10px_25px_rgba(232,71,10,0.25)] hover:shadow-[0_15px_35px_rgba(232,71,10,0.45)] hover:-translate-y-0.5"
            >
              <span>Request Custom Estimate</span>
            </a>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
