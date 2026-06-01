import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Check, 
  ArrowRight, 
  Globe, 
  Smartphone, 
  Palette, 
  Megaphone, 
  LineChart,
  Sparkles
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatPricing } from '../../utils/pricingFormatter';

const getCategoryIcon = (categoryIconString) => {
  const iconClasses = "w-5 h-5 text-primary";
  switch (categoryIconString?.toLowerCase()) {
    case 'web':
      return <Globe className={iconClasses} />;
    case 'app':
      return <Smartphone className={iconClasses} />;
    case 'branding':
      return <Palette className={iconClasses} />;
    case 'marketing':
      return <Megaphone className={iconClasses} />;
    case 'finance':
      return <LineChart className={iconClasses} />;
    default:
      return <Sparkles className={iconClasses} />;
  }
};

export default function PricingCard({ plan, categoryIcon }) {
  const { title, tech, pricing, features, highlight } = plan;
  const [isExpanded, setIsExpanded] = useState(false);

  const VISIBLE_COUNT = 5;
  const safeFeatures = features || [];
  const hasMore = safeFeatures.length > VISIBLE_COUNT;
  const displayedFeatures = isExpanded ? safeFeatures : safeFeatures.slice(0, VISIBLE_COUNT);

  // Smart price parser using the new utility
  const hasDiscount = pricing?.discountedAmount && pricing.discountedAmount < pricing.amount;
  const originalDisplayPrice = formatPricing({ ...pricing, isStartingAt: false, period: 'one-time' });
  const discountedDisplayPrice = hasDiscount 
    ? formatPricing({ ...pricing, amount: pricing.discountedAmount, isStartingAt: false, period: 'one-time' }) 
    : null;
    
  const finalDisplayPrice = (hasDiscount ? discountedDisplayPrice : originalDisplayPrice) + (pricing?.isStartingAt ? '+' : '');
  const finalOriginalPrice = originalDisplayPrice + (pricing?.isStartingAt ? '+' : '');
  
  const discountPercent = hasDiscount 
    ? Math.round(((pricing.amount - pricing.discountedAmount) / pricing.amount) * 100)
    : 0;

  const isMonthly = pricing?.period === 'monthly';
  const periodLabel = isMonthly ? 'P E R  M O N T H' : (pricing?.isStartingAt ? 'S T A R T I N G  A T' : 'O N E  T I M E');

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      whileHover={{ y: -6 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={`relative rounded-[2.25rem] border-[1.5px] overflow-hidden flex flex-col justify-between h-full group transition-all duration-500
        ${highlight 
          ? 'border-primary bg-white dark:bg-app-card shadow-[0_0_30px_rgba(255,90,31,0.15)] dark:shadow-[0_0_30px_rgba(255,90,31,0.25)]' 
          : 'border-slate-100 dark:border-white/10 bg-white dark:bg-app-card hover:border-primary hover:shadow-[0_0_30px_rgba(255,90,31,0.2)] shadow-sm dark:shadow-lg'
        }`}
    >
      {/* Floating best choice badge if highlighted */}
      {highlight && (
        <div className="absolute top-2.5 right-3.5 z-20">
          <span className="px-3 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-primary text-white dark:bg-white dark:text-black shadow-md">
            Best Choice
          </span>
        </div>
      )}

      {/* Top Section: Details & Features */}
      <div className="flex flex-col flex-grow">
        
        {/* Header Row: Icon + Title */}
        <div className="flex items-center gap-4 p-6 pt-7">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center shrink-0 shadow-sm transition-transform duration-500 group-hover:scale-110 group-hover:rotate-[360deg]">
            {getCategoryIcon(categoryIcon)}
          </div>
          <div className="space-y-0.5 pr-12"> {/* Right padding to avoid overlap with badge */}
            <h3 className="text-base md:text-lg font-black font-heading text-black dark:text-white uppercase tracking-wide leading-tight transition-colors duration-300 group-hover:text-primary">
              {title}
            </h3>
            <p className="text-primary text-[9px] uppercase font-bold tracking-widest block">
              {tech}
            </p>
          </div>
        </div>

        {/* Deliverables / Features Box */}
        <div className="px-6 pb-6 flex-grow flex flex-col">
          <div className="rounded-2xl bg-black/[0.01] dark:bg-white/[0.01] border border-black/5 dark:border-white/5 p-4.5 flex flex-col space-y-3 group-hover:bg-black/[0.02] group-hover:dark:bg-white/[0.02] transition-all duration-300 overflow-hidden">
            <p className="text-[9px] font-black text-black/40 dark:text-white/40 tracking-[0.2em] uppercase shrink-0">
              Included Deliverables
            </p>
            <motion.ul layout className="space-y-2.5 relative">
              <AnimatePresence initial={false}>
                {displayedFeatures.map((feature, idx) => (
                  <motion.li 
                    key={idx}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ opacity: { duration: 0.2 }, height: { duration: 0.3 } }}
                    className="flex items-start gap-2.5 group/item overflow-hidden"
                  >
                    <div className="mt-1 w-3.5 h-3.5 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center flex-shrink-0 group-hover:scale-115 transition-all">
                      <Check className="w-2 h-2 text-primary" strokeWidth={3} />
                    </div>
                    <span className="text-xs text-black/75 dark:text-white/70 group-hover/item:text-black group-hover/item:dark:text-white transition-colors leading-tight">
                      {feature}
                    </span>
                  </motion.li>
                ))}
              </AnimatePresence>
            </motion.ul>
            {hasMore && (
              <motion.button 
                layout
                onClick={() => setIsExpanded(!isExpanded)}
                className="mt-2 text-[10px] font-black uppercase tracking-widest text-primary hover:text-black dark:hover:text-white transition-colors flex items-center gap-1.5 self-start py-1"
              >
                {isExpanded ? '- Show Less' : `+ ${safeFeatures.length - VISIBLE_COUNT} More`}
              </motion.button>
            )}
          </div>
        </div>

      </div>

      {/* Bottom Section: Pricing & Call to Action (Divided layout) */}
      <div className="bg-[#FFF6F2] dark:bg-[#07070F] p-6 border-t border-black/5 dark:border-white/5 rounded-b-[2.25rem] flex items-center justify-between gap-4 transition-colors duration-300">
        <div>
          {hasDiscount ? (
            <>
              <div className="flex items-end gap-2">
                <span className="text-xl md:text-2xl font-black text-black dark:text-white tracking-tight leading-none block">
                  {finalDisplayPrice}
                </span>
                <del className="text-xs font-bold text-black/30 dark:text-white/30 decoration-primary/50 decoration-2 leading-none mb-0.5">
                  {finalOriginalPrice}
                </del>
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[8px] font-black text-primary tracking-widest uppercase block">
                  {periodLabel}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-green-500/15 text-green-600 dark:text-green-400 text-[8px] font-black uppercase tracking-widest leading-none">
                  Save {discountPercent}%
                </span>
              </div>
            </>
          ) : (
            <>
              <span className="text-xl md:text-2xl font-black text-black dark:text-white tracking-tight leading-none block">
                {finalDisplayPrice}
              </span>
              <span className="text-[8px] font-black text-primary tracking-widest uppercase block mt-1.5">
                {periodLabel}
              </span>
            </>
          )}
        </div>
        
        <Link
          to="/get-quote"
          className="px-5 py-3 rounded-xl flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-wider bg-primary text-black hover:bg-black hover:text-primary dark:hover:bg-white dark:hover:text-black transition-all duration-300 shadow-[0_4px_12px_rgba(232,71,10,0.15)] hover:shadow-[0_6px_20px_rgba(232,71,10,0.35)] hover:-translate-y-0.5 active:translate-y-0"
        >
          <span>Get Started</span>
          <ArrowRight className="w-3 h-3 stroke-[3]" />
        </Link>
      </div>

    </motion.div>
  );
}
