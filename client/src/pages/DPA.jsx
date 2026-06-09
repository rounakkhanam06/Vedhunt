import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ShieldCheck } from 'lucide-react';
import dpaHeroImage from '../assets/footer-illustration/undraw_security-on_3ykb.svg';
import { settingsService } from '../services/settingsService';

export default function DPA() {
  const [openSection, setOpenSection] = useState(0); // First section open by default
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await settingsService.getDPA();
        setData(res.data);
      } catch (error) {
        console.error("Error fetching DPA:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const toggleSection = (index) => {
    setOpenSection(openSection === index ? null : index);
  };

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
      </div>
    );
  }

  const hero = data?.hero || {};
  const policySections = data?.policyData || [];
  const acceptance = data?.acceptance || {};

  return (
    <div className="min-h-screen bg-app-bg pt-24 pb-24">
      {/* Hero Section */}
      <section className="relative overflow-hidden mb-16">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-app-bg to-app-bg z-0" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 pt-16 pb-12 lg:pt-24 lg:pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center space-x-2 bg-primary/10 text-primary px-4 py-2 rounded-full mb-6">
                <ShieldCheck size={20} />
                <span className="font-bold text-sm">{hero.badgeText || 'GDPR & IT Act Compliant'}</span>
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black font-heading text-app-text leading-tight mb-6">
                {hero.heading || 'Data Processing'} <span className="text-primary">{hero.subheading || 'Agreement'}</span>
              </h1>
              <p className="text-lg text-slate-600 dark:text-app-text-muted mb-8 leading-relaxed">
                {hero.description}
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <a href="mailto:info@vedhunt.in" className="btn-primary flex justify-center text-center">
                  Contact Compliance Team
                </a>
              </div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative flex justify-center items-center p-4"
            >
              <img 
                src={dpaHeroImage} 
                alt="Data Processing Security" 
                className="w-full h-auto object-contain dark:opacity-90"
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Accordion Content Section */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="bg-white dark:bg-app-card rounded-3xl p-6 md:p-10 shadow-xl border border-slate-200 dark:border-app-border"
        >
          <div className="mb-8 border-b border-slate-100 dark:border-app-border pb-6">
            <h2 className="text-2xl font-bold font-heading text-app-text">Agreement Sections</h2>
            <p className="text-slate-500 dark:text-app-text-muted mt-2">Click to expand and read the details of our data processing commitments.</p>
          </div>

          <div className="space-y-4">
            {policySections.map((section, index) => (
              <div 
                key={section.id || index} 
                className="border border-slate-200 dark:border-app-border rounded-xl overflow-hidden bg-slate-50/50 dark:bg-black/20"
              >
                <button
                  onClick={() => toggleSection(index)}
                  className="w-full flex items-center justify-between p-5 text-left transition-colors hover:bg-slate-100 dark:hover:bg-black/40 focus:outline-none"
                >
                  <span className={`font-bold font-heading text-lg ${openSection === index ? 'text-primary' : 'text-app-text'}`}>
                    {section.title}
                  </span>
                  <motion.div
                    animate={{ rotate: openSection === index ? 180 : 0 }}
                    transition={{ duration: 0.3 }}
                    className={`flex-shrink-0 ml-4 ${openSection === index ? 'text-primary' : 'text-slate-400'}`}
                  >
                    <ChevronDown size={24} />
                  </motion.div>
                </button>
                
                <AnimatePresence>
                  {openSection === index && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div 
                        className="p-5 pt-0 prose prose-slate dark:prose-invert max-w-none prose-p:text-slate-600 dark:prose-p:text-app-text-muted prose-li:text-slate-600 dark:prose-li:text-app-text-muted leading-relaxed border-t border-slate-100 dark:border-app-border mt-2 quill-content-override"
                        dangerouslySetInnerHTML={{ __html: section.content }}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>

          <div className="mt-12 p-6 bg-primary/10 rounded-2xl border border-primary/20">
            <h3 className="text-lg font-bold font-heading text-app-text mb-3">
              {acceptance.title || 'Agreement Acceptance'}
            </h3>
            <p className="text-slate-600 dark:text-app-text-muted mb-4">
              {acceptance.description}
            </p>
            <p className="font-semibold text-primary">
              {acceptance.highlight}
            </p>
          </div>
        </motion.div>
      </section>

      {/* CSS Override for pasted rich-text inline styles */}
      <style dangerouslySetInnerHTML={{__html: `
        .quill-content-override * {
          background-color: transparent !important;
          white-space: normal !important;
          word-wrap: break-word !important;
        }
        .quill-content-override p, 
        .quill-content-override span, 
        .quill-content-override h1, 
        .quill-content-override h2, 
        .quill-content-override h3, 
        .quill-content-override h4, 
        .quill-content-override h5, 
        .quill-content-override h6, 
        .quill-content-override li {
          color: inherit !important;
        }
      `}} />
    </div>
  );
}
