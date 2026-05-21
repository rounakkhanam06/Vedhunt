import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import privacyImage from '../assets/footer-illustration/undraw_handshake-deal_nwk6.svg';

export default function PrivacyPolicy() {
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
            Privacy Policy
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-slate-500 dark:text-slate-400 font-medium"
          >
            Last Updated: May 2026
          </motion.p>
        </div>

        {/* Content Section */}
        <div className="flex flex-col lg:flex-row gap-12 lg:gap-24 relative">
          
          {/* Left Column - Text Content */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex-1 space-y-10 text-slate-600 dark:text-app-text-muted leading-relaxed"
          >
            <section className="text-lg">
              <p>
                Your privacy is important to us. It is Vedhunt InfoTech's policy to respect your privacy regarding any information we may collect from you across our website, and other sites we own and operate.
              </p>
              <p className="mt-4">
                We only collect information about you if we have a reason to do so — for example, to provide our Services, to communicate with you, or to make our Services better.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold font-heading text-app-text mb-6">Information We Collect</h2>
              
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-app-text mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary"></span>
                    Personal Information
                  </h3>
                  <p className="ml-4">We collect personal information that you provide to us when you use our Services, such as your name, email address, and any other contact information you provide.</p>
                </div>
                
                <div>
                  <h3 className="text-lg font-bold text-app-text mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary"></span>
                    Usage Data
                  </h3>
                  <p className="ml-4">We collect information about your interactions with our Services, such as the pages you visit, the links you click, and the search terms you use.</p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold font-heading text-app-text mb-6">How We Use Information</h2>
              <p className="mb-4">We use the information we collect in various ways, including to:</p>
              <ul className="space-y-3">
                {[
                  'Provide, operate, and maintain our website.',
                  'Improve, personalize, and expand our website.',
                  'Understand and analyze how you use our website.',
                  'Develop new products, services, features, and functionality.',
                  'Communicate with you, either directly or through one of our partners, for customer service, updates, and marketing.'
                ].map((item, index) => (
                  <li key={index} className="flex items-start">
                    <span className="text-primary mr-3 mt-1">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold font-heading text-app-text mb-6">Data Storage and Security</h2>
              <p>
                Your information is stored securely on encrypted servers and trusted cloud platforms. We employ enterprise-grade security systems including SSL encryption, multi-factor authentication, and regular audits to ensure your data remains protected.
              </p>
              <div className="mt-6 p-6 bg-primary/5 dark:bg-primary/10 rounded-2xl border border-primary/10 dark:border-primary/20 flex items-start gap-4">
                <span className="text-2xl">💡</span>
                <p className="font-medium text-app-text text-sm">
                  We do not collect unnecessary personal data, and we never sell, trade, or rent your information to third parties.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold font-heading text-app-text mb-6">Contact Us</h2>
              <p className="mb-6">If you have any questions or concerns regarding this Privacy Policy, please reach out to our team:</p>
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
              </div>
            </section>
          </motion.div>

          {/* Right Column - Sticky Image */}
          <div className="hidden lg:block lg:w-5/12 relative">
            <div className="sticky top-8 -mt-12 lg:-mt-24">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4, duration: 0.5 }}
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

        </div>
      </div>
    </div>
  );
}
