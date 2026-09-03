const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const logger = require('./utils/logger');

// Import Middleware
const { globalLimiter } = require('./middleware/rateLimiter');
const startCronJobs = require('./services/cronJobs');

// Import Routes
const authRoutes = require('./routes/auth');
const uploadRoutes = require('./routes/upload');
const heroRoutes = require('./routes/hero');
const teamRoutes = require('./routes/team');
const rbacRoutes = require('./routes/rbac');
const contentRoutes = require('./routes/contentRoutes');
const testimonialRoutes = require('./routes/testimonialRoutes');
const portfolioRoutes = require('./routes/portfolioRoutes');
const pricingRoutes = require('./routes/pricingRoutes');
const homePricingCardRoutes = require('./routes/homePricingCardRoutes');
const { seedPortfolioData, seedPortfolioMetrics, seedPortfolioCTA, seedPortfolioHero } = require('./controllers/portfolioController');
const { seedHomePricingCards } = require('./controllers/homePricingCardController');
const { seedFaqData } = require('./controllers/faqController');
const { seedBlogsAndSettings } = require('./controllers/blogSeeder');
const blogRoutes = require('./routes/blogRoutes');
const blogCategoryRoutes = require('./routes/blogCategoryRoutes');
const jobRoutes = require('./routes/jobRoutes');
const applicationRoutes = require('./routes/applicationRoutes');
const faqRoutes = require('./routes/faqRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const servicePageRoutes = require('./routes/servicePageRoutes');
const contactRoutes = require('./routes/contactRoutes');
const leadRoutes = require('./routes/leadRoutes');
const leadFormRoutes = require('./routes/leadFormRoutes');
const assignmentRoutes = require('./routes/assignmentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const activityRoutes = require('./routes/activityRoutes');
const auditRoutes = require('./routes/auditRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const subscribeRoutes = require('./routes/subscribeRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const employeeAuthRoutes = require('./routes/employeeAuthRoutes');
const employeePortalRoutes = require('./routes/employeePortalRoutes');
const performanceRoutes = require('./routes/performanceRoutes');
const payrollRoutes = require('./routes/payrollRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const { seedServicePages } = require('./controllers/servicePageSeeder');
const { generateSitemap } = require('./controllers/sitemapController');

// Client Portal Routes (isolated from admin auth)
const clientAuthRoutes = require('./routes/clientAuthRoutes');
const clientPortalRoutes = require('./routes/clientPortalRoutes');
const clientManagementRoutes = require('./routes/clientManagementRoutes');
const errorHandler = require('./middleware/errorHandler');

// Cache middleware for public read-only GET endpoints
// Allows browsers + CDN to cache responses for 2 minutes (s-maxage 4 min for CDN)
// Bypasses cache for authenticated admin requests
const publicCache = (req, res, next) => {
  // contentRoutes mixes public reads with /admin/* writes+reads under one
  // mount — never let admin sub-paths be cached, even if a stray request
  // happens to reach here without an Authorization header (e.g. a token
  // refresh race). Without this, a single such request can get a CDN/proxy
  // to cache the admin response as "public" for minutes, showing stale
  // data (e.g. an already-deleted record) until the cache expires.
  if (req.path.startsWith('/admin')) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  } else if (req.method === 'GET' && !req.headers.authorization) {
    res.set('Cache-Control', 'public, max-age=120, s-maxage=240, stale-while-revalidate=60');
  } else if (req.method === 'GET' && req.headers.authorization) {
    // Explicitly prevent caching for admin requests
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
  next();
};

const app = express();

// Trust first proxy (needed for express-rate-limit to get the correct client IP behind Nginx/Cloudflare/Vercel)
app.set('trust proxy', 1);

// Security & Global Middleware
app.use(helmet());
app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
      'https://vedhunt.vercel.app',
      process.env.CLIENT_ORIGIN
    ].filter(Boolean),
    credentials: true, // required to send cookies
  })
);
if (process.env.NODE_ENV === 'production') {
  app.use(globalLimiter); // Apply global rate limiting
}

// Webhooks must be registered BEFORE global express.json() 
// because FB webhook needs the raw body to verify HMAC signatures
app.use('/api/leads/webhook', webhookRoutes);

app.use(express.json({ limit: '10mb' })); // Body parser with increased limit for rich text
app.use(cookieParser()); // Cookie parser

// Dynamic Sitemap Generation Route
app.get('/api/sitemap.xml', generateSitemap);

// Serve public directory for local uploads
app.use(express.static(path.join(__dirname, 'public')));

// Request Logging
const morganFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
app.use(
  morgan(morganFormat, {
    stream: { write: (message) => logger.info(message.trim()) },
  })
);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/hero', publicCache, heroRoutes); // Legacy route, keeping for backwards compatibility
app.use('/api/team', publicCache, teamRoutes);
app.use('/api/rbac', rbacRoutes);
app.use('/api/content', publicCache, contentRoutes);
app.use('/api/testimonials', publicCache, testimonialRoutes);
app.use('/api/portfolio', publicCache, portfolioRoutes);
app.use('/api/pricing', publicCache, pricingRoutes);
app.use('/api/home-pricing', publicCache, homePricingCardRoutes);
app.use('/api/blog-categories', publicCache, blogCategoryRoutes);
app.use('/api/blogs', publicCache, blogRoutes);
app.use('/api/jobs', publicCache, jobRoutes);
app.use('/api/applications', applicationRoutes); // write route — no cache
app.use('/api/faq', publicCache, faqRoutes);
app.use('/api/service-pages', publicCache, servicePageRoutes);
app.use('/api/contact', contactRoutes);   // write route — no cache
app.use('/api/leads', leadRoutes);         // write route — no cache
// Mounted before the publicCache-wrapped settingsRoutes below: these are
// cookie-authenticated GETs, which publicCache would mark publicly cacheable.
app.use('/api/admin/lead-forms', leadFormRoutes);
app.use('/api/admin/assignment', assignmentRoutes);
app.use('/api/admin/activity', activityRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/subscribe', subscribeRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/performance', performanceRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api', publicCache, settingsRoutes);
app.use('/api', paymentRoutes); // Non-cached payment routes


// Client Portal — completely isolated auth + data routes
app.use('/api/client/auth', clientAuthRoutes);
app.use('/api/client', clientPortalRoutes); // all protected by clientAuthMiddleware internally

// Employee Portal — completely isolated auth + data routes
app.use('/api/employee/auth', employeeAuthRoutes);
app.use('/api/employee-portal', employeePortalRoutes); // all protected by employeeAuthMiddleware internally

// Admin management of client portal data (clients, invoices, projects, retainers, tickets)
app.use('/api/admin', clientManagementRoutes);

// Analytics
app.use('/api/admin/analytics', analyticsRoutes);

// Root route for API status
app.get('/', (req, res) => {
  res.json({ success: true, message: 'Vedhunt API is running successfully.' });
});

// Error handling middleware
app.use(errorHandler);

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  const clientBuildPath = path.join(__dirname, '../client/dist');
  app.use(express.static(clientBuildPath));

  const fs = require('fs');
  const Service = require('./models/Service');
  const ServicePage = require('./models/ServicePage');

  // Server-Side Render Open Graph Tags for Social Media Bots
  app.get('/services/:slug', async (req, res) => {
    try {
      const slug = req.params.slug;
      
      // Fetch data
      const serviceMain = await Service.findOne({ slug, isActive: true }).lean();
      const serviceDetails = await ServicePage.findOne({ serviceSlug: slug, isActive: true }).lean();

      let htmlData = fs.readFileSync(path.resolve(clientBuildPath, 'index.html'), 'utf8');

      if (serviceMain && serviceDetails) {
        const ogTitle = serviceDetails.metaTitle || serviceMain.metaTitle || serviceDetails.title || serviceMain.title;
        const ogDesc = serviceDetails.metaDescription || serviceMain.metaDescription || serviceMain.shortDescription;
        const ogImage = serviceDetails.ogImage || serviceMain.imageUrl || 'https://vedhunt.in/og-banner.jpg';
        const canonicalUrl = `https://vedhunt.in/services/${slug}`;

        const metaTags = `
          <title>${ogTitle}</title>
          <meta name="description" content="${ogDesc}" />
          <meta property="og:site_name" content="Vedhunt Infotech" />
          <meta property="og:type" content="website" />
          <meta property="og:title" content="${ogTitle}" />
          <meta property="og:description" content="${ogDesc}" />
          <meta property="og:url" content="${canonicalUrl}" />
          <meta property="og:image" content="${ogImage}" />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content="${ogTitle}" />
          <meta name="twitter:description" content="${ogDesc}" />
          <meta name="twitter:image" content="${ogImage}" />
        `;

        // Inject the meta tags right before </head>
        htmlData = htmlData.replace('</head>', `${metaTags}</head>`);
      }

      res.send(htmlData);
    } catch (error) {
      console.error('Error serving dynamic OG tags:', error);
      res.sendFile(path.resolve(clientBuildPath, 'index.html'));
    }
  });

  // ── 404 handling ───────────────────────────────────────────────────────────
  // Serving index.html with a 200 for every unmatched path made every URL look
  // like a real page to search engines. Google indexed paths that have never
  // existed (/case-studies among them) and could not drop them, because the
  // server kept insisting they were fine. The SPA still renders its own 404
  // screen — the difference is the status code crawlers see.
  const Blog = require('./models/Blog');

  // Public routes declared in client/src/routes/index.jsx
  const STATIC_ROUTES = new Set([
    '/', '/about', '/services', '/portfolio', '/get-quote', '/pricing',
    '/career', '/career/success', '/blog', '/faq', '/thank-you', '/sitemap',
    '/privacy-policy', '/terms-and-conditions', '/refund-and-billing-policy',
    '/cookie-policy', '/data-processing-agreement'
  ]);

  // Prefixes whose sub-paths are app-internal (authenticated areas, landing
  // pages, tokenised links). Never 404 these — they are not crawlable content
  // and their validity is decided client-side.
  const PASSTHROUGH_PREFIXES = ['/admin', '/client', '/employee', '/lp/', '/unsubscribe/'];

  const routeExists = async (pathname) => {
    const clean = pathname.replace(/\/+$/, '') || '/';

    if (STATIC_ROUTES.has(clean)) return true;
    if (PASSTHROUGH_PREFIXES.some((p) => clean === p.replace(/\/$/, '') || clean.startsWith(p))) return true;

    // Detail pages are only real if the underlying record is
    const service = clean.match(/^\/services?\/([^/]+)$/);
    if (service) return !!(await Service.exists({ slug: service[1], isActive: true }));

    // Blog links are usually slugs but the route also accepts an id
    const blog = clean.match(/^\/blog\/([^/]+)$/);
    if (blog) {
      const query = mongoose.isValidObjectId(blog[1])
        ? { $or: [{ slug: blog[1] }, { _id: blog[1] }] }
        : { slug: blog[1] };
      return !!(await Blog.exists({ ...query, isPublished: true }));
    }

    return false;
  };

  app.get('*all', async (req, res) => {
    let status = 200;
    try {
      if (!(await routeExists(req.path))) status = 404;
    } catch (err) {
      // A database hiccup must not turn a real page into a 404
      logger.error('Error resolving route for 404 check:', err);
    }
    res.status(status).sendFile(path.resolve(clientBuildPath, 'index.html'));
  });
}

// Database connection
const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGODB_URI)
  .then(async () => {
    logger.info('Connected to MongoDB');

    // Seed data
    await seedPortfolioData();
    await seedPortfolioMetrics();
    await seedPortfolioCTA();
    await seedPortfolioHero();
    await seedHomePricingCards();
    await seedBlogsAndSettings();
    await seedFaqData();
    await seedServicePages();

    // Start background jobs worker
    require('./jobs/agenda');
    startCronJobs();

    app.listen(PORT, () => {
      logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    });
  })
  .catch((err) => {
    logger.error('Failed to connect to MongoDB', err);
    process.exit(1);
  });
