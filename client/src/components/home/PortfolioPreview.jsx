import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Laptop, Database, Share2, ExternalLink, ChevronRight, Sparkles } from 'lucide-react';
import { SpotlightHover } from '../ui/spotlight-hover';
import { OptimizedLazyImage } from '../ui/lazy-image';

const PORTFOLIO_ITEMS = [
  {
    id: 'multifarious',
    title: 'Multifarious Group',
    clientUrl: 'https://multifariousgroup.com/',
    category: 'development',
    tagline: 'High-Fidelity Corporate Infrastructure',
    description: 'A multi-faceted business conglomerate requiring a highly prestigious digital footprint. We designed and developed a blazing-fast corporate portal.',
    tags: ['Web Engineering', 'UI/UX Design', 'Corporate Branding', 'React & Vite'],
    image: 'https://vedhunt.in/wp-content/uploads/2026/01/multifarious-1.webp',
    statLabel: 'Lighthouse Score',
    statValue: '98/100',
    icon: Laptop
  },
  {
    id: 'rinnsamadhan',
    title: 'RINNSAMADHAN',
    clientUrl: 'https://rinnsamadhan.com/',
    category: 'automation',
    tagline: 'Secure Compliance & Bookkeeping',
    description: 'A premium financial advisory and legal compliance portal. We integrated secure, multi-tier databases and automated document generators.',
    tags: ['Financial Tech', 'SQL Automation', 'Data Modeling', 'Client Portal'],
    image: 'https://vedhunt.in/wp-content/uploads/2026/01/rinn3.webp',
    statLabel: 'Lead Velocity',
    statValue: '+220%',
    icon: Database
  },
  {
    id: 'visionsfinity',
    title: 'Visionsfinity',
    clientUrl: 'https://visionsfinityshipping.com/',
    category: 'development',
    tagline: 'Global Freight & Logistics',
    description: 'A global logistics provider. We engineered their responsive digital platform incorporating real-time booking engines and high-end animations.',
    tags: ['Logistics App', 'React Router', 'UX Engineering'],
    image: 'https://vedhunt.in/wp-content/uploads/2026/01/vision3.webp',
    statLabel: 'Efficiency',
    statValue: '3.5x Faster',
    icon: Laptop
  },
  {
    id: 'mumbaishopper',
    title: 'Mumbai Shoppers',
    clientUrl: 'https://mumbaishopper.in/',
    category: 'marketing',
    tagline: 'High-Yield E-Commerce Scale',
    description: 'A vibrant modern retail and fashion storefront. We developed an incredibly fast, highly intuitive online checkout grid and managed high-performance PPC.',
    tags: ['E-Commerce', 'Paid PPC Ads', 'SEO Dominance'],
    image: 'https://vedhunt.in/wp-content/uploads/2026/01/mumbai3.webp',
    statLabel: 'Social Growth',
    statValue: '+310%',
    icon: Share2
  }
];

const staggerContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1 }
  }
};

export default function PortfolioPreview() {
  return (
    <section className="pt-4 pb-12 px-4 bg-app-bg relative overflow-hidden">
      {/* Background Subtle Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-primary/5 blur-[120px] pointer-events-none rounded-full" />
      
      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* Section Header */}
        <div className="text-center mb-10 space-y-2">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex items-center justify-center gap-3"
          >
            <span className="w-6 h-[2px] bg-primary" />
            <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">
              Latest Work
            </span>
            <span className="w-6 h-[2px] bg-primary" />
          </motion.div>
          <motion.h2 
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ delay: 0.1 }}
            className="text-3xl md:text-4xl font-black font-heading text-app-text"
          >
            Featured <span className="text-primary">Projects</span>
          </motion.h2>
        </div>

        {/* Portfolio Grid - 4 items in a row for small layout */}
        <motion.div 
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <AnimatePresence mode="popLayout">
            {PORTFOLIO_ITEMS.map((project) => {
              const ClientIcon = project.icon;
              
              return (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, scale: 0.96, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 15 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  className="h-[300px] w-full relative cursor-pointer flip-card-perspective group"
                >
                  {/* Outer Flip Card Wrapper */}
                  <div className="flip-card-inner shadow-lg rounded-2xl group-hover:[transform:rotateY(180deg)] transition-transform duration-700 [transform-style:preserve-3d]">
                    
                    {/* FRONT SIDE FACE */}
                    <div className="absolute inset-0 [backface-visibility:hidden] [-webkit-backface-visibility:hidden] rounded-2xl border border-app-border/60 bg-white dark:bg-app-card/50 flex flex-col justify-between overflow-hidden shadow-lg transition-colors duration-300">
                      <SpotlightHover size={150} />

                      <div className="flex flex-col h-full justify-between relative z-10">
                        {/* Device Frame Mockup Header */}
                        <div className="bg-[#F1F5F9] dark:bg-[#0E0E0E] px-3 py-1.5 border-b border-app-border/50 flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-500/80" />
                            <div className="w-1.5 h-1.5 rounded-full bg-yellow-500/80" />
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500/80" />
                          </div>
                          <div className="text-[9px] font-mono font-bold tracking-wider text-slate-500 dark:text-white/30 uppercase flex items-center gap-1 max-w-[160px] xs:max-w-none min-w-0">
                            <ClientIcon className="w-2.5 h-2.5 text-primary shrink-0" />
                            <span className="truncate">{project.clientUrl.replace('https://', '').replace('www.', '').replace(/\/$/, '')}</span>
                          </div>
                          <div className="w-6" />
                        </div>

                        {/* Screenshot Visual */}
                        <div className="relative w-full h-[180px] overflow-hidden bg-slate-900">
                          <OptimizedLazyImage 
                            src={project.image}
                            alt={`${project.title} Screenshot`}
                            className="w-full h-full object-cover pointer-events-none"
                            placeholderColor="rgba(255,107,0,0.03)"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none" />
                          
                          <div className="absolute top-2 left-2 bg-slate-950/90 border border-primary/40 rounded px-2 py-0.5 text-[8px] font-extrabold text-primary uppercase tracking-wider">
                            {project.category === 'development' ? 'Engineering' : project.category === 'automation' ? 'Finance & Tech' : 'Marketing'}
                          </div>

                          <div className="absolute bottom-2 left-2 bg-black/95 border border-white/10 rounded px-2 py-1 flex items-center gap-1 text-[10px] font-bold text-white shadow-sm">
                            <span className="text-primary uppercase tracking-wider text-[8px]">{project.statLabel}:</span>
                            <span className="text-white font-extrabold">{project.statValue}</span>
                          </div>
                        </div>

                        {/* Front Bottom Title Info */}
                        <div className="p-3 text-left border-t border-app-border/30 bg-gradient-to-b from-transparent to-app-card/90 flex flex-col justify-center flex-grow">
                          <h3 className="text-sm font-black font-heading text-app-text tracking-tight flex items-center justify-between">
                            <span className="truncate">{project.title}</span>
                          </h3>
                          <p className="text-[9px] font-extrabold text-primary/70 italic mt-0.5 truncate">
                            {project.tagline}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* BACK SIDE FACE */}
                    <div className="absolute inset-0 [backface-visibility:hidden] [-webkit-backface-visibility:hidden] [transform:rotateY(180deg)_translateZ(1px)] rounded-2xl border border-primary/30 bg-white dark:bg-gradient-to-br dark:from-app-card dark:via-app-card/95 dark:to-app-bg p-4 flex flex-col justify-between text-left overflow-hidden shadow-2xl">
                      <div className="absolute -bottom-10 -right-10 w-24 h-24 bg-primary/4 rounded-full filter blur-xl pointer-events-none" />

                      <div className="space-y-3 relative z-10">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[8px] font-extrabold text-primary uppercase tracking-widest bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                              {project.category === 'development' ? 'Engineering' : project.category === 'automation' ? 'Finance & Tech' : 'Marketing'}
                            </span>
                            <ClientIcon className="w-3.5 h-3.5 text-primary" />
                          </div>
                          
                          <h3 className="text-sm font-black font-heading text-app-text tracking-tight mt-1 truncate">
                            {project.title}
                          </h3>
                          <p className="text-[9px] font-bold text-primary/75 italic truncate">
                            {project.tagline}
                          </p>
                        </div>

                        <p className="text-[10px] text-black dark:text-app-text-muted leading-relaxed font-normal line-clamp-3">
                          {project.description}
                        </p>

                        <div className="space-y-1 pt-1">
                          <span className="text-[8px] font-normal uppercase tracking-widest text-black dark:text-white/40 block">Tech Stack</span>
                          <div className="flex flex-wrap gap-1">
                            {project.tags.slice(0, 3).map(tag => (
                              <span 
                                key={tag} 
                                className="text-[8px] font-normal text-black dark:text-app-text-muted bg-slate-100 dark:bg-[#151515] border border-app-border/40 px-1.5 py-0.5 rounded"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-app-border/30 pt-3 mt-1 flex items-center justify-between relative z-10">
                        <a
                          href={project.clientUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="relative inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-primary hover:text-primary-hover group/link cursor-pointer"
                        >
                          <span>Live Site</span>
                          <ExternalLink className="w-3 h-3 text-primary transition-transform duration-300 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5" />
                        </a>
                      </div>

                    </div>

                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>

        {/* View All Button */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="mt-12 text-center"
        >
          <Link
            to="/portfolio"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-black font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-[0_0_20px_rgba(255,107,0,0.2)] hover:shadow-[0_0_30px_rgba(255,107,0,0.4)]"
          >
            View All Projects
          </Link>
        </motion.div>

      </div>
    </section>
  );
}
