const express = require('express');
const router = express.Router();
const jobController = require('../controllers/jobController');
const authMiddleware = require('../middleware/authMiddleware');

// Get all jobs (public)
router.get('/', jobController.getJobs);

// Get single job (public)
router.get('/:id', jobController.getJobById);

// Admin Routes (protected)
router.post('/', authMiddleware, jobController.createJob);
router.put('/:id', authMiddleware, jobController.updateJob);
router.delete('/:id', authMiddleware, jobController.deleteJob);

module.exports = router;

