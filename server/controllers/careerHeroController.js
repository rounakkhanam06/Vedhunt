const CareerHero = require('../models/CareerHero');

// @desc    Get career hero content
// @route   GET /api/content/career-hero
// @access  Public
const getCareerHero = async (req, res) => {
  try {
    let hero = await CareerHero.findOne();
    if (!hero) {
      hero = await CareerHero.create({});
    }
    res.status(200).json({
      success: true,
      data: hero,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch career hero content',
      error: error.message,
    });
  }
};

// @desc    Update career hero content
// @route   PUT /api/content/admin/career-hero
// @access  Private/Admin
const updateCareerHero = async (req, res) => {
  try {
    const { headingTop, headingHighlight, description, benefits } = req.body;
    let hero = await CareerHero.findOne();

    if (!hero) {
      hero = await CareerHero.create({
        headingTop,
        headingHighlight,
        description,
        benefits,
      });
    } else {
      hero.headingTop = headingTop || hero.headingTop;
      hero.headingHighlight = headingHighlight || hero.headingHighlight;
      hero.description = description || hero.description;
      if (benefits) {
        hero.benefits = benefits;
      }
      await hero.save();
    }

    res.status(200).json({
      success: true,
      data: hero,
      message: 'Career hero content updated successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update career hero content',
      error: error.message,
    });
  }
};

module.exports = {
  getCareerHero,
  updateCareerHero,
};
