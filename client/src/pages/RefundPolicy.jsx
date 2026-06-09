import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import refundImage from '../assets/footer-illustration/undraw_absorbed_h2rt.svg';
import { settingsService } from '../services/settingsService';

const AccordionItem = ({ title, content, isOpen, onClick }) => {
  return (
    <div className="bg-white dark:bg-app-card rounded-2xl border border-slate-100 dark:border-app-border overflow-hidden shadow-sm transition-all duration-300">
      <button
        className="w-full px-6 py-5 text-left flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        onClick={onClick}
      >
        <h3 className="font-bold text-app-text">{title}</h3>
        <ChevronDown 
          className={`w-5 h-5 flex-shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180 text-primary' : 'text-slate-400 dark:text-slate-500'}`} 
        />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div 
              className="px-6 pb-6 pt-0 text-sm prose prose-slate dark:prose-invert max-w-none prose-p:text-slate-600 dark:prose-p:text-app-text-muted prose-li:text-slate-600 dark:prose-li:text-app-text-muted leading-relaxed quill-content-override"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function RefundPolicy() {
  const [openAccordion, setOpenAccordion] = useState(0);
  const [data, setData] = useState(null);
  const [contactInfo, setContactInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [policyRes, contactRes] = await Promise.all([
          settingsService.getRefundPolicy(),
          settingsService.getContactInfo()
        ]);
        setData(policyRes.data);
        setContactInfo(contactRes.data);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
      </div>
    );
  }

  const { hero, scope, billingTerms, noRefund, cancellation } = data;

  return (
    <div className="min-h-screen bg-app-bg text-app-text pb-24">

      {/* ── HERO SECTION: two-column (text left, image right) ── */}
      <div className="pt-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-24">

            {/* Left: heading + meta */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex-1"
            >
              <Link
                to="/"
                className="inline-flex items-center text-primary hover:text-primary/80 font-medium mb-6 transition-colors"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Link>
              <h1 className="text-4xl md:text-5xl font-black font-heading mb-4">
                {hero?.heading || 'Refund & Billing Policy'}
              </h1>
              <p className="text-slate-500 dark:text-slate-400 font-medium">
                Last Updated: {hero?.lastUpdated || 'May 2026'}
              </p>
              <p className="mt-4 text-lg text-slate-600 dark:text-app-text-muted">
                {hero?.subtitle || 'Payments, Refunds & Service Terms at Vedhunt'}
              </p>
              <div className="mt-6 space-y-4 text-slate-600 dark:text-app-text-muted leading-relaxed">
                {hero?.paragraphs?.map((p, idx) => (
                  <p key={idx}>{p}</p>
                ))}
              </div>
            </motion.div>

            {/* Right: illustration */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="hidden lg:flex lg:w-5/12 justify-center"
            >
              <img
                src={refundImage}
                alt="Refund & Billing Policy"
                className="w-full max-w-sm h-auto object-contain dark:opacity-90"
              />
            </motion.div>
          </div>
        </div>
      </div>

      {/* ── CONTENT SECTIONS: single-column centered ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-20 space-y-16 text-slate-600 dark:text-app-text-muted leading-relaxed"
      >


        {/* Section 1 */}
        <section>
          <h2 className="text-2xl font-bold font-heading text-app-text mb-6 flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-primary inline-block flex-shrink-0"></span>
            {scope?.title || '1. Scope'}
          </h2>
          <p className="mb-6">{scope?.intro}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {scope?.items?.map((item, i) => (
              <div key={i} className="flex items-start bg-white dark:bg-app-card px-5 py-4 rounded-xl border border-slate-100 dark:border-app-border shadow-sm">
                <span className="text-primary mr-3 mt-0.5 font-bold">•</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Section 2 */}
        <section>
          <h2 className="text-2xl font-bold font-heading text-app-text mb-6 flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-primary inline-block flex-shrink-0"></span>
            {billingTerms?.title || '2. Billing Terms'}
          </h2>
          <div className="space-y-4">
            {billingTerms?.items?.map((term, index) => (
              <AccordionItem 
                key={index}
                title={term.title}
                content={term.content}
                isOpen={openAccordion === index}
                onClick={() => setOpenAccordion(openAccordion === index ? -1 : index)}
              />
            ))}
          </div>
        </section>

        {/* Section 3 */}
        <section>
          <h2 className="text-2xl font-bold font-heading text-app-text mb-4 flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-primary inline-block flex-shrink-0"></span>
            {noRefund?.title || '3. No Refund Policy'}
          </h2>
          <p className="font-bold text-app-text mb-4 text-xl">{noRefund?.subtitle}</p>
          <p className="mb-4">{noRefund?.intro1}</p>
          <p className="mb-6 font-semibold text-app-text">{noRefund?.intro2}</p>
          <ul className="space-y-4 mb-10">
            {noRefund?.noRefundItems?.map((item, i) => (
              <li key={i} className="flex items-start bg-white dark:bg-app-card px-5 py-4 rounded-xl border border-slate-100 dark:border-app-border shadow-sm">
                <span className="text-red-400 mr-3 mt-0.5 font-bold">✗</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          
          <div className="bg-primary/10 p-6 sm:p-8 rounded-2xl border border-primary/20 relative overflow-hidden shadow-sm">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl -mr-16 -mt-16"></div>
            <h3 className="font-bold text-app-text text-xl mb-5 relative z-10">{noRefund?.commitment?.title || 'Our Commitment'}</h3>
            <ul className="space-y-4 relative z-10">
              {noRefund?.commitment?.items?.map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <span className="text-primary mt-0.5 font-bold">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 pt-6 border-t border-primary/20 relative z-10">
              <p className="font-bold text-primary flex items-center gap-2">
                <span className="text-2xl">💬</span> {noRefund?.commitment?.footer}
              </p>
            </div>
          </div>
        </section>

        {/* Section 4 */}
        <section>
          <h2 className="text-2xl font-bold font-heading text-app-text mb-6 flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-primary inline-block flex-shrink-0"></span>
            {cancellation?.title || '4. Project Cancellation'}
          </h2>
          <p className="mb-6">{cancellation?.intro}</p>
          <ul className="space-y-4">
            {cancellation?.items?.map((item, i) => (
              <li key={i} className="flex items-start bg-white dark:bg-app-card px-5 py-4 rounded-xl border border-slate-100 dark:border-app-border shadow-sm">
                <span className="text-primary mr-3 mt-0.5 font-bold">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Contact */}
        <section>
          <h2 className="text-2xl font-bold font-heading text-app-text mb-6">Contact for Billing Support</h2>
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

      {/* CSS Override for pasted rich-text inline styles in accordion */}
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
