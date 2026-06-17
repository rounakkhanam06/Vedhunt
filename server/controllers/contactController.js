const ContactInquiry = require('../models/ContactInquiry');
const logger = require('../utils/logger');

// @desc    Submit a new contact inquiry from the FAQ page
// @route   POST /api/contact
// @access  Public
exports.submitContactForm = async (req, res, next) => {
  try {
    const { firstName, lastName, email, phone, message } = req.body;

    if (!firstName || !lastName || !email || !phone || !message) {
      return res.status(400).json({ success: false, message: 'Please provide all required fields' });
    }

    // Backend Validation
    const nameRegex = /^[A-Za-z\s]+$/;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^[0-9]{10}$/;

    if (!nameRegex.test(firstName)) {
      return res.status(400).json({ success: false, message: 'First name can only contain letters and spaces' });
    }

    if (lastName && !nameRegex.test(lastName)) {
      return res.status(400).json({ success: false, message: 'Last name can only contain letters and spaces' });
    }

    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email address' });
    }

    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ success: false, message: 'Invalid phone number. Must be 10 digits.' });
    }

    // Save inquiry to the database
    const inquiry = await ContactInquiry.create({
      firstName,
      lastName,
      email,
      phone,
      message
    });

    res.status(201).json({ success: true, message: 'Message sent successfully', data: inquiry });
  } catch (error) {
    logger.error('Error submitting contact form:', error);
    next(error);
  }
};

// @desc    Get all contact inquiries with pagination and search
// @route   GET /api/contact
// @access  Private (Admin)
exports.getInquiries = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;

    const query = {};

    if (req.query.status && req.query.status !== 'All') {
      query.status = req.query.status;
    }

    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      query.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
        { phone: searchRegex }
      ];
    }

    const totalInquiries = await ContactInquiry.countDocuments(query);
    const inquiries = await ContactInquiry.find(query)
      .sort({ createdAt: -1 })
      .skip(startIndex)
      .limit(limit);

    res.status(200).json({
      success: true,
      count: inquiries.length,
      totalInquiries,
      totalPages: Math.ceil(totalInquiries / limit),
      currentPage: page,
      data: inquiries
    });
  } catch (error) {
    logger.error('Error fetching contact inquiries:', error);
    next(error);
  }
};

// @desc    Update inquiry status
// @route   PUT /api/contact/:id/status
// @access  Private (Admin)
exports.updateInquiryStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    
    if (!status || !['Unread', 'Read', 'Responded'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const inquiry = await ContactInquiry.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!inquiry) {
      return res.status(404).json({ success: false, message: 'Inquiry not found' });
    }

    res.status(200).json({ success: true, data: inquiry });
  } catch (error) {
    logger.error('Error updating inquiry status:', error);
    next(error);
  }
};

// @desc    Delete contact inquiry
// @route   DELETE /api/contact/:id
// @access  Private (Admin)
exports.deleteInquiry = async (req, res, next) => {
  try {
    const inquiry = await ContactInquiry.findByIdAndDelete(req.params.id);

    if (!inquiry) {
      return res.status(404).json({ success: false, message: 'Inquiry not found' });
    }

    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    logger.error('Error deleting inquiry:', error);
    next(error);
  }
};
