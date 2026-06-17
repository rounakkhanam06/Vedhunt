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
const servicePageRoutes = require('./routes/servicePageRoutes');
const contactRoutes = require('./routes/contactRoutes');
const leadRoutes = require('./routes/leadRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const subscribeRoutes = require('./routes/subscribeRoutes');
const { seedServicePages } = require('./controllers/servicePageSeeder');
const errorHandler = require('./middleware/errorHandler');

// Cache middleware for public read-only GET endpoints
// Allows browsers + CDN to cache responses for 2 minutes (s-maxage 4 min for CDN)
// Bypasses cache for authenticated admin requests
const publicCache = (req, res, next) => {
  if (req.method === 'GET' && !req.headers.authorization) {
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
app.use('/api/subscribe', subscribeRoutes);
app.use('/api', publicCache, settingsRoutes);

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

  app.get('*', (req, res) => {
    res.sendFile(path.resolve(clientBuildPath, 'index.html'));
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

    app.listen(PORT, () => {
      logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    });
  })
  .catch((err) => {
    logger.error('Failed to connect to MongoDB', err);
    process.exit(1);
  });
