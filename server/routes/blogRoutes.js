const express = require('express');
const router = express.Router();
const blogController = require('../controllers/blogController');
// Assuming there might be an auth middleware in the project for admin routes. 
// For now, I will map the routes. If auth is needed, the user can plug it into these routes later.

// --- Public Routes ---
router.get('/', blogController.getBlogs);
router.get('/hero', blogController.getBlogHeroSettings);
router.get('/:slug', blogController.getBlogBySlug);

// --- Admin Routes ---
// Ideally, these would be protected by an auth middleware (e.g., router.post('/', requireAuth, blogController.createBlog))
router.get('/admin/all', blogController.getAdminBlogs);
router.get('/admin/slug/:slug', blogController.getAdminBlogBySlug);
router.post('/', blogController.createBlog);
router.put('/:slug', blogController.updateBlog);
router.delete('/:slug', blogController.deleteBlog);
router.put('/admin/hero', blogController.updateBlogHeroSettings);

module.exports = router;
