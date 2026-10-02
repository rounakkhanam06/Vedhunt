const express = require('express');
const router = express.Router();
const blogController = require('../controllers/blogController');
const protect = require('../middleware/authMiddleware');
const authorize = require('../middleware/requirePermission');

// Same permission the admin sidebar uses to show the Blogs page
const adminOnly = [protect, authorize('cms.manage')];

// --- Public Routes ---
router.get('/', blogController.getBlogs);
router.get('/hero', blogController.getBlogHeroSettings);
router.get('/:slug', blogController.getBlogBySlug);

// --- Admin Routes ---
router.get('/admin/all', ...adminOnly, blogController.getAdminBlogs);
router.get('/admin/slug/:slug', ...adminOnly, blogController.getAdminBlogBySlug);
router.post('/', ...adminOnly, blogController.createBlog);
router.put('/:slug', ...adminOnly, blogController.updateBlog);
router.delete('/:slug', ...adminOnly, blogController.deleteBlog);
router.put('/admin/hero', ...adminOnly, blogController.updateBlogHeroSettings);

module.exports = router;
