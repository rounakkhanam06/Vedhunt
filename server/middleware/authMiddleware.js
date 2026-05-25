const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const Admin = require('../models/Admin');

const authMiddleware = async (req, res, next) => {
  try {
    let token = req.cookies.adminToken;

    // Check authorization header if token not in cookies (for cross-domain compatibility)
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorized, no token' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await Admin.findById(decoded.id).select('-password');
    
    if (!req.user || !req.user.isActive) {
      return res.status(401).json({ success: false, message: 'Not authorized, user not active or found' });
    }

    next();
  } catch (error) {
    logger.error('Auth middleware error:', error.message);
    res.status(401).json({ success: false, message: 'Not authorized, token failed' });
  }
};

module.exports = authMiddleware;
