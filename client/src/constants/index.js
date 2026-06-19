// Vedhunt Website Global Constants
import { 
  Globe,
  Smartphone, 
  Share2, 
  TrendingUp, 
  Calculator,
  LayoutDashboard,
  Search, 
  MousePointerClick, 
  FileSpreadsheet, 
  Database, 
  Briefcase, 
  DollarSign, 
  Award, 
  Users, 
  Clock, 
  ShieldCheck,
  Layers
} from 'lucide-react';



export const CONTACT_INFO = {
  phone: '+91 86524 10289',
  phoneDisplay: '+91 86524 10289',
  email: 'info@vedhunt.in',
  hours: 'Mon – Fri: 8:00am – 7:00pm',
  cin: 'CIN - U62099MH2025PTC447275',
  registration: 'Company Registration: CIN - U62099MH2025PTC447275',
  copyright: '© 2026 Vedhunt InfoTech. All Rights Reserved.'
};

export const NAV_LINKS = [
  { label: 'Home', path: '/' },
  { label: 'About', path: '/about' },
  { label: 'Services', path: '/services' },
  { label: 'Portfolio', path: '/portfolio' },
  { label: 'Blog', path: '/blog' },
  { label: 'Pricing', path: '/pricing' },
  { label: 'Career', path: '/career' }
];

export const SERVICES = [
  {
    id: 'web-dev',
    slug: 'website-development',
    title: 'Website Development',
    subtitle: 'High Performance & Stunning Layouts',
    shortDescription: 'We build fast, mobile-friendly websites — from landing pages to full web portals.',
    description: 'Our development team specializes in crafting high-converting, blazing-fast web solutions that represent your brand with prestige. From responsive corporate landing pages to complex e-commerce engines, we deliver optimized visual layout combined with robust, lightweight clean code.',
    subServices: 'Static sites, CMS, E-commerce, Web Apps',
    icon: Globe,
    features: [
      'Custom Responsive UI/UX Design',
      'Modern Single Page Applications (SPAs)',
      'High-Speed Performance Optimization',
      'SEO-Friendly Code Structure',
      'E-commerce Platform Integration'
    ],
    pricingCards: [
      {
        title: 'React / Framework Website',
        tech: 'Next.js · React · Tailwind · Custom CMS',
        price: '₹30,000+',
        features: [
          'Custom UI/UX design from scratch',
          'Built on React / Next.js',
          'SEO-friendly architecture',
          'Component-based scalable architecture',
          'Fully responsive design',
          'API integrations',
          'Admin panel / CMS',
          'Analytics setup',
          '3 rounds of revisions',
          'Delivery in 10–20 working days'
        ],
        highlight: true
      },
      {
        title: 'WordPress Website',
        tech: 'Elementor · WooCommerce',
        price: '₹15,000+',
        features: [
          'Custom theme setup & design',
          'Elementor page builder',
          'WooCommerce support',
          'Responsive mobile layout',
          'SEO plugins support',
          'Contact forms integration',
          '2 rounds of revisions',
          'Delivery in 7–10 working days'
        ],
        highlight: false
      }
    ],
    technologies: [
      { name: 'Next.js', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nextjs/nextjs-original.svg' },
      { name: 'React', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg' },
      { name: 'Tailwind', icon: 'https://www.vectorlogo.zone/logos/tailwindcss/tailwindcss-icon.svg' },
      { name: 'WordPress', icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/wordpress/wordpress-plain.svg' },
      { name: 'WooCommerce', icon: 'https://www.vectorlogo.zone/logos/woocommerce/woocommerce-icon.svg' }
    ],
    timeline: [
      { step: '01', title: 'Discovery', desc: 'Understanding your business goals and target audience.' },
      { step: '02', title: 'Design', desc: 'Crafting premium UI/UX mockups and brand assets.' },
      { step: '03', title: 'Development', desc: 'Building your solution with clean, performant code.' },
      { step: '04', title: 'QA & Testing', desc: 'Rigorous testing across all devices and browsers.' },
      { step: '05', title: 'Launch', desc: 'Deploying your project and ensuring a smooth start.' }
    ],
    cta: 'Get Started'
  },
  {
    id: 'app-dev',
    slug: 'mobile-app-development',
    title: 'App Development',
    subtitle: 'Seamless iOS & Android Experiences',
    shortDescription: 'Native and cross-platform mobile apps for iOS and Android.',
    description: 'We develop highly interactive, feature-rich native and cross-platform mobile apps. From wireframing to App Store deployment, we ensure a smooth, premium feel, dynamic animations, and high processing efficiency for your customers on the move.',
    subServices: 'Flutter, React Native, Android, iOS',
    icon: Smartphone,
    features: [
      'Cross-Platform Apps (React Native / Flutter)',
      'Highly Intuitive Mobile UI/UX Design',
      'Real-Time Push Notifications',
      'Offline Storage & Cloud Syncing',
      'Smooth Native Micro-Animations'
    ],
    cta: 'Get Started'
  },
  {
    id: 'social-media',
    slug: 'social-media-management',
    title: 'Social Media Management',
    subtitle: 'Build an Unforgettable Social Presence',
    shortDescription: 'Consistent, creative content that builds your brand and engages your audience.',
    description: 'Our social media experts curate compelling content and schedule engaging interactions across all major platforms. We help you build a loyal community and maintain a consistent brand voice that resonates with your target audience.',
    subServices: 'Posts, Reels, Stories, Strategy',
    icon: Share2,
    features: [
      'Custom Content Calendar',
      'High-Engagement Reels & Stories',
      'Community Management',
      'Brand Tone Development',
      'Influencer Collaboration'
    ],
    cta: 'Get Started'
  },
  {
    id: 'performance-marketing',
    slug: 'performance-marketing',
    title: 'Performance Marketing',
    subtitle: 'Paid Ads, Brand Awareness & Content Strategy',
    shortDescription: 'Data-driven ad campaigns across Google, Meta, and more — every rupee tracked.',
    description: 'We deploy high-performance outbound marketing models. From laser-targeted social media advertising on Instagram, Facebook, and LinkedIn, to search retargeting and creative content copy, we maximize your ad spend and scale your customer acquisition pipelines.',
    subServices: 'Google Ads, Meta Ads, A/B Testing',
    icon: TrendingUp,
    features: [
      'Laser-Targeted Google & Social Ads',
      'Creative Design & Ad Copywriting',
      'Continuous Conversion Optimization (CRO)',
      'Detailed Performance ROI Audits',
      'Custom Multi-Channel Retargeting Funnels'
    ],
    cta: 'Get Started'
  },
  {
    id: 'accounting-finance',
    slug: 'accounting-financial-services',
    title: 'Accounting & Finance',
    subtitle: 'Streamlined Compliance & MIS Reporting',
    shortDescription: 'Indian and US accounting, GST, compliance, bookkeeping.',
    description: 'Manage your operations with absolute precision. We offer professional outsource accounting, tax computation, statutory audit preparation, and high-level financial reporting to enable executives to make smart, data-supported decisions.',
    subServices: 'GST Filing, ITR, US GAAP, Bookkeeping',
    icon: Calculator,
    features: [
      'Multi-Currency Bookkeeping',
      'Tax Planning & Statutory Filings',
      'Reconciliation of Bank Accounts & Ledgers',
      'Real-Time Cash Flow Analysis',
      'Audit Readiness Support'
    ],
    cta: 'Get Started'
  },
  {
    id: 'mis-reporting',
    slug: 'mis-reporting-services',
    title: 'MIS & Reporting Services',
    subtitle: 'SQL, Power BI, Python integrations',
    shortDescription: 'Automated dashboards and reports using Excel, Power BI.',
    description: 'Don\'t let manual reports slow down your team. We create automated pipelines using Python scripts, robust SQL data warehouse modeling, and interactive Power BI charts, helping you monitor critical business KPIs in real time.',
    subServices: 'Excel Dashboards, Power BI, Automation, KPI Reports',
    icon: LayoutDashboard,
    features: [
      'Automated Data Pipelines (ETL)',
      'Custom Interactive Power BI Dashboards',
      'Python Automation & Web Scraping',
      'SQL Query Optimization & Database Architecture',
      'Instant Email & Slack Report Alerts'
    ],
    cta: 'Get Started'
  }
];


export const WHY_CHOOSE_US = [
  {
    title: 'Economical & Pricing-Friendly',
    description: 'We deliver top-of-the-line creative solutions and website layouts at highly competitive, business-friendly price structures.',
    icon: DollarSign
  },
  {
    title: 'Hands-On Tech Experience',
    description: 'Our team comprises diverse expert minds, modern developers, and seasoned growth marketers who understand execution.',
    icon: Award
  },
  {
    title: 'Continuous Support & Strategy',
    description: 'We support you from initial concept drafting, through seamless deployment, to iterative growth strategies and pivots.',
    icon: Clock
  },
  {
    title: 'Lead-Building Machinery',
    description: 'Our applications are not just pretty digital brochures. They are engineered to actively acquire and capture high-intent business leads.',
    icon: Users
  }
];

export const TEAM_MEMBERS = [
  {
    name: 'Andrew Wills',
    role: 'Co-Founder & Technology Lead',
    bio: 'An expert system architect passionate about scalable microservices and lightning-fast user interfaces.',
    image: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?q=80&w=300&h=300&fit=crop'
  },
  {
    name: 'Alisha Smith',
    role: 'Head of Creative Design & UI/UX',
    bio: 'Crafts beautiful, premium visual layouts and digital branding models with extreme precision.',
    image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=300&h=300&fit=crop'
  },
  {
    name: 'Robert White',
    role: 'Lead Growth Marketer & Lead Strategist',
    bio: 'Specializes in laser-focused PPC campaigns, SEO dominance, and high-yield user acquisition channels.',
    image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=300&h=300&fit=crop'
  },
  {
    name: 'Sarah George',
    role: 'Finance Specialist & Compliance Advisor',
    bio: 'Ensures flawless financial auditing, reporting systems, and international accounting compliances.',
    image: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?q=80&w=300&h=300&fit=crop'
  }
];

export const TESTIMONIALS = [
  {
    quote: "It really met my requirements. You guys were very patient even though there were delays from my side. The price was competitive and all our requirements were met. If somebody were to ask me for something similar, I would definitely recommend you guys!",
    author: "Reshma S.",
    role: "E-commerce Founder",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=150&h=150&fit=crop",
    country: "India",
    countryFlag: "🇮🇳"
  },
  {
    quote: "Working with Vedhunt was extremely professional. They took our complex reporting workflow and transformed it into a fully automated Power BI dashboard. Saves our department 15 hours every single week.",
    author: "Piyush K.",
    role: "Finance Director",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=150&h=150&fit=crop",
    country: "India",
    countryFlag: "🇮🇳"
  },
  {
    quote: "Their SEO service is top-notch. Our organic search leads increased by nearly 180% within four months. They are very analytical and direct with their projections.",
    author: "Shweta G.",
    role: "Real Estate Marketer",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=150&h=150&fit=crop",
    country: "United States",
    countryFlag: "🇺🇸"
  },
  {
    quote: "Vedhunt designed our corporate brand identity and logo. They understood our values instantly and gave us options that we absolutely loved. Exceptional branding service!",
    author: "Ajay Sharma",
    role: "SaaS Co-Founder",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=150&h=150&fit=crop",
    country: "United Kingdom",
    countryFlag: "🇬🇧"
  },
  {
    quote: "The web development team was fast, structured, and very transparent. Communication was perfect throughout the project lifecycle. Highly recommended for premium website development.",
    author: "Akash Bansal",
    role: "Retail Director",
    avatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?q=80&w=150&h=150&fit=crop",
    country: "Canada",
    countryFlag: "🇨🇦"
  },
  {
    quote: "Their UI/UX design process completely blew us away. They created an interactive mobile application prototype that helped us secure our pre-seed funding round. Outstanding strategic partners!",
    author: "Karan Malhotra",
    role: "FinTech Founder",
    avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=150&h=150&fit=crop",
    country: "Australia",
    countryFlag: "🇦🇺"
  },
  {
    quote: "Absolutely phenomenal results with their digital marketing campaigns. Our brand engagement grew by over 300% and direct inquiries skyrocketed within weeks. The team is hyper-responsive and highly skilled.",
    author: "Nisha Patel",
    role: "Creative Director",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=150&h=150&fit=crop",
    country: "United States",
    countryFlag: "🇺🇸"
  },
  {
    quote: "The custom CRM platform they built for us has streamlined our entire sales operations and team reporting. It is extremely fast, secure, and intuitive. Exceptional product engineering team!",
    author: "Vikram Seth",
    role: "Operations Head",
    avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=150&h=150&fit=crop",
    country: "United Arab Emirates",
    countryFlag: "🇦🇪"
  }
];

export const BLOG_POSTS = [
  {
    id: 1,
    title: 'The Future of Web Development: What to Expect in 2026',
    category: 'DEVELOPMENT',
    date: 'May 12, 2026',
    excerpt: 'Explore the latest trends in web development, from AI-driven coding to the rise of edge computing and micro-frontends.',
    image: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?q=80&w=800&h=500&fit=crop',
    author: 'Andrew Wills'
  },
  {
    id: 2,
    title: 'Mastering Brand Identity in a Digital-First World',
    category: 'BRANDING',
    date: 'May 08, 2026',
    excerpt: 'How to build a brand that resonates with modern consumers and stands out in an increasingly crowded digital marketplace.',
    image: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?q=80&w=800&h=500&fit=crop',
    author: 'Alisha Smith'
  },
  {
    id: 3,
    title: 'Maximizing ROI: Strategies for High-Performance Ad Campaigns',
    category: 'MARKETING',
    date: 'May 05, 2026',
    excerpt: 'Learn the secrets of running successful PPC campaigns that drive conversions and scale your business growth.',
    image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=800&h=500&fit=crop',
    author: 'Robert White'
  },
  {
    id: 4,
    title: 'The Power of Data: Transforming Business Intelligence with Power BI',
    category: 'STRATEGY',
    date: 'April 28, 2026',
    excerpt: 'Unlock the potential of your business data with interactive dashboards and real-time analytics for better decision making.',
    image: 'https://images.unsplash.com/photo-1454165833767-027ffea9e778?q=80&w=800&h=500&fit=crop',
    author: 'Sarah George'
  },
  {
    id: 5,
    title: 'Mobile App Trends: Creating Seamless User Experiences',
    category: 'MOBILE APPS',
    date: 'April 22, 2026',
    excerpt: 'A deep dive into the latest mobile app design patterns and technologies that are defining the next generation of mobile apps.',
    image: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?q=80&w=800&h=500&fit=crop',
    author: 'Andrew Wills'
  },
  {
    id: 6,
    title: 'SEO Secrets: Dominating Search Rankings in 2026',
    category: 'SEO',
    date: 'April 15, 2026',
    excerpt: 'Everything you need to know about search engine optimization in the era of AI-powered search and semantic understanding.',
    image: 'https://images.unsplash.com/photo-1571721795195-a2ca2d3370a9?q=80&w=800&h=500&fit=crop',
    author: 'Robert White'
  }
];
