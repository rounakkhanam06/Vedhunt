import { 
  Globe, 
  Smartphone, 
  Share2, 
  TrendingUp, 
  Calculator, 
  LayoutDashboard,
  Code, 
  Layout, 
  Layers, 
  Cpu, 
  Search, 
  Zap, 
  Shield, 
  Database,
  ShoppingBag,
  Palette,
  MessageSquare,
  BarChart,
  UserCheck,
  Award,
  Sparkles,
  CheckCircle,
  Play,
  Heart,
  DollarSign
} from 'lucide-react';

export const SERVICE_DETAILS_DATA = {
  'website-development': {
    title: 'Website Development',
    subtitle: 'High Performance & Stunning Layouts',
    tagline: 'Blazing-fast, SEO-optimized custom web solutions to represent your brand with prestige.',
    overview: [
      'Your website is the digital storefront of your business. We craft custom websites that are not just beautiful, but engineered for speed, responsiveness, and conversions. Our approach blends state-of-the-art frontend architectures with sleek, minimal aesthetics that reflect your technical and operational prestige.',
      'We focus on mobile responsiveness, high-speed optimization, and clean-code structures. Whether it is a premium corporate website, a lightning-fast React application, or an e-commerce platform, we ensure your users have an unforgettable, frictionless experience that drives conversions.'
    ],
    highlights: [
      { text: 'Affordable Pricing', desc: 'Premium engineering at business-friendly rates.' },
      { text: 'Fast Delivery', desc: 'Launch in days, not months, with optimized workflows.' },
      { text: 'Proven Results', desc: 'Designed for conversion, high engagement & speed.' },
      { text: 'Dedicated Support', desc: 'Direct communication with principal developers.' }
    ],
    subServices: [
      {
        icon: Globe,
        title: 'Corporate Web Portals',
        description: 'Bespoke corporate websites built with custom interactions, lightweight structures, and fully SEO-optimized layout.'
      },
      {
        icon: ShoppingBag,
        title: 'E-Commerce Platforms',
        description: 'Scalable digital storefronts with secure checkouts, seamless product management, and intuitive administrative panels.'
      },
      {
        icon: Code,
        title: 'Custom Web Applications',
        description: 'High-performance React and Next.js applications featuring custom APIs, dashboard metrics, and interactive tooling.'
      },
      {
        icon: Layout,
        title: 'Landing Pages & Funnels',
        description: 'Conversion-optimized micro-sites engineered specifically for paid ad campaigns, product launches, or lead capturing.'
      },
      {
        icon: Layers,
        title: 'Headless CMS Integration',
        description: 'Decoupled web content architectures allowing your team to update copywriting and media instantly without breaking code.'
      },
      {
        icon: Cpu,
        title: 'Speed & SEO Optimization',
        description: 'Auditing and re-engineering slow codebases to score 95+ on Google PageSpeed Insights, boosting organic search visibility.'
      }
    ],
    process: [
      { step: '01', title: 'Discovery & Scope', desc: 'We detail your functional specifications and operational targets.' },
      { step: '02', title: 'Wireframes & UI UX', desc: 'Crafting responsive layout prototypes for visual feedback.' },
      { step: '03', title: 'Agile Engineering', desc: 'Building your custom solution with React, Next.js or lightweight engines.' },
      { step: '04', title: 'Quality Assurance', desc: 'Rigorous speed, responsiveness, security, and integration diagnostics.' },
      { step: '05', title: 'Launch & Handoff', desc: 'Deployment on premium web servers and training your internal teams.' }
    ],
    pricing: {
      type: 'project',
      toggleLabels: { primary: 'One-Time Payment', secondary: 'With Annual Support' },
      plans: [
        {
          title: 'Starter',
          priceOneTime: '₹14,999',
          priceSupport: '₹18,999',
          subtitle: 'Perfect for local brands & landing pages',
          features: [
            'Up to 5 custom designed pages',
            '100% responsive mobile layout',
            'Basic contact form & maps integration',
            'SEO starter setup & meta configuration',
            'Frictionless performance optimization',
            'Delivery within 7-10 working days'
          ],
          cta: 'Get Started Starter',
          highlight: false
        },
        {
          title: 'Growth',
          priceOneTime: '₹29,999',
          priceSupport: '₹34,999',
          subtitle: 'Highly recommended for growing companies',
          features: [
            'Up to 10 premium responsive pages',
            'Next.js / React component framework',
            'Custom CMS / Admin dashboard panel',
            'API integrations (CRM, WhatsApp, Mailchimp)',
            'Ultra-high Google PageSpeed score (90+)',
            'Dynamic custom animations',
            'Delivery within 15-20 working days',
            '3 rounds of revisions included'
          ],
          cta: 'Get Started Growth',
          highlight: true
        },
        {
          title: 'Enterprise',
          priceOneTime: '₹64,999+',
          priceSupport: '₹74,999+',
          subtitle: 'Bespoke engineering for high-volume needs',
          features: [
            'Unlimited custom pages',
            'Full e-commerce suite or interactive SaaS portal',
            'Custom high-security database architecture',
            'Advanced search & filtering algorithms',
            'Dedicated principal engineer support',
            'Priority speed caching configurations',
            'End-to-end user documentation',
            'Unlimited design iterations'
          ],
          cta: 'Get Started Enterprise',
          highlight: false
        }
      ]
    },
    portfolio: [
      {
        image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=600&h=400&fit=crop',
        title: 'Zenith Logistics Corporate Portal',
        metric: '180% PageSpeed Increase',
        description: 'Redesigned a legacy logistics platform with headless architecture, driving seamless customer quote bookings.'
      },
      {
        image: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?q=80&w=600&h=400&fit=crop',
        title: 'Luxura Apparel E-Commerce Store',
        metric: '4.2% Checkout Conversion Rate',
        description: 'Built a custom React-based digital storefront with clean micro-interactions and high-performance layout.'
      }
    ],
    faqs: [
      {
        q: 'How long will it take to build a custom website?',
        a: 'A typical corporate starter site takes 7 to 10 working days, while highly custom React/Next.js frameworks take 15 to 20 working days depending on the scope of custom feature integrations.'
      },
      {
        q: 'Do you provide domain registration and web hosting?',
        a: 'We assist in procuring domain names and setting up scalable, secure hosting engines (such as Vercel, AWS, or Hostinger). The actual subscription fee is billed transparently at actual cost.'
      },
      {
        q: 'Will my website be mobile-friendly and optimized for SEO?',
        a: 'Absolutely. Every single layout we design is natively responsive across mobile devices, tablets, and desktops. We also write search engine indexable semantic HTML with proper metadata.'
      },
      {
        q: 'Can I update the copy and images on the website myself?',
        a: 'Yes, we integrate easy-to-use CMS admin panels (like custom dashboards or headless payloads) so your marketing team can edit content and assets without editing the source code.'
      }
    ],
    testimonial: {
      feedback: "Working with Vedhunt was extremely professional. They took our complex corporate requirements and transformed them into a beautiful, lightning-fast React portal that load instantly. Absolutely outstanding work!",
      author: "Reshma S.",
      role: "E-Commerce Founder",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=150&h=150&fit=crop"
    }
  },
  'mobile-app-development': {
    title: 'Mobile App Development',
    subtitle: 'Seamless iOS & Android Experiences',
    tagline: 'High-performance native and hybrid mobile apps built to engage your customers on the move.',
    overview: [
      'Mobile apps have become a principal standard of daily consumer interaction. We engineer fluid native and cross-platform mobile apps for iOS and Android. Our technical experts focus on building hyper-responsive interfaces that consume minimal battery and memory, ensuring optimal retention rates.',
      'From wireframing and design prototypes to secure database synchronization and deployment on the Apple App Store and Google Play Store, we support you through the full software engineering lifecycle. We implement rich, modern micro-interactions that make your application feel premium.'
    ],
    highlights: [
      { text: 'Native Performance', desc: 'Blazing-fast speeds with direct API access.' },
      { text: 'Fluid Animations', desc: 'Smooth, physics-based UI transitions.' },
      { text: 'Custom Syncing', desc: 'Secure offline database capabilities.' },
      { text: 'App Store Success', desc: 'Complete deployment and review management.' }
    ],
    subServices: [
      {
        icon: Smartphone,
        title: 'Cross-Platform App Development',
        description: 'Single codebase architectures using React Native or Flutter, allowing you to deploy on both iOS and Android simultaneously.'
      },
      {
        icon: Cpu,
        title: 'Native iOS & Android Apps',
        description: 'Dedicated swift/kotlin engineering for apps demanding extreme graphical performance, security, and hardware access.'
      },
      {
        icon: Database,
        title: 'Offline Database Syncing',
        description: 'Locally cached data systems that automatically synchronize with cloud databases when network connectivity returns.'
      },
      {
        icon: Zap,
        title: 'Real-Time Communication',
        description: 'Instant chat engines, geo-location tracking services, and customized push notification funnels for active engagement.'
      }
    ],
    process: [
      { step: '01', title: 'System Blueprinting', desc: 'Mapping user journeys, API specifications, and architectural schema.' },
      { step: '02', title: 'Interactive Prototypes', desc: 'Designing premium visual mockups with interactive flow simulations.' },
      { step: '03', title: 'Agile App Coding', desc: 'Robust React Native or Flutter engineering with proper state management.' },
      { step: '04', title: 'Rigorous Sandbox Testing', desc: 'Automated testing across multiple virtual and hardware mobile devices.' },
      { step: '05', title: 'Store Submission', desc: 'Navigating Google Play and Apple App Store compliance guidelines for deployment.' }
    ],
    pricing: {
      type: 'project',
      toggleLabels: { primary: 'MVP Release', secondary: 'Production Ready' },
      plans: [
        {
          title: 'Starter MVP',
          priceOneTime: '₹49,999',
          priceSupport: '₹59,999',
          subtitle: 'Perfect to validate your app concept',
          features: [
            'Clean cross-platform (iOS & Android) MVP',
            'Up to 6 UI dashboard pages',
            'Firebase database & authentication setup',
            'Standard push notifications integration',
            'Delivery within 20 working days',
            'Basic App Store guidance'
          ],
          cta: 'Build MVP Starter',
          highlight: false
        },
        {
          title: 'Growth App',
          priceOneTime: '₹89,999',
          priceSupport: '₹1,09,999',
          subtitle: 'Ideal for mature startup initiatives',
          features: [
            'Up to 12 custom animated screen layouts',
            'Custom Node.js API & database backend',
            'Full payment gateway & wallet setups',
            'Advanced state management & offline caching',
            'Enhanced dashboard metrics panel',
            '30 days post-launch technical support',
            'Complete store submission management'
          ],
          cta: 'Build Growth App',
          highlight: true
        },
        {
          title: 'Enterprise Custom',
          priceOneTime: '₹1,79,999+',
          priceSupport: '₹2,09,999+',
          subtitle: 'For enterprise solutions & custom features',
          features: [
            'Unlimited highly-custom screen screens',
            'Robust microservice backend system',
            'Advanced biometric & multi-factor security',
            'Custom AI / Analytics modeling integrations',
            '99.9% uptime SLA service agreement',
            'Dedicated principal engineer support',
            'Long-term SLA operational contracts'
          ],
          cta: 'Build Custom App',
          highlight: false
        }
      ]
    },
    portfolio: [
      {
        image: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?q=80&w=600&h=400&fit=crop',
        title: 'FitPulse Interactive Health Tracker',
        metric: '4.8 App Store Rating',
        description: 'Engineered a React Native fitness app with real-time Bluetooth device tracking and custom calories dashboards.'
      },
      {
        image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=600&h=400&fit=crop',
        title: 'QuickPay FinTech Ledger',
        metric: '100k+ App Downloads',
        description: 'Designed a highly secure mobile transactional wallet with real-time biometric locks and ledger sync.'
      }
    ],
    faqs: [
      {
        q: 'Should I choose React Native/Flutter or Native Swift/Kotlin?',
        a: 'For 90% of business applications, React Native or Flutter is perfect. It saves up to 50% in development costs since it uses a single codebase to support both iOS and Android. Native code is only recommended for complex 3D rendering or hardware-intensive architectures.'
      },
      {
        q: 'Do you help publish the apps on the Apple and Google Play stores?',
        a: 'Yes, we take care of the entire store submission process, including metadata configuration, icon setups, policy declarations, and addressing review rejections.'
      },
      {
        q: 'Can the app store data offline?',
        a: 'Absolutely. We configure lightweight local databases (like SQLite or Realm) that store transactional records offline and sync immediately when an internet connection is established.'
      }
    ],
    testimonial: {
      feedback: "Their mobile engineering process was extremely detailed and clean. The application prototypes they built helped us demonstrate concrete traction to our investors and secure our seed round. Absolutely top-tier partners!",
      author: "Karan Malhotra",
      role: "FinTech Founder",
      avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=150&h=150&fit=crop"
    }
  },
  'social-media-management': {
    title: 'Social Media Management',
    subtitle: 'Build an Unforgettable Social Presence',
    tagline: 'Strategic content planning and high-impact visual design to turn followers into customers.',
    overview: [
      'In a noisy digital landscape, attention is currency. We do not just post generic templates. We conceptualize, design, and schedule custom content that reinforces your brand identity and actively drives business growth across platforms like Instagram, LinkedIn, and Facebook.',
      'Our creative crew develops monthly content calendars, curates high-engagement Reels/Shorts scripts, designs professional graphic layouts, and handles community moderation. We keep your brand voice consistent, interactive, and premium.'
    ],
    highlights: [
      { text: 'Aesthetic Branding', desc: 'Custom, gorgeous graphics tailored to your tone.' },
      { text: 'Viral Reels Strategy', desc: 'Scriptwriting and editing for maximum reach.' },
      { text: 'Active Engagement', desc: 'Direct response to followers, comments, and DMs.' },
      { text: 'Weekly Analytics', desc: 'Data-driven content adjustments to scale.' }
    ],
    subServices: [
      {
        icon: Palette,
        title: 'Custom Brand Guidelines',
        description: 'Establishing a cohesive color scheme, layout grid system, and font typography unique to your social media brand.'
      },
      {
        icon: Play,
        title: 'High-Impact Reels & Shorts',
        description: 'Curating script copy, professional motion graphics, and high-impact editing tailored specifically for modern video algorithms.'
      },
      {
        icon: MessageSquare,
        title: 'Community Moderation',
        description: 'Proactively responding to customer queries, comments, and direct inbox messages to drive positive reviews and conversions.'
      },
      {
        icon: UserCheck,
        title: 'LinkedIn Authority Scaling',
        description: 'Drafting high-value professional posts for executives and founders to establish industry authority and capture B2B inquiries.'
      }
    ],
    process: [
      { step: '01', title: 'Brand Audit', desc: 'Analyzing competitors, historical posts, and targeting the ideal persona.' },
      { step: '02', title: 'Content Calendar', desc: 'Drafting 30 days of conceptual ideas, captions, and script blueprints.' },
      { step: '03', title: 'Premium Production', desc: 'Designing elite graphics, editing video loops, and preparing copy.' },
      { step: '04', title: 'Schedule & Publish', desc: 'Automated publishing during high-traffic intervals for maximal exposure.' },
      { step: '05', title: 'Report & Optimize', desc: 'Auditing key metrics (reach, saves, inquiries) to adjust content models.' }
    ],
    pricing: {
      type: 'monthly',
      toggleLabels: { primary: 'Standard Retainer', secondary: 'Quarterly Package (Save 15%)' },
      plans: [
        {
          title: 'Starter',
          priceOneTime: '₹14,999 / mo',
          priceSupport: '₹12,749 / mo',
          subtitle: 'Perfect for regular active posting',
          features: [
            '12 custom graphic posts per month',
            '3 high-impact Reels (script + edit)',
            'Custom aesthetic content layout design',
            'Engaging caption writing & hashtags research',
            'Publishing schedules on Meta channels'
          ],
          cta: 'Scale Social Starter',
          highlight: false
        },
        {
          title: 'Growth Pack',
          priceOneTime: '₹24,999 / mo',
          priceSupport: '₹21,249 / mo',
          subtitle: 'Highly recommended to acquire leads',
          features: [
            '20 premium graphic / carousel posts',
            '8 algorithm-optimized Reels / Shorts',
            'Full management of Instagram, FB & LinkedIn',
            'Community engagement (daily comment responses)',
            '2 dedicated promotional ad campaign layouts',
            'Detailed bi-weekly performance analytics'
          ],
          cta: 'Scale Social Growth',
          highlight: true
        },
        {
          title: 'Enterprise Elite',
          priceOneTime: '₹44,999 / mo',
          priceSupport: '₹38,249 / mo',
          subtitle: 'Complete dominance & custom production',
          features: [
            'Unlimited custom social posts',
            '15 highly-produced Reels / TikToks',
            'Dedicated social media strategist',
            'LinkedIn personal branding copywriting',
            'Influencer outreach & collaboration manager',
            'Custom photography / video direction guidelines'
          ],
          cta: 'Scale Social Enterprise',
          highlight: false
        }
      ]
    },
    portfolio: [
      {
        image: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?q=80&w=600&h=400&fit=crop',
        title: 'DecoSpace Luxury Interiors',
        metric: '320% Instagram Engagement',
        description: 'Transformed an architectural firm’s feed into a luxury aesthetic grid, driving high-ticket direct massage bookings.'
      },
      {
        image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=600&h=400&fit=crop',
        title: 'MedScribe Diagnostics Agency',
        metric: '8,000 Organic B2B Followers',
        description: 'Established thought leadership on LinkedIn through highly detailed custom infographics and operational authority articles.'
      }
    ],
    faqs: [
      {
        q: 'Do you create the raw photos and videos yourself?',
        a: 'We design premium graphics and custom illustrate vector formats. For videos (like Reels), the client provides the raw mobile clips, and our professional editors handle the color correction, transitions, scripts, and typography.'
      },
      {
        q: 'Will you engage with comments and direct messages?',
        a: 'Yes, on the Growth and Enterprise tiers, our community moderating team actively checks, likes, and answers standard customer queries within 1-2 hours.'
      }
    ],
    testimonial: {
      feedback: "Their visual layouts completely transformed our social presence. We went from looking like a generic local vendor to a premium brand name. Our inbound inquires doubled in less than 3 months!",
      author: "Shweta G.",
      role: "Real Estate Marketer",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=150&h=150&fit=crop"
    }
  },
  'performance-marketing': {
    title: 'Performance Marketing',
    subtitle: 'Paid Ads, Brand Awareness & Lead Generation',
    tagline: 'High-ROAS Google and Meta ad campaigns engineered with data to acquire paying customers.',
    overview: [
      'Stop burning money on unmeasured ad boosting. We build scientific, trackable paid acquisition campaigns across Meta (Instagram/Facebook), Google Search, YouTube, and LinkedIn. Every rupee spent is accounted for in concrete metrics: leads, clicks, and checkout conversions.',
      'Our performance marketers combine persuasive copywriting, high-converting ad graphics, and deep A/B testing configurations. We monitor client acquisition costs daily to maximize return on advertising spend (ROAS) and scale profit margins.'
    ],
    highlights: [
      { text: 'Laser Ad Targeting', desc: 'Reach high-intent users ready to buy.' },
      { text: 'A/B Creative Splits', desc: 'Continuous testing of copy & visuals.' },
      { text: 'Accurate ROI Audits', desc: '100% transparent tracking dashboard.' },
      { text: 'Lead Engine Funnels', desc: 'Custom micro-pages built to convert.' }
    ],
    subServices: [
      {
        icon: TrendingUp,
        title: 'Google Search & Display PPC',
        description: 'Targeting users who are actively searching for your service, ensuring immediate high-intent customer acquisition.'
      },
      {
        icon: Share2,
        title: 'Meta Social Ad Funnels',
        description: 'Compelling video and carousel ads across Instagram and Facebook using lookalike audiences and behavioral targeting.'
      },
      {
        icon: Layout,
        title: 'Conversion Rate Auditing (CRO)',
        description: 'Analyzing your landing pages using heatmaps to eliminate frictional elements and double your conversion rate.'
      },
      {
        icon: UserCheck,
        title: 'Advanced Retargeting Systems',
        description: 'Deploying custom pixel retargeting to re-engage users who abandoned carts, maintaining brand recall until purchase.'
      }
    ],
    process: [
      { step: '01', title: 'Funnel Audit', desc: 'Evaluating historical ads, landing page speeds, and configuring pixel trackers.' },
      { step: '02', title: 'Creative Mockups', desc: 'Drafting compelling graphic layouts, hooks, and sales copy variations.' },
      { step: '03', title: 'Ad Launch', desc: 'Deploying structured campaigns with precise target parameters.' },
      { step: '04', title: 'Daily Scaling', desc: 'Pruning underperforming assets, shifting budgets to winning creatives.' },
      { step: '05', title: 'ROI Reports', desc: 'Providing clear documentation on cost-per-lead and monthly return metrics.' }
    ],
    pricing: {
      type: 'monthly',
      toggleLabels: { primary: 'Standard Retainer', secondary: 'Quarterly Setup (Save 15%)' },
      plans: [
        {
          title: 'Starter Ad Plan',
          priceOneTime: '₹19,999 / mo',
          priceSupport: '₹16,999 / mo',
          subtitle: 'Perfect for budgets up to ₹1 Lakh/mo',
          features: [
            'Google Ads or Meta Ads setup',
            '3 custom-designed ad creatives / graphics',
            'Conversion tracking pixel setup',
            'Custom audience demographic definition',
            'Weekly campaign monitoring',
            'Monthly progress spreadsheet report'
          ],
          cta: 'Launch Ads Starter',
          highlight: false
        },
        {
          title: 'Growth Engine',
          priceOneTime: '₹34,999 / mo',
          priceSupport: '₹29,749 / mo',
          subtitle: 'Best for scaling sales & high lead volume',
          features: [
            'Multi-channel ads (Meta + Google Search)',
            '8 premium ad graphics & copy testing variations',
            'Custom high-converting landing page built by us',
            'Competitor keyword bid auditing',
            'Advanced custom retargeting setups',
            'Bi-weekly analysis & live dashboard call'
          ],
          cta: 'Launch Ads Growth',
          highlight: true
        },
        {
          title: 'Enterprise Dominance',
          priceOneTime: '₹64,999 / mo',
          priceSupport: '₹55,249 / mo',
          subtitle: 'For custom funnels & major budgets',
          features: [
            'Full omnichannel setups (Meta, Google, YouTube, LinkedIn)',
            'Unlimited ad design assets & high-converting layouts',
            'Omnichannel CRO & continuous landing page testing',
            'Custom CRM automation and lead alerts integration',
            'Dedicated principal growth strategist',
            'Direct Slack channel response team'
          ],
          cta: 'Launch Ads Enterprise',
          highlight: false
        }
      ]
    },
    portfolio: [
      {
        image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=600&h=400&fit=crop',
        title: 'InstaSolar Lead Engine',
        metric: '380% Increase in B2B Leads',
        description: 'Configured targeted local search campaigns that generated high-volume corporate leads for solar panel setups.'
      },
      {
        image: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?q=80&w=600&h=400&fit=crop',
        title: 'PrimeDental Orthodontics Clinic',
        metric: '₹240 Cost-Per-Consultation',
        description: 'Deployed geographic-targeted Meta ad campaigns with dynamic video patient testimonials, booking 200+ clinics appointments.'
      }
    ],
    faqs: [
      {
        q: 'Does your fee include the paid ad spend billed by Google/Meta?',
        a: 'No, our retainer fee is strictly for our strategy, visual design, campaign management, and reporting. The actual ad budget is paid directly to Google or Meta via your corporate credit card.'
      },
      {
        q: 'How fast will we see qualified business leads?',
        a: 'Paid campaigns often yield initial leads within 48 to 72 hours of launch. However, maximum ROAS and cost stabilization are typically achieved within 3 to 4 weeks of consistent machine learning optimization.'
      }
    ],
    testimonial: {
      feedback: "Absolutely phenomenal results with their digital marketing campaigns. Our brand engagement grew by over 300% and direct inquiries skyrocketed within weeks. The team is hyper-responsive and highly skilled.",
      author: "Nisha Patel",
      role: "Creative Director",
      avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=150&h=150&fit=crop"
    }
  },
  'accounting-financial-services': {
    title: 'Accounting & Financial Services',
    subtitle: 'Streamlined Compliance & MIS Reporting',
    tagline: 'Professional bookkeeping, taxation, and financial compliance with total accuracy.',
    overview: [
      'Managing finances shouldn\'t keep you awake at night. We offer corporate outsource bookkeeping, statutory tax preparation (GST, ITR), and customized cash flow reporting to help executives make data-driven financial decisions with absolute clarity.',
      'Our team is highly experienced in both Indian regulatory frameworks and international ledger guidelines (US GAAP). We automate tedious bank reconciliations, ensure flawless compliance, and keep your accounting systems audit-ready at all times.'
    ],
    highlights: [
      { text: 'Absolute Accuracy', desc: 'Zero error tolerance in ledgers & reconciliations.' },
      { text: 'Prompt Compliance', desc: 'Avoid penalties with early tax filings.' },
      { text: 'Actionable Insights', desc: 'MIS reports showing exact monthly cash flows.' },
      { text: 'Hassle-Free Auditing', desc: 'Complete support for corporate auditors.' }
    ],
    subServices: [
      {
        icon: Calculator,
        title: 'Corporate Bookkeeping',
        description: 'Flawless maintenance of purchase/sales ledgers, bank transactions, and depreciation charts in QuickBooks or Tally.'
      },
      {
        icon: DollarSign,
        title: 'GST & Statutory Compliance',
        description: 'Computing monthly GST liabilities, preparing GSTR-1 & GSTR-3B filings, and managing input tax credit reconciliations.'
      },
      {
        icon: Shield,
        title: 'Income Tax (ITR) Filing',
        description: 'Strategic corporate tax planning and prompt filing of yearly returns in alignment with statutory audits.'
      },
      {
        icon: LayoutDashboard,
        title: 'MIS & Cash Flow Reporting',
        description: 'Clean monthly reports detailing cash burn rate, operating margins, and profit-and-loss breakouts.'
      }
    ],
    process: [
      { step: '01', title: 'System Setup', desc: 'Integrating bank feeds with accounting tools (Tally, Zoho, QuickBooks).' },
      { step: '02', title: 'Bookkeeping', desc: 'Weekly classification of expenses, receipts, and revenue records.' },
      { step: '03', title: 'Reconciliation', desc: 'Balancing accounts ledger records with bank credit/debit histories.' },
      { step: '04', title: 'Tax Filings', desc: 'Drafting GSTR reports early to secure prompt internal validations.' },
      { step: '05', title: 'Monthly MIS', desc: 'Publishing customized financial breakdowns to support administrative strategy.' }
    ],
    pricing: {
      type: 'monthly',
      toggleLabels: { primary: 'Monthly Retainer', secondary: 'With Quarterly Audit' },
      plans: [
        {
          title: 'Starter Ledger',
          priceOneTime: '₹4,999 / mo',
          priceSupport: '₹7,999 / mo',
          subtitle: 'Ideal for small firms & single founders',
          features: [
            'Up to 100 bank ledger transactions/mo',
            'Monthly bank account reconciliation',
            'Monthly GST calculation & GSTR filing',
            'Standard Profit & Loss sheet',
            'Direct access to account executive'
          ],
          cta: 'Get Accounting Starter',
          highlight: false
        },
        {
          title: 'Growth Corporate',
          priceOneTime: '₹11,999 / mo',
          priceSupport: '₹14,999 / mo',
          subtitle: 'Best for active trading & retail brands',
          features: [
            'Up to 350 bank transactions/mo',
            'Weekly ledger updates & checks',
            'Input Tax Credit (ITC) reconciliation',
            'Custom monthly MIS cash flow report',
            'TDS computation & quarterly return filings',
            'Direct support during tax inspections'
          ],
          cta: 'Get Accounting Growth',
          highlight: true
        },
        {
          title: 'Enterprise Custom',
          priceOneTime: '₹24,999 / mo',
          priceSupport: '₹29,999 / mo',
          subtitle: 'For high transaction volumes & multi-entities',
          features: [
            'Unlimited transactions & accounts',
            'Dedicated principal financial controller',
            'Multi-currency / international ledger setups',
            'Advanced payroll administration & PF/ESI compliance',
            'Full coordination with external statutory auditors',
            'Strategic cash-flow forecasting modeling'
          ],
          cta: 'Get Accounting Enterprise',
          highlight: false
        }
      ]
    },
    portfolio: [
      {
        image: 'https://images.unsplash.com/photo-1454165833767-027ffea9e778?q=80&w=600&h=400&fit=crop',
        title: 'Nexus Logistics Services',
        metric: 'Zero-Audit Penalties In 2 Years',
        description: 'Restructured ledger classification and optimized input tax credits, saving over ₹4.5 Lakhs in leakages.'
      },
      {
        image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=600&h=400&fit=crop',
        title: 'Aura Retail Apparels',
        metric: '3 Days Fast Books Closure',
        description: 'Automated POS sales data importing with inventory ledgers, decreasing month-end closing latency by 12 days.'
      }
    ],
    faqs: [
      {
        q: 'Which accounting software platforms do you support?',
        a: 'We are highly skilled across QuickBooks, Tally Prime, Zoho Books, and Xero. We select the tool that aligns with your operational scale.'
      },
      {
        q: 'How do we share our financial invoices and receipts with you?',
        a: 'We configure a secure shared Google Drive folder or WhatsApp portal where your team can upload invoices and bank statements. We process these records weekly.'
      }
    ],
    testimonial: {
      feedback: "Working with Vedhunt has given us massive relief. They managed our complex input tax credits and TDS filings with absolute precision. Our bookkeeping is finally in pristine shape!",
      author: "Piyush K.",
      role: "Finance Director",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=150&h=150&fit=crop"
    }
  },
  'mis-reporting-services': {
    title: 'MIS & Reporting Services',
    subtitle: 'SQL, Power BI & Custom Automation Pipelines',
    tagline: 'Automated data pipelines and interactive executive dashboards to track KPIs in real time.',
    overview: [
      'Stop wasting hours of manual Excel copying every single week. We build automated data pipelines using Python and robust SQL querying to consolidate records from your CRMs, databases, and spreadsheets into beautifully designed, interactive Power BI dashboards.',
      'Our analytics engineers help you identify operating bottlenecks, trace customer conversion metrics, and monitor department-wise cost structures in real time. We make data accessible, clean, and highly actionable.'
    ],
    highlights: [
      { text: 'Automated Pipelines', desc: 'No more manual data entry or copy-paste errors.' },
      { text: 'Interactive Charts', desc: 'Drill down to specific regions or sales with one click.' },
      { text: 'Instant Alerts', desc: 'Trigger Slack or email updates for major metrics.' },
      { text: 'Fast Database Queries', desc: 'Optimized SQL for high-speed reporting.' }
    ],
    subServices: [
      {
        icon: LayoutDashboard,
        title: 'Power BI & Tableau Dashboards',
        description: 'Crafting visually stunning, interactive dashboards that refresh automatically, showing you key operational variables.'
      },
      {
        icon: Database,
        title: 'SQL Warehouse Engineering',
        description: 'Structuring clean databases, optimizing query layouts, and building relational schemas to support fast reports.'
      },
      {
        icon: Zap,
        title: 'Python Automation Scripts',
        description: 'Writing scripts to automatically scrape lead portals, consolidate CSV reports, and dispatch notifications.'
      },
      {
        icon: BarChart,
        title: 'Executive KPI Definition',
        description: 'Consulting with management to identify core operational metrics and designing visual systems to track them.'
      }
    ],
    process: [
      { step: '01', title: 'Data Inventory', desc: 'Identifying data origins (CRMs, SQL databases, Shopify, Google Sheets).' },
      { step: '02', title: 'ETL Pipeline Design', desc: 'Writing automated scripts to extract, clean, and consolidate raw datasets.' },
      { step: '03', title: 'Visual Wireframing', desc: 'Drafting mockup layouts of dashboard screens for user experience review.' },
      { step: '04', title: 'Power BI Development', desc: 'Coding advanced DAX queries, relational joins, and interactive grids.' },
      { step: '05', title: 'Alert Deployments', desc: 'Setting up automated metric reports to deliver directly to your inbox or Slack.' }
    ],
    pricing: {
      type: 'project',
      toggleLabels: { primary: 'Dashboard Build', secondary: 'With Monthly SLA Support' },
      plans: [
        {
          title: 'Starter Dashboard',
          priceOneTime: '₹19,999',
          priceSupport: '₹24,999',
          subtitle: 'Perfect to automate a single data process',
          features: [
            '1 custom Power BI or Excel dashboard',
            'Up to 3 data sources (Excel, CSV, SQL)',
            'Standard automated daily data refresh',
            'Up to 5 custom charts & metrics',
            'Delivery within 12 working days'
          ],
          cta: 'Build Dashboard Starter',
          highlight: false
        },
        {
          title: 'Growth Analytics',
          priceOneTime: '₹39,999',
          priceSupport: '₹47,999',
          subtitle: 'Ideal for operational visibility across teams',
          features: [
            'Up to 3 interconnected dashboard layouts',
            'Unlimited data sources (API, SQL, CRM, Shopify)',
            'Advanced DAX queries and relational data models',
            'Hourly automated dashboard refresh setups',
            'Custom email/Slack metric alert automation',
            'Complete team operational training session'
          ],
          cta: 'Build Dashboard Growth',
          highlight: true
        },
        {
          title: 'Enterprise custom',
          priceOneTime: '₹79,999+',
          priceSupport: '₹94,999+',
          subtitle: 'Complete data lakehouse setup & custom tools',
          features: [
            'Unlimited custom dashboards & reports',
            'Custom Python ETL database pipeline build',
            'High-security enterprise SQL server structure',
            'Predictive analytics / forecasting charts',
            'Dedicated principal BI data engineer support',
            '24/7 priority support & monitoring SLA'
          ],
          cta: 'Build Dashboard Enterprise',
          highlight: false
        }
      ]
    },
    portfolio: [
      {
        image: 'https://images.unsplash.com/photo-1454165833767-027ffea9e778?q=80&w=600&h=400&fit=crop',
        title: 'MedLine Healthcare CRM Analytics',
        metric: '15 Hours Saved Every Week',
        description: 'Consolidated patient records and billing invoices from 6 local clinics into one auto-updating central dashboard.'
      },
      {
        image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=600&h=400&fit=crop',
        title: 'Omni物流 Operational Metric Tool',
        metric: '9% Efficiency Bottlenecks Resolved',
        description: 'Designed a real-time dispatch dashboard with Python-automated emails, alerting operations of delay instances.'
      }
    ],
    faqs: [
      {
        q: 'Can Power BI work with data stored in local Excel spreadsheets?',
        a: 'Yes. We can set up a secure gateway utility on your office PC that automatically grabs data from your local Excel spreadsheets and updates the Power BI cloud dashboard seamlessly.'
      },
      {
        q: 'Is our corporate data safe and secure during transfers?',
        a: 'Absolutely. We configure fully encrypted data pipelines using secure HTTPS API tunnels or SSL database configurations. Your login credentials are encrypted in premium cloud lockers.'
      }
    ],
    testimonial: {
      feedback: "Working with Vedhunt was extremely professional. They took our complex reporting workflow and transformed it into a fully automated Power BI dashboard. Saves our department 15 hours every single week.",
      author: "Piyush K.",
      role: "Finance Director",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=150&h=150&fit=crop"
    }
  }
};
