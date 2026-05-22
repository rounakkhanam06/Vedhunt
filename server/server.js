require('dotenv').config();
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

const app = express();

// Security & Global Middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
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
app.use('/api/hero', heroRoutes);
app.use('/api/team', teamRoutes);

// Error handling middleware (catch-all)
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal Server Error' });
});

// Database connection
const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    logger.info('Connected to MongoDB');
    app.listen(PORT, () => {
      logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    });
  })
  .catch((err) => {
    logger.error('Failed to connect to MongoDB', err);
    process.exit(1);
  });
