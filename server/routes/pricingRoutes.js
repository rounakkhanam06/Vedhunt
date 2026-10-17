const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const requirePermission = require('../middleware/requirePermission');
const {
  getPricing,
  getPublicCategories,
  getAdminCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getAdminPlans,
  createPlan,
  updatePlan,
  deletePlan
} = require('../controllers/pricingController');

// Public route
router.get('/', getPricing);
router.get('/categories', getPublicCategories);

// Admin Category routes
router.route('/admin/categories')
  .get(authMiddleware, requirePermission('pricing.manage'), getAdminCategories)
  .post(authMiddleware, requirePermission('pricing.manage'), createCategory);

router.route('/admin/categories/:id')
  .put(authMiddleware, requirePermission('pricing.manage'), updateCategory)
  .delete(authMiddleware, requirePermission('pricing.manage'), deleteCategory);

// Admin Plan routes
router.route('/admin/plans')
  .get(authMiddleware, requirePermission('pricing.manage'), getAdminPlans)
  .post(authMiddleware, requirePermission('pricing.manage'), createPlan);

router.route('/admin/plans/:id')
  .put(authMiddleware, requirePermission('pricing.manage'), updatePlan)
  .delete(authMiddleware, requirePermission('pricing.manage'), deletePlan);

module.exports = router;
