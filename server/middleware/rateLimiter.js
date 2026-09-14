const rateLimit = require('express-rate-limit');

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000, // Generous limit for modern SPA with frequent polling & multiple active users per office IP
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: { success: false, message: 'Too many requests from this IP, please try again after 15 minutes' },
  // 1. Ad-platform webhooks must never be rate limited (Facebook leads, Shiprocket, etc.)
  // 2. Notification polling from active dashboard sessions must not choke on rate limiting
  skip: (req) => {
    if (req.path.startsWith('/api/leads/webhook')) return true;
    if (req.path.includes('/notifications')) return true;
    return false;
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 100 : 10, // Higher limit for dev
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts, please try again after 15 minutes' },
});

module.exports = { globalLimiter, authLimiter };
