const express = require('express');
const router = express.Router();
const jobController = require('../controllers/jobController');
const authMiddleware = require('../middleware/authMiddleware');
const requirePermission = require('../middleware/requirePermission');

// Get all jobs (public)
router.get('/', jobController.getJobs);

// Get single job (public)
router.get('/:id', jobController.getJobById);

// Admin Routes (protected)
router.post('/', authMiddleware, requirePermission('careers.manage'), jobController.createJob);
router.put('/:id', authMiddleware, requirePermission('careers.manage'), jobController.updateJob);
router.delete('/:id', authMiddleware, requirePermission('careers.manage'), jobController.deleteJob);

module.exports = router;

