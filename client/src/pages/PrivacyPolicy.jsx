import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import privacyImage from '../assets/footer-illustration/undraw_handshake-deal_nwk6.svg';
import { settingsService } from '../services/settingsService';

export default function PrivacyPolicy() {
  const [openIndex, setOpenIndex] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await settingsService.getPrivacyPolicy();
        setData(res.data);
      } catch (error) {
        console.error("Error fetching privacy policy:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
      </div>
    );
  }

  const hero = data?.hero || {};
  const policySections = data?.policyData || [];

  return (
    <div className="min-h-screen bg-app-bg text-app-text pt-32 pb-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Hero Section */}
        <div className="flex flex-col lg:flex-row gap-12 lg:gap-24 items-center mb-24">
          
          {/* Left Column - Heading and Intro */}
          <div className="flex-1">
            <Link 
              to="/" 
              className="inline-flex items-center text-primary hover:text-primary/80 font-medium mb-6 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Link>
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-5xl font-black font-heading mb-4"
            >
              Privacy Policy
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-slate-500 dark:text-slate-400 font-medium mb-8"
            >
              {hero.lastUpdated}
            </motion.p>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-lg text-slate-600 dark:text-app-text-muted leading-relaxed space-y-4"
            >
              {hero.introParagraphs?.map((paragraph, idx) => (
                <p key={idx}>{paragraph}</p>
              ))}
            </motion.div>
          </div>

          {/* Right Column - Hero Image */}
          <div className="hidden lg:block lg:w-5/12">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="relative flex items-center justify-center p-4"
            >
              <img 
                src={privacyImage} 
                alt="Privacy and Security Illustration" 
                className="w-full h-auto object-contain dark:opacity-90 transition-opacity"
              />
            </motion.div>
          </div>
        </div>

        {/* Accordion Content Section - Centered at Bottom */}
        <div className="max-w-4xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white dark:bg-app-card rounded-xl shadow-sm border border-slate-200 dark:border-app-border overflow-hidden"
          >
            {policySections.map((section, index) => {
              const isOpen = openIndex === index;
              return (
                <div 
                  key={section.id || index} 
                  className={`border-b border-slate-200 dark:border-app-border last:border-b-0`}
                >
                  <button
                    onClick={() => setOpenIndex(isOpen ? -1 : index)}
                    className="w-full flex items-center justify-between p-4 sm:p-6 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors focus:outline-none"
                  >
                    <span className={`font-semibold text-lg ${isOpen ? 'text-primary' : 'text-slate-800 dark:text-slate-200'}`}>
                      {section.title}
                    </span>
                    <motion.div
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="text-primary flex-shrink-0 ml-4"
                    >
                      <ChevronDown className="w-5 h-5" />
                    </motion.div>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                      >
                        <div 
                          className="px-4 sm:px-6 pb-6 pt-2 prose prose-slate dark:prose-invert max-w-none prose-p:text-slate-600 dark:prose-p:text-slate-400 prose-li:text-slate-600 dark:prose-li:text-slate-400 quill-content-override"
                          dangerouslySetInnerHTML={{ __html: section.content }}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </motion.div>
        </div>

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
    </div>
  );
}
