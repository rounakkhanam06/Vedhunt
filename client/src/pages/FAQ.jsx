import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ChevronDown, MapPin, Mail, Phone, ArrowRight, Loader2 } from 'lucide-react';
import faqImage from '../assets/footer-illustration/undraw_mobile-assistant_iifm.svg';
import { faqService } from '../services/faqService';

const AccordionItem = ({ question, answer, isOpen, onClick }) => {
  return (
    <div className="mb-4 overflow-hidden rounded-xl border border-app-border bg-app-card shadow-sm transition-all duration-300">
      <button
        className={`w-full px-6 py-4 text-left flex justify-between items-center transition-colors duration-300 ${
          isOpen ? 'bg-primary text-black' : 'bg-app-card text-app-text hover:bg-slate-50 dark:hover:bg-slate-800/50'
        }`}
        onClick={onClick}
      >
        <span className="font-semibold pr-4">{question}</span>
        <ChevronDown 
          className={`w-5 h-5 flex-shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180 text-black' : 'text-slate-400 dark:text-slate-500'}`} 
        />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <div className="px-6 py-5 text-app-text-muted text-sm leading-relaxed border-t border-app-border bg-app-bg dark:bg-app-card/50 whitespace-pre-wrap">
              {answer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function FAQ() {
  const [openIndex1, setOpenIndex1] = useState(0);
  const [openIndex2, setOpenIndex2] = useState(0);
  const [content, setContent] = useState(null);
  const [frequentFaqs, setFrequentFaqs] = useState([]);
  const [regularFaqs, setRegularFaqs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchFaqData = async () => {
      try {
        const [contentRes, faqsRes] = await Promise.all([
          faqService.getFaqContent(),
          faqService.getFaqs()
        ]);
        
        setContent(contentRes.data || {});
        
        const allFaqs = faqsRes.data || [];
        setFrequentFaqs(allFaqs.filter(f => f.category === 'frequent'));
        setRegularFaqs(allFaqs.filter(f => f.category === 'regular'));
      } catch (error) {
        console.error('Error fetching FAQ data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFaqData();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-app-bg pt-20 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Fallbacks if content is somehow missing
  const heroTitleParts = content?.heroTitle ? content.heroTitle.split(' ') : ['How', 'can', 'we', 'help', 'you?'];
  const lastTwoWords = heroTitleParts.slice(-2).join(' ');
  const firstWords = heroTitleParts.slice(0, -2).join(' ');

  return (
    <div className="min-h-screen bg-app-bg pt-20">
      {/* Header Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 lg:pt-12 pb-8 lg:pb-16">
        <div className="flex flex-col-reverse lg:flex-row items-center gap-12 lg:gap-24">
          <div className="flex-1 text-center lg:text-left">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center justify-center lg:justify-start gap-2 text-sm font-medium text-app-text-muted mb-4"
            >
              <Link to="/" className="hover:text-primary transition-colors">Home</Link>
              <span>/</span>
              <span className="text-primary">FAQs</span>
            </motion.div>
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-4xl md:text-5xl lg:text-6xl font-black font-heading text-app-text mb-4 leading-tight"
            >
              {firstWords} <br className="hidden lg:block" /><span className="text-primary">{lastTwoWords}</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-app-text-muted text-lg max-w-xl mx-auto lg:mx-0 whitespace-pre-wrap"
            >
              {content?.heroSubtitle || "Find answers to common questions about our services, processes, and how we can help your business thrive."}
            </motion.p>
          </div>
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="flex-1 w-full max-w-md lg:max-w-lg"
          >
            <img 
              src={faqImage} 
              alt="FAQ Support" 
              className="w-full h-auto drop-shadow-xl dark:opacity-90 transition-opacity" 
            />
          </motion.div>
        </div>
      </div>

      {/* Section 1: Frequently Asked Questions */}
      <section className="py-20 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row gap-12 lg:gap-24 items-start">
            <div className="lg:w-1/3">
              <motion.h2 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-3xl md:text-4xl font-black font-heading text-app-text mb-6 leading-tight whitespace-pre-wrap"
              >
                {content?.section1Title || "Frequently Asked\nQuestions"}
              </motion.h2>
              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="text-app-text-muted mb-8 leading-relaxed whitespace-pre-wrap"
              >
                {content?.section1Subtitle || "Find answers to common questions about our services, processes, and how we can help your business thrive in the digital landscape."}
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
              >
                <Link 
                  to="/get-quote" 
                  className="inline-flex items-center gap-2 px-8 py-3.5 bg-slate-900 dark:bg-primary text-white dark:text-black font-bold rounded-full hover:bg-slate-800 dark:hover:bg-primary-hover transition-all duration-300 group shadow-lg"
                >
                  Contact Us
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </motion.div>
            </div>
            
            <div className="lg:w-2/3 w-full">
              {frequentFaqs.map((faq, index) => (
                <AccordionItem 
                  key={faq._id}
                  question={faq.question}
                  answer={faq.answer}
                  isOpen={openIndex1 === index}
                  onClick={() => setOpenIndex1(openIndex1 === index ? -1 : index)}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Regular Questions */}
      <section className="py-24 bg-primary/5 dark:bg-primary/10 relative overflow-hidden">
        {/* Decorative background shapes */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl -mr-48 -mt-48"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-secondary/10 rounded-full blur-3xl -ml-48 -mb-48"></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16">
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-3xl md:text-4xl font-black font-heading text-app-text whitespace-pre-wrap"
            >
              {content?.section2Title || "Regular Questions"}
            </motion.h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            {regularFaqs.map((faq, index) => (
              <AccordionItem 
                key={faq._id}
                question={faq.question}
                answer={faq.answer}
                isOpen={openIndex2 === index}
                onClick={() => setOpenIndex2(openIndex2 === index ? -1 : index)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Section 3: Ask Us Anything */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row gap-16 items-center">
            <div className="lg:w-5/12">
              <motion.h2 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-3xl md:text-4xl font-black font-heading text-app-text mb-6 whitespace-pre-wrap"
              >
                {content?.contactTitle || "Ask Us Anything"}
              </motion.h2>
              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="text-app-text-muted mb-10 leading-relaxed whitespace-pre-wrap"
              >
                {content?.contactSubtitle || "Have a specific question or a custom project in mind? Drop us a message and our team will get back to you promptly with the information you need."}
              </motion.p>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="space-y-6"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-app-text font-medium">{content?.contactAddress || "123, Tech Hub Road, Mumbai"}</p>
                    <p className="text-sm text-app-text-muted">{content?.contactAddressSub || "Maharashtra, India"}</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Mail className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-app-text font-medium">{content?.contactEmail || "info@vedhunt.in"}</p>
                    <p className="text-sm text-app-text-muted">{content?.contactEmailSub || "Online Support"}</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Phone className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-app-text font-medium">{content?.contactPhone || "+91 86524 10289"}</p>
                    <p className="text-sm text-app-text-muted">{content?.contactPhoneSub || "Mon-Fri 9am-6pm"}</p>
                  </div>
                </div>
              </motion.div>
            </div>
            
            <div className="lg:w-7/12 w-full">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="bg-slate-900 dark:bg-app-card rounded-3xl p-8 md:p-12 shadow-2xl border border-slate-800 relative overflow-hidden"
              >
                {/* Decorative dots in the corner */}
                <div className="absolute top-0 right-0 p-4 opacity-20 pointer-events-none">
                  <div className="grid grid-cols-4 gap-2">
                    {[...Array(16)].map((_, i) => (
                      <div key={i} className="w-1.5 h-1.5 rounded-full bg-white"></div>
                    ))}
                  </div>
                </div>
                
                <form className="space-y-6 relative z-10" onSubmit={(e) => e.preventDefault()}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <input 
                        type="text" 
                        placeholder="First Name" 
                        className="w-full bg-white dark:bg-slate-900 px-5 py-4 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary transition-all border border-transparent dark:border-slate-800"
                        required
                      />
                    </div>
                    <div>
                      <input 
                        type="text" 
                        placeholder="Last Name" 
                        className="w-full bg-white dark:bg-slate-900 px-5 py-4 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary transition-all border border-transparent dark:border-slate-800"
                        required
                      />
                    </div>
                  </div>
                  
                  <div>
                    <input 
                      type="email" 
                      placeholder="Email" 
                      className="w-full bg-white dark:bg-slate-900 px-5 py-4 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary transition-all border border-transparent dark:border-slate-800"
                      required
                    />
                  </div>
                  
                  <div>
                    <textarea 
                      placeholder="Message" 
                      rows="4"
                      className="w-full bg-white dark:bg-slate-900 px-5 py-4 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary transition-all resize-none border border-transparent dark:border-slate-800"
                      required
                    ></textarea>
                  </div>
                  
                  <div className="flex justify-end">
                    <button 
                      type="submit"
                      className="px-8 py-3.5 bg-primary text-black font-bold rounded-xl hover:bg-primary-hover hover:shadow-[0_0_20px_rgba(255,107,0,0.4)] transition-all duration-300"
                    >
                      Send Message
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
