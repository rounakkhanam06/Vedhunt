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
      metaTitle,
      metaDescription,
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

    const updatedServicePage = await ServicePage.findOneAndUpdate(
      { slug: req.params.slug },
      {
        $set: {
          title: title || undefined,
          subtitle: subtitle || undefined,
          tagline: tagline || undefined,
          metaTitle: metaTitle !== undefined ? metaTitle : undefined,
          metaDescription: metaDescription !== undefined ? metaDescription : undefined,
          overview: overview || undefined,
          highlights: highlights || undefined,
          subServices: subServices || undefined,
          process: process || undefined,
          pricing: pricing || undefined,
          portfolio: portfolio || undefined,
          faqs: faqs || undefined,
          testimonial: testimonial || undefined,
          testimonials: testimonials || undefined
        }
      },
      { new: true, omitUndefined: true }
    );

    if (updatedServicePage) {
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
