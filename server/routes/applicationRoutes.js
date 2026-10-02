const express = require('express');
const router = express.Router();
const applicationController = require('../controllers/applicationController');
const { uploadResume } = require('../utils/cloudinary');
const protect = require('../middleware/authMiddleware');
const authorize = require('../middleware/requirePermission');

// Error handling middleware for Multer file type errors
const multerErrorHandler = (err, req, res, next) => {
  if (err) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File size too large. Maximum size allowed is 5MB.' });
    }
    return res.status(400).json({ message: err.message });
  }
  next();
};

// Submit a new application (with resume upload)
router.post('/', uploadResume.single('resume'), multerErrorHandler, applicationController.createApplication);

// Get all applications (Admin) — same permission the sidebar uses for Applications
router.get('/', protect, authorize('careers.manage'), applicationController.getApplications);

// Update application status (Admin)
router.patch('/:id/status', protect, authorize('careers.manage'), applicationController.updateStatus);

module.exports = router;
