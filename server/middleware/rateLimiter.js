const rateLimit = require('express-rate-limit');

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: { success: false, message: 'Too many requests from this IP, please try again after 15 minutes' },
  // Ad-platform webhooks must never be rate limited. Facebook delivers leads in
  // bursts from a small pool of IPs; a 429 makes it retry and, if failures
  // persist, Facebook disables the webhook subscription entirely — silently
  // losing every lead until it is manually re-enabled.
  skip: (req) => req.path.startsWith('/api/leads/webhook'),
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 100 : 10, // Higher limit for dev
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts, please try again after 15 minutes' },
});

module.exports = { globalLimiter, authLimiter };
