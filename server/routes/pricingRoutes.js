const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
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
  .get(authMiddleware, getAdminCategories)
  .post(authMiddleware, createCategory);

router.route('/admin/categories/:id')
  .put(authMiddleware, updateCategory)
  .delete(authMiddleware, deleteCategory);

// Admin Plan routes
router.route('/admin/plans')
  .get(authMiddleware, getAdminPlans)
  .post(authMiddleware, createPlan);

router.route('/admin/plans/:id')
  .put(authMiddleware, updatePlan)
  .delete(authMiddleware, deletePlan);

module.exports = router;
