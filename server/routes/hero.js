const express = require('express');
const Hero = require('../models/Hero');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const validate = require('../middleware/validate');
const { heroUpdateSchema } = require('../validators/heroValidator');
const logger = require('../utils/logger');

const router = express.Router();

// @route   GET /api/hero
// @desc    Get active Hero content
// @access  Public
router.get('/', async (req, res) => {
  try {
    const hero = await Hero.findOne({ isActive: true }).sort({ createdAt: -1 });
    
    if (!hero) {
      return res.json({ success: true, data: null });
    }

    res.json({ success: true, data: hero });
  } catch (error) {
    logger.error('Fetch hero error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

// @route   PUT /api/hero
// @desc    Update Hero content
// @access  Private (Admin)
router.put('/', authMiddleware, roleMiddleware('SUPER_ADMIN', 'EDITOR'), validate(heroUpdateSchema), async (req, res) => {
  try {
    // Upsert logic - update existing active hero, or create new if none
    let hero = await Hero.findOne({ isActive: true });

    if (hero) {
      Object.assign(hero, req.body);
      hero.updatedBy = req.user._id;
      await hero.save();
    } else {
      hero = new Hero({
        ...req.body,
        updatedBy: req.user._id,
      });
      await hero.save();
    }

    logger.info(`Hero section updated by ${req.user.email}`);
    res.json({ success: true, data: hero });
  } catch (error) {
    logger.error('Update hero error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

module.exports = router;
