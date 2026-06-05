import { motion } from 'framer-motion';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function CareerSuccess() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const { fullName = 'Candidate', jobTitle = 'General Application' } = location.state || {};

  return (
    <div className="min-h-screen bg-app-bg text-app-text relative pt-24 sm:pt-36 pb-12 sm:pb-20 px-4 sm:px-6 lg:px-8 flex items-center justify-center overflow-hidden">
      
      {/* Universal Floating Mesh Backdrop */}
      <div className="absolute inset-0 mesh-grid opacity-35 pointer-events-none z-0" />

      {/* Decorative Orbs */}
      <div className="absolute top-1/3 -left-20 w-[450px] h-[450px] bg-primary/5 rounded-full filter blur-[150px] pointer-events-none z-0" />
      <div className="absolute bottom-1/3 -right-20 w-[450px] h-[450px] bg-primary/4 rounded-full filter blur-[150px] pointer-events-none z-0" />

      <div className="max-w-2xl mx-auto relative z-10 w-full">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="glass-panel rounded-3xl p-8 sm:p-12 border border-primary/20 bg-app-card shadow-2xl text-center space-y-8"
        >
          <div className="w-20 h-20 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mx-auto shadow-[0_0_35px_rgba(232,71,10,0.25)]">
            <CheckCircle2 className="w-10 h-10 animate-bounce" />
          </div>
          
          <div className="space-y-4">
            <h1 className="text-3xl sm:text-4xl font-bold font-heading text-app-text">
              Application Received!
            </h1>
            <p className="text-sm sm:text-base text-app-text-muted leading-relaxed max-w-lg mx-auto">
              Thank you for applying, <strong className="text-app-text">{fullName}</strong>. Our engineering & HR leads will review your profile for the <strong className="text-primary">{jobTitle}</strong> position and get back to you soon.
            </p>
          </div>

          <div className="pt-8 border-t border-app-border flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              onClick={() => navigate('/career')}
              className="px-8 py-3 bg-primary hover:bg-primary-hover text-black rounded-full text-xs font-extrabold uppercase tracking-widest transition-all shadow-[0_10px_25px_rgba(232,71,10,0.22)] hover:shadow-[0_12px_35px_rgba(232,71,10,0.45)] hover:-translate-y-0.5 flex items-center gap-2 cursor-pointer w-full sm:w-auto justify-center"
            >
              <ArrowRight className="w-4 h-4 rotate-180" />
              <span>Back to Careers</span>
            </button>
            <button
              onClick={() => navigate('/')}
              className="px-8 py-3 bg-app-bg border border-app-border hover:border-primary/50 text-app-text hover:text-primary rounded-full text-xs font-bold uppercase tracking-widest transition-all w-full sm:w-auto justify-center"
            >
              Return Home
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
