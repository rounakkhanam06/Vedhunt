import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import termsImage from '../assets/footer-illustration/undraw_handshake-deal_nwk6.svg';

export default function TermsConditions() {
  return (
    <div className="min-h-screen bg-app-bg text-app-text pt-32 pb-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Header Section */}
        <div className="mb-12">
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
            Terms & Conditions
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-slate-500 dark:text-slate-400 font-medium"
          >
            Last Updated: May 2026
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mt-4 text-lg text-slate-600 dark:text-app-text-muted"
          >
            Website Usage Rules & Policies at Vedhunt
          </motion.p>
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
            <section className="text-lg">
              <p>
                Welcome to Vedhunt InfoTech (“Company,” “we,” “our,” or “us”). By accessing our website www.vedhunt.in, using our services, or accessing the Vedhunt Client Portal, you agree to comply with and be bound by these Terms & Conditions.
              </p>
              <p className="mt-4">
                Please read them carefully before using any of our services. If you do not agree to these Terms, you may not access or use our website or services.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold font-heading text-app-text mb-4 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-primary inline-block"></span>
                1. Legal Entity & Applicability
              </h2>
              <p className="mb-4">Vedhunt InfoTech is an Information Technology and Business Process Solutions provider operating under Indian law. These Terms govern:</p>
              <ul className="space-y-4 pl-2">
                <li className="flex items-start">
                  <span className="text-primary mr-3 mt-1 font-bold">•</span>
                  <span>The use of our website and digital platforms.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-3 mt-1 font-bold">•</span>
                  <span>The engagement of our services, including website/app development, digital marketing, automation, analytics, MIS reporting, and accounting-related solutions.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-3 mt-1 font-bold">•</span>
                  <span>Access to the Vedhunt Client Portal and any associated systems.</span>
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold font-heading text-app-text mb-4 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-primary inline-block"></span>
                2. Acceptance of Terms
              </h2>
              <p className="mb-4">By using this website, registering for services, or signing a project agreement, you acknowledge that:</p>
              <ul className="space-y-4 pl-2">
                <li className="flex items-start">
                  <span className="text-primary mr-3 mt-1 font-bold">•</span>
                  <span>You have read, understood, and agreed to these Terms.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-3 mt-1 font-bold">•</span>
                  <span>You are authorized to act on behalf of the entity you represent (if applicable).</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-3 mt-1 font-bold">•</span>
                  <span>You consent to the collection and processing of data as per our Privacy Policy.</span>
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold font-heading text-app-text mb-4 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-primary inline-block"></span>
                3. Services Overview
              </h2>
              <p className="mb-4">Vedhunt InfoTech provides:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-2 mb-4">
                {[
                  'Website & App Development',
                  'Digital Marketing and Social Media Management',
                  'Automation (SQL, Power BI, Python) and Data Analytics',
                  'MIS & Reporting Services',
                  'Accounting & Financial Analytics',
                  'Business Process Optimization and Consultation'
                ].map((item, i) => (
                  <div key={i} className="flex items-start">
                    <span className="text-primary mr-3 mt-1 font-bold">•</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <p className="mt-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700/50 text-sm">
                Each service may have its own scope, deliverables, timelines, and payment terms defined in a separate agreement or proposal.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold font-heading text-app-text mb-4 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-primary inline-block"></span>
                4. Intellectual Property Rights
              </h2>
              <div className="space-y-6">
                <div className="bg-white dark:bg-app-card p-6 rounded-2xl border border-slate-100 dark:border-app-border shadow-sm">
                  <h3 className="font-bold text-app-text mb-2 text-primary">Ownership of Work</h3>
                  <p className="text-sm">All source code, designs, documents, dashboards, and related deliverables created by Vedhunt InfoTech remain the company’s intellectual property until full payment is received. Upon payment completion, ownership of final deliverables transfers to the client, excluding pre-existing code, frameworks, or proprietary tools.</p>
                </div>
                <div className="bg-white dark:bg-app-card p-6 rounded-2xl border border-slate-100 dark:border-app-border shadow-sm">
                  <h3 className="font-bold text-app-text mb-2 text-primary">Trademarks and Branding</h3>
                  <p className="text-sm">Vedhunt InfoTech trademarks, logos, and brand assets cannot be used without prior written consent.</p>
                </div>
                <div className="bg-white dark:bg-app-card p-6 rounded-2xl border border-slate-100 dark:border-app-border shadow-sm">
                  <h3 className="font-bold text-app-text mb-2 text-primary">Client Data</h3>
                  <p className="text-sm">Client-provided content and data remain the property of the client. Vedhunt only uses such data to deliver services or as legally required.</p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold font-heading text-app-text mb-4 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-primary inline-block"></span>
                5. Confidentiality
              </h2>
              <p className="mb-4">Both Vedhunt InfoTech and the Client agree to:</p>
              <ul className="space-y-4 pl-2">
                <li className="flex items-start">
                  <span className="text-primary mr-3 mt-1 font-bold">•</span>
                  <span>Maintain strict confidentiality of all proprietary, personal, and business data shared during the engagement.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-3 mt-1 font-bold">•</span>
                  <span>Use such information solely for the purpose of project execution.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-3 mt-1 font-bold">•</span>
                  <span>Prevent unauthorized access, duplication, or disclosure.</span>
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold font-heading text-app-text mb-4 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-primary inline-block"></span>
                6. Warranties and Limitations
              </h2>
              <p className="mb-4">Vedhunt InfoTech provides services on a best-effort and professional basis, without guaranteeing outcomes beyond the defined scope.</p>
              <ul className="space-y-4 pl-2 mb-6">
                <li className="flex items-start">
                  <span className="text-red-500 mr-3 mt-1 font-bold">✗</span>
                  <span>We do not warrant uninterrupted, error-free, or 100% bug-free services.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-red-500 mr-3 mt-1 font-bold">✗</span>
                  <span>We are not responsible for issues caused by third-party tools, hosting providers, APIs, or client-side data errors.</span>
                </li>
              </ul>
              
              <div className="bg-primary/10 p-6 sm:p-8 rounded-2xl border border-primary/20 mt-8 relative overflow-hidden shadow-sm">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl -mr-16 -mt-16"></div>
                <h3 className="font-bold text-app-text text-xl mb-4 relative z-10 flex items-center gap-2">
                  <span className="text-xl">⚠️</span> Limitation of Liability
                </h3>
                <p className="relative z-10 text-sm">
                  To the fullest extent permitted by law, Vedhunt InfoTech’s liability for any damages (direct, indirect, incidental, or consequential) shall not exceed the total fees paid by the client for the specific service within the last 6 months.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold font-heading text-app-text mb-6">Contact Information</h2>
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

          {/* Right Column - Sticky Image */}
          <div className="hidden lg:block lg:w-5/12 relative">
            <div className="sticky top-0 -mt-24 lg:-mt-48">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="relative flex items-center justify-center p-4"
              >
                <img 
                  src={termsImage} 
                  alt="Terms & Conditions" 
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
