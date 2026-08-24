const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const Admin = require('../models/Admin');
const Settings = require('../models/Settings');
const { sendEmail } = require('../utils/sendEmail');
const logger = require('../utils/logger');
const { findDuplicateLead } = require('../services/leadDedup');
const { normalizePhone, normalizeEmail } = require('../utils/normalize');
const AssignmentLog = require('../models/AssignmentLog');
const { manualAssign, autoAssignLead } = require('../services/leadAssignment');
const { findLeadRaw } = require('../utils/leadLookup');
const { validateFollowUpRules } = require('../utils/followUpRules');

// @desc    Submit a new lead from a landing page
// @route   POST /api/leads
// @access  Public
exports.createLead = async (req, res, next) => {
  try {
    const { fullName, phone, altPhone, email, service, businessName, message, source, consent, city, country, platform, userSource, utmSource, utmMedium, utmCampaign, utmContent, utmTerm } = req.body;

    if (!fullName || !phone || !email || !source) {
      return res.status(400).json({ success: false, message: 'Please provide all required fields' });
    }

    if (!consent) {
      return res.status(400).json({ success: false, message: 'You must agree to be contacted.' });
    }

    // Allow Unicode letters, spaces, hyphens, dots, and apostrophes
    const nameRegex = /^[A-Za-z\p{L}\s.'-]+$/u;
    if (!nameRegex.test(fullName)) {
      return res.status(400).json({ success: false, message: 'Name can only contain letters and spaces' });
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address' });
    }

    // Allow standard digits, spaces, hyphens, plus signs, and parentheses
    const phoneRegex = /^[+]?[0-9\s().-]{10,20}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid phone number' });
    }

    // Someone resubmitting (double-click, retried form, already reached us
    // through another channel) should see the same success screen without
    // creating a second Lead or paging HR again — so this returns success
    // and stops here rather than surfacing an error to a real customer.
    const duplicate = await findDuplicateLead({ phone, altPhone, email });
    if (duplicate) {
      logger.info(`Duplicate lead ignored (matches ${duplicate.leadId} by phone/email): ${fullName} — ${phone}`);
      return res.status(200).json({ success: true, message: 'Lead submitted successfully', data: duplicate });
    }

    // Save lead to database
    const lead = await Lead.create({
      fullName,
      phone,
      altPhone,
      email,
      service: service || 'Not specified',
      businessName,
      message,
      source,
      consent,
      city,
      country,
      platform: platform || 'Website',
      userSource: userSource || 'Direct',
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      utmTerm,
      pipelineHistory: [{
        status: 'New',
        note: 'Lead Received'
      }]
    });

    // Never throws — logs and leaves the lead Unassigned on any failure.
    await autoAssignLead(lead);

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
      <p><strong>User Source (Attribution):</strong> ${userSource || 'Direct'}</p>
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
    const isExport = req.query.export === 'true';

    const query = {};

    // Filter by status
    if (req.query.status && req.query.status !== 'All') {
      query.status = req.query.status;
    }

    // Filter by platform
    if (req.query.platform && req.query.platform !== 'All') {
      query.platform = req.query.platform;
    }

    // Filter by userSource (attribution source)
    if (req.query.userSource && req.query.userSource !== 'All') {
      query.userSource = req.query.userSource;
    }

    // Filter by lead type (Sales vs Hiring). Leads created before this field
    // existed have no leadType, so 'Sales' must also match those.
    if (req.query.leadType && req.query.leadType !== 'All') {
      query.leadType = req.query.leadType === 'Sales'
        ? { $in: ['Sales', null] }
        : req.query.leadType;
    }

    // Filter by the Facebook Instant Form the lead came from
    if (req.query.fbFormId && req.query.fbFormId !== 'All') {
      query.fbFormId = req.query.fbFormId;
    }

    // Visibility: BDs (anyone without the '*' wildcard) only ever see leads
    // assigned to them, however they filter. Admins additionally get an
    // "Assigned BD" filter (a specific BD, or 'Unassigned').
    const isSuperAdmin = req.user?.permissions?.includes('*');
    if (!isSuperAdmin) {
      query.assignedTo = req.user._id;
    } else if (req.query.assignedTo && req.query.assignedTo !== 'All') {
      query.assignedTo = req.query.assignedTo === 'Unassigned' ? null : req.query.assignedTo;
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

    let sort = { createdAt: -1 };
    if (req.query.sortBy) {
      const order = req.query.sortOrder === 'asc' ? 1 : -1;
      sort = { [req.query.sortBy]: order };
    }

    const totalLeads = await Lead.countDocuments(query);

    let leadsQuery = Lead.find(query).sort(sort).populate('assignedTo', 'firstName lastName email');

    if (!isExport) {
      leadsQuery = leadsQuery.skip(startIndex).limit(limit);
    }
    
    const leads = await leadsQuery;

    res.status(200).json({
      success: true,
      count: leads.length,
      totalLeads,
      totalPages: isExport ? 1 : Math.ceil(totalLeads / limit),
      currentPage: isExport ? 1 : page,
      data: leads
    });
  } catch (error) {
    logger.error('Error fetching leads:', error);
    next(error);
  }
};

// @desc    Get a single lead
// @route   GET /api/leads/:id
// @access  Private (Admin) — used by the notification deep link
exports.getLeadById = async (req, res, next) => {
  try {
    const isSuperAdmin = req.user?.permissions?.includes('*');
    const lead = await findLeadRaw(req.params.id);
    if (!lead || (!isSuperAdmin && String(lead.assignedTo || '') !== String(req.user._id))) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    let assignedTo = null;
    if (lead.assignedTo) {
      const admin = await Admin.findById(lead.assignedTo).select('firstName lastName email');
      if (admin) assignedTo = { _id: admin._id, firstName: admin.firstName, lastName: admin.lastName, email: admin.email };
    }

    res.status(200).json({ success: true, data: { ...lead, assignedTo } });
  } catch (error) {
    logger.error('Error fetching lead:', error);
    next(error);
  }
};

// @desc    Assign, reassign, or unassign a lead to a BD
// @route   POST /api/leads/:id/assign
// @access  Private (leads.assign)
exports.assignLead = async (req, res, next) => {
  try {
    const { assignedTo, reason } = req.body;

    if (assignedTo) {
      const targetAdmin = await Admin.findById(assignedTo);
      if (!targetAdmin) {
        return res.status(400).json({ success: false, message: 'That BD account does not exist' });
      }
    }

    const lead = await manualAssign({
      leadId: req.params.id,
      toAdmin: assignedTo || null,
      assignedBy: req.user._id,
      reason: reason || ''
    });

    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    res.status(200).json({ success: true, data: lead });
  } catch (error) {
    logger.error('Error assigning lead:', error);
    next(error);
  }
};

// @desc    Assignment/reassignment audit trail for one lead
// @route   GET /api/leads/:id/assignment-history
// @access  Private (Admin)
exports.getAssignmentHistory = async (req, res, next) => {
  try {
    const isSuperAdmin = req.user?.permissions?.includes('*');
    const lead = await findLeadRaw(req.params.id);
    if (!lead || (!isSuperAdmin && String(lead.assignedTo || '') !== String(req.user._id))) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    const history = await AssignmentLog.find({ lead: lead._id })
      .sort({ createdAt: -1 })
      .populate('fromAdmin', 'firstName lastName')
      .populate('toAdmin', 'firstName lastName')
      .populate('assignedBy', 'firstName lastName');

    res.status(200).json({ success: true, data: history });
  } catch (error) {
    logger.error('Error fetching assignment history:', error);
    next(error);
  }
};

// @desc    Update lead
// @route   PUT /api/leads/:id
// @access  Private (Admin)
exports.updateLead = async (req, res, next) => {
  try {
    // 'bd'/'assignedTo' are intentionally excluded — ownership changes must
    // go through POST /leads/:id/assign so every change is audit-logged.
    let allowedUpdates = [
      'status', 'city', 'country', 'callStartTime', 'callEndTime', 'callDuration',
      'callDate', 'connected', 'notConnectedReason', 'interestLevel',
      'notConvertedReason', 'remark', 'nextFollowUpDate', 'leadAgeAtCall', 'touchNumber',
      'fullName', 'email', 'phone', 'altPhone', 'businessName', 'service'
    ];

    // Field-level access control: Only Super Admins can edit core fields
    const isSuperAdmin = req.user?.permissions?.includes('*');
    if (!isSuperAdmin) {
      const protectedFields = ['fullName', 'email', 'phone', 'altPhone', 'city', 'country', 'businessName', 'platform'];
      allowedUpdates = allowedUpdates.filter(field => !protectedFields.includes(field));
    }

    let updates = {};
    for (const key of Object.keys(req.body)) {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    }

    // This update goes through the raw driver below (to bypass ObjectId
    // casting), which skips the Mongoose pre-save hook that normally keeps
    // phone/altPhone/email normalized — so recompute them here whenever the
    // admin edits one, or duplicate-lead lookups would go stale for this lead.
    if ('phone' in updates) updates.phoneNormalized = normalizePhone(updates.phone);
    if ('altPhone' in updates) updates.altPhoneNormalized = normalizePhone(updates.altPhone);
    if ('email' in updates) updates.emailNormalized = normalizeEmail(updates.email);

    // Bypass Mongoose casting to find the lead (handles both String and ObjectId)
    const db = mongoose.connection.db;
    let existingLead = await db.collection('leads').findOne({ _id: req.params.id });
    if (!existingLead && mongoose.Types.ObjectId.isValid(req.params.id)) {
      existingLead = await db.collection('leads').findOne({ _id: new mongoose.Types.ObjectId(req.params.id) });
    }

    if (!existingLead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    const followUpError = validateFollowUpRules(existingLead, updates);
    if (followUpError) {
      return res.status(400).json({ success: false, message: followUpError });
    }

    // Every field change worth surfacing in the lead's Activity Timeline
    // (not just status) gets its own pipelineHistory entry.
    const pipelineEntries = [];
    if (updates.status && updates.status !== existingLead.status) {
      let note = '';
      if (updates.status === 'Won' && req.body.dealValue) note = `Closed with value ₹${req.body.dealValue}`;
      else if ((updates.status === 'Lost' || updates.status === 'Dropped') && req.body.notConvertedReason) note = `Reason: ${req.body.notConvertedReason}`;
      pipelineEntries.push({ status: updates.status, date: new Date(), updatedBy: req.user ? req.user._id : undefined, note });
    }
    if (updates.connected && updates.connected !== existingLead.connected) {
      pipelineEntries.push({
        status: updates.connected === 'Yes' ? 'Call connected' : 'Call not connected',
        date: new Date(),
        updatedBy: req.user ? req.user._id : undefined,
        note: updates.connected === 'No' ? (updates.notConnectedReason || '') : ''
      });
    }
    if (updates.interestLevel && updates.interestLevel !== existingLead.interestLevel) {
      pipelineEntries.push({
        status: `Interest set: ${updates.interestLevel}`,
        date: new Date(),
        updatedBy: req.user ? req.user._id : undefined,
        note: ''
      });
    }

    // Set updated At
    updates.updatedAt = new Date();

    // Use raw findOneAndUpdate to bypass ObjectId casting
    const updateQuery = { $set: updates };
    if (pipelineEntries.length > 0) {
      updateQuery.$push = { pipelineHistory: { $each: pipelineEntries } };
    }

    const result = await db.collection('leads').findOneAndUpdate(
      { _id: existingLead._id },
      updateQuery,
      { returnDocument: 'after' }
    );
    
    const updatedLead = result.value || result;

    res.status(200).json({ success: true, data: updatedLead });
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
