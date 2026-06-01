const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const PricingCategory = require('./models/PricingCategory');
const PricingPlan = require('./models/PricingPlan');

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '.env') });

const ALL_PRICING_CATEGORIES = [
  { id: 'web', name: 'Web Development', description: 'Premium web applications & scalable CMS architectures', icon: 'web', order: 1 },
  { id: 'app', name: 'Mobile Apps', description: 'Native and cross-platform mobile solutions', icon: 'app', order: 2 },
  { id: 'branding', name: 'Branding & UI/UX', description: 'Strategic design and scalable visual identity kits', icon: 'branding', order: 3 },
  { id: 'marketing', name: 'Marketing & SEO', description: 'Growth-driven organic ranking and paid performance marketing', icon: 'marketing', order: 4 },
  { id: 'finance', name: 'Accounting & BI', description: 'Automated bookkeeping and Power BI analytics', icon: 'finance', order: 5 }
];

const parsePrice = (priceStr) => {
  const isMonthly = priceStr.toLowerCase().includes('/mo');
  const isStartingAt = priceStr.includes('+');
  let amountStr = priceStr.replace(/[^\d]/g, '');
  const amount = parseInt(amountStr, 10);
  
  return {
    amount,
    currency: 'INR',
    period: isMonthly ? 'monthly' : 'one-time',
    isStartingAt,
    discountPercentage: 0
  };
};

const ALL_PRICING_PLANS = [
  // Web Development
  { categoryId: 'web', title: 'WordPress Website', tech: 'Elementor · WooCommerce · Responsive', price: '₹15,000+', features: ['Custom theme setup & design', 'Elementor page builder', 'WooCommerce support', 'Responsive mobile layout', 'SEO plugins support', 'Contact forms integration', '2 rounds of revisions', 'Delivery in 7–10 working days'], highlight: false, order: 1 },
  { categoryId: 'web', title: 'React / Framework Website', tech: 'Next.js · React · Tailwind · Custom CMS', price: '₹30,000+', features: ['Custom UI/UX design from scratch', 'Built on React / Next.js', 'SEO-friendly architecture', 'Component-based scalable architecture', 'Fully responsive design', 'API integrations', 'Admin panel / CMS', 'Analytics setup', '3 rounds of revisions', 'Delivery in 10–20 working days'], highlight: true, order: 2 },
  { categoryId: 'web', title: 'E-Commerce Custom Portal', tech: 'Next.js · Node.js · Advanced Payment Gateways', price: '₹50,000+', features: ['Custom multivendor / enterprise store', 'Advanced filtering & search engines', 'Multiple payment gateway integrations', 'Inventory & order management CMS', 'High-speed edge caching', 'Automated email & SMS notifications', 'Dedicated support & maintenance', 'Delivery in 20–30 working days'], highlight: false, order: 3 },

  // Mobile Apps
  { categoryId: 'app', title: 'Cross-Platform Mobile App', tech: 'React Native / Flutter · iOS & Android', price: '₹60,000+', features: ['Single codebase for iOS & Android', 'Custom intuitive UI/UX design', 'REST API / GraphQL backend integration', 'Real-time push notifications', 'Social media logins & auth', 'App Store & Google Play deployment', '3 months post-launch support'], highlight: true, order: 1 },
  { categoryId: 'app', title: 'Enterprise Native Application', tech: 'Swift · Kotlin · High Performance Native', price: '₹1,20,000+', features: ['Dedicated native iOS & Android apps', 'Ultra-high performance & fluid micro-animations', 'Offline storage & complex cloud syncing', 'Advanced hardware integration (Camera/GPS/Biometrics)', 'Bank-grade security encryption', 'Dedicated project manager & architect', '6 months post-launch VIP support'], highlight: false, order: 2 },

  // Branding & UI/UX
  { categoryId: 'branding', title: 'Startup Brand Identity Kit', tech: 'Vector Logo · Typography · Color Guidelines', price: '₹15,000+', features: ['3 Custom vector logo concepts', 'Primary & secondary color palette selection', 'Typography & font pairing guidelines', 'Business card & letterhead design', 'Social media profile & cover banners', 'Full copyright ownership & source files', 'Delivery in 5–7 working days'], highlight: false, order: 1 },
  { categoryId: 'branding', title: 'Complete Enterprise UI/UX', tech: 'Figma Design System · Wireframing · Prototyping', price: '₹40,000+', features: ['Comprehensive user research & flow mapping', 'High-fidelity interactive Figma prototypes', 'Complete modular design system & token setup', 'Developer-ready asset handoff', 'Responsive desktop, tablet & mobile layouts', 'Usability testing & 4 revision rounds', 'Delivery in 15–20 working days'], highlight: true, order: 2 },

  // Marketing & SEO
  { categoryId: 'marketing', title: 'Local SEO & Organic Growth', tech: 'On-Page SEO · Backlinks · Google My Business', price: '₹15,000/mo', features: ['Comprehensive website technical SEO audit', 'Targeted keyword research & mapping', 'Google My Business optimization', 'High-authority white-hat backlink building', 'Monthly organic traffic & ranking reports', 'Continuous on-page content optimization', 'Dedicated SEO specialist'], highlight: false, order: 1 },
  { categoryId: 'marketing', title: 'Performance PPC & Social Ads', tech: 'Google Ads · Meta PPC · LinkedIn Scaling', price: '₹30,000/mo', features: ['Laser-targeted ad campaign strategy & setup', 'High-converting ad creative design & copywriting', 'Custom multi-channel retargeting funnels', 'A/B testing & continuous conversion optimization', 'Detailed bi-weekly ROI & ROAS audits', 'Pixel tracking & advanced analytics setup', 'Cancel anytime with 30-day notice'], highlight: true, order: 2 },

  // Accounting & BI
  { categoryId: 'finance', title: 'Outsource Bookkeeping & Tax', tech: 'GST · TDS · GAAP · Monthly Compliance', price: '₹15,000/mo', features: ['Dedicated professional accountant', 'Monthly bank & ledger reconciliation', 'GST computation & statutory tax filings', 'Payroll processing & TDS compliance', 'Monthly Profit & Loss and Balance Sheet reports', 'Audit readiness & CA representation support', 'Secure cloud accounting software setup'], highlight: false, order: 1 },
  { categoryId: 'finance', title: 'Custom Power BI & Automation', tech: 'Python ETL · SQL Warehousing · Power BI', price: '₹45,000+', features: ['Automated data ingestion pipelines (ETL)', 'Custom interactive Power BI executive dashboards', 'SQL database architecture & query optimization', 'Python scripts for automated web scraping / reporting', 'Real-time automated alerts via Email & Slack', 'Complete documentation & team training session', '3 months post-delivery maintenance'], highlight: true, order: 2 }
];

const seedPricingData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Connected...');

    // Don't delete existing data to preserve what admin might have already created
    // But we avoid duplicates by checking if they exist
    
    let categoryMap = {};

    for (const cat of ALL_PRICING_CATEGORIES) {
      let existingCat = await PricingCategory.findOne({ name: cat.name });
      if (!existingCat) {
        existingCat = await PricingCategory.create({
          name: cat.name,
          description: cat.description,
          icon: cat.icon,
          order: cat.order,
          status: 'active',
          seo: {
            metaTitle: `${cat.name} Pricing | Vedhunt`,
            metaDescription: cat.description
          }
        });
        console.log(`Created category: ${existingCat.name}`);
      } else {
        console.log(`Category already exists: ${existingCat.name}`);
      }
      categoryMap[cat.id] = existingCat._id;
    }

    for (const plan of ALL_PRICING_PLANS) {
      const existingPlan = await PricingPlan.findOne({ title: plan.title });
      if (!existingPlan) {
        await PricingPlan.create({
          category: categoryMap[plan.categoryId],
          title: plan.title,
          tech: plan.tech,
          pricing: parsePrice(plan.price),
          features: plan.features,
          highlight: plan.highlight,
          order: plan.order,
          status: 'active',
          seo: {
            metaTitle: `${plan.title} | Vedhunt`,
            metaDescription: plan.features.slice(0, 2).join(' ')
          }
        });
        console.log(`Created plan: ${plan.title}`);
      } else {
        console.log(`Plan already exists: ${plan.title}`);
      }
    }

    console.log('Data seeding completed successfully!');
    process.exit();
  } catch (error) {
    console.error('Error with data import:', error);
    process.exit(1);
  }
};

seedPricingData();
