import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Star, Sparkles } from 'lucide-react';
import { CONTACT_INFO } from '../../constants';

export default function CTABanner() {
  const staggerContainer = {
    hidden: {},
    visible: {
      transition: { staggerChildren: 0.1 }
    }
  };

  const scrollFadeUp = {
    hidden: { opacity: 0, y: 25 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] }
    }
  };

  return (
    <section className="pt-2 pb-14 sm:pt-4 sm:pb-16 px-4 sm:px-6 lg:px-8 bg-app-bg relative overflow-hidden">
      {/* Glow overlays */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] bg-primary/10 rounded-full filter blur-[120px] pointer-events-none animate-pulse" />
      
      <div className="max-w-6xl mx-auto relative z-10">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={staggerContainer}
          className="glass-panel rounded-3xl p-8 md:p-16 text-center bg-gradient-to-tr from-app-card via-app-card/95 to-app-bg border-app-border relative overflow-hidden orange-glow shadow-xl"
        >
          {/* Decorative floating dots */}
          <div className="absolute top-6 left-6 text-primary/10 select-none">
            <Sparkles className="w-12 h-12" />
          </div>
          <div className="absolute bottom-6 right-6 text-primary/10 select-none">
            <Star className="w-12 h-12 animate-pulse" />
          </div>

          <div className="max-w-2xl mx-auto space-y-8">
            <div className="space-y-4">
              <motion.span variants={scrollFadeUp} className="text-primary text-[10px] md:text-xs font-extrabold uppercase tracking-widest bg-primary/10 border border-primary/20 px-3.5 py-1.5 rounded-full inline-block">
                Start Your Digital Transformation Today
              </motion.span>
              <motion.h2 variants={scrollFadeUp} className="text-3xl sm:text-4xl md:text-5xl font-black font-heading text-app-text leading-tight">
                Ready to Accelerate Your <br />
                Business <span className="text-primary text-gradient-orange">Lead Acquisition?</span>
              </motion.h2>
              <motion.p variants={scrollFadeUp} className="text-app-text-muted text-xs sm:text-sm md:text-base leading-relaxed">
                Connect with our system engineers, growth marketers, and bookkeeping experts today. We assemble comprehensive digital platforms designed explicitly to convert search traffic into direct corporate revenue.
              </motion.p>
            </div>

            {/* Direct Interaction Buttons */}
            <motion.div variants={scrollFadeUp} className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                to="/get-quote"
                className="px-8 py-4 bg-primary hover:bg-primary-hover text-black font-extrabold text-sm rounded-lg flex items-center justify-center gap-2.5 transition-all duration-300 shadow-[0_4px_25px_rgba(255,107,0,0.2)] hover:shadow-[0_4px_30px_rgba(255,107,0,0.55)] hover:-translate-y-0.5 group w-full sm:w-auto cursor-pointer"
              >
                <span>Request Free Quote Callback</span>
                <ArrowRight className="w-4.5 h-4.5 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
              
              <a
                href={`tel:${CONTACT_INFO.phone}`}
                className="px-8 py-4 bg-app-bg border border-app-border hover:bg-app-card text-app-text font-bold text-sm rounded-lg flex items-center justify-center gap-2 transition-all duration-300 hover:-translate-y-0.5 w-full sm:w-auto shadow-sm"
              >
                <span>Call {CONTACT_INFO.phoneDisplay}</span>
              </a>
            </motion.div>

            {/* Sub text list of parameters */}
            <motion.div variants={scrollFadeUp} className="flex flex-wrap justify-center gap-x-6 gap-y-2 pt-4 border-t border-app-border text-[11px] text-app-text-muted/70 font-medium">
              <span>✓ Itemized Proposals within 4 Hours</span>
              <span>•</span>
              <span>✓ 100% Free Consultation Call</span>
              <span>•</span>
              <span>✓ Customized Budget-Friendly Plans</span>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
