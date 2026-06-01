const ServicesHero = require('../models/ServicesHero');

// @desc    Get services hero content
// @route   GET /api/content/services-hero
// @access  Public
const getServicesHero = async (req, res) => {
  try {
    let hero = await ServicesHero.findOne();
    if (!hero) {
      hero = await ServicesHero.create({});
    }
    res.status(200).json({
      success: true,
      data: hero,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch services hero content',
      error: error.message,
    });
  }
};

// @desc    Update services hero content
// @route   PUT /api/content/services-hero
// @access  Private/Admin
const updateServicesHero = async (req, res) => {
  try {
    const { badgeText, headingTop, headingHighlight, description } = req.body;
    let hero = await ServicesHero.findOne();

    if (!hero) {
      hero = await ServicesHero.create({
        badgeText,
        headingTop,
        headingHighlight,
        description,
      });
    } else {
      hero.badgeText = badgeText || hero.badgeText;
      hero.headingTop = headingTop || hero.headingTop;
      hero.headingHighlight = headingHighlight || hero.headingHighlight;
      hero.description = description || hero.description;
      await hero.save();
    }

    res.status(200).json({
      success: true,
      data: hero,
      message: 'Services hero content updated successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update services hero content',
      error: error.message,
    });
  }
};

module.exports = {
  getServicesHero,
  updateServicesHero,
};
