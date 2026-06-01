const express = require('express');
const router = express.Router();
const {
  getPortfolioItems,
  getAllAdminPortfolioItems,
  getPortfolioItem,
  createPortfolioItem,
  updatePortfolioItem,
  deletePortfolioItem,
  getPortfolioMetrics,
  getAdminPortfolioMetrics,
  createPortfolioMetric,
  updatePortfolioMetric,
  deletePortfolioMetric,
  getPortfolioCTA,
  updatePortfolioCTA
} = require('../controllers/portfolioController');
const protect = require('../middleware/authMiddleware');

// Public Portfolio routes
router.route('/')
  .get(getPortfolioItems)
  .post(protect, createPortfolioItem);

// Public Metrics routes
router.route('/metrics')
  .get(getPortfolioMetrics);

// Public CTA route
router.route('/cta')
  .get(getPortfolioCTA);

// Protected Admin Portfolio routes
router.route('/admin')
  .get(protect, getAllAdminPortfolioItems);

// Protected Admin Metrics routes
router.route('/admin/metrics')
  .get(protect, getAdminPortfolioMetrics)
  .post(protect, createPortfolioMetric);

router.route('/admin/metrics/:id')
  .put(protect, updatePortfolioMetric)
  .delete(protect, deletePortfolioMetric);

// Protected Admin CTA routes
router.route('/admin/cta')
  .put(protect, updatePortfolioCTA);

// Detail Portfolio routes
router.route('/:id')
  .get(getPortfolioItem)
  .put(protect, updatePortfolioItem)
  .delete(protect, deletePortfolioItem);

module.exports = router;
