const Testimonial = require('../models/Testimonial');
const logger = require('../utils/logger');

// @desc    Create a new testimonial (public)
// @route   POST /api/testimonials
// @access  Public
exports.createTestimonial = async (req, res, next) => {
  try {
    const { author, role, quote, country, countryFlag } = req.body;
    
    // Create new testimonial with 'pending' status by default
    const testimonial = await Testimonial.create({
      author,
      role: role || 'Client',
      quote,
      country: country || 'India',
      countryFlag: countryFlag || '🇮🇳',
      status: 'pending',
      source: 'client',
    });

    logger.info(`New public review submitted by ${author}`);
    res.status(201).json({
      success: true,
      data: testimonial,
      message: 'Your review has been submitted and is pending approval.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all approved testimonials (public)
// @route   GET /api/testimonials/approved
// @access  Public
exports.getApprovedTestimonials = async (req, res, next) => {
  try {
    const { page } = req.query;
    let query = { status: 'approved' };
    
    if (page) {
      // Find testimonials that explicitly include this page slug OR include 'home' (as fallback)
      query.showOnPages = { $in: [page, 'home'] };
    }
    
    let testimonials = await Testimonial.find(query).sort({ createdAt: -1 });

    if (page && page !== 'home') {
      // If we found specific testimonials for this page, use only them.
      // Otherwise, the ones matching 'home' will act as the fallback.
      const specificTestimonials = testimonials.filter(t => t.showOnPages && t.showOnPages.includes(page));
      if (specificTestimonials.length > 0) {
        testimonials = specificTestimonials;
      }
    }

    res.status(200).json({
      success: true,
      data: testimonials,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all testimonials (Admin)
// @route   GET /api/testimonials
// @access  Private/Admin
exports.getAllTestimonials = async (req, res, next) => {
  try {
    const testimonials = await Testimonial.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      data: testimonials,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update testimonial status (Admin)
// @route   PUT /api/testimonials/:id/status
// @access  Private/Admin
exports.updateTestimonialStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const testimonial = await Testimonial.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!testimonial) {
      return res.status(404).json({ success: false, message: 'Testimonial not found' });
    }

    logger.info(`Testimonial ${req.params.id} status updated to ${status}`);
    res.status(200).json({
      success: true,
      data: testimonial,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create an approved testimonial manually (Admin)
// @route   POST /api/testimonials/admin
// @access  Private/Admin
exports.createAdminTestimonial = async (req, res, next) => {
  try {
    const { author, role, quote, country, countryFlag, avatar, showOnPages } = req.body;
    
    const testimonialData = {
      author,
      role: role || 'Client',
      quote,
      country: country || 'India',
      countryFlag: countryFlag || '🇮🇳',
      status: 'approved',
      source: 'system',
      showOnPages: showOnPages || ['home'],
    };

    if (avatar) {
      testimonialData.avatar = avatar;
    }

    const testimonial = await Testimonial.create(testimonialData);

    logger.info(`New testimonial added directly by Admin for ${author}`);
    res.status(201).json({
      success: true,
      data: testimonial,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update a testimonial fully (Admin)
// @route   PUT /api/testimonials/:id
// @access  Private/Admin
exports.updateTestimonial = async (req, res, next) => {
  try {
    const { author, role, quote, country, countryFlag, avatar, showOnPages } = req.body;
    
    const testimonialData = {
      author,
      role,
      quote,
      country,
      countryFlag,
    };

    if (showOnPages) {
      testimonialData.showOnPages = showOnPages;
    }

    if (avatar) {
      testimonialData.avatar = avatar;
    }

    const testimonial = await Testimonial.findByIdAndUpdate(
      req.params.id,
      testimonialData,
      { new: true, runValidators: true }
    );

    if (!testimonial) {
      return res.status(404).json({ success: false, message: 'Testimonial not found' });
    }

    logger.info(`Testimonial ${req.params.id} fully updated by Admin`);
    res.status(200).json({
      success: true,
      data: testimonial,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a testimonial (Admin)
// @route   DELETE /api/testimonials/:id
// @access  Private/Admin
exports.deleteTestimonial = async (req, res, next) => {
  try {
    const testimonial = await Testimonial.findByIdAndDelete(req.params.id);

    if (!testimonial) {
      return res.status(404).json({ success: false, message: 'Testimonial not found' });
    }

    logger.info(`Testimonial ${req.params.id} deleted by Admin`);
    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (error) {
    next(error);
  }
};
