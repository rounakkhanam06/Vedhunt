import { motion } from 'framer-motion';
import { Check, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PricingCard({ plan }) {
  const { title, tech, price, features, highlight } = plan;

  return (
    <motion.div
      whileHover={{ y: -5 }}
      className="relative p-6 rounded-2xl border border-white/10 bg-app-card hover:border-primary/30 transition-all duration-500 shadow-lg group"
    >
      <div className="space-y-5">
        <div>
          <h3 className="text-xl font-bold font-heading text-white mb-1 tracking-tight">{title}</h3>
          <p className="text-primary text-[10px] font-bold tracking-widest opacity-80">{tech}</p>
        </div>

        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold text-white">{price}</span>
        </div>

        <div className="space-y-3 pt-2">
          <p className="text-[10px] font-bold text-white/30 tracking-widest">Key Features</p>
          <ul className="space-y-2.5">
            {features.map((feature, idx) => (
              <li key={idx} className="flex items-start gap-2.5 group/item">
                <div className="mt-1 w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Check className="w-2.5 h-2.5 text-primary" />
                </div>
                <span className="text-xs text-white/60 group-hover/item:text-white/90 transition-colors leading-tight">{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        <Link
          to="/get-quote"
          className="w-full py-3 rounded-lg flex items-center justify-center gap-2 font-bold text-xs bg-primary text-black hover:brightness-110 transition-all duration-300 shadow-lg"
        >
          <span>Get Started</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </motion.div>


  );
}
