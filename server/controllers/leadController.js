const Lead = require('../models/Lead');
const Settings = require('../models/Settings');
const { sendEmail } = require('../utils/sendEmail');
const logger = require('../utils/logger');

// @desc    Submit a new lead from a landing page
// @route   POST /api/leads
// @access  Public
exports.createLead = async (req, res, next) => {
  try {
    const { fullName, phone, email, service, businessName, message, source, consent, city, platform, utmSource, utmMedium, utmCampaign, utmContent, utmTerm } = req.body;

    if (!fullName || !phone || !email || !source) {
      return res.status(400).json({ success: false, message: 'Please provide all required fields' });
    }

    if (!consent) {
      return res.status(400).json({ success: false, message: 'You must agree to be contacted.' });
    }

    const nameRegex = /^[A-Za-z\s]+$/;
    if (!nameRegex.test(fullName)) {
      return res.status(400).json({ success: false, message: 'Name can only contain letters and spaces' });
    }

    // Save lead to database
    const lead = await Lead.create({
      fullName,
      phone,
      email,
      service: service || 'Not specified',
      businessName,
      message,
      source,
      consent,
      city,
      platform: platform || 'Website',
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      utmTerm
    });

    // Send email to HR/Admin
    // Send email to HR/Admin
    let hrEmail = process.env.HR_EMAIL || 'hr@vedhunt.in';
    try {
      const emailSettings = await Settings.findOne({ key: 'email_settings' });
      if (emailSettings && emailSettings.value && emailSettings.value.hrEmail) {
        hrEmail = emailSettings.value.hrEmail;
      }
    } catch (err) {
      logger.error('Error fetching email settings:', err);
    }
    const emailContent = `
      <h3>New Lead from Landing Page (${source})</h3>
      <p><strong>Name:</strong> ${fullName}</p>
      <p><strong>Phone:</strong> ${phone}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Business Name:</strong> ${businessName || 'N/A'}</p>
      <p><strong>Service Requested:</strong> ${service || 'N/A'}</p>
      <p><strong>Source URL:</strong> ${source}</p>
      <br />
      <p><strong>Message / Requirements:</strong></p>
      <p>${message ? message.replace(/\n/g, '<br>') : 'N/A'}</p>
      <br />
      <p><em>Consent to contact: Yes</em></p>
    `;

    try {
      await sendEmail({
        email: hrEmail,
        subject: `New Lead: ${fullName} - ${service || source}`,
        html: emailContent
      });
    } catch (emailError) {
      logger.error('Failed to send email for new lead, but lead was saved:', emailError);
      // We don't throw here to ensure the user still gets a success response
    }

    res.status(201).json({ success: true, message: 'Lead submitted successfully', data: lead });
  } catch (error) {
    logger.error('Error submitting lead:', error);
    next(error);
  }
};

// @desc    Get all leads with pagination, filtering, and search
// @route   GET /api/leads
// @access  Private (Admin)
exports.getLeads = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;

    const query = {};

    // Filter by status
    if (req.query.status && req.query.status !== 'All') {
      query.status = req.query.status;
    }

    // Filter by platform
    if (req.query.platform && req.query.platform !== 'All') {
      query.platform = req.query.platform;
    }

    // Search by text (using $text index or regex if $text doesn't cover partial well)
    // Note: MongoDB $text search is word-based. For partial matching (e.g. typing part of an email), 
    // regex is often more intuitive for admin panels, though less scalable than raw $text.
    // For optimal scalability with partial matches, we use an $or with regex.
    // Since we added an index on these fields, the regex search on anchored/indexed fields can be optimized.
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      query.$or = [
        { fullName: searchRegex },
        { email: searchRegex },
        { phone: searchRegex }
      ];
    }

    const totalLeads = await Lead.countDocuments(query);
    const leads = await Lead.find(query)
      .sort({ createdAt: -1 })
      .skip(startIndex)
      .limit(limit);

    res.status(200).json({
      success: true,
      count: leads.length,
      totalLeads,
      totalPages: Math.ceil(totalLeads / limit),
      currentPage: page,
      data: leads
    });
  } catch (error) {
    logger.error('Error fetching leads:', error);
    next(error);
  }
};

// @desc    Update lead
// @route   PUT /api/leads/:id
// @access  Private (Admin)
exports.updateLead = async (req, res, next) => {
  try {
    let allowedUpdates = [
      'status', 'bd', 'city', 'callStartTime', 'callEndTime', 'callDuration', 
      'callDate', 'connected', 'notConnectedReason', 'interestLevel', 
      'notConvertedReason', 'remark', 'nextFollowUpDate', 'leadAgeAtCall', 'touchNumber',
      'fullName', 'email', 'phone', 'businessName', 'service'
    ];

    // Field-level access control: Only Super Admins can edit core fields
    const isSuperAdmin = req.user.permissions && req.user.permissions.includes('*');
    if (!isSuperAdmin) {
      const protectedFields = ['fullName', 'email', 'phone', 'city', 'businessName', 'platform'];
      allowedUpdates = allowedUpdates.filter(field => !protectedFields.includes(field));
    }

    const updates = {};
    for (const key of Object.keys(req.body)) {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    }

    const lead = await Lead.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    res.status(200).json({ success: true, data: lead });
  } catch (error) {
    logger.error('Error updating lead:', error);
    next(error);
  }
};

// @desc    Delete lead
// @route   DELETE /api/leads/:id
// @access  Private (Admin)
exports.deleteLead = async (req, res, next) => {
  try {
    const lead = await Lead.findByIdAndDelete(req.params.id);

    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    logger.error('Error deleting lead:', error);
    next(error);
  }
};
