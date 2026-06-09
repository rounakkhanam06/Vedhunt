const ServicePage = require('../models/ServicePage');

// @desc    Get service page details by slug
// @route   GET /api/service-pages/:slug
// @access  Public
const getServicePageBySlug = async (req, res) => {
  try {
    const servicePage = await ServicePage.findOne({ slug: req.params.slug });
    
    if (!servicePage) {
      return res.status(404).json({ message: 'Service page not found' });
    }
    
    res.json(servicePage);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Get all service pages
// @route   GET /api/service-pages
// @access  Private/Admin
const getServicePages = async (req, res) => {
  try {
    const servicePages = await ServicePage.find({});
    res.json(servicePages);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Update service page details by slug
// @route   PUT /api/service-pages/:slug
// @access  Private/Admin
const updateServicePage = async (req, res) => {
  try {
    const {
      title,
      subtitle,
      tagline,
      overview,
      highlights,
      subServices,
      process,
      pricing,
      portfolio,
      faqs,
      testimonial,
      testimonials
    } = req.body;

    const servicePage = await ServicePage.findOne({ slug: req.params.slug });

    if (servicePage) {
      servicePage.title = title || servicePage.title;
      servicePage.subtitle = subtitle || servicePage.subtitle;
      servicePage.tagline = tagline || servicePage.tagline;
      servicePage.overview = overview || servicePage.overview;
      servicePage.highlights = highlights || servicePage.highlights;
      servicePage.subServices = subServices || servicePage.subServices;
      servicePage.process = process || servicePage.process;
      servicePage.pricing = pricing || servicePage.pricing;
      servicePage.portfolio = portfolio || servicePage.portfolio;
      servicePage.faqs = faqs || servicePage.faqs;
      servicePage.testimonial = testimonial || servicePage.testimonial;
      servicePage.testimonials = testimonials || servicePage.testimonials;

      const updatedServicePage = await servicePage.save();
      res.json(updatedServicePage);
    } else {
      res.status(404).json({ message: 'Service page not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

module.exports = {
  getServicePageBySlug,
  getServicePages,
  updateServicePage
};
