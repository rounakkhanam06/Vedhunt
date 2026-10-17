const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const authMiddleware = require('../middleware/authMiddleware');
const requirePermission = require('../middleware/requirePermission');

// Company revenue (Overview dashboard). Needs its own permission, finance.view,
// so it can be given without the rest of the management dashboard; Super
// Admin holds it through '*'.
router.get(
  '/earnings',
  authMiddleware,
  requirePermission('finance.view'),
  analyticsController.getFinancialOverview
);

module.exports = router;
