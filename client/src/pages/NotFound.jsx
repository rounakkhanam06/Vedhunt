import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, ArrowLeft, HelpCircle } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 relative overflow-hidden mesh-grid py-20 bg-app-bg text-app-text-muted">
      {/* Dynamic blurred backdrop nodes */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full filter blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/2 dark:bg-white/3 rounded-full filter blur-[120px] pointer-events-none" />

      <div className="max-w-md w-full text-center relative z-10 space-y-8">
        {/* Animated Question Symbol */}
        <motion.div
          animate={{ rotate: [0, 10, -10, 0], y: [0, -10, 0] }}
          transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
          className="w-20 h-20 bg-primary/10 border border-primary/20 text-primary rounded-full flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(255,107,0,0.15)]"
        >
          <HelpCircle className="w-10 h-10 animate-pulse" />
        </motion.div>

        <div className="space-y-4">
          <motion.h1
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', duration: 1.2 }}
            className="text-8xl md:text-9xl font-black tracking-tight text-app-text font-heading relative inline-block"
          >
            4<span className="text-primary">0</span>4
            {/* Ambient orange text shadow */}
            <span className="absolute inset-0 text-primary/15 filter blur-lg select-none">404</span>
          </motion.h1>
          
          <h2 className="text-2xl md:text-3xl font-bold font-heading text-app-text">
            Lost in the Digital Hunt?
          </h2>
          <p className="text-app-text-muted text-sm leading-relaxed max-w-sm mx-auto">
            The page you are looking for does not exist, has been archived, or was moved to another location. Let's guide you back to safety.
          </p>
        </div>

        {/* CTA Actions */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          <Link
            to="/"
            className="px-6 py-3 bg-primary hover:bg-primary-hover text-black font-bold rounded-lg flex items-center justify-center gap-2 transition-all duration-300 shadow-[0_4px_20px_rgba(255,107,0,0.25)] hover:shadow-[0_4px_30px_rgba(255,107,0,0.4)] hover:-translate-y-0.5 group cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Back to Home</span>
          </Link>
          
          <Link
            to="/services"
            className="px-6 py-3 bg-app-card border border-app-border hover:bg-app-bg hover:border-primary/20 text-app-text font-bold rounded-lg flex items-center justify-center gap-2 transition-all duration-300 hover:-translate-y-0.5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Explore Services</span>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
