const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const Hero = require('./models/Hero');
const NavbarLink = require('./models/NavbarLink');
const Service = require('./models/Service');

const seedContent = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected for seeding...');

    // 1. Seed Navbar Links (if empty)
    const existingLinks = await NavbarLink.countDocuments();
    if (existingLinks === 0) {
      const defaultLinks = [
        { label: 'Home', path: '/', order: 1 },
        { label: 'About', path: '/about', order: 2 },
        { label: 'Services', path: '/services', order: 3 },
        { label: 'Portfolio', path: '/portfolio', order: 4 },
        { label: 'Blog', path: '/blog', order: 5 },
        { label: 'Pricing', path: '/pricing', order: 6 },
        { label: 'Career', path: '/career', order: 7 }
      ];

      await NavbarLink.insertMany(defaultLinks);
      console.log('Default Navbar Links seeded successfully!');
    } else {
      console.log('Navbar links already exist. Skipping.');
    }

    // 2. Seed Hero Content (if empty)
    const existingHero = await Hero.countDocuments({ isActive: true });
    if (existingHero === 0) {
      const defaultHero = {
        tagline: 'REAL VALUE. REAL CONTENT. REAL GROWTH',
        heading: 'Build. Market. Grow.',
        subheading: 'We think beyond the boundaries, So join us to grow your business.\\nAnd be smart and fast.',
        primaryButtonText: 'Start Project',
        primaryButtonLink: '/get-quote',
        secondaryButtonText: 'View Services',
        secondaryButtonLink: '/services',
        description: 'At our company, professionalism meets smart execution. We offer a wide range of high-quality services designed to simplify operations and support business growth under one trusted platform. We believe every business deserves a service partner that understands modern challenges and delivers practical, efficient solutions. Our multi-service expertise allows us to provide flexible, cost-effective, and scalable support across different industries. Your trusted partner for professional multi-service solutions.',
        isActive: true
      };

      await Hero.create(defaultHero);
      console.log('Default Hero content seeded successfully!');
    } else {
      console.log('Active Hero content already exists. Skipping.');
    }

    // 3. Seed Services
    const existingServices = await Service.countDocuments();
    if (existingServices === 0) {
      const defaultServices = [
        {
          id_string: 'web-dev',
          slug: 'website-development',
          title: 'Website Development',
          subtitle: 'High Performance & Stunning Layouts',
          shortDescription: 'We build fast, mobile-friendly websites — from landing pages to full web portals.',
          description: 'Our development team specializes in crafting high-converting, blazing-fast web solutions that represent your brand with prestige.',
          subServices: 'Static sites, CMS, E-commerce, Web Apps',
          iconName: 'Globe',
          features: ['Custom Responsive UI/UX Design', 'Modern Single Page Applications (SPAs)'],
          order: 1
        },
        {
          id_string: 'app-dev',
          slug: 'mobile-app-development',
          title: 'App Development',
          subtitle: 'Seamless iOS & Android Experiences',
          shortDescription: 'Native and cross-platform mobile apps for iOS and Android.',
          description: 'We develop highly interactive, feature-rich native and cross-platform mobile apps.',
          subServices: 'Flutter, React Native, Android, iOS',
          iconName: 'Smartphone',
          features: ['Cross-Platform Apps', 'Real-Time Push Notifications'],
          order: 2
        },
        {
          id_string: 'social-media',
          slug: 'social-media-management',
          title: 'Social Media Management',
          subtitle: 'Build an Unforgettable Social Presence',
          shortDescription: 'Consistent, creative content that builds your brand and engages your audience.',
          description: 'Our social media experts curate compelling content and schedule engaging interactions.',
          subServices: 'Posts, Reels, Stories, Strategy',
          iconName: 'Share2',
          features: ['Custom Content Calendar', 'High-Engagement Reels & Stories'],
          order: 3
        },
        {
          id_string: 'performance-marketing',
          slug: 'performance-marketing',
          title: 'Performance Marketing',
          subtitle: 'Paid Ads, Brand Awareness & Content Strategy',
          shortDescription: 'Data-driven ad campaigns across Google, Meta, and more — every rupee tracked.',
          description: 'We deploy high-performance outbound marketing models.',
          subServices: 'Google Ads, Meta Ads, A/B Testing',
          iconName: 'TrendingUp',
          features: ['Laser-Targeted Google & Social Ads', 'Creative Design & Ad Copywriting'],
          order: 4
        },
        {
          id_string: 'accounting-finance',
          slug: 'accounting-financial-services',
          title: 'Accounting & Finance',
          subtitle: 'Streamlined Compliance & MIS Reporting',
          shortDescription: 'Indian and US accounting, GST, compliance, bookkeeping.',
          description: 'Manage your operations with absolute precision. We offer professional outsource accounting.',
          subServices: 'GST Filing, ITR, US GAAP, Bookkeeping',
          iconName: 'Calculator',
          features: ['Multi-Currency Bookkeeping', 'Tax Planning & Statutory Filings'],
          order: 5
        },
        {
          id_string: 'mis-reporting',
          slug: 'mis-reporting-services',
          title: 'MIS & Reporting Services',
          subtitle: 'SQL, Power BI, Python integrations',
          shortDescription: 'Automated dashboards and reports using Excel, Power BI.',
          description: 'We create automated pipelines using Python scripts, robust SQL data warehouse modeling, and interactive Power BI charts.',
          subServices: 'Excel Dashboards, Power BI, Automation',
          iconName: 'LayoutDashboard',
          features: ['Automated Data Pipelines (ETL)', 'Custom Interactive Power BI Dashboards'],
          order: 6
        }
      ];
      await Service.insertMany(defaultServices);
      console.log('Default Services seeded successfully!');
    } else {
      console.log('Services already exist. Skipping.');
    }

    console.log('Seeding completed.');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
};

seedContent();
