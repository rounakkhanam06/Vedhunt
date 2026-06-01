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
const contentRoutes = require('./routes/contentRoutes');
const testimonialRoutes = require('./routes/testimonialRoutes');
const portfolioRoutes = require('./routes/portfolioRoutes');
const pricingRoutes = require('./routes/pricingRoutes');
const homePricingCardRoutes = require('./routes/homePricingCardRoutes');
const { seedPortfolioData, seedPortfolioMetrics, seedPortfolioCTA } = require('./controllers/portfolioController');
const { seedHomePricingCards } = require('./controllers/homePricingCardController');
const { seedBlogsAndSettings } = require('./controllers/blogSeeder');
const blogRoutes = require('./routes/blogRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Security & Global Middleware
app.use(helmet());
app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'https://vedhunt.vercel.app',
      process.env.CLIENT_ORIGIN
    ].filter(Boolean),
    credentials: true, // required to send cookies
  })
);
if (process.env.NODE_ENV === 'production') {
  app.use(globalLimiter); // Apply global rate limiting
}
app.use(express.json()); // Body parser
app.use(cookieParser()); // Cookie parser

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
app.use('/api/hero', heroRoutes); // Legacy route, keeping for backwards compatibility
app.use('/api/team', teamRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/testimonials', testimonialRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/pricing', pricingRoutes);
app.use('/api/home-pricing', homePricingCardRoutes);
app.use('/api/blogs', blogRoutes);

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
    await seedHomePricingCards();
    await seedBlogsAndSettings();

    app.listen(PORT, () => {
      logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    });
  })
  .catch((err) => {
    logger.error('Failed to connect to MongoDB', err);
    process.exit(1);
  });
