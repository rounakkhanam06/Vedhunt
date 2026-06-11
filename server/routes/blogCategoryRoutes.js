const express = require('express');
const router = express.Router();
const blogCategoryController = require('../controllers/blogCategoryController');
const authMiddleware = require('../middleware/authMiddleware');

// Public route to get categories (can use ?activeOnly=true)
router.get('/', blogCategoryController.getCategories);

// Admin routes for CRUD
router.post('/', authMiddleware, blogCategoryController.createCategory);
router.put('/:id', authMiddleware, blogCategoryController.updateCategory);
router.delete('/:id', authMiddleware, blogCategoryController.deleteCategory);

module.exports = router;
