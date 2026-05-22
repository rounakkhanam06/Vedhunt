const express = require('express');
const Admin = require('../models/Admin');
const authMiddleware = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

const router = express.Router();

// All team routes require authentication
router.use(authMiddleware);

// @route   GET /api/team
// @desc    Get all admins
// @access  Private
router.get('/', async (req, res) => {
  try {
    const admins = await Admin.find({}).select('-password');
    res.json({ success: true, admins });
  } catch (error) {
    logger.error('Error fetching team:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/team
// @desc    Create a new admin
// @access  Private
router.post('/', async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    const adminExists = await Admin.findOne({ email });
    if (adminExists) {
      return res.status(400).json({ success: false, message: 'Admin already exists' });
    }

    const admin = await Admin.create({
      email,
      password,
      role: role || 'EDITOR'
    });

    res.status(201).json({
      success: true,
      admin: {
        _id: admin._id,
        email: admin.email,
        role: admin.role,
        isActive: admin.isActive
      }
    });
  } catch (error) {
    logger.error('Error creating admin:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   DELETE /api/team/:id
// @desc    Delete admin
// @access  Private
router.delete('/:id', async (req, res) => {
  try {
    const adminId = req.params.id;
    
    // Prevent deleting oneself
    if (adminId === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot delete yourself' });
    }

    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }

    await Admin.deleteOne({ _id: adminId });
    res.json({ success: true, message: 'Admin removed' });
  } catch (error) {
    logger.error('Error deleting admin:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
