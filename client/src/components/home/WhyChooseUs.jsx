import React from 'react';
import { motion } from 'framer-motion';
import { 
  Target, 
  Eye, 
  Zap, 
  Headphones, 
  Lightbulb, 
  BarChart3 
} from 'lucide-react';

/**
 * WhyChooseUs - Updated with Lucide icons and Dark Theme.
 */
export default function WhyChooseUs() {
  const features = [
    {
      icon: Target,
      title: "Result-Oriented",
      desc: "We focus heavily on measurable outcomes that directly drive your business growth."
    },
    {
      icon: Eye,
      title: "Full Transparency",
      desc: "No hidden charges, no vague metrics—clear communication at every phase."
    },
    {
      icon: Zap,
      title: "Fast Turnaround",
      desc: "Optimized agile development workflows to deliver your projects ahead of schedule."
    },
    {
      icon: Headphones,
      title: "Dedicated Support",
      desc: "Get a dedicated account manager reachable directly over WhatsApp for seamless updates."
    },
    {
      icon: Lightbulb,
      title: "Creative + Technical",
      desc: "A powerful combination of stunning visual UX design and robust backend engineering."
    },
    {
      icon: BarChart3,
      title: "Data-Driven",
      desc: "Every campaign, design layout, and process optimization is backed by real user data analytics."
    }
  ];

  // Animation Variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: [0.25, 1, 0.5, 1] }
    }
  };

  return (
    <section className="py-12 px-4 bg-app-bg relative overflow-hidden mesh-grid">
      {/* Background Ambient Glows */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-primary/5 rounded-full filter blur-[150px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/2 dark:bg-white/2 rounded-full filter blur-[150px] pointer-events-none" />
      
      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* Section Header */}
        <div className="text-center mb-12 sm:mb-16 md:mb-20 space-y-4">
          <motion.span 
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-primary text-xs font-black uppercase tracking-[0.3em] bg-primary/10 px-4 py-1.5 rounded-full"
          >
            Why Vedhunt
          </motion.span>
          <motion.h2 
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-3xl sm:text-4xl md:text-5xl font-black font-heading text-app-text leading-tight"
          >
            Engineering Success with <span className="text-primary">Precision</span>
          </motion.h2>
          <motion.div 
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, duration: 0.8 }}
            className="w-24 h-1 bg-primary mx-auto rounded-full"
          />
        </div>

        {/* Feature Grid */}
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8"
        >
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={index}
                variants={itemVariants}
                className="group relative bg-app-card rounded-2xl p-8 shadow-lg border border-white/5 hover:border-primary/20 hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 flex flex-col items-start text-left"
              >
                {/* Subtle Gradient Background on Hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl" />

                {/* Icon Wrapper */}
                <div className="mb-6 w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-primary shadow-inner group-hover:bg-primary group-hover:text-black transition-all duration-500 transform group-hover:rotate-3">
                  <Icon size={28} strokeWidth={2.5} />
                </div>

                {/* Title */}
                <h3 className="text-xl font-black font-heading text-app-text mb-3 group-hover:text-primary transition-colors duration-300 relative z-10">
                  {feature.title}
                </h3>

                {/* Description */}
                <p className="text-app-text-muted text-sm leading-relaxed font-medium relative z-10">
                  {feature.desc}
                </p>

                {/* Bottom Accent Line */}
                <div className="absolute bottom-0 left-0 w-0 h-1 bg-primary group-hover:w-full transition-all duration-700 rounded-b-2xl" />
              </motion.div>
            );
          })}
        </motion.div>



      </div>
    </section>
  );
}
