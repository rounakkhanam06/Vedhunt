import { Link } from 'react-router-dom';
import { Phone, Mail, ArrowRight, MapPin, ArrowUpRight, Link as LinkIcon, ChevronRight, Send, Globe } from 'lucide-react';
import { SERVICES } from '../../constants';
import { useTheme } from '../../context/ThemeContext';
import { useContactInfo } from '../../context/ContactInfoContext';
import lightLogo from '../../assets/logo_Square.jpg__1_-removebg-preview.png';
import darkLogo from '../../assets/DarkthemeLogo.png';

// Custom high-fidelity inline SVG social icons replacing removed Lucide brand icons
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

export default function Footer() {
  const { theme } = useTheme();
  const { contactInfo } = useContactInfo();
  return (
    <footer className="relative text-app-text-muted mt-6 sm:mt-12 font-sans theme-transition">
      {/* Wave Divider with light orange glow at the top of the footer */}
      <div className="w-full overflow-hidden leading-[0] translate-y-[1px] pointer-events-none relative z-10">
        <svg
          viewBox="0 0 1440 120"
          preserveAspectRatio="none"
          className="w-full h-[25px] sm:h-[35px] md:h-[45px] block overflow-visible"
        >
          <defs>
            <filter id="orange-glow-filter" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feComponentTransfer in="blur" result="boost">
                <feFuncA type="linear" slope="1.5"/>
              </feComponentTransfer>
              <feMerge>
                <feMergeNode in="boost" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          
          {/* Glowing background path */}
          <path
            d="M0,60 C400,130 600,10 1000,30 C1200,45 1350,65 1440,50"
            fill="none"
            stroke="#FF6B00"
            strokeWidth="6"
            filter="url(#orange-glow-filter)"
            className="opacity-35 dark:opacity-55 transition-opacity duration-300"
          />

          {/* Crisp semi-transparent orange edge line */}
          <path
            d="M0,60 C400,130 600,10 1000,30 C1200,45 1350,65 1440,50"
            fill="none"
            stroke="#FF6B00"
            strokeWidth="1.5"
            className="opacity-25 dark:opacity-45 transition-opacity duration-300"
          />

          {/* Solid wave background */}
          <path
            d="M0,60 C400,130 600,10 1000,30 C1200,45 1350,65 1440,50 L1440,121 L0,121 Z"
            fill="currentColor"
            className="text-app-card transition-colors duration-300"
          />
        </svg>
      </div>

      {/* Main Footer Body with card background color */}
      <div className="bg-app-card pb-4 relative overflow-hidden transition-colors duration-300">
        {/* Decorative gradient glow overlays */}
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-primary/5 rounded-full filter blur-[100px] pointer-events-none" />
        <div className="absolute top-0 left-0 w-80 h-80 bg-primary/2 rounded-full filter blur-[100px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-4">
          
          {/* 5-Column Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-x-8 gap-y-8 lg:gap-6 pb-6 border-b border-app-border/40">
            
            {/* Column 1: Branding & Profile */}
            <div className="col-span-1 md:col-span-2 lg:col-span-1 flex flex-col gap-3">
              <Link to="/" className="inline-block">
                <img
                  src={theme === 'dark' ? darkLogo : lightLogo}
                  alt="Vedhunt Logo"
                  className="w-44 md:w-52 h-12 md:h-14 object-cover object-center transition-transform duration-300 hover:scale-[1.02]"
                />
              </Link>
              <p className="text-sm text-app-text-muted leading-relaxed mt-1">
                Vedhunt Infotech is a full-service digital agency. We specialize in building responsive website development, strategic organic SEO, digital branding, accounting solutions, and automated dashboards to actively turn operations into revenue.
              </p>
              
              {/* High-fidelity custom Social Icons */}
              <div className="flex flex-wrap items-center gap-3">
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
                        className="w-9 h-9 rounded-full border border-app-border hover:border-primary text-app-text-muted hover:text-primary transition-all duration-300 flex items-center justify-center group"
                        title={social.platform}
                      >
                        <Icon className="w-4 h-4 transition-transform group-hover:scale-110" />
                      </a>
                    );
                })}
              </div>

              <div className="flex items-start gap-3 text-sm text-app-text-muted pt-2 border-t border-app-border/40">
                <div className="w-8 h-8 rounded-md border border-primary/30 flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin className="w-4 h-4 text-primary" />
                </div>
                <span className="leading-relaxed text-xs">Office No, 7th Floor, Everest Nivara Infotech Park, A-702, Indira Nagar, MIDC Industrial Area, Turbhe, Navi Mumbai, Maharashtra 400705</span>
              </div>
            </div>

            {/* Column 2: Services Directory */}
            <div className="space-y-3 lg:pt-2">
              <div className="relative pb-1">
                <h4 className="text-app-text font-bold text-sm uppercase tracking-wider">
                  OUR SERVICES
                </h4>
                <div className="absolute bottom-0 left-0 w-8 h-0.5 bg-primary rounded-full"></div>
              </div>
              <ul className="space-y-2 text-sm">
                {SERVICES.map((srv) => (
                  <li key={srv.id} className="flex items-center gap-2 group">
                    <ChevronRight className="w-4 h-4 text-primary transition-transform group-hover:translate-x-1" />
                    <Link
                      to={`/services/${srv.slug}`}
                      className="text-app-text-muted hover:text-primary transition-colors duration-300 block border-b border-app-border/30 pb-1.5 w-full"
                    >
                      {srv.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 3: Quick Navigation */}
            <div className="space-y-3 lg:pt-2">
              <div className="relative pb-1">
                <h4 className="text-app-text font-bold text-sm uppercase tracking-wider">
                  COMPANY
                </h4>
                <div className="absolute bottom-0 left-0 w-8 h-0.5 bg-primary rounded-full"></div>
              </div>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2 group">
                  <ChevronRight className="w-4 h-4 text-primary transition-transform group-hover:translate-x-1" />
                  <Link to="/about" className="text-app-text-muted hover:text-primary transition-colors duration-300 block border-b border-app-border/30 pb-1.5 w-full">
                    About Us
                  </Link>
                </li>
                <li className="flex items-center gap-2 group">
                  <ChevronRight className="w-4 h-4 text-primary transition-transform group-hover:translate-x-1" />
                  <Link to="/portfolio" className="text-app-text-muted hover:text-primary transition-colors duration-300 block border-b border-app-border/30 pb-1.5 w-full">
                    Our Portfolio
                  </Link>
                </li>
                <li className="flex items-center gap-2 group">
                  <ChevronRight className="w-4 h-4 text-primary transition-transform group-hover:translate-x-1" />
                  <Link to="/services" className="text-app-text-muted hover:text-primary transition-colors duration-300 block border-b border-app-border/30 pb-1.5 w-full">
                    Expert Solutions
                  </Link>
                </li>
                <li className="flex items-center gap-2 group">
                  <ChevronRight className="w-4 h-4 text-primary transition-transform group-hover:translate-x-1" />
                  <Link to="/career" className="text-app-text-muted hover:text-primary transition-colors duration-300 block border-b border-app-border/30 pb-1.5 w-full">
                    Career Vacancies
                  </Link>
                </li>
                <li className="flex items-center gap-2 group">
                  <ChevronRight className="w-4 h-4 text-primary transition-transform group-hover:translate-x-1" />
                  <Link to="/faq" className="text-app-text-muted hover:text-primary transition-colors duration-300 block border-b border-app-border/30 pb-1.5 w-full">
                    FAQ's
                  </Link>
                </li>
                <li className="flex items-center gap-2 group">
                  <ChevronRight className="w-4 h-4 text-primary transition-transform group-hover:translate-x-1" />
                  <Link to="/get-quote" className="text-app-text-muted hover:text-primary transition-colors duration-300 block border-b border-app-border/30 pb-1.5 w-full">
                    Contact Support
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 4: Legal & Compliance */}
            <div className="space-y-3 lg:pt-2">
              <div className="relative pb-1">
                <h4 className="text-app-text font-bold text-sm uppercase tracking-wider">
                  LEGAL & COMPLIANCE
                </h4>
                <div className="absolute bottom-0 left-0 w-8 h-0.5 bg-primary rounded-full"></div>
              </div>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2 group">
                  <ChevronRight className="w-4 h-4 text-primary transition-transform group-hover:translate-x-1" />
                  <Link to="/privacy-policy" className="text-app-text-muted hover:text-primary transition-colors duration-300 block border-b border-app-border/30 pb-1.5 w-full">
                    Privacy Policy
                  </Link>
                </li>
                <li className="flex items-center gap-2 group">
                  <ChevronRight className="w-4 h-4 text-primary transition-transform group-hover:translate-x-1" />
                  <Link to="/terms-and-conditions" className="text-app-text-muted hover:text-primary transition-colors duration-300 block border-b border-app-border/30 pb-1.5 w-full">
                    Terms & Conditions
                  </Link>
                </li>
                <li className="flex items-center gap-2 group">
                  <ChevronRight className="w-4 h-4 text-primary transition-transform group-hover:translate-x-1" />
                  <Link to="/cookie-policy" className="text-app-text-muted hover:text-primary transition-colors duration-300 block border-b border-app-border/30 pb-1.5 w-full">
                    Cookie Policy
                  </Link>
                </li>
                <li className="flex items-center gap-2 group">
                  <ChevronRight className="w-4 h-4 text-primary transition-transform group-hover:translate-x-1" />
                  <Link to="/data-processing-agreement" className="text-app-text-muted hover:text-primary transition-colors duration-300 block border-b border-app-border/30 pb-1.5 w-full">
                    Data Processing Agreement (DPA)
                  </Link>
                </li>
                <li className="flex items-center gap-2 group">
                  <ChevronRight className="w-4 h-4 text-primary transition-transform group-hover:translate-x-1" />
                  <Link to="/refund-and-billing-policy" className="text-app-text-muted hover:text-primary transition-colors duration-300 block border-b border-app-border/30 pb-1.5 w-full">
                    Refund & Billing Policy
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 5: Contact Info & CTA */}
            <div className="space-y-4 lg:pt-2">
              <div className="relative pb-1">
                <h4 className="text-app-text font-bold text-sm uppercase tracking-wider">
                  CONTACT INFO
                </h4>
                <div className="absolute bottom-0 left-0 w-8 h-0.5 bg-primary rounded-full"></div>
              </div>
              <div className="space-y-3 text-sm">
                <a href={`tel:${contactInfo.phone}`} className="flex items-center gap-3 text-app-text-muted hover:text-primary transition-colors group">
                  <div className="w-8 h-8 rounded-md border border-primary/30 flex items-center justify-center shrink-0 group-hover:border-primary transition-colors">
                    <Phone className="w-4 h-4 text-primary" />
                  </div>
                  <span>{contactInfo.phoneDisplay}</span>
                </a>
                <a href={`mailto:${contactInfo.email}`} className="flex items-center gap-3 text-app-text-muted hover:text-primary transition-colors group">
                  <div className="w-8 h-8 rounded-md border border-primary/30 flex items-center justify-center shrink-0 group-hover:border-primary transition-colors">
                    <Mail className="w-4 h-4 text-primary" />
                  </div>
                  <span>{contactInfo.email}</span>
                </a>
                <div className="flex items-center gap-3 text-app-text-muted group">
                  <div className="w-8 h-8 rounded-md border border-primary/30 flex items-center justify-center shrink-0 group-hover:border-primary transition-colors">
                    <Globe className="w-4 h-4 text-primary" />
                  </div>
                  <span>Navi Mumbai, Maharashtra, India</span>
                </div>
              </div>

              {/* High-Fidelity Interactive CTA Button */}
              <div className="pt-2">
                <Link
                  to="/get-quote"
                  className="relative inline-flex items-center justify-center gap-2 w-full px-6 py-3 bg-[#FF7900] hover:bg-[#E66D00] text-white font-bold text-sm rounded-lg shadow-md hover:shadow-[0_4px_15px_rgba(255,121,0,0.3)] transition-all duration-300 group overflow-hidden"
                >
                  <Send className="w-4 h-4 transition-transform duration-300 group-hover:-translate-y-1 group-hover:translate-x-1" />
                  <span>Get in Touch</span>
                </Link>
              </div>
            </div>

          </div>

          {/* Centered Subscription Input Capsule */}
          <div className="py-3 sm:py-4 border-b border-app-border/40 flex flex-col items-center justify-center text-center space-y-2 sm:space-y-3">
            <div className="space-y-1 max-w-md">
              <h5 className="text-app-text font-heading font-bold text-xs sm:text-sm tracking-wide">
                Subscribe to Our Newsletter
              </h5>
              <p className="text-[11px] sm:text-xs text-app-text-muted leading-relaxed">
                Stay updated on technological trends, SEO tips, and enterprise solutions.
              </p>
            </div>
            
            <form onSubmit={(e) => e.preventDefault()} className="w-full max-w-md">
              <div className="relative flex items-center bg-app-bg border border-app-border focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/40 rounded-full p-1 shadow-md transition-all duration-300">
                <input
                  type="email"
                  placeholder="Enter email address"
                  className="w-full bg-transparent outline-none pl-4 pr-28 py-1.5 text-xs text-app-text placeholder-gray-500 transition-all"
                  required
                />
                <button
                  type="submit"
                  className="absolute right-1 bg-primary hover:bg-primary-hover text-black font-extrabold text-xs px-5 py-1.5 rounded-full transition-all duration-300 shadow-md cursor-pointer hover:shadow-[0_0_15px_rgba(255,107,0,0.4)]"
                >
                  Submit
                </button>
              </div>
            </form>
          </div>

          {/* Footer Bottom Block */}
          <div className="pt-4 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-app-text-muted">
            <div className="text-center md:text-left space-y-0.5 max-w-xl">
              <p className="text-app-text-muted/80 text-[11px] sm:text-xs">
                {contactInfo.copyright}
              </p>
              <p className="text-app-text-muted/60 text-[9px] sm:text-[10px]">
                {contactInfo.registration}
              </p>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="flex flex-wrap justify-center gap-4 text-app-text-muted text-[11px] sm:text-xs">
                <Link to="/privacy-policy" className="hover:text-primary transition-colors">Privacy Policy</Link>
                <span>•</span>
                <Link to="/terms-and-conditions" className="hover:text-primary transition-colors">Terms of Service</Link>
              </div>

              {/* Beautiful Rounded Scroll-to-Top Card */}
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="w-10 h-10 rounded-2xl bg-app-bg dark:bg-app-card border border-app-border hover:border-primary/40 text-app-text hover:text-primary transition-all duration-300 flex items-center justify-center cursor-pointer shadow-md hover:shadow-[0_0_15px_rgba(255,107,0,0.25)] group relative overflow-hidden"
                aria-label="Scroll to top"
              >
                <ArrowUpRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                {/* Micro hover overlay */}
                <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
              </button>
            </div>
          </div>

        </div>
      </div>
    </footer>
  );
}
