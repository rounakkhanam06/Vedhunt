import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import refundImage from '../assets/footer-illustration/undraw_absorbed_h2rt.svg';

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
            <div className="px-6 pb-6 pt-0 text-sm text-slate-600 dark:text-app-text-muted leading-relaxed">
              {content}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function RefundPolicy() {
  const [openAccordion, setOpenAccordion] = useState(0);

  const billingTerms = [
    {
      title: "1. Quotation & Agreement",
      content: "Every project or engagement is initiated after a written quotation, proposal, or agreement is mutually approved. The scope of work, timeline, and payment schedule are clearly defined before commencement."
    },
    {
      title: "2. Advance Payment",
      content: "Projects typically begin with an advance payment (as mentioned in the quotation or agreement). The advance is considered a confirmation of engagement and allocation of dedicated resources."
    },
    {
      title: "3. Milestone-Based Billing",
      content: "Depending on the project type, billing may occur at key milestones, deliverable completion, or on a monthly retainer basis. All invoices are shared electronically, inclusive of applicable taxes (GST or others)."
    },
    {
      title: "4. Accepted Payment Methods",
      content: (
        <ul className="space-y-2">
          <li className="flex items-center gap-2"><span className="text-primary">•</span> Bank Transfer (NEFT / RTGS / IMPS)</li>
          <li className="flex items-center gap-2"><span className="text-primary">•</span> UPI / Payment Gateway</li>
          <li className="flex items-center gap-2"><span className="text-primary">•</span> International Wire Transfer (for overseas clients)</li>
        </ul>
      )
    }
  ];

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
                Refund & Billing Policy
              </h1>
              <p className="text-slate-500 dark:text-slate-400 font-medium">
                Last Updated: May 2026
              </p>
              <p className="mt-4 text-lg text-slate-600 dark:text-app-text-muted">
                Payments, Refunds & Service Terms at Vedhunt
              </p>
              <div className="mt-6 space-y-4 text-slate-600 dark:text-app-text-muted leading-relaxed">
                <p>
                  At Vedhunt InfoTech, we are committed to delivering high-quality, customized solutions that add measurable value to our clients' businesses. Our services are intellectual and time-based, meaning they involve professional expertise, research, planning, and effort invested from the moment a project begins.
                </p>
                <p>
                  For this reason, our billing and refund policy is designed to maintain fairness, transparency, and mutual respect between Vedhunt InfoTech and our clients.
                </p>
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
            1. Scope
          </h2>
          <p className="mb-6">This policy applies to all professional services offered by Vedhunt InfoTech, including:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              'Website & App Development',
              'Digital Marketing & Social Media Management',
              'Automation (SQL / Power BI / Python)',
              'MIS & Reporting Services',
              'Accounting & Financial Services',
              'Data Analytics, AI, and Consulting Projects'
            ].map((item, i) => (
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
            2. Billing Terms
          </h2>
          <div className="space-y-4">
            {billingTerms.map((term, index) => (
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
            3. No Refund Policy
          </h2>
          <p className="font-bold text-app-text mb-4 text-xl">Vedhunt InfoTech follows a strict No Refund Policy for all its professional services.</p>
          <p className="mb-4">This is because our services involve significant intellectual effort, skilled manpower, and time investments that begin immediately upon project initiation.</p>
          <p className="mb-6 font-semibold text-app-text">We do not offer refunds for:</p>
          <ul className="space-y-4 mb-10">
            {[
              'Projects where any stage of design, development, or setup has commenced.',
              'Completed milestones, approved deliverables, or ongoing work-in-progress.',
              'Retainer, subscription, or maintenance plans once service has started.',
              'Third-party costs (e.g., domain, hosting, ad spend, software licenses, API integrations).'
            ].map((item, i) => (
              <li key={i} className="flex items-start bg-white dark:bg-app-card px-5 py-4 rounded-xl border border-slate-100 dark:border-app-border shadow-sm">
                <span className="text-red-400 mr-3 mt-0.5 font-bold">✗</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          
          <div className="bg-primary/10 p-6 sm:p-8 rounded-2xl border border-primary/20 relative overflow-hidden shadow-sm">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl -mr-16 -mt-16"></div>
            <h3 className="font-bold text-app-text text-xl mb-5 relative z-10">Our Commitment</h3>
            <ul className="space-y-4 relative z-10">
              {[
                'Every project is executed with clear communication and transparency.',
                'In case of any dissatisfaction, Vedhunt will work collaboratively to review, revise, or realign deliverables within the agreed scope.',
                'If a delay or issue arises due to our side, we will rectify or adjust timelines — instead of processing refunds — ensuring that our clients always receive complete value for their investment.'
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <span className="text-primary mt-0.5 font-bold">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 pt-6 border-t border-primary/20 relative z-10">
              <p className="font-bold text-primary flex items-center gap-2">
                <span className="text-2xl">💬</span> Our priority is long-term client satisfaction, not one-time transactions.
              </p>
            </div>
          </div>
        </section>

        {/* Section 4 */}
        <section>
          <h2 className="text-2xl font-bold font-heading text-app-text mb-6 flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-primary inline-block flex-shrink-0"></span>
            4. Project Cancellation
          </h2>
          <p className="mb-6">Clients may request cancellation by written notice (email to info@vedhunt.in). In such cases:</p>
          <ul className="space-y-4">
            {[
              'Work completed up to the date of cancellation will be billed in full.',
              'Advance payments already received are non-refundable, as resources and time are already allocated.',
              'If any external vendor costs have been incurred (e.g., ads, hosting, tools), these will also be chargeable.'
            ].map((item, i) => (
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
                <a href="mailto:info@vedhunt.in" className="text-app-text font-semibold hover:text-primary transition-colors">info@vedhunt.in</a>
              </div>
            </div>
            <div className="w-full h-px bg-slate-100 dark:bg-app-border"></div>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">#</div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Phone Number</p>
                <p className="text-app-text font-semibold">+91 86524 10289</p>
              </div>
            </div>
            <div className="w-full h-px bg-slate-100 dark:bg-app-border"></div>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">📍</div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Address</p>
                <p className="text-app-text font-semibold">Vedhunt InfoTech, Pune, Maharashtra, India</p>
              </div>
            </div>
          </div>
        </section>
      </motion.div>
    </div>
  );
}
