import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { CheckCircle2, ArrowLeft } from 'lucide-react';

export default function ThankYou() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-app-bg px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-primary/5 filter blur-[120px] rounded-full pointer-events-none -z-10" />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass-panel p-10 md:p-16 rounded-3xl border border-primary/20 text-center max-w-lg w-full"
      >
        <div className="w-20 h-20 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-8">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        
        <h1 className="text-3xl md:text-4xl font-black font-heading text-app-text mb-4">
          Thank You!
        </h1>
        
        <p className="text-app-text-muted mb-8 leading-relaxed">
          Your request has been successfully received. One of our experts will review your requirements and get back to you within 24 hours.
        </p>

        <Link 
          to="/"
          className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-app-bg border border-app-border hover:border-primary/50 text-app-text font-bold text-sm uppercase tracking-widest rounded-full transition-all duration-300"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>
      </motion.div>
    </div>
  );
}
