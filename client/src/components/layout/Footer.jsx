import { Link } from 'react-router-dom';
import { Phone, Mail, ArrowRight, MapPin, ArrowUpRight } from 'lucide-react';
import { CONTACT_INFO, SERVICES } from '../../constants';
import { useTheme } from '../../context/ThemeContext';
import lightLogo from '../../assets/logo_Square.jpg__1_-removebg-preview.png';
import darkLogo from '../../assets/DarkthemeLogo.png';

// Custom high-fidelity inline SVG social icons replacing removed Lucide brand icons
const FacebookIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
);

const TwitterIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
  </svg>
);

const LinkedinIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect width="4" height="12" x="2" y="9" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);

const GithubIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

export default function Footer() {
  const { theme } = useTheme();
  return (
    <footer className="relative text-app-text-muted mt-12 sm:mt-16 font-sans theme-transition">
      {/* Wave Divider with light orange glow at the top of the footer */}
      <div className="w-full overflow-hidden leading-[0] translate-y-[1px] pointer-events-none relative z-10">
        <svg
          viewBox="0 0 1440 120"
          preserveAspectRatio="none"
          className="w-full h-[40px] sm:h-[60px] md:h-[80px] block overflow-visible"
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
      <div className="bg-app-card pb-6 relative overflow-hidden transition-colors duration-300">
        {/* Decorative gradient glow overlays */}
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-primary/5 rounded-full filter blur-[100px] pointer-events-none" />
        <div className="absolute top-0 left-0 w-80 h-80 bg-primary/2 rounded-full filter blur-[100px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
          
          {/* 4-Column Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6 pb-8 border-b border-app-border">
            
            {/* Column 1: Branding & Profile */}
            <div className="space-y-2">
              <Link to="/" className="flex items-center gap-2 group relative z-10">
                <img
                  src={theme === 'dark' ? darkLogo : lightLogo}
                  alt="Vedhunt Infotech"
                  className="h-[90px] sm:h-[120px] w-auto object-contain transition-all duration-300"
                />
              </Link>
              <p className="text-sm text-app-text-muted leading-relaxed max-w-sm">
                Vedhunt Infotech is a full-service digital agency. We specialize in building responsive website development, strategic organic SEO, digital branding, accounting solutions, and automated dashboards to actively turn operations into revenue.
              </p>
              <div className="flex items-start gap-3 text-sm text-app-text">
                <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span>Mumbai, Maharashtra, India</span>
              </div>
            </div>

            {/* Column 2: Services Directory */}
            <div className="space-y-4 lg:pt-10 lg:pl-6">
              <h4 className="text-primary font-heading font-extrabold text-xs uppercase tracking-wider pl-1.5 border-l-2 border-primary">
                Our Services
              </h4>
              <ul className="space-y-2 text-sm">
                {SERVICES.slice(0, 5).map((srv) => (
                  <li key={srv.id}>
                    <Link
                      to="/services"
                      className="hover:text-primary hover:translate-x-1.5 transition-all duration-300 block py-0.5"
                    >
                      {srv.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 3: Quick Navigation */}
            <div className="space-y-4 lg:pt-10 lg:pl-6">
              <h4 className="text-primary font-heading font-extrabold text-xs uppercase tracking-wider pl-1.5 border-l-2 border-primary">
                Company
              </h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link to="/about" className="hover:text-primary hover:translate-x-1.5 transition-all duration-300 block py-0.5">
                    About Us
                  </Link>
                </li>
                <li>
                  <Link to="/portfolio" className="hover:text-primary hover:translate-x-1.5 transition-all duration-300 block py-0.5">
                    Our Portfolio
                  </Link>
                </li>
                <li>
                  <Link to="/services" className="hover:text-primary hover:translate-x-1.5 transition-all duration-300 block py-0.5">
                    Expert Solutions
                  </Link>
                </li>
                <li>
                  <Link to="/contact" className="hover:text-primary hover:translate-x-1.5 transition-all duration-300 block py-0.5">
                    Leadership Team
                  </Link>
                </li>
                <li>
                  <Link to="/contact" className="hover:text-primary hover:translate-x-1.5 transition-all duration-300 block py-0.5">
                    Career Vacancies
                  </Link>
                </li>
                <li>
                  <Link to="/contact" className="hover:text-primary hover:translate-x-1.5 transition-all duration-300 block py-0.5">
                    Contact Support
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 4: Contact Info & Social Connections */}
            <div className="space-y-4 lg:pt-10 lg:pl-6">
              <h4 className="text-primary font-heading font-extrabold text-xs uppercase tracking-wider pl-1.5 border-l-2 border-primary">
                Contact Info
              </h4>
              <div className="space-y-2.5 text-sm">
                <a href={`tel:${CONTACT_INFO.phone}`} className="flex items-center gap-3 text-app-text hover:text-primary transition-colors group">
                  <Phone className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
                  <span>{CONTACT_INFO.phoneDisplay}</span>
                </a>
                <a href={`mailto:${CONTACT_INFO.email}`} className="flex items-center gap-3 text-app-text hover:text-primary transition-colors group">
                  <Mail className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
                  <span>{CONTACT_INFO.email}</span>
                </a>
              </div>

              {/* High-Fidelity Interactive CTA Button */}
              <div className="pt-1.5 pb-0.5">
                <Link
                  to="/contact"
                  className="relative inline-flex items-center justify-center gap-2 w-full px-5 py-2.5 bg-primary hover:bg-primary-hover text-black font-extrabold text-xs rounded-xl shadow-md hover:shadow-[0_0_15px_rgba(255,107,0,0.4)] group transition-all duration-300 cursor-pointer overflow-hidden"
                >
                  <span className="absolute inset-0 bg-white/10 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out" />
                  <span>Get in Touch</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
              </div>

              {/* High-fidelity custom Social Icons */}
              <div className="flex items-center gap-3.5 pt-1">
                {[
                  { icon: FacebookIcon, link: 'https://facebook.com' },
                  { icon: TwitterIcon, link: 'https://twitter.com' },
                  { icon: LinkedinIcon, link: 'https://linkedin.com' },
                  { icon: GithubIcon, link: 'https://github.com' }
                ].map((social, idx) => (
                  <a
                    key={idx}
                    href={social.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 rounded-lg bg-app-bg border border-app-border hover:border-primary/40 text-app-text-muted hover:text-primary hover:bg-primary/5 transition-all duration-300 flex items-center justify-center group"
                  >
                    <social.icon className="w-4 h-4 transition-transform group-hover:scale-110" />
                  </a>
                ))}
              </div>
            </div>

          </div>

          {/* Centered Subscription Input Capsule */}
          <div className="py-6 border-b border-app-border/40 flex flex-col items-center justify-center text-center space-y-4">
            <div className="space-y-1 max-w-md">
              <h5 className="text-app-text font-heading font-bold text-sm tracking-wide">
                Subscribe to Our Newsletter
              </h5>
              <p className="text-xs text-app-text-muted leading-relaxed">
                Stay updated on technological trends, SEO tips, and enterprise solutions.
              </p>
            </div>
            
            <form onSubmit={(e) => e.preventDefault()} className="w-full max-w-md">
              <div className="relative flex items-center bg-app-bg border border-app-border focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/40 rounded-full p-1.5 shadow-md transition-all duration-300">
                <input
                  type="email"
                  placeholder="Enter email address"
                  className="w-full bg-transparent outline-none pl-4 pr-32 py-2 text-xs sm:text-sm text-app-text placeholder-gray-500 transition-all"
                  required
                />
                <button
                  type="submit"
                  className="absolute right-1.5 bg-primary hover:bg-primary-hover text-black font-extrabold text-xs px-6 py-2 rounded-full transition-all duration-300 shadow-md cursor-pointer hover:shadow-[0_0_15px_rgba(255,107,0,0.4)]"
                >
                  Submit
                </button>
              </div>
            </form>
          </div>

          {/* Footer Bottom Block */}
          <div className="pt-6 flex flex-col md:flex-row justify-between items-center gap-6 text-xs text-app-text-muted">
            <div className="text-center md:text-left space-y-1 max-w-xl">
              <p className="text-app-text-muted/80">
                {CONTACT_INFO.copyright}
              </p>
              <p className="text-app-text-muted/60 text-[10px]">
                {CONTACT_INFO.registration}
              </p>
            </div>
            
            <div className="flex items-center gap-8">
              <div className="flex flex-wrap justify-center gap-4 text-app-text-muted">
                <Link to="/contact" className="hover:text-primary transition-colors">Privacy Policy</Link>
                <span>•</span>
                <Link to="/contact" className="hover:text-primary transition-colors">Terms of Service</Link>
              </div>

              {/* Beautiful Rounded Scroll-to-Top Card */}
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="w-14 h-14 rounded-3xl bg-app-bg dark:bg-app-card border border-app-border hover:border-primary/40 text-app-text hover:text-primary transition-all duration-300 flex items-center justify-center cursor-pointer shadow-md hover:shadow-[0_0_20px_rgba(255,107,0,0.25)] group relative overflow-hidden"
                aria-label="Scroll to top"
              >
                <ArrowUpRight className="w-5.5 h-5.5 transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1" />
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
