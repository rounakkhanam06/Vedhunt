import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * ServiceCard - A compact reusable component for displaying service details.
 * 
 * @param {Object} props
 * @param {Object} props.service - The service object containing title, shortDescription, subServices, icon, and slug.
 * @param {string} props.image - The image source for the top of the card.
 */
export default function ServiceCard({ service, image }) {
  const { title, shortDescription, subServices, icon: Icon, slug } = service;
  
  return (
    <motion.div
      className="group relative bg-app-card rounded-2xl border border-app-border hover:border-primary transition-all duration-300 shadow-md hover:shadow-xl flex flex-col h-full overflow-hidden"
    >
      {/* Top Image Section - Compact Height */}
      <div className="relative h-32 w-full overflow-hidden">
        <img 
          src={image} 
          alt={title} 
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60" />
      </div>

      {/* Content Section - Tightened Padding */}
      <div className="relative z-10 p-5 flex flex-col flex-grow">
        {/* Icon Overlay - Moved to content area to ensure full visibility */}
        <div className="mb-4 w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-black shadow-lg -mt-11 relative z-20 transform group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
          {typeof Icon === 'string' ? (
            <img src={Icon} alt={title} className="w-6 h-6 object-contain" />
          ) : (
            <Icon className="w-6 h-6" />
          )}
        </div>
        
        {/* Title - Reduced Size */}
        <h3 className="text-lg font-black font-heading text-app-text mb-2 group-hover:text-primary transition-colors duration-300">
          {title}
        </h3>

        {/* Description - Reduced Size & Line Clamp */}
        <p className="text-app-text-muted text-xs leading-relaxed mb-4 flex-grow line-clamp-2">
          {shortDescription}
        </p>

        {/* Sub-services - More Compact */}
        {subServices && (
          <div className="mb-5 py-2 px-3 bg-black/5 dark:bg-black/20 rounded-lg border border-white/5 backdrop-blur-sm">
            <p className="text-[10px] text-app-text/70 italic font-medium leading-tight line-clamp-1">
              {subServices}
            </p>
          </div>
        )}

        {/* CTA - Small & Bold */}
        <Link
          to={`/service/${slug}`}
          className="inline-flex items-center gap-2 text-[11px] font-black text-primary uppercase tracking-wider group/link"
        >
          <span className="relative">
            Learn More
            <span className="absolute -bottom-0.5 left-0 w-0 h-0.5 bg-primary transition-all duration-300 group-hover/link:w-full" />
          </span>
          <ArrowRight className="w-3 h-3 group-hover/link:translate-x-1 transition-transform duration-300" />
        </Link>
      </div>
    </motion.div>
  );
}
