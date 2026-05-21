import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import cookieImage from '../assets/footer-illustration/undraw_private-data_7v0o.svg';

export default function CookiePolicy() {
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
            Cookie Policy
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
            How we use cookies to improve your experience on our platform.
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
                Vedhunt InfoTech ("we", "us", or "our") uses cookies and similar tracking technologies to track activity on our service and hold certain information. This Cookie Policy explains what cookies are, how we use them, and your choices regarding their use.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold font-heading text-app-text mb-4 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-primary inline-block"></span>
                1. What Are Cookies?
              </h2>
              <p className="mb-4">
                Cookies are small files that are placed on your computer, mobile device, or any other device by a website, containing the details of your browsing history on that website among its many uses. They are widely used in order to make websites work, or work more efficiently, as well as to provide reporting information.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold font-heading text-app-text mb-4 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-primary inline-block"></span>
                2. How We Use Cookies
              </h2>
              <p className="mb-4">We use cookies for a variety of reasons detailed below:</p>
              <ul className="space-y-4 pl-2">
                <li className="flex items-start">
                  <span className="text-primary mr-3 mt-1 font-bold">•</span>
                  <span><strong>To provide functionality:</strong> Certain cookies are essential for our website to function properly and for you to use its features securely.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-3 mt-1 font-bold">•</span>
                  <span><strong>For analytics and performance:</strong> We use cookies to analyze how visitors interact with our website, which pages are visited most often, and to identify any errors or issues.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-3 mt-1 font-bold">•</span>
                  <span><strong>For marketing:</strong> These cookies are used to track visitors across websites to display ads that are relevant and engaging for the individual user.</span>
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold font-heading text-app-text mb-4 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-primary inline-block"></span>
                3. Types of Cookies We Use
              </h2>
              <div className="space-y-6">
                <div className="bg-white dark:bg-app-card p-6 rounded-2xl border border-slate-100 dark:border-app-border">
                  <h3 className="font-bold text-app-text mb-2">Essential Cookies</h3>
                  <p className="text-sm">These cookies are strictly necessary to provide you with services available through our website. Because these cookies are strictly necessary to deliver the website, refusing them will have an impact on how our site functions.</p>
                </div>
                <div className="bg-white dark:bg-app-card p-6 rounded-2xl border border-slate-100 dark:border-app-border">
                  <h3 className="font-bold text-app-text mb-2">Analytics & Customization Cookies</h3>
                  <p className="text-sm">These cookies collect information that is used either in aggregate form to help us understand how our website is being used or how effective our marketing campaigns are, or to help us customize our website for you.</p>
                </div>
                <div className="bg-white dark:bg-app-card p-6 rounded-2xl border border-slate-100 dark:border-app-border">
                  <h3 className="font-bold text-app-text mb-2">Advertising Cookies</h3>
                  <p className="text-sm">These cookies are used to make advertising messages more relevant to you. They perform functions like preventing the same ad from continuously reappearing, ensuring that ads are properly displayed for advertisers, and in some cases selecting advertisements that are based on your interests.</p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold font-heading text-app-text mb-4 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-primary inline-block"></span>
                4. Your Choices Regarding Cookies
              </h2>
              <p className="mb-4">
                If you prefer to avoid the use of cookies on the website, you must first disable the use of cookies in your browser and then delete the cookies saved in your browser associated with this website. You may use this option for preventing the use of cookies at any time.
              </p>
              <p className="mb-4">
                Please note that if you do not accept our cookies, you may experience some inconvenience in your use of the website and some features may not function properly.
              </p>
              <div className="bg-primary/10 p-6 sm:p-8 rounded-2xl border border-primary/20 mt-8 relative overflow-hidden shadow-sm">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl -mr-16 -mt-16"></div>
                <h3 className="font-bold text-app-text text-xl mb-4 relative z-10">Browser Settings</h3>
                <p className="relative z-10 text-sm mb-4">You can usually change your browser settings to decline cookies. To find out how to manage cookies on popular browsers, please visit:</p>
                <ul className="space-y-3 relative z-10 text-sm">
                  <li className="flex items-center gap-2"><span>•</span> <a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noreferrer" className="text-primary hover:underline">Google Chrome</a></li>
                  <li className="flex items-center gap-2"><span>•</span> <a href="https://support.apple.com/guide/safari/manage-cookies-and-website-data-sfri11471/mac" target="_blank" rel="noreferrer" className="text-primary hover:underline">Apple Safari</a></li>
                  <li className="flex items-center gap-2"><span>•</span> <a href="https://support.mozilla.org/en-US/kb/enhanced-tracking-protection-firefox-desktop" target="_blank" rel="noreferrer" className="text-primary hover:underline">Mozilla Firefox</a></li>
                  <li className="flex items-center gap-2"><span>•</span> <a href="https://support.microsoft.com/en-us/windows/microsoft-edge-browsing-data-and-privacy-bb8174ba-9d73-dcf2-9b4a-c582b4e640dd" target="_blank" rel="noreferrer" className="text-primary hover:underline">Microsoft Edge</a></li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold font-heading text-app-text mb-6">Contact Us</h2>
              <p className="mb-6">If you have any questions about our Cookie Policy, please contact us:</p>
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
