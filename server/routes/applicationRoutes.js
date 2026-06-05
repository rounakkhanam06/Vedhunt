const express = require('express');
const router = express.Router();
const applicationController = require('../controllers/applicationController');
const { uploadResume } = require('../utils/cloudinary');

// Error handling middleware for Multer file type errors
const multerErrorHandler = (err, req, res, next) => {
  if (err) {
    return res.status(400).json({ message: err.message });
  }
  next();
};

// Submit a new application (with resume upload)
router.post('/', uploadResume.single('resume'), multerErrorHandler, applicationController.createApplication);

// Get all applications (Admin)
router.get('/', applicationController.getApplications);

module.exports = router;
