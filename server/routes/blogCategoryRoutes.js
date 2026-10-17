const express = require('express');
const router = express.Router();
const blogCategoryController = require('../controllers/blogCategoryController');
const authMiddleware = require('../middleware/authMiddleware');
const requirePermission = require('../middleware/requirePermission');

// Public route to get categories (can use ?activeOnly=true)
router.get('/', blogCategoryController.getCategories);

// Admin routes for CRUD
router.post('/', authMiddleware, requirePermission('cms.manage'), blogCategoryController.createCategory);
router.put('/:id', authMiddleware, requirePermission('cms.manage'), blogCategoryController.updateCategory);
router.delete('/:id', authMiddleware, requirePermission('cms.manage'), blogCategoryController.deleteCategory);

module.exports = router;
