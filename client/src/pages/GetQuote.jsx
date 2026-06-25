import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Phone, 
  Mail, 
  ArrowRight, 
  ArrowLeft,
  AlertCircle, 
  MapPin, 
  Smartphone, 
  CheckCircle2,
  Monitor,
  LineChart,
  Target,
  FileSpreadsheet,
  Calculator,
  Check,
  Link as LinkIcon,
  ChevronDown,
  Palette,
  Ship,
  Settings
} from 'lucide-react';
import { useContactInfo } from '../context/ContactInfoContext';
import api from '../services/api';

// Inline premium custom SVG brand icons
const FacebookIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
);

const InstagramIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);

const LinkedinIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect width="4" height="12" x="2" y="9" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);

const YoutubeIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
    <path d="m10 15 5-3-5-3z" />
  </svg>
);

// Services Data
const servicesOptions = [
  { id: 'website', label: 'Website Development', desc: 'Business / Ecommerce', icon: Monitor },
  { id: 'app', label: 'App Development', desc: 'Android / iOS / Flutter', icon: Smartphone },
  { id: 'digital_marketing', label: 'Digital Marketing', desc: 'SEO / Social / Content', icon: LineChart },
  { id: 'performance_marketing', label: 'Performance Marketing', desc: 'Google / Meta / PPC', icon: Target },
  { id: 'mis', label: 'MIS & Reporting', desc: 'Power BI / Excel', icon: FileSpreadsheet },
  { id: 'accounting', label: 'Accounting & Finance', desc: 'GST / Books / Payroll', icon: Calculator },
  { id: 'graphic_design', label: 'Logo & Graphic Design', desc: 'Branding / Creatives', icon: Palette },
  { id: 'shipping', label: 'Shipping Management', desc: 'Logistics / Freight', icon: Ship },
  { id: 'workflow', label: 'Workflow Management', desc: 'Automation / Systems', icon: Settings },
];

const timelineOptions = ['Immediately', 'Within 1 Month', '1-3 Months', 'Just Exploring'];

// Dynamic form configuration based on service
const serviceFormConfig = {
  website: {
    radios: [
      { name: 'websiteType', label: 'Website Type *', options: ['Business / Corporate', 'Ecommerce Store', 'Landing Page', 'Web App / Portal', 'Redesign Existing'] },
      { name: 'hasWebsite', label: 'Do you have a website currently?', options: ['Yes', 'No'] },
      { name: 'sizeScope', label: 'Size / Scope', options: ['1-5 pages', '5-15 pages', '15+ pages', '50+ products', 'Not sure'] },
      { name: 'designStatus', label: 'Design Status', options: ['Design ready', 'Need design', 'Have logo / brand only'] },
      { name: 'projectBudget', label: 'Project Budget (INR) *', options: ['Below 25K', '25K-75K', '75K-2L', '2L-5L', 'Above 5L', 'Not sure'] }
    ],
    inputs: [
      { name: 'existingWebsiteUrl', label: 'Existing Website URL *', type: 'url', placeholder: 'https://yoursite.com', showIf: { field: 'hasWebsite', value: 'Yes' } }
    ],
    checkboxes: { name: 'websiteFeatures', label: 'Key Features Needed', options: ['Payment Gateway', 'Bookings / Appointments', 'User Login', 'Blog / CMS', 'Multi-language', 'Live Chat'] },
    textarea: { name: 'projectIdea', label: 'Describe Your Goals *', placeholder: 'What does this website need to achieve for your business?' }
  },
  app: {
    radios: [
      { name: 'platform', label: 'Platform *', options: ['Android', 'iOS', 'Both', 'Cross-platform (Flutter)', 'Not sure'] },
      { name: 'currentStage', label: 'Current Stage', options: ['New idea', 'Have requirement doc', 'MVP needed', 'Improve existing app'] },
      { name: 'designsReady', label: 'Designs / Wireframes Ready?', options: ['Yes', 'No'] },
      { name: 'projectBudget', label: 'Project Budget (INR) *', options: ['Below 1L', '1L-3L', '3L-7L', '7L-15L', 'Above 15L', 'Not sure'] }
    ],
    dropdowns: [
      { name: 'appCategory', label: 'App Category', options: ['E-commerce', 'Social', 'Utility', 'Health & Fitness', 'Education', 'Other'] }
    ],
    checkboxes: { name: 'appFeatures', label: 'Key Features', options: ['User Login', 'Payments', 'Push Notifications', 'Maps / GPS', 'Chat', 'Admin Panel', 'API Integration'] },
    textarea: { name: 'projectIdea', label: 'Describe Your Goals *', placeholder: 'Describe your app idea and the core problem it solves.' }
  },
  digital_marketing: {
    subtitle: 'Tell us about your growth goals.',
    checkboxes: { name: 'servicesNeeded', label: 'Services Needed *', options: ['SEO', 'Social Media Management', 'Content Marketing', 'Email Marketing', 'Influencer / UGC'] },
    dropdowns: [
      { name: 'businessType', label: 'Business Type', options: ['B2B', 'B2C', 'Ecommerce', 'Local Business', 'SaaS / Tech'] }
    ],
    radios: [
      { name: 'haveWebsiteSocial', label: 'Have Website / Social Accounts?', options: ['Yes', 'No'] },
      { name: 'primaryGoal', label: 'Primary Goal', options: ['Brand Awareness', 'Website Traffic', 'Leads', 'Engagement', 'Sales'] },
      { name: 'engagementType', label: 'Engagement Type', options: ['Monthly Retainer', 'One-time Project', 'Not sure'] },
      { name: 'projectBudget', label: 'Project Budget (INR) *', options: ['Below 25K', '25K-50K', '50K-1L', '1L-2L', 'Above 2L', 'Not sure'] }
    ],
    textarea: { name: 'projectIdea', label: 'Describe Your Goals *', placeholder: 'What growth result are you aiming for in the next 90 days?' }
  },
  performance_marketing: {
    subtitle: 'Tell us about your paid advertising goals.',
    dropdowns: [
      { name: 'adPlatform', label: 'Ad Platform *', options: ['Google Ads', 'Meta (FB / Instagram)', 'Both', 'LinkedIn Ads', 'YouTube', 'Not sure'] },
      { name: 'monthlyAdSpend', label: 'Monthly Ad Spend (INR)', options: ['Below ₹50K', '₹50K–1L', '₹1L–3L', '₹3L–5L', 'Above ₹5L'] }
    ],
    radios: [
      { name: 'currentlyRunningAds', label: 'Currently Running Ads?', options: ['Yes', 'No'] },
      { name: 'primaryGoal', label: 'Primary Goal', options: ['Leads', 'Sales', 'Awareness', 'App Installs'] },
      { name: 'projectBudget', label: 'Project Budget (INR) *', options: ['Below 25K', '25K-75K', '75K-2L', '2L-5L', 'Above 5L', 'Not sure'] }
    ],
    inputs: [
      { name: 'landingPageUrl', label: 'Landing Page URL', type: 'url', placeholder: 'vedhunt.in' }
    ],
    textarea: { name: 'projectIdea', label: 'Describe Your Goals *', placeholder: 'You can connect me any time' }
  },
  mis: {
    subtitle: 'Tell us what you want to measure and visualise.',
    radios: [
      { name: 'toolPreference', label: 'Tool Preference *', options: ['Power BI', 'Excel', 'Both', 'Recommend for me'] },
      { name: 'updateFrequency', label: 'Update Frequency', options: ['Real-time / Live', 'Daily', 'Weekly', 'Monthly', 'One-time'] },
      { name: 'engagementType', label: 'Engagement Type', options: ['Monthly Retainer', 'One-time'] },
      { name: 'projectBudget', label: 'Project Budget (INR) *', options: ['Below 25K', '25K-75K', '75K-1.5L', 'Above 1.5L', 'Not sure'] }
    ],
    dropdowns: [
      { name: 'dataSource', label: 'Data Source', options: ['Excel / CSV', 'Google Sheets', 'Database (SQL)', 'CRM / ERP', 'Multiple sources', 'Not sure'] }
    ],
    checkboxes: { name: 'whatYouNeed', label: 'What do you need?', options: ['Live Dashboard', 'Automated Reports', 'Data Cleaning', 'Sales / MIS Report', 'Financial Dashboard', 'KPI Tracking'] },
    textarea: { name: 'projectIdea', label: 'Describe Your Goals *', placeholder: 'What decisions should this dashboard help you make?' }
  },
  accounting: {
    subtitle: 'Tell us about your compliance and finance needs.',
    checkboxes: { name: 'servicesNeeded', label: 'Services Needed *', options: ['GST Filing', 'Bookkeeping', 'Payroll', 'ITR Filing', 'Audit Support', 'Financial MIS'] },
    dropdowns: [
      { name: 'businessType', label: 'Business Type', options: ['Proprietorship', 'Partnership / LLP', 'Pvt Ltd', 'Startup', 'Individual'] }
    ],
    radios: [
      { name: 'gstRegistered', label: 'GST Registered?', options: ['Yes', 'No', 'Need Registration'] },
      { name: 'monthlyTransactionVolume', label: 'Monthly Transaction Volume', options: ['Below 50', '50–200', '200–500', '500+', 'Not sure'] },
      { name: 'currentSetup', label: 'Current Setup', options: ['Tally', 'Zoho / QuickBooks', 'Excel only', 'Nothing in place', 'Have existing CA'] },
      { name: 'engagementType', label: 'Engagement Type', options: ['Monthly Retainer', 'Annual Compliance', 'One-time'] }
    ],
    textarea: { name: 'projectIdea', label: 'Describe Your Goals *', placeholder: 'Describe your current accounting setup and pain points.' }
  },
  graphic_design: {
    subtitle: 'Tell us what you want designed.',
    checkboxes: { name: 'whatYouNeed', label: 'What do you need? *', options: ['Logo', 'Brand Identity Kit', 'Social Media Creatives', 'Brochure / Flyer', 'Packaging', 'Business Cards'] },
    radios: [
      { name: 'haveBrandGuidelines', label: 'Have Brand Guidelines?', options: ['Yes', 'No'] },
      { name: 'stylePreference', label: 'Style Preference', options: ['Minimal', 'Modern', 'Bold', 'Classic', 'Not sure'] },
      { name: 'deliveryTimeline', label: 'Delivery Timeline', options: ['Urgent (3–5 days)', '1–2 weeks', 'Flexible'] },
      { name: 'engagementType', label: 'Engagement Type', options: ['Monthly Retainer', 'One-time'] },
      { name: 'projectBudget', label: 'Project Budget (INR) *', options: ['Below 10K', '10K-25K', '25K-50K', 'Above 50K', 'Not sure'] }
    ],
    textarea: { name: 'projectIdea', label: 'Describe Your Goals *', placeholder: 'Describe what you want designed and any references you like.' }
  },
  shipping: {
    subtitle: 'Tell us about your shipping or logistics business.',
    dropdowns: [
      { name: 'businessType', label: 'Business Type *', options: ['Freight Forwarding', 'Courier / Logistics', 'Import / Export', 'Warehousing', 'Shipping Line / Agency'] }
    ],
    checkboxes: { name: 'servicesNeeded', label: 'Services Needed', options: ['Operations Management', 'Documentation', 'Digital System / Software', 'Marketing', 'Accounting / Compliance'] },
    radios: [
      { name: 'currentSystem', label: 'Current System In Place?', options: ['Yes', 'No'] },
      { name: 'teamFleetSize', label: 'Team / Fleet Size', options: ['1–10', '10–50', '50+', 'Not applicable'] },
      { name: 'engagementType', label: 'Engagement Type', options: ['Monthly Retainer', 'One-time', 'Consultation'] }
    ],
    textarea: { name: 'projectIdea', label: 'Describe Your Goals *', placeholder: "Describe what you'd like Vedhunt to manage or build." }
  },
  workflow: {
    subtitle: 'Tell us where your operations slow down.',
    checkboxes: { name: 'whatToImprove', label: 'What do you want to improve? *', options: ['Lead / Sales Process', 'Project Management', 'Team Productivity', 'Approvals / Docs', 'Reporting / MIS', 'End-to-end Automation'] },
    dropdowns: [
      { name: 'currentTools', label: 'Current Tools', options: ['Excel / Spreadsheets', 'Jira / Asana / Trello', 'Notion / Monday.com', 'Custom Software', 'Other'] }
    ],
    radios: [
      { name: 'teamSize', label: 'Team Size', options: ['1–5', '5–20', '20–50', '50+'] },
      { name: 'biggestPainPoint', label: 'Biggest Pain Point', options: ['Too much manual work', 'No visibility', 'Things slip through', 'Slow approvals', 'Scaling issues'] },
      { name: 'engagementType', label: 'Engagement Type', options: ['Monthly Retainer', 'One-time Setup', 'Consultation'] },
      { name: 'projectBudget', label: 'Project Budget (INR) *', options: ['Below 25K', '25K-75K', '75K-2L', 'Above 2L', 'Not sure'] }
    ],
    textarea: { name: 'projectIdea', label: 'Describe Your Goals *', placeholder: 'Describe the workflow problem costing you the most time.' }
  }
};

export default function GetQuote() {
  const { contactInfo } = useContactInfo();
  const [step, setStep] = useState(1);
  const [isSubmitSuccess, setIsSubmitSuccess] = useState(false);
  const [submittedData, setSubmittedData] = useState(null);
  
  // Custom states for checkbox groups to work easily without complex react-hook-form setups
  const [checkboxState, setCheckboxState] = useState({});

  const {
    register,
    handleSubmit,
    formState: { errors },
    trigger,
    watch,
    setValue,
    getValues,
    reset
  } = useForm({
    defaultValues: {
      firstName: '',
      lastName: '',
      company: '',
      email: '',
      phone: '',
      city: '',
      source: '',
      service: '',
      timeline: '',
      projectIdea: '',
      platform: ''
    }
  });

  const selectedService = watch('service');

  const onSubmitForm = async (data) => {
    // Prevent submission if not on the final review step (e.g. if user presses Enter key early)
    if (step < 4) {
      nextStep();
      return;
    }

    try {
      // Combine react-hook-form data with our custom checkbox states
      const finalData = { ...data, ...checkboxState };
      const urlParams = new URLSearchParams(window.location.search);
      // Build dynamic message with all the details
      let fullMessage = `Timeline: ${finalData.timeline || 'Not specified'}\n\n`;
      const config = serviceFormConfig[finalData.service];
      if (config) {
        if (config.dropdowns) config.dropdowns.forEach(f => {
          if (finalData[f.name]) fullMessage += `${f.label.replace(' *', '')}: ${finalData[f.name]}\n`;
        });
        if (config.radios) config.radios.forEach(f => {
          if (finalData[f.name]) fullMessage += `${f.label.replace(' *', '')}: ${finalData[f.name]}\n`;
        });
        if (config.inputs) config.inputs.forEach(f => {
          if (finalData[f.name]) fullMessage += `${f.label.replace(' *', '')}: ${finalData[f.name]}\n`;
        });
        if (config.checkboxes && finalData[config.checkboxes.name]?.length > 0) {
          fullMessage += `${config.checkboxes.label.replace(' *', '')}: ${finalData[config.checkboxes.name].join(', ')}\n`;
        }
        if (config.textarea && finalData[config.textarea.name]) {
          fullMessage += `\n${config.textarea.label.replace(' *', '')}:\n${finalData[config.textarea.name]}\n`;
        }
      } else if (finalData.projectIdea) {
        fullMessage += `Details:\n${finalData.projectIdea}\n`;
      }

      const payload = {
        fullName: `${finalData.firstName} ${finalData.lastName || ''}`.trim(),
        phone: finalData.phone,
        email: finalData.email,
        service: servicesOptions.find(s => s.id === finalData.service)?.label || finalData.service || 'Not Specified',
        businessName: finalData.company,
        message: fullMessage.trim(),
        consent: true,
        source: finalData.source || window.location.href || 'Get Quote Page',
        city: finalData.city,
        platform: 'Website',
        utmSource: urlParams.get('utm_source') || '',
        utmMedium: urlParams.get('utm_medium') || '',
        utmCampaign: urlParams.get('utm_campaign') || '',
        utmContent: urlParams.get('utm_content') || '',
        utmTerm: urlParams.get('utm_term') || ''
      };

      await api.post('/leads', payload);

      setSubmittedData(finalData);
      setIsSubmitSuccess(true);
      
      // Success message will remain until the user manually clicks "Submit New Inquiry"
      
      // Trigger tracking
      if (window.gtag) {
        window.gtag('event', 'conversion', {
          'send_to': 'AW-10976080417/8TJtCIb2vMIcEKHk5vEo',
          'value': 1.0,
          'currency': 'INR'
        });
      }

      if (window.trackConversion) {
        window.trackConversion({
          value: 0,
          currency: 'INR',
          service: finalData.service,
          timeline: finalData.timeline,
          source: finalData.source || 'GetQuote Form'
        });
      }
      
      if (window.fbq) {
        window.fbq('track', 'Lead', {
          content_name: payload.service,
          currency: 'INR',
          value: 0
        });
      }

      reset();
      setCheckboxState({});
      setStep(1);
    } catch (error) {
      console.error('Error submitting quote request:', error);
      alert('Failed to submit request. Please try again later.');
    }
  };

  const nextStep = async () => {
    let isValid = false;
    if (step === 1) {
      isValid = await trigger(['firstName', 'lastName', 'email', 'phone']);
    } else if (step === 2) {
      isValid = await trigger(['service']);
      if (!selectedService) {
        // Validation handled by required rules mostly, but forcing check
        return;
      }
      isValid = true;
    } else if (step === 3) {
      const fieldsToValidate = ['projectIdea'];
      const config = serviceFormConfig[selectedService];
      if (config) {
        if (config.dropdowns) config.dropdowns.forEach(dd => fieldsToValidate.push(dd.name));
        if (config.inputs) config.inputs.forEach(inp => {
          if (!inp.showIf || watch(inp.showIf.field) === inp.showIf.value) {
            fieldsToValidate.push(inp.name);
          }
        });
      }
      isValid = await trigger(fieldsToValidate);
    }
    
    if (isValid) {
      setStep((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const prevStep = () => {
    setStep((prev) => prev - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCheckboxToggle = (groupName, option) => {
    setCheckboxState(prev => {
      const group = prev[groupName] || [];
      if (group.includes(option)) {
        return { ...prev, [groupName]: group.filter(i => i !== option) };
      } else {
        return { ...prev, [groupName]: [...group, option] };
      }
    });
  };

  const staggerContainer = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.1 } }
  };
  const scrollFadeUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
  };
  const scrollFadeRight = {
    hidden: { opacity: 0, x: 45 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center space-x-2 sm:space-x-4 mb-6 w-full max-w-xl mx-auto">
      {[1, 2, 3, 4].map((s) => (
        <div key={s} className="flex items-center">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium transition-colors duration-300 ${
            step === s ? 'bg-primary text-black shadow-[0_0_15px_rgba(255,107,0,0.4)]' : 
            step > s ? 'bg-primary/20 text-primary border border-primary/30' : 
            'bg-app-border/20 text-app-text-muted border border-app-border/50'
          }`}>
            {step > s ? <Check className="w-3 h-3" /> : s}
          </div>
          {s < 4 && (
            <div className={`w-8 sm:w-16 h-1 rounded-full mx-1 sm:mx-2 transition-colors duration-300 ${
              step > s ? 'bg-primary/50' : 'bg-app-border/30'
            }`} />
          )}
        </div>
      ))}
    </div>
  );

  const renderDynamicFields = () => {
    if (!selectedService) return null;
    const config = serviceFormConfig[selectedService];
    if (!config) return null;

    return (
      <div className="space-y-4">
        <div className="mb-4">
          <h3 className="text-xl font-black font-heading text-primary uppercase">
            {servicesOptions.find(s => s.id === selectedService)?.label}
          </h3>
          <p className="text-sm text-app-text-muted mt-1">
            {config.subtitle || `Details for ${servicesOptions.find(s => s.id === selectedService)?.label}`}
          </p>
        </div>

        {/* Dropdowns */}
        {config.dropdowns && config.dropdowns.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {config.dropdowns.map((dd, idx) => (
              <div key={idx} className="space-y-1.5 text-left relative group">
                <label className="text-[10px] font-extrabold text-app-text-muted/70 uppercase tracking-widest block">
                  {dd.label}
                </label>
                <div className="relative">
                  <select
                    className={`w-full bg-transparent border-b-2 py-2.5 text-app-text focus:outline-none focus:border-primary transition-colors text-sm font-bold appearance-none pr-8 ${
                      errors[dd.name] ? 'border-red-500/50' : 'border-app-border/70'
                    }`}
                    {...register(dd.name, { required: dd.label.includes('*') ? 'This field is required' : false })}
                  >
                    <option value="" className="bg-app-bg text-app-text-muted">Select {dd.label.replace('*', '').trim()}</option>
                    {dd.options.map(opt => <option key={opt} value={opt} className="bg-app-bg text-app-text">{opt}</option>)}
                  </select>
                  <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-muted pointer-events-none" />
                </div>
                {errors[dd.name] && <span className="text-[10px] text-red-500">{errors[dd.name].message}</span>}
              </div>
            ))}
          </div>
        )}

        {/* Checkboxes */}
        {config.checkboxes && (
          <div className="space-y-3 text-left">
            <label className="text-[10px] font-extrabold text-app-text-muted/70 uppercase tracking-widest block">
              {config.checkboxes.label}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {config.checkboxes.options.map(opt => (
                <label key={opt} className="flex items-center gap-3 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    className="hidden"
                    checked={(checkboxState[config.checkboxes.name] || []).includes(opt)}
                    onChange={() => handleCheckboxToggle(config.checkboxes.name, opt)}
                  />
                  <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                    (checkboxState[config.checkboxes.name] || []).includes(opt) ? 'bg-primary border-primary' : 'border-app-border/70 group-hover:border-primary/50'
                  }`}>
                    {(checkboxState[config.checkboxes.name] || []).includes(opt) && <Check className="w-3.5 h-3.5 text-black" />}
                  </div>
                  <span className="text-sm font-bold text-app-text-muted group-hover:text-app-text transition-colors">{opt}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Radios */}
        {config.radios && config.radios.length > 0 && (
          <div className="space-y-4">
            {config.radios.map((r, idx) => (
              <div key={idx} className="space-y-2 text-left">
                <label className="text-[10px] font-extrabold text-app-text-muted/70 uppercase tracking-widest block">
                  {r.label}
                </label>
                <div className="flex flex-wrap gap-2.5">
                  {r.options.map(opt => (
                    <label key={opt} className="flex items-center cursor-pointer group">
                      <input
                        type="radio"
                        value={opt}
                        {...register(r.name)}
                        className="hidden"
                      />
                      <div className={`px-3 py-1.5 rounded-full border flex items-center justify-center transition-colors text-[10px] font-extrabold tracking-wider ${
                        watch(r.name) === opt ? 'border-app-text text-app-text bg-app-border/20' : 'border-app-border/70 text-app-text-muted group-hover:border-primary/50 group-hover:text-app-text'
                      }`}>
                        {opt}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Inputs */}
        {config.inputs && config.inputs.length > 0 && (
          <div className="space-y-4">
            {config.inputs.map((inp, idx) => {
              if (inp.showIf && watch(inp.showIf.field) !== inp.showIf.value) return null;
              return (
                <div key={idx} className="space-y-1 text-left relative group">
                  <label className="text-[10px] font-extrabold text-app-text-muted/70 uppercase tracking-widest block">
                    {inp.label}
                  </label>
                  <input
                    type={inp.type || "text"}
                    placeholder={inp.placeholder}
                    className={`w-full bg-transparent border-b-2 py-1.5 text-app-text focus:outline-none focus:border-primary transition-colors text-sm font-bold ${
                      errors[inp.name] ? 'border-red-500/50' : 'border-app-border/70'
                    }`}
                    {...register(inp.name, { required: inp.label.includes('*') ? 'This field is required' : false })}
                  />
                  {errors[inp.name] && <span className="text-[10px] text-red-500">{errors[inp.name].message}</span>}
                </div>
              );
            })}
          </div>
        )}

        {/* Textarea */}
        {config.textarea && (
          <div className="space-y-1.5 text-left relative group">
            <label className="text-[10px] font-extrabold text-app-text-muted/70 uppercase tracking-widest block transition-colors group-focus-within:text-primary">
              {config.textarea.label}
            </label>
            <textarea
              rows="3"
              placeholder={config.textarea.placeholder || "Tell us about your requirements..."}
              className={`w-full bg-transparent border-b-2 py-2.5 text-app-text focus:outline-none focus:border-primary transition-all resize-none text-sm font-bold placeholder:text-app-text-muted/20 ${
                errors.projectIdea ? 'border-red-500/50' : 'border-app-border/70'
              }`}
              {...register('projectIdea', { required: 'Please provide some details' })}
            />
            {errors.projectIdea && (
              <div className="flex items-center gap-1 text-[11px] text-red-500 mt-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{errors.projectIdea.message}</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-app-bg text-app-text relative pt-36 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
      
      {/* Universal Floating Particles Grid Backdrop */}
      <div className="absolute inset-0 mesh-grid opacity-35 pointer-events-none z-0" />

      {/* Decorative Orbs */}
      <div className="absolute -top-20 -left-20 w-[450px] h-[450px] bg-primary/5 rounded-full filter blur-[150px] pointer-events-none z-0" />
      <div className="absolute -bottom-40 right-20 w-96 h-96 bg-primary/4 rounded-full filter blur-[150px] pointer-events-none z-0" />

      <div className="max-w-6xl mx-auto relative z-10">
        
        {/* Title Block removed as requested */}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-24 items-start">
          
          {/* Left Column: Contact Form Multi-Step */}
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            className="lg:col-span-7"
          >
            {!isSubmitSuccess && renderStepIndicator()}
            <AnimatePresence mode="wait">
              {!isSubmitSuccess ? (
                <motion.div
                  key="form-container"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-app-card/30 border border-app-border/50 backdrop-blur-md rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden"
                >

                  <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-6">
                    
                    {/* STEP 1: Contact Info */}
                    {step === 1 && (
                      <motion.div key="step1" variants={scrollFadeUp} initial="hidden" animate="visible" exit={{ opacity: 0, x: -20 }} className="space-y-4">
                        <h3 className="text-xl font-black font-heading text-primary mb-3">Contact Information</h3>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1 text-left relative group">
                            <label className="text-[10px] font-extrabold text-app-text-muted/70 uppercase tracking-widest block">
                              First Name <span className="text-primary">*</span>
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Rajesh"
                              className={`w-full bg-transparent border-b-2 py-1.5 text-app-text focus:outline-none focus:border-primary transition-colors text-sm font-bold ${errors.firstName ? 'border-red-500/50' : 'border-app-border/70'}`}
                              {...register('firstName', { 
                                required: 'First name is required',
                                pattern: {
                                  value: /^[A-Za-z\s]+$/,
                                  message: 'Letters and spaces only'
                                }
                              })}
                            />
                            {errors.firstName && <span className="text-[10px] text-red-500">{errors.firstName.message}</span>}
                          </div>

                          <div className="space-y-1 text-left relative group">
                            <label className="text-[10px] font-extrabold text-app-text-muted/70 uppercase tracking-widest block">
                              Last Name
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Sharma"
                              className={`w-full bg-transparent border-b-2 py-1.5 text-app-text focus:outline-none focus:border-primary transition-colors text-sm font-bold ${errors.lastName ? 'border-red-500/50' : 'border-app-border/70'}`}
                              {...register('lastName', {
                                pattern: {
                                  value: /^[A-Za-z\s]+$/,
                                  message: 'Letters and spaces only'
                                }
                              })}
                            />
                            {errors.lastName && <span className="text-[10px] text-red-500">{errors.lastName.message}</span>}
                          </div>
                        </div>

                        <div className="space-y-1 text-left relative group">
                          <label className="text-[10px] font-extrabold text-app-text-muted/70 uppercase tracking-widest block">
                            Company Name
                          </label>
                          <input
                            type="text"
                            placeholder="Your Company Pvt Ltd"
                            className="w-full bg-transparent border-b-2 py-1.5 text-app-text focus:outline-none focus:border-primary transition-colors text-sm font-bold border-app-border/70"
                            {...register('company')}
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1 text-left relative group">
                            <label className="text-[10px] font-extrabold text-app-text-muted/70 uppercase tracking-widest block">
                              Email Address <span className="text-primary">*</span>
                            </label>
                            <input
                              type="email"
                              placeholder="you@company.com"
                              className={`w-full bg-transparent border-b-2 py-1.5 text-app-text focus:outline-none focus:border-primary transition-colors text-sm font-bold ${errors.email ? 'border-red-500/50' : 'border-app-border/70'}`}
                              {...register('email', { 
                                required: 'Email is required', 
                                pattern: { 
                                  value: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, 
                                  message: 'Invalid email address' 
                                } 
                              })}
                            />
                            {errors.email && <span className="text-[10px] text-red-500">{errors.email.message}</span>}
                          </div>

                          <div className="space-y-1 text-left relative group">
                            <label className="text-[10px] font-extrabold text-app-text-muted/70 uppercase tracking-widest block">
                              Phone Number <span className="text-primary">*</span>
                            </label>
                            <input
                              type="tel"
                              placeholder="+91 98765 43210"
                              className={`w-full bg-transparent border-b-2 py-1.5 text-app-text focus:outline-none focus:border-primary transition-colors text-sm font-bold ${errors.phone ? 'border-red-500/50' : 'border-app-border/70'}`}
                              {...register('phone', { 
                                required: 'Phone is required',
                                pattern: {
                                  value: /^[+]?[0-9\s-]{10,15}$/,
                                  message: 'Phone number must be 10 to 15 digits'
                                }
                              })}
                            />
                            {errors.phone && <span className="text-[10px] text-red-500">{errors.phone.message}</span>}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1 text-left relative group">
                            <label className="text-[10px] font-extrabold text-app-text-muted/70 uppercase tracking-widest block">
                              City
                            </label>
                            <div className="relative">
                              <select
                                className="w-full bg-transparent border-b-2 py-1.5 text-app-text focus:outline-none focus:border-primary transition-colors text-sm font-bold border-app-border/70 appearance-none pr-8"
                                {...register('city')}
                              >
                                <option value="" className="bg-app-bg">Select city</option>
                                <option value="Mumbai" className="bg-app-bg">Mumbai</option>
                                <option value="Delhi" className="bg-app-bg">Delhi</option>
                                <option value="Bangalore" className="bg-app-bg">Bangalore</option>
                                <option value="Hyderabad" className="bg-app-bg">Hyderabad</option>
                                <option value="Pune" className="bg-app-bg">Pune</option>
                                <option value="Other" className="bg-app-bg">Other</option>
                              </select>
                              <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-muted pointer-events-none" />
                            </div>
                          </div>

                          <div className="space-y-1 text-left relative group">
                            <label className="text-[10px] font-extrabold text-app-text-muted/70 uppercase tracking-widest block">
                              How did you find us?
                            </label>
                            <div className="relative">
                              <select
                                className="w-full bg-transparent border-b-2 py-1.5 text-app-text focus:outline-none focus:border-primary transition-colors text-sm font-bold border-app-border/70 appearance-none pr-8"
                                {...register('source')}
                              >
                                <option value="" className="bg-app-bg">Select source</option>
                                <option value="Google Search" className="bg-app-bg">Google Search</option>
                                <option value="Social Media" className="bg-app-bg">Social Media</option>
                                <option value="Referral" className="bg-app-bg">Referral</option>
                                <option value="Advertisement" className="bg-app-bg">Advertisement</option>
                                <option value="Other" className="bg-app-bg">Other</option>
                              </select>
                              <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-muted pointer-events-none" />
                            </div>
                          </div>
                        </div>

                      </motion.div>
                    )}

                    {/* STEP 2: Service Selection */}
                    {step === 2 && (
                      <motion.div key="step2" variants={scrollFadeUp} initial="hidden" animate="visible" exit={{ opacity: 0, x: -20 }} className="space-y-6">
                        <div className="mb-4">
                          <h3 className="text-xl font-black font-heading text-primary mb-2">Select Your Service</h3>
                          <p className="text-sm text-app-text-muted mt-1">Choose the service — questions will adjust automatically</p>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {servicesOptions.map(svc => {
                            const Icon = svc.icon;
                            const isSelected = selectedService === svc.id;
                            return (
                              <div 
                                key={svc.id}
                                onClick={() => {
                                  setValue('service', svc.id);
                                  trigger('service');
                                }}
                                className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 flex items-start gap-4 ${
                                  isSelected 
                                    ? 'border-primary bg-primary/10 shadow-[0_4px_20px_rgba(255,107,0,0.15)]' 
                                    : 'border-app-border/50 bg-app-bg/50 hover:border-primary/50'
                                }`}
                              >
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isSelected ? 'bg-primary text-black' : 'bg-app-border/20 text-app-text-muted'}`}>
                                  <Icon className="w-5 h-5" />
                                </div>
                                <div>
                                  <h4 className="font-bold text-sm text-app-text">{svc.label}</h4>
                                  <p className="text-xs text-app-text-muted mt-0.5">{svc.desc}</p>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                        {errors.service && <span className="text-[10px] text-red-500 block">Please select a service</span>}

                        <div className="pt-4">
                          <label className="text-[10px] font-extrabold text-app-text-muted/70 uppercase tracking-widest block mb-3">
                            When do you want to start?
                          </label>
                          <div className="grid grid-cols-2 gap-3">
                            {timelineOptions.map(opt => (
                              <label key={opt} className={`cursor-pointer text-center p-3 rounded-lg border transition-all text-sm font-bold ${
                                watch('timeline') === opt ? 'border-primary bg-primary/10 text-primary' : 'border-app-border/50 text-app-text-muted hover:border-primary/50'
                              }`}>
                                <input type="radio" value={opt} {...register('timeline')} className="hidden" />
                                {opt}
                              </label>
                            ))}
                          </div>
                        </div>

                      </motion.div>
                    )}

                    {/* STEP 3: Details */}
                    {step === 3 && (
                      <motion.div key="step3" variants={scrollFadeUp} initial="hidden" animate="visible" exit={{ opacity: 0, x: -20 }}>
                        {renderDynamicFields()}
                      </motion.div>
                    )}

                    {/* STEP 4: Review */}
                    {step === 4 && (
                      <motion.div key="step4" variants={scrollFadeUp} initial="hidden" animate="visible" exit={{ opacity: 0, x: -20 }} className="space-y-5">
                        <h3 className="text-xl font-black font-heading text-app-text mb-1">Review & Submit</h3>
                        <p className="text-sm text-app-text-muted mb-4">Please review your information before submitting.</p>
                        
                        <div className="bg-app-bg border border-app-border/50 rounded-xl p-5 space-y-5 text-sm">
                          <div>
                            <h4 className="text-[10px] font-extrabold text-primary uppercase tracking-widest mb-2">Contact Info</h4>
                            <div className="grid grid-cols-2 gap-2 text-app-text-muted">
                              <div><strong>Name:</strong> {getValues('firstName')} {getValues('lastName')}</div>
                              <div><strong>Email:</strong> {getValues('email')}</div>
                              <div><strong>Phone:</strong> {getValues('phone')}</div>
                              {getValues('company') && <div><strong>Company:</strong> {getValues('company')}</div>}
                            </div>
                          </div>
                          
                          <div className="h-px w-full bg-app-border/50" />

                          <div>
                            <h4 className="text-[10px] font-extrabold text-primary uppercase tracking-widest mb-2">Project Summary</h4>
                            <div className="grid grid-cols-2 gap-2 text-app-text-muted">
                              <div><strong>Service:</strong> {servicesOptions.find(s => s.id === selectedService)?.label}</div>
                              {getValues('timeline') && <div><strong>Timeline:</strong> {getValues('timeline')}</div>}
                            </div>
                          </div>

                          <div className="h-px w-full bg-app-border/50" />
                          
                          <div>
                            <h4 className="text-[10px] font-extrabold text-primary uppercase tracking-widest mb-2">Details</h4>
                            {(() => {
                              const config = serviceFormConfig[selectedService];
                              if (!config) return null;
                              
                              const values = getValues();
                              const details = [];
                              
                              if (config.dropdowns) config.dropdowns.forEach(f => {
                                if (values[f.name]) details.push({ label: f.label.replace(' *', ''), value: values[f.name] });
                              });
                              if (config.radios) config.radios.forEach(f => {
                                if (values[f.name]) details.push({ label: f.label.replace(' *', ''), value: values[f.name] });
                              });
                              if (config.inputs) config.inputs.forEach(f => {
                                if ((!f.showIf || values[f.showIf.field] === f.showIf.value) && values[f.name]) {
                                  details.push({ label: f.label.replace(' *', ''), value: values[f.name] });
                                }
                              });
                              if (config.checkboxes && values[config.checkboxes.name]?.length > 0) {
                                details.push({ label: config.checkboxes.label.replace(' *', ''), value: values[config.checkboxes.name].join(', ') });
                              }
                              if (config.textarea && values[config.textarea.name]) {
                                details.push({ label: config.textarea.label.replace(' *', ''), value: values[config.textarea.name] });
                              }
                              
                              return details.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-app-text-muted mt-2">
                                  {details.map((d, i) => (
                                    <div key={i} className={d.value.length > 50 ? 'col-span-1 sm:col-span-2' : ''}>
                                      <strong className="text-app-text">{d.label}:</strong> <span className="break-words">{d.value}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-app-text-muted text-xs italic">No additional details provided.</p>
                              );
                            })()}
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Navigation Buttons */}
                    <div className="pt-6 flex items-center justify-between border-t border-app-border/30 mt-6">
                      {step > 1 ? (
                        <button
                          type="button"
                          onClick={prevStep}
                          className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-app-text-muted hover:text-primary transition-colors"
                        >
                          <ArrowLeft className="w-4 h-4" />
                          Back
                        </button>
                      ) : (
                        <div /> // Placeholder for flex spacing
                      )}

                      {step < 4 ? (
                        <button
                          type="button"
                          onClick={nextStep}
                          className="relative inline-flex items-center justify-between pl-6 pr-1.5 py-1.5 bg-primary hover:bg-primary-hover text-black font-extrabold text-xs uppercase tracking-widest rounded-full transition-all duration-300 group shadow-[0_10px_25px_rgba(255,107,0,0.22)] hover:shadow-[0_12px_35px_rgba(255,107,0,0.45)] hover:-translate-y-0.5 w-32"
                        >
                          <span>Next</span>
                          <div className="w-7 h-7 rounded-full bg-black/10 flex items-center justify-center text-black group-hover:bg-black/20 transition-all duration-300">
                            <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
                          </div>
                        </button>
                      ) : (
                        <button
                          type="submit"
                          className="relative inline-flex items-center justify-between pl-6 pr-1.5 py-1.5 bg-primary hover:bg-primary-hover text-black font-extrabold text-xs uppercase tracking-widest rounded-full transition-all duration-300 group shadow-[0_10px_25px_rgba(255,107,0,0.22)] hover:shadow-[0_12px_35px_rgba(255,107,0,0.45)] hover:-translate-y-0.5 w-36"
                        >
                          <span>Submit</span>
                          <div className="w-7 h-7 rounded-full bg-black/10 flex items-center justify-center text-black group-hover:bg-black/20 transition-all duration-300">
                            <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
                          </div>
                        </button>
                      )}
                    </div>
                  </form>
                </motion.div>
              ) : (
                /* Interactive Success Overlay Card */
                <motion.div
                  key="contact-success-box"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="glass-panel rounded-3xl p-8 md:p-10 text-center space-y-6 flex flex-col items-center border border-primary/20 bg-app-card/85 shadow-2xl relative overflow-hidden"
                >
                  <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shadow-[0_0_35px_rgba(255,107,0,0.25)]">
                    <CheckCircle2 className="w-9 h-9 animate-bounce" />
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="text-xl md:text-2xl font-black font-heading text-app-text">Quote Request Submitted!</h3>
                    <p className="text-xs md:text-sm text-app-text-muted leading-relaxed max-w-sm">
                      Thank you for reaching out, <strong className="text-app-text">{submittedData?.firstName}</strong>. Our domain expert will review your project requirements and respond with an estimate in under 4 hours!
                    </p>
                  </div>

                  <button
                    onClick={() => setIsSubmitSuccess(false)}
                    className="px-6 py-2.5 bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary hover:text-white rounded-full text-xs font-extrabold uppercase tracking-widest transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Submit New Inquiry</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Right Column: Organic Floating Pebble Card inside Liquid Vector Wave */}
          <div className="lg:col-span-5 relative flex items-center justify-center min-h-[500px] w-full z-10 select-none hidden lg:flex">
            
            {/* Liquid Flowing Background Waves */}
            <svg 
              className="absolute inset-0 w-[140%] h-[140%] -translate-x-[20%] -translate-y-[20%] pointer-events-none z-0 opacity-100" 
              viewBox="0 0 600 600" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="organicLiquidGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FF6B00" stopOpacity="0.9" />
                  <stop offset="65%" stopColor="#EA580C" stopOpacity="0.75" />
                  <stop offset="100%" stopColor="#9333EA" stopOpacity="0.9" />
                </linearGradient>
                <linearGradient id="organicLiquidBack" x1="100%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#FF6B00" stopOpacity="0.1" />
                </linearGradient>
              </defs>

              <motion.path 
                d="M480,180 C540,280 500,420 380,480 C260,540 140,500 100,380 C60,260 120,140 240,100 C360,60 420,80 480,180 Z" 
                fill="url(#organicLiquidGrad)"
                animate={{
                  scale: [1, 1.03, 1],
                  rotate: [0, 3, -3, 0],
                  x: [0, 5, -5, 0],
                  y: [0, -5, 5, 0]
                }}
                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
              />

              <motion.path 
                d="M430,150 C490,240 470,360 360,420 C250,480 150,440 110,330 C70,220 130,120 230,90 C330,60 370,60 430,150 Z" 
                fill="url(#organicLiquidBack)"
                animate={{
                  scale: [1, 1.05, 1],
                  rotate: [0, -4, 4, 0],
                  x: [0, -8, 8, 0],
                  y: [0, 8, -8, 0]
                }}
                transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
              />

              <motion.circle 
                cx="150" cy="110" r="22" 
                className="fill-primary/65 dark:fill-primary/45" 
                animate={{ y: [0, -12, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              />
            </svg>

            {/* Floating Glassmorphic Pebble-Shaped Contact Information Card */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={scrollFadeRight}
              className="relative z-10 w-full max-w-[440px] aspect-[4/5] bg-app-card text-app-text rounded-[50%_40%_60%_40%_/_40%_60%_40%_60%] p-10 md:p-12 flex flex-col justify-center items-start shadow-3xl border border-app-border"
            >
              <div className="space-y-1 mb-8 text-left">
                <div className="w-12 h-[3px] bg-primary rounded-full mb-3" />
                <h3 className="text-3xl font-black font-heading tracking-wider uppercase text-zinc-950 dark:text-white leading-none">
                  VEDHUNT
                </h3>
              </div>

              <div className="space-y-6 text-left w-full">
                <div className="flex gap-4 items-start">
                  <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                    <MapPin className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold font-sans text-zinc-800 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap">
                      {contactInfo.address}
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 items-start">
                  <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                    <Smartphone className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <a href={`tel:${contactInfo.phone}`} className="text-sm font-black text-zinc-950 dark:text-white hover:text-primary transition-colors font-sans">
                      {contactInfo.phoneDisplay}
                    </a>
                  </div>
                </div>

                <div className="flex gap-4 items-start">
                  <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                    <Mail className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <a href={`mailto:${contactInfo.email}`} className="text-sm font-black text-zinc-950 dark:text-white hover:text-primary transition-colors font-sans">
                      {contactInfo.email}
                    </a>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3.5 mt-10">
                {(Array.isArray(contactInfo.socialLinks) ? contactInfo.socialLinks : [])
                  .filter(social => social.url)
                  .map((social, idx) => {
                    const platform = social.platform.toLowerCase();
                    let Icon = LinkIcon;
                    if (platform.includes('facebook')) Icon = FacebookIcon;
                    else if (platform.includes('instagram')) Icon = InstagramIcon;
                    else if (platform.includes('linkedin')) Icon = LinkedinIcon;
                    else if (platform.includes('youtube')) Icon = YoutubeIcon;

                    return (
                      <a 
                        key={social.id || idx} 
                        href={social.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        title={social.platform}
                        className={`w-10 h-10 rounded-full bg-zinc-100 hover:bg-primary border border-zinc-200 hover:border-primary text-zinc-700 hover:text-black flex items-center justify-center shadow-md transition-all duration-300 hover:-translate-y-1 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-primary dark:hover:text-black ${idx === 0 ? 'ml-3.5' : ''}`}
                      >
                        <Icon className="w-4 h-4" />
                      </a>
                    );
                })}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
