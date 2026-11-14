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
  updatePortfolioCTA,
  getPortfolioHero,
  updatePortfolioHero
} = require('../controllers/portfolioController');
const {
  getPublicCategories,
  getAdminCategories,
  createCategory,
  updateCategory,
  deleteCategory
} = require('../controllers/portfolioCategoryController');
const protect = require('../middleware/authMiddleware');
const requirePermission = require('../middleware/requirePermission');

// Public Portfolio routes
router.route('/')
  .get(getPortfolioItems)
  .post(protect, requirePermission('portfolio.manage'), createPortfolioItem);

// Public Metrics routes
router.route('/metrics')
  .get(getPortfolioMetrics);

// Public CTA route
router.route('/cta')
  .get(getPortfolioCTA);

// Public Hero route
router.route('/hero')
  .get(getPortfolioHero);

// Protected Admin Portfolio routes
router.route('/admin')
  .get(protect, requirePermission('portfolio.manage'), getAllAdminPortfolioItems);

// Protected Admin Metrics routes
router.route('/admin/metrics')
  .get(protect, requirePermission('portfolio.manage'), getAdminPortfolioMetrics)
  .post(protect, requirePermission('portfolio.manage'), createPortfolioMetric);

router.route('/admin/metrics/:id')
  .put(protect, requirePermission('portfolio.manage'), updatePortfolioMetric)
  .delete(protect, requirePermission('portfolio.manage'), deletePortfolioMetric);

// Protected Admin CTA routes
router.route('/admin/cta')
  .put(protect, requirePermission('portfolio.manage'), updatePortfolioCTA);

// Protected Admin Hero routes
router.route('/admin/hero')
  .put(protect, requirePermission('portfolio.manage'), updatePortfolioHero);

// Categories (public list + admin CRUD) — must stay above '/:id'
router.route('/categories')
  .get(getPublicCategories);

router.route('/admin/categories')
  .get(protect, requirePermission('portfolio.manage'), getAdminCategories)
  .post(protect, requirePermission('portfolio.manage'), createCategory);

router.route('/admin/categories/:id')
  .put(protect, requirePermission('portfolio.manage'), updateCategory)
  .delete(protect, requirePermission('portfolio.manage'), deleteCategory);

// Detail Portfolio routes
router.route('/:id')
  .get(getPortfolioItem)
  .put(protect, requirePermission('portfolio.manage'), updatePortfolioItem)
  .delete(protect, requirePermission('portfolio.manage'), deletePortfolioItem);

module.exports = router;
