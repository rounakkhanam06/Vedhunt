import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { 
  Laptop, 
  Database, 
  Share2, 
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Zap,
  Award,
  ArrowRight,
  Loader
} from 'lucide-react';
import { EncryptedText } from '../components/ui/encrypted-text';
import { OptimizedLazyImage } from '../components/ui/lazy-image';
import { SpotlightHover } from '../components/ui/spotlight-hover';
import { Card } from '../components/ui/card';
import EmptyState from '../components/ui/EmptyState';
import api from '../services/api';

// High-performance animated Counter that increments from 0 to target when scrolled into viewport
function CountUp({ to, duration = 1.8, suffix = '' }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-60px' });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;

    let startTime;
    let animationFrameId;

    const runCount = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const elapsedTime = timestamp - startTime;
      const progress = Math.min(elapsedTime / (duration * 1000), 1);

      // Quadratic Ease-Out curve for realistic, elegant slowing down at the end
      const easeOutProgress = progress * (2 - progress);
      setCount(Math.floor(easeOutProgress * to));

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(runCount);
      } else {
        setCount(to);
      }
    };

    animationFrameId = requestAnimationFrame(runCount);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isInView, to, duration]);

  return (
    <span ref={ref} className="gpu-accelerated tabular-nums">
      {count}
      {suffix}
    </span>
  );
}

const ICON_MAP = {
  Laptop,
  Database,
  Share2,
  // Add fallback or others if needed
};

// Success parameters displaying hard-proof outcomes of Vedhunt projects with numeric values for count-up triggers
const METRICS_LIST_FALLBACK = [
  { numericValue: 140, suffix: '+', label: 'Deployments Delivered', desc: 'Secure web systems and custom automation modules.', icon: 'Zap' },
  { numericValue: 99, suffix: '%', label: 'Retention Rate', desc: 'SMEs & enterprises continuing partnerships with us.', icon: 'Award' },
  { numericValue: 300, suffix: '%+', label: 'Engagement Growth', desc: 'Average increase across client marketing funnels.', icon: 'Share2' },
  { numericValue: 15, suffix: ' Hrs', label: 'Saved per Week', desc: 'Through automated SQL and Power BI workflows.', icon: 'Database' }
];

const PORTFOLIO_ICON_MAP = {
  Zap,
  Award,
  Share2,
  Database,
  Laptop
};

export default function Portfolio() {
  const [activeFilter, setActiveFilter] = useState('all');
  const [portfolioItems, setPortfolioItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [metrics, setMetrics] = useState([]);
  const [ctaData, setCtaData] = useState({
    tagText: "Let's Collaborate",
    tagIcon: 'Sparkles',
    headingRegular: 'Ready to Build Your',
    headingHighlight: 'Digital Legacy?',
    buttonText: 'Start a Project',
    buttonLink: '/get-quote',
    features: [
      { text: 'Free Visual Mockup Draft', icon: 'Sparkles' },
      { text: 'Direct Engineering Channel', icon: 'Laptop' },
      { text: 'High-Performance Launch', icon: 'Zap' }
    ]
  });
  const limit = 4;

  useEffect(() => {
    fetchPortfolioItems();
  }, [activeFilter, page]);

  useEffect(() => {
    fetchMetrics();
    fetchCTAData();
  }, []);

  const fetchCTAData = async () => {
    try {
      const res = await api.get('/portfolio/cta');
      if (res.data.success && res.data.data) {
        setCtaData(res.data.data);
      }
    } catch (error) {
      console.error('Error fetching portfolio CTA:', error);
    }
  };

  const fetchMetrics = async () => {
    try {
      const res = await api.get('/portfolio/metrics');
      if (res.data.success && res.data.data.length > 0) {
        setMetrics(res.data.data);
      } else {
        setMetrics(METRICS_LIST_FALLBACK);
      }
    } catch (error) {
      console.error('Error fetching portfolio metrics:', error);
      setMetrics(METRICS_LIST_FALLBACK);
    }
  };

  const fetchPortfolioItems = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (activeFilter !== 'all') {
        params.append('category', activeFilter);
      }
      const res = await api.get(`/portfolio?${params.toString()}`);
      if (res.data.success) {
        setPortfolioItems(res.data.data);
        setTotalPages(res.data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Error fetching portfolio items:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Animation definitions optimized for GPU hardware acceleration
  const staggerContainer = {
    hidden: {},
    visible: {
      transition: { staggerChildren: 0.08 }
    }
  };

  const scrollFadeUp = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] }
    }
  };

  const handleFilterChange = (newFilter) => {
    setActiveFilter(newFilter);
    setPage(1);
  };

  return (
    <div className="bg-app-bg text-app-text-muted min-h-screen pt-24 pb-8 sm:pt-28 sm:pb-12 px-4 sm:px-6 lg:px-8 mesh-grid relative overflow-hidden theme-transition">
      
      {/* Blended Glowing Orange Plexus Network Hero Background Image */}
      <div 
        className="absolute top-0 left-0 right-0 h-[450px] bg-cover bg-center opacity-[0.08] dark:opacity-[0.18] pointer-events-none mix-blend-color-burn dark:mix-blend-screen z-0"
        style={{ 
          backgroundImage: "url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1920')",
          maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 100%)',
          filter: 'hue-rotate(180deg) saturate(2.5) contrast(1.15)'
        }}
      />

      {/* Decorative Blur Ambient Orbs */}
      <div className="absolute top-1/4 -right-20 w-[300px] h-[300px] bg-primary/6 rounded-full filter blur-[120px] animate-pulse pointer-events-none" />
      <div className="absolute bottom-1/4 -left-20 w-[350px] h-[350px] bg-primary/3 dark:bg-white/1 rounded-full filter blur-[120px] pointer-events-none" />
      
      <div className="max-w-6xl mx-auto relative z-10">
        
        {/* Compact Hero Segment with Increased Bottom Spacing */}
        <motion.div 
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="text-center max-w-2xl mx-auto mb-14 space-y-4"
        >
          {/* Subtitle Accent */}
          <motion.div variants={scrollFadeUp} className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-primary/10 border border-primary/20 text-primary text-[10px] font-extrabold uppercase tracking-widest rounded-md">
            <Sparkles className="w-3 h-3" />
            <span>Success Showcases</span>
          </motion.div>

          {/* Heading with Cryptographic Encryption Typing Reveal */}
          <h1 className="text-3xl md:text-4xl font-black font-heading text-app-text leading-tight tracking-tight flex flex-col gap-0.5">
            <EncryptedText 
              text="Proven Engineering Standards" 
              revealedClassName="text-app-text"
              encryptedClassName="text-primary/50 font-mono"
              revealDelayMs={20}
            />
            <EncryptedText 
              text="& Strategic Growth" 
              revealedClassName="text-primary text-gradient-orange"
              encryptedClassName="text-primary/50 font-mono"
              revealDelayMs={10}
            />
          </h1>

          {/* Upgraded Hero text readability */}
          <motion.p 
            variants={scrollFadeUp}
            className="text-sm sm:text-base text-app-text-muted leading-relaxed max-w-xl mx-auto font-medium"
          >
            Explore our real-world portfolio of partnerships across India. From full-scale corporate web architectures and automated bookkeeping tools, to organic SEO domination and high-converting marketing pipelines.
          </motion.p>
        </motion.div>

        {/* Categories / Filter Toolbar with Subtle Translucent Orange Active Styling */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="flex flex-wrap items-center justify-center gap-2.5 mb-16"
        >
          {[
            { id: 'all', label: 'All Showcases' },
            { id: 'development', label: 'Web & App Engineering' },
            { id: 'automation', label: 'Automation & Business Finance' },
            { id: 'marketing', label: 'SEO & Growth Marketing' }
          ].map(btn => (
            <button
              key={btn.id}
              onClick={() => handleFilterChange(btn.id)}
              className={`relative px-4.5 py-2.5 rounded-xl text-xs font-semibold tracking-wide uppercase cursor-pointer transition-all duration-300 border ${
                activeFilter === btn.id
                  ? 'text-primary border-primary/30 z-10'
                  : 'text-app-text hover:text-primary bg-app-card/25 border-app-border/40 hover:border-app-border/80'
              }`}
            >
              {activeFilter === btn.id && (
                <motion.div
                  layoutId="activeFilterBg"
                  className="absolute inset-0 bg-primary/10 rounded-xl -z-10"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              {btn.label}
            </button>
          ))}
        </motion.div>

        {/* Portfolio Showcases Compact Cards Grid */}
        <motion.div 
          layout
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          variants={staggerContainer}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 max-w-5xl mx-auto gap-8 mb-20"
        >
          <AnimatePresence mode="popLayout">
            {isLoading ? (
              <div className="col-span-1 md:col-span-2 flex items-center justify-center min-h-[300px]">
                <Loader className="w-8 h-8 text-primary animate-spin" />
              </div>
            ) : portfolioItems.length === 0 ? (
              <div className="col-span-1 md:col-span-2">
                <EmptyState 
                  message="No showcases found for this category." 
                  subMessage="We are currently updating our portfolio. Please check back later."
                />
              </div>
            ) : portfolioItems.map((project) => {
              const ClientIcon = ICON_MAP[project.icon] || Laptop;
              
              return (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, scale: 0.96, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 15 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  className="h-[390px] sm:h-[415px] w-full relative cursor-pointer flip-card-perspective"
                >
                  {/* Outer Flip Card Wrapper */}
                  <div className="flip-card-inner shadow-lg rounded-2xl">
                    
                    {/* FRONT SIDE FACE */}
                    <div className="flip-card-front [backface-visibility:hidden] [-webkit-backface-visibility:hidden] rounded-2xl border border-app-border/60 bg-white dark:bg-app-card/50 flex flex-col justify-between overflow-hidden shadow-lg transition-colors duration-300">
                      {/* Spotlight Hover logic specifically for front card */}
                      <SpotlightHover size={200} />

                      <div className="flex flex-col h-full justify-between">
                        {/* Device Frame Mockup Header */}
                        <div className="bg-[#F1F5F9] dark:bg-[#0E0E0E] px-3.5 py-2.5 border-b border-app-border/50 flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-red-500/80" />
                            <div className="w-2 h-2 rounded-full bg-yellow-500/80" />
                            <div className="w-2 h-2 rounded-full bg-green-500/80" />
                          </div>
                          <div className="text-[10px] font-mono font-bold tracking-wider text-slate-500 dark:text-white/30 uppercase flex items-center gap-1 truncate max-w-[150px] sm:max-w-none">
                            <ClientIcon className="w-2.5 h-2.5 text-primary" />
                            <span>{project.title.toLowerCase().replace(/\s/g, '')}.in</span>
                          </div>
                          <div className="w-8" />
                        </div>

                        {/* Screenshot Visual Taking standard portion of card */}
                        <div className="relative w-full h-[230px] sm:h-[250px] overflow-hidden bg-slate-900">
                          <OptimizedLazyImage 
                            src={project.image}
                            alt={`${project.title} Screenshot`}
                            className="w-full h-full object-cover pointer-events-none"
                            placeholderColor="rgba(255,107,0,0.03)"
                          />
                          {/* Rich bottom gradient blending */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
                          
                          {/* Floating Category Tag */}
                          <div className="absolute top-3.5 left-3.5 bg-slate-950/90 border border-primary/40 rounded px-2.5 py-0.5 text-[9px] font-extrabold text-primary uppercase tracking-wider">
                            {project.category === 'development' ? 'Engineering' : project.category === 'automation' ? 'Finance & Tech' : 'Marketing & SEO'}
                          </div>

                          {/* Stat Badge */}
                          <div className="absolute bottom-3.5 left-3.5 bg-black/95 border border-white/10 rounded-lg px-3 py-1.5 flex items-center gap-1.5 text-xs font-bold text-white shadow-sm">
                            <span className="text-primary uppercase tracking-wider text-[9px]">{project.statLabel}:</span>
                            <span className="text-white font-extrabold">{project.statValue}</span>
                          </div>
                        </div>

                        {/* Front Bottom Title Info */}
                        <div className="p-5 text-left border-t border-app-border/30 bg-gradient-to-b from-transparent to-app-card/90 flex flex-col justify-center flex-grow">
                          <h3 className="text-base sm:text-lg font-black font-heading text-app-text tracking-tight flex items-center justify-between">
                            <span>{project.title}</span>
                            <span className="text-[9px] text-primary/75 font-mono flex items-center gap-1 font-bold animate-pulse">
                              flip to see more... <Sparkles className="w-2.5 h-2.5 text-primary" />
                            </span>
                          </h3>
                          <p className="text-[10px] sm:text-xs font-extrabold text-primary/70 italic mt-0.5">
                            {project.tagline}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* BACK SIDE FACE (Revealed when card flips around) */}
                    <div className="flip-card-back [backface-visibility:hidden] [-webkit-backface-visibility:hidden] [transform:rotateY(180deg)_translateZ(1px)] rounded-2xl border border-primary/30 bg-white dark:bg-gradient-to-br dark:from-app-card dark:via-app-card/95 dark:to-app-bg p-5 sm:p-6 flex flex-col justify-between text-left overflow-hidden shadow-2xl">
                      {/* Back Core ambient light glow */}
                      <div className="absolute -bottom-10 -right-10 w-24 h-24 bg-primary/4 rounded-full filter blur-xl pointer-events-none" />

                      <div className="space-y-4">
                        {/* Header Details */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-extrabold text-primary uppercase tracking-widest bg-primary/10 px-2.5 py-0.5 rounded border border-primary/20">
                              {project.category === 'development' ? 'Engineering' : project.category === 'automation' ? 'Finance & Tech' : 'Marketing & SEO'}
                            </span>
                            <ClientIcon className="w-4.5 h-4.5 text-primary" />
                          </div>
                          
                          <h3 className="text-lg sm:text-xl font-black font-heading text-app-text tracking-tight mt-1">
                            {project.title}
                          </h3>
                          <p className="text-[10px] sm:text-xs font-bold text-primary/75 italic">
                            {project.tagline}
                          </p>
                        </div>

                        {/* Elegant full height paragraph details */}
                        <p className="text-xs sm:text-sm text-black dark:text-app-text-muted leading-relaxed font-normal line-clamp-4 sm:line-clamp-5">
                          {project.description}
                        </p>

                        {/* Coding Engineering tags */}
                        <div className="space-y-1.5 pt-1">
                          <span className="text-[9px] font-normal uppercase tracking-widest text-black dark:text-white/40 block">Engineering Stack</span>
                          <div className="flex flex-wrap gap-1">
                            {project.tags.map(tag => (
                              <span 
                                key={tag} 
                                className="text-[9px] sm:text-[10px] font-normal text-black dark:text-app-text-muted bg-slate-100 dark:bg-[#151515] border border-app-border/40 px-2.5 py-0.5 rounded"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Launch website CTA link & arrow */}
                      <div className="border-t border-app-border/30 pt-4 mt-2 flex items-center justify-between relative z-10">
                        <a
                          href={project.clientUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="relative inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-primary hover:text-primary-hover group/link cursor-pointer"
                        >
                          <span>Launch Live Website</span>
                          <ExternalLink className="w-3.5 h-3.5 text-primary transition-transform duration-300 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5" />
                        </a>

                        <Link
                          to="/get-quote"
                          className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center hover:bg-primary hover:text-black hover:scale-105 transition-all duration-300"
                          aria-label="Inquire about similar solution"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </div>

                    </div>

                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>

        {/* Pagination Controls */}
        {!isLoading && totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mb-20">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-10 h-10 rounded-full bg-app-card/50 border border-app-border/40 flex items-center justify-center text-app-text disabled:opacity-30 disabled:cursor-not-allowed hover:border-primary/50 hover:text-primary transition-all duration-300"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="text-sm font-medium text-app-text-muted">
              Page {page} of {totalPages}
            </div>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="w-10 h-10 rounded-full bg-app-card/50 border border-app-border/40 flex items-center justify-center text-app-text disabled:opacity-30 disabled:cursor-not-allowed hover:border-primary/50 hover:text-primary transition-all duration-300"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Corporate Proof Segments (Metrics) */}
        <div className="mb-20 text-left space-y-8 content-visibility-auto">
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="max-w-lg"
          >
            <span className="text-[9px] font-extrabold text-primary uppercase tracking-widest bg-primary/10 px-2 py-0.5 rounded">
              Demonstrated Proof
            </span>
            <h2 className="text-xl sm:text-2xl font-black font-heading text-app-text leading-tight mt-2.5">
              Concrete Metrics. Exceptional Outcomes.
            </h2>
            <p className="text-[11px] text-app-text-muted leading-relaxed mt-1">
              We focus on measurable statistics. From performance scores and user acquisition speeds, to manual administrative hours eliminated.
            </p>
          </motion.div>

          {/* Cards for metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {metrics.map((m, mIdx) => {
              const MetricIcon = typeof m.icon === 'string' ? (PORTFOLIO_ICON_MAP[m.icon] || Zap) : (m.icon || Zap);
              return (
                <motion.div
                  key={mIdx}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: mIdx * 0.05 }}
                  className="glass-panel bg-app-card/30 border border-app-border/50 hover:border-primary/20 rounded-xl p-4.5 text-left hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden group"
                >
                  <div className="absolute -bottom-10 -right-10 w-16 h-16 bg-primary/2 rounded-full filter blur-xl" />
                  
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-black transition-all duration-300">
                      <MetricIcon className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  <div className="space-y-0.5 relative z-10">
                    <div className="text-xl sm:text-2xl font-black text-primary font-heading tracking-tight leading-none">
                      <CountUp to={m.numericValue} suffix={m.suffix} />
                    </div>
                    <div className="text-[10px] font-bold text-app-text font-heading">
                      {m.label}
                    </div>
                    <p className="text-[10px] text-app-text-muted leading-relaxed">
                      {m.desc}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* CTA Segment */}
        <motion.div
          initial={{ opacity: 0, scale: 0.99 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="relative"
        >
          {/* Subtle back glowing core */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[200px] bg-primary/6 rounded-full filter blur-[100px] pointer-events-none" />

          <div className="glass-panel rounded-2xl p-6 md:p-10 bg-gradient-to-br from-app-card/90 via-app-card/75 to-app-bg border border-app-border/80 relative overflow-hidden orange-glow shadow-xl">
            <div className="flex flex-col lg:flex-row gap-8 items-center justify-between">
              
              <div className="flex-1 space-y-4 text-left">
                <div className="flex">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-primary/10 border border-primary/20 text-primary text-[10px] font-extrabold uppercase tracking-widest rounded-md">
                    {(() => {
                      const TagIcon = PORTFOLIO_ICON_MAP[ctaData.tagIcon] || Sparkles;
                      return <TagIcon className="w-3 h-3" />;
                    })()}
                    <span>{ctaData.tagText}</span>
                  </span>
                </div>
                
                <h3 className="text-2xl sm:text-3xl font-black font-heading text-app-text leading-tight">
                  {ctaData.headingRegular} <span className="text-primary text-gradient-orange">{ctaData.headingHighlight}</span>
                </h3>

                {/* Micro benefits cards with UPGRADED text sizes for perfect visibility */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1.5">
                  {ctaData.features.map((feat, fIdx) => {
                    const FeatIcon = PORTFOLIO_ICON_MAP[feat.icon] || Sparkles;
                    return (
                      <div 
                        key={fIdx} 
                        className="flex items-center gap-2.5 bg-app-bg/50 dark:bg-app-card/40 border border-app-border/40 rounded-xl p-3.5 hover:border-primary/20 hover:bg-app-bg transition-all duration-300 group/item"
                      >
                        <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 group-hover/item:bg-primary group-hover/item:text-black transition-all duration-300">
                          <FeatIcon className="w-4 h-4" />
                        </div>
                        <span className="text-xs sm:text-sm font-bold text-app-text leading-snug">{feat.text}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="shrink-0 flex justify-center lg:justify-end">
                <Link
                  to={ctaData.buttonLink}
                  className="relative inline-flex items-center gap-2 px-7 py-3.5 bg-primary hover:bg-primary-hover text-black font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition-all duration-300 hover:shadow-[0_0_25px_rgba(255,107,0,0.4)] group cursor-pointer overflow-hidden"
                >
                  <span className="absolute inset-0 bg-white/10 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out" />
                  <span>{ctaData.buttonText}</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
              </div>

            </div>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
