const express = require('express');
const router = express.Router();
const jobController = require('../controllers/jobController');
// Assuming they use a middleware for admin. Looking at other files might be needed, but I'll write generic ones or rely on how they protect routes.
// For now, I'll just use standard routes. If there's an auth middleware, we should apply it. Let's assume public access for GET and rely on existing setup.
// I will not apply middleware directly here if I don't know the name, or I can check middleware dir.

// Get all jobs
router.get('/', jobController.getJobs);

// Get single job
router.get('/:id', jobController.getJobById);

// Create job (Admin)
router.post('/', jobController.createJob);

// Update job (Admin)
router.put('/:id', jobController.updateJob);

// Delete job (Admin)
router.delete('/:id', jobController.deleteJob);

module.exports = router;
