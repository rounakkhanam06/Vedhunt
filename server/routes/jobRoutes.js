const express = require('express');
const router = express.Router();
const jobController = require('../controllers/jobController');
const authMiddleware = require('../middleware/authMiddleware');
const requirePermission = require('../middleware/requirePermission');

// Get all jobs (public) — Published only; drafts never reach the website
router.get('/', jobController.getJobs);

// Admin: every job, including Unpublished (must stay above '/:id')
router.get('/admin', authMiddleware, requirePermission('careers.manage'), jobController.getAllJobsAdmin);

// Get single job (public) — Published only
router.get('/:id', jobController.getJobById);

// Admin Routes (protected)
router.post('/', authMiddleware, requirePermission('careers.manage'), jobController.createJob);
router.put('/:id', authMiddleware, requirePermission('careers.manage'), jobController.updateJob);
router.delete('/:id', authMiddleware, requirePermission('careers.manage'), jobController.deleteJob);

module.exports = router;

