const express = require('express');
const { upload, publicImageUpload, deleteFromCloudinary } = require('../utils/cloudinary');
const { publicUploadLimiter } = require('../middleware/rateLimiter');
const authMiddleware = require('../middleware/authMiddleware');
const requirePermission = require('../middleware/requirePermission');
const logger = require('../utils/logger');

const router = express.Router();

// @route   POST /api/upload
// @desc    Upload an image to Cloudinary
// @access  Private (Admin)
router.post('/', authMiddleware, requirePermission(['cms.manage', 'services.manage', 'portfolio.manage', 'careers.manage', 'pricing.manage', 'settings.manage']), upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image provided' });
    }

    res.json({
      success: true,
      url: req.file.path, // Cloudinary url
      publicId: req.file.filename, // Cloudinary public_id
    });
  } catch (error) {
    logger.error('Upload error:', error);
    res.status(500).json({ success: false, message: 'Image upload failed' });
  }
});

// @route   POST /api/upload/public
// @desc    Upload an image to Cloudinary (Public - for testimonials)
// @access  Public — rate limited, raster images only (no SVG), 3MB
router.post('/public', publicUploadLimiter, publicImageUpload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image provided' });
    }

    res.json({
      success: true,
      url: req.file.path, // Cloudinary url
      publicId: req.file.filename, // Cloudinary public_id
    });
  } catch (error) {
    logger.error('Public Upload error:', error);
    res.status(500).json({ success: false, message: 'Image upload failed' });
  }
});

// @route   DELETE /api/upload/:publicId
// @desc    Delete an image from Cloudinary
// @access  Private (SUPER_ADMIN)
router.delete('/:publicId', authMiddleware, requirePermission('*'), async (req, res) => {
  try {
    const publicId = req.params.publicId;
    await deleteFromCloudinary(publicId);
    
    res.json({ success: true, message: 'Image deleted successfully' });
  } catch (error) {
    logger.error('Delete image error:', error);
    res.status(500).json({ success: false, message: 'Image deletion failed' });
  }
});

module.exports = router;
