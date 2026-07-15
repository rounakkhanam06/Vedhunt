const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// Get financial overview and project breakdown
router.get(
  '/earnings',
  authMiddleware,
  roleMiddleware('SUPER_ADMIN', 'ADMIN', 'EDITOR'), // Adjust based on your roles
  analyticsController.getFinancialOverview
);

module.exports = router;
