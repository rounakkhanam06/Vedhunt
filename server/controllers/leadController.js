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
const { LEAD_UPDATE_FIELDS, TERMINAL_STATUSES } = require('../utils/leadStateMachine');
const { applyLeadUpdate } = require('../services/leadLifecycle');
const { addLeadDocument, removeLeadDocument } = require('../services/leadDocuments');
const { importLeadsFromFile } = require('../services/leadImport');
const { listTasks, createParallelTask, completeTask } = require('../services/followUpTasks');
const { derivePriority } = require('../utils/serviceQualification');
const { getLeadScoringSettings, computeLeadScore } = require('../services/leadScoring');

// A role can see every lead (not just ones assignedTo them) either by holding
// the full '*' wildcard, or the narrower 'leads.viewAll' permission — added
// so a Super Admin can grant "see all Raw + Working leads" without handing
// out full admin access. Read-only: it does not bypass the ownership checks
// on write actions (unlock, editing protected fields), which stay '*'-only.
const canViewAllLeads = (user) => Boolean(
  user?.permissions?.includes('*') || user?.permissions?.includes('leads.viewAll')
);

// @desc    Submit a new lead from a landing page
// @route   POST /api/leads
// @access  Public
exports.createLead = async (req, res, next) => {
  try {
    const {
      fullName, phone, altPhone, email, service, businessName, message, source, consent, city, country,
      platform, userSource, utmSource, utmMedium, utmCampaign, utmContent, utmTerm,
      // Service-aware qualification fields — populated when the source form
      // (e.g. GetQuote.jsx) already collected them at intake; blank otherwise,
      // a BD fills them in during qualification. See utils/serviceQualification.js.
      servicesRequired, website, businessType, timeline, decisionMaker, projectBudget, monthlyMarketingBudget
    } = req.body;

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

    const scoringSettings = await getLeadScoringSettings();

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
      servicesRequired,
      website,
      businessType,
      timeline,
      decisionMaker,
      projectBudget,
      monthlyMarketingBudget,
      leadPriority: derivePriority({ decisionMaker, timeline, projectBudget, monthlyMarketingBudget }),
      leadScore: computeLeadScore({ servicesRequired, projectBudget, monthlyMarketingBudget, decisionMaker, timeline }, scoringSettings),
      // Full original submission, captured before any dedup/assignment
      // processing runs, so the raw request is always recoverable for audit.
      rawPayload: req.body,
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

    // Raw (untouched, still "New") vs Working (calling/stage activity has
    // started) — keeps the two admin lead pages from ever showing the same
    // lead. stageGroup takes priority over a plain status filter so a
    // Working-page request can't accidentally leak New leads back in.
    if (req.query.stageGroup === 'raw') {
      query.status = 'New';
    } else if (req.query.stageGroup === 'working') {
      query.status = (req.query.status && req.query.status !== 'All')
        ? req.query.status
        : { $ne: 'New' };
    } else if (req.query.status && req.query.status !== 'All') {
      query.status = req.query.status;
    }

    // Filter by platform
    if (req.query.platform && req.query.platform !== 'All') {
      query.platform = req.query.platform;
    }

    // Filter by userSource (attribution source)
    if (req.query.userSource && req.query.userSource !== 'All') {
      const src = req.query.userSource;
      const regex = new RegExp(src === 'Twitter/X' ? 'twitter|x\\.com' : src, 'i');
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { userSource: src },
          { userSource: regex },
          { platform: regex },
          { utmSource: regex },
          { source: regex }
        ]
      });
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

    // Filter by call-connected outcome (dashboard drill-down)
    if (req.query.connected === 'Yes' || req.query.connected === 'No') {
      query.connected = req.query.connected;
    }

    // Filter by the legacy free-text service field (dashboard drill-down)
    if (req.query.service && req.query.service !== 'All') {
      query.service = req.query.service;
    }

    // Filter by auto-derived Lead Priority (dashboard drill-down)
    if (req.query.leadPriority && req.query.leadPriority !== 'All') {
      query.leadPriority = req.query.leadPriority;
    }

    // Follow-up Breach filter (dashboard drill-down)
    if (req.query.followUpBreached === 'true') {
      query.followUpBreached = true;
    }

    // "Open pipeline" shorthand — every non-terminal, non-Hold lead, same set
    // activityController.js's getPipelineSummary already uses for pipelineValue.
    // Only applies when no explicit status/stageGroup filter already set one.
    if (req.query.stage === 'open' && !query.status) {
      query.status = { $nin: [...TERMINAL_STATUSES, 'Hold'] };
    }

    // Date range filter (createdAt) — indexed field, cheap to filter on.
    if (req.query.dateFrom || req.query.dateTo) {
      query.createdAt = {};
      if (req.query.dateFrom) query.createdAt.$gte = new Date(req.query.dateFrom);
      if (req.query.dateTo) {
        // Treat dateTo as inclusive of the whole day.
        const endOfDay = new Date(req.query.dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        query.createdAt.$lte = endOfDay;
      }
    }

    // Visibility: BDs (anyone without '*' or 'leads.viewAll') only ever see
    // leads assigned to them, however they filter. Full-visibility roles
    // additionally get an "Assigned BD" filter (a specific BD, or 'Unassigned').
    if (!canViewAllLeads(req.user)) {
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
    const lead = await findLeadRaw(req.params.id);
    if (!lead || (!canViewAllLeads(req.user) && String(lead.assignedTo || '') !== String(req.user._id))) {
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

// @desc    Bulk assign leads to a BD
// @route   POST /api/leads/bulk-assign
// @desc    Bulk assign leads to a specific BD, unassign, or distribute via Round Robin
// @route   POST /api/leads/bulk-assign
// @access  Private (leads.assign)
exports.bulkAssignLeads = async (req, res, next) => {
  try {
    const { leadIds, assignedTo, mode = 'manual', reason } = req.body;

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({ success: false, message: 'No leads provided' });
    }

    const isRoundRobin = assignedTo === 'round-robin' || mode === 'round-robin';

    if (isRoundRobin) {
      let successCount = 0;
      let skippedCount = 0;

      for (const leadId of leadIds) {
        const lead = await findLeadRaw(leadId);
        if (!lead) {
          skippedCount++;
          continue;
        }
        const assigned = await autoAssignLead(lead);
        if (assigned && assigned.assignedTo) {
          successCount++;
        } else {
          skippedCount++;
        }
      }

      return res.status(200).json({
        success: true,
        message: `Round-Robin: Assigned ${successCount} leads across active BD rules.${skippedCount > 0 ? ` (${skippedCount} could not be matched or BDs at capacity)` : ''}`
      });
    }

    if (assignedTo && assignedTo !== 'unassign') {
      const targetAdmin = await Admin.findById(assignedTo);
      if (!targetAdmin) {
        return res.status(400).json({ success: false, message: 'That BD account does not exist' });
      }
    }

    const targetBdId = (assignedTo === 'unassign' || !assignedTo) ? null : assignedTo;
    let successCount = 0;
    let failCount = 0;

    for (const leadId of leadIds) {
      const lead = await manualAssign({
        leadId,
        toAdmin: targetBdId,
        assignedBy: req.user._id,
        reason: reason || (targetBdId ? 'Bulk Assignment' : 'Bulk Unassigned')
      });
      if (lead) {
        successCount++;
      } else {
        failCount++;
      }
    }

    res.status(200).json({ 
      success: true, 
      message: targetBdId
        ? `Successfully assigned ${successCount} leads.${failCount > 0 ? ` (Failed: ${failCount})` : ''}`
        : `Successfully unassigned ${successCount} leads.`
    });
  } catch (error) {
    logger.error('Error in bulk assigning leads:', error);
    next(error);
  }
};

// @desc    Assignment/reassignment audit trail for one lead
// @route   GET /api/leads/:id/assignment-history
// @access  Private (Admin)
exports.getAssignmentHistory = async (req, res, next) => {
  try {
    const lead = await findLeadRaw(req.params.id);
    if (!lead || (!canViewAllLeads(req.user) && String(lead.assignedTo || '') !== String(req.user._id))) {
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

// @desc    Global assignment/reassignment audit trail (all leads)
// @route   GET /api/leads/assignments/all
// @access  Private (Super Admin)
exports.getAllAssignmentLogs = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const startIndex = (page - 1) * limit;

    const query = {};

    if (req.query.leadId) {
      // Find lead by leadId to get its ObjectId
      const lead = await Lead.findOne({ leadId: req.query.leadId });
      if (lead) {
        query.lead = lead._id;
      } else {
        // Return empty if leadId filter doesn't match anything
        return res.status(200).json({
          success: true, count: 0, totalLogs: 0, totalPages: 0, currentPage: page, data: []
        });
      }
    }

    if (req.query.userId && req.query.userId !== 'All') {
      query.$or = [
        { fromAdmin: req.query.userId },
        { toAdmin: req.query.userId },
        { assignedBy: req.query.userId }
      ];
    }

    const totalLogs = await AssignmentLog.countDocuments(query);
    const logs = await AssignmentLog.find(query)
      .sort({ createdAt: -1 })
      .skip(startIndex)
      .limit(limit)
      .populate('lead', 'leadId fullName email phone')
      .populate('fromAdmin', 'firstName lastName')
      .populate('toAdmin', 'firstName lastName')
      .populate('assignedBy', 'firstName lastName');

    res.status(200).json({
      success: true,
      count: logs.length,
      totalLogs,
      totalPages: Math.ceil(totalLogs / limit),
      currentPage: page,
      data: logs
    });
  } catch (error) {
    logger.error('Error fetching all assignment logs:', error);
    next(error);
  }
};

// @desc    Lock lead for active handling
// @route   POST /api/leads/:id/lock
// @access  Private
exports.lockLead = async (req, res, next) => {
  try {
    const lead = await findLeadRaw(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    const LOCK_TIMEOUT_MS = 5 * 60 * 1000;
    if (lead.lockedBy && String(lead.lockedBy) !== String(req.user._id)) {
      if (lead.lockedAt && (Date.now() - new Date(lead.lockedAt).getTime()) < LOCK_TIMEOUT_MS) {
        return res.status(409).json({ success: false, message: 'Lead is currently locked by another user.' });
      }
    }

    // Raw driver, not lead.save() — .save()'s version-checked update throws a
    // spurious VersionError for some legacy String-_id leads (see
    // utils/leadLookup.js), and can also race against itself: this effect
    // fires twice under React StrictMode in dev (mount, cleanup/unlock,
    // remount/lock), and an atomic update has no version to conflict on.
    await mongoose.connection.db.collection('leads').updateOne(
      { _id: lead._id },
      { $set: { lockedBy: req.user._id, lockedAt: new Date() } }
    );

    res.status(200).json({ success: true, message: 'Lead locked successfully' });
  } catch (error) {
    logger.error('Error locking lead:', error);
    next(error);
  }
};

// @desc    Unlock lead
// @route   POST /api/leads/:id/unlock
// @access  Private
exports.unlockLead = async (req, res, next) => {
  try {
    const lead = await findLeadRaw(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    if (String(lead.lockedBy) === String(req.user._id) || req.user?.permissions?.includes('*')) {
      await mongoose.connection.db.collection('leads').updateOne(
        { _id: lead._id },
        { $set: { lockedBy: null, lockedAt: null } }
      );
    }

    res.status(200).json({ success: true, message: 'Lead unlocked successfully' });
  } catch (error) {
    logger.error('Error unlocking lead:', error);
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
    // businessName lives in LEAD_UPDATE_FIELDS — it's an ordinary qualification
    // field now, not a protected core-identity one (see below).
    let allowedUpdates = [...LEAD_UPDATE_FIELDS, 'fullName', 'email', 'phone', 'altPhone', 'service'];

    // Field-level access control: Only Super Admins can edit core fields
    const isSuperAdmin = req.user?.permissions?.includes('*');
    if (!isSuperAdmin) {
      const protectedFields = ['fullName', 'email', 'phone', 'altPhone', 'city', 'country', 'platform'];
      allowedUpdates = allowedUpdates.filter(field => !protectedFields.includes(field));
    }

    let updates = {};
    for (const key of Object.keys(req.body)) {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    }

    // This update goes through the raw driver (to bypass ObjectId casting),
    // which skips the Mongoose pre-save hook that normally keeps
    // phone/altPhone/email normalized — so recompute them here whenever the
    // admin edits one, or duplicate-lead lookups would go stale for this lead.
    if ('phone' in updates) updates.phoneNormalized = normalizePhone(updates.phone);
    if ('altPhone' in updates) updates.altPhoneNormalized = normalizePhone(updates.altPhone);
    if ('email' in updates) updates.emailNormalized = normalizeEmail(updates.email);

    const result = await applyLeadUpdate(req.params.id, updates, { id: req.user?._id, isSuperAdmin });
    if (!result.ok) {
      return res.status(result.status).json({ success: false, message: result.message });
    }

    res.status(200).json({ success: true, data: result.lead });
  } catch (error) {
    logger.error('Error updating lead:', error);
    next(error);
  }
};

// @desc    Bulk-import leads from an uploaded Excel (.xlsx) or CSV file
// @route   POST /api/leads/import
// @access  Private (Super Admin)
exports.importLeads = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const summary = await importLeadsFromFile(req.file.buffer, req.file.originalname, { id: req.user?._id });
    res.status(200).json({ success: true, data: summary });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    logger.error('Error importing leads:', error);
    next(error);
  }
};

// @desc    Attach a document (proposal, quotation, scope, other) to a lead
// @route   POST /api/leads/:id/documents
// @access  Private (Admin)
exports.uploadLeadDocument = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    const result = await addLeadDocument(req.params.id, req.file, req.body.docType, req.user._id);
    if (!result.ok) {
      return res.status(result.status).json({ success: false, message: result.message });
    }
    res.status(201).json({ success: true, data: result.lead });
  } catch (error) {
    logger.error('Error uploading lead document:', error);
    next(error);
  }
};

// @desc    Remove a document from a lead
// @route   DELETE /api/leads/:id/documents/:docId
// @access  Private (Admin)
exports.deleteLeadDocument = async (req, res, next) => {
  try {
    const result = await removeLeadDocument(req.params.id, req.params.docId);
    if (!result.ok) {
      return res.status(result.status).json({ success: false, message: result.message });
    }
    res.status(200).json({ success: true, data: result.lead });
  } catch (error) {
    logger.error('Error deleting lead document:', error);
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

// @desc    List a lead's follow-up tasks (Primary + any manager-created Parallel ones)
// @route   GET /api/leads/:id/tasks
// @access  Private (Admin)
exports.getLeadTasks = async (req, res, next) => {
  try {
    const result = await listTasks(req.params.id);
    if (!result.ok) {
      return res.status(result.status).json({ success: false, message: result.message });
    }
    res.status(200).json({ success: true, tasks: result.tasks });
  } catch (error) {
    logger.error('Error listing lead tasks:', error);
    next(error);
  }
};

// @desc    Create a Parallel follow-up task — manager-only, independent of
//          the lead's primary next-follow-up (the spec's "manager explicitly
//          creates parallel tasks" exception).
// @route   POST /api/leads/:id/tasks
// @access  Private (leads.assign)
exports.createLeadTask = async (req, res, next) => {
  try {
    const { assignedTo, dueDate, note } = req.body;
    const result = await createParallelTask(req.params.id, { assignedTo, dueDate, note }, req.user._id);
    if (!result.ok) {
      return res.status(result.status).json({ success: false, message: result.message });
    }
    res.status(201).json({ success: true, task: result.task });
  } catch (error) {
    logger.error('Error creating lead task:', error);
    next(error);
  }
};

// @desc    Complete a follow-up task — a result is always required.
// @route   PUT /api/leads/:id/tasks/:taskId/complete
// @access  Private (Admin)
exports.completeLeadTask = async (req, res, next) => {
  try {
    const canManage = req.user?.permissions?.includes('leads.assign') || req.user?.permissions?.includes('*');
    const result = await completeTask(req.params.id, req.params.taskId, req.body.result, req.user._id, { canManage });
    if (!result.ok) {
      return res.status(result.status).json({ success: false, message: result.message });
    }
    res.status(200).json({ success: true, task: result.task });
  } catch (error) {
    logger.error('Error completing lead task:', error);
    next(error);
  }
};
