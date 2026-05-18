import { motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';

export default function FeatureList({ features }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {features.map((feature, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, x: -10 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: index * 0.05 }}
          className="flex items-center gap-3 p-3 rounded-xl bg-app-card border border-white/5 hover:border-primary/20 transition-all duration-300 group shadow-md"
        >
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <span className="text-white/60 text-xs font-bold uppercase tracking-tight group-hover:text-white transition-colors">
            {feature}
          </span>
        </motion.div>

      ))}
    </div>
  );
}
