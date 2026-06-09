import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { settingsService } from '../services/settingsService';
import cookieImage from '../assets/footer-illustration/undraw_private-data_7v0o.svg';

export default function CookiePolicy() {
  const [policyData, setPolicyData] = useState(null);
  const [contactInfo, setContactInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [policyRes, contactRes] = await Promise.all([
          settingsService.getCookiePolicy(),
          settingsService.getContactInfo()
        ]);
        setPolicyData(policyRes.data);
        setContactInfo(contactRes.data);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading || !policyData) {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app-bg text-app-text pt-32 pb-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Header Section */}
        <div className="mb-12 max-w-2xl lg:max-w-lg relative z-10">
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
            {policyData.hero?.heading || 'Cookie Policy'}
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-slate-500 dark:text-slate-400 font-medium"
          >
            {policyData.hero?.lastUpdated || 'Last Updated: May 2026'}
          </motion.p>
          {policyData.hero?.introParagraphs?.map((para, idx) => (
            <motion.p
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + (idx * 0.05) }}
              className={`mt-4 ${idx === 0 ? 'text-lg text-slate-600 dark:text-app-text-muted' : 'text-slate-600 dark:text-app-text-muted'}`}
            >
              {para}
            </motion.p>
          ))}
        </div>

        {/* Content Section */}
        <div className="flex flex-col lg:flex-row gap-12 lg:gap-24 relative">
          
          {/* Left Column - Text Content */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex-1 space-y-12 text-slate-600 dark:text-app-text-muted leading-relaxed"
          >
            {policyData.policyData?.map((section) => (
              <section key={section.id}>
                <h2 className="text-2xl font-bold font-heading text-app-text mb-4 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-primary inline-block shrink-0"></span>
                  {section.title}
                </h2>
                <div 
                  className="prose prose-slate dark:prose-invert max-w-none prose-p:text-slate-600 dark:prose-p:text-app-text-muted prose-headings:text-app-text prose-a:text-primary hover:prose-a:text-primary/80 prose-strong:text-app-text"
                  dangerouslySetInnerHTML={{ __html: section.content }} 
                />
              </section>
            ))}

            <section>
              <h2 className="text-2xl font-bold font-heading text-app-text mb-6">Contact Us</h2>
              <p className="mb-6">If you have any questions about our Cookie Policy, please contact us:</p>
              <div className="bg-white dark:bg-app-card p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-app-border space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">@</div>
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Email Address</p>
                    <a href={`mailto:${contactInfo?.email || 'info@vedhunt.in'}`} className="text-app-text font-semibold hover:text-primary transition-colors">
                      {contactInfo?.email || 'info@vedhunt.in'}
                    </a>
                  </div>
                </div>
                <div className="w-full h-px bg-slate-100 dark:bg-app-border"></div>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">#</div>
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Phone Number</p>
                    <a href={`tel:${contactInfo?.phone || '+91 86524 10289'}`} className="text-app-text font-semibold hover:text-primary transition-colors">
                      {contactInfo?.phoneDisplay || contactInfo?.phone || '+91 86524 10289'}
                    </a>
                  </div>
                </div>
                <div className="w-full h-px bg-slate-100 dark:bg-app-border"></div>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">📍</div>
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Address</p>
                    <p className="text-app-text font-semibold">
                      {contactInfo?.address || 'Vedhunt InfoTech, Pune, Maharashtra, India'}
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </motion.div>

          {/* Right Column - Sticky Image */}
          <div className="hidden lg:block lg:w-5/12 relative">
            <div className="sticky top-24 -mt-32 lg:-mt-72 xl:-mt-80">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="relative flex items-center justify-center p-4"
              >
                <img 
                  src={cookieImage} 
                  alt="Cookie Policy" 
                  className="w-full h-auto object-contain dark:opacity-90 transition-opacity"
                />
              </motion.div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
