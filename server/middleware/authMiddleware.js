const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const Admin = require('../models/Admin');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.cookies.adminToken;

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
