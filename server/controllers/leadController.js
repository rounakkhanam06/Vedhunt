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
const { applyLeadUpdate, hasActiveCallByOther } = require('../services/leadLifecycle');
const { prepareImport, previewImport } = require('../services/leadImport');
const { startImportJob, getImportJob } = require('../services/importJobs');
const { listTasks, createParallelTask, completeTask } = require('../services/followUpTasks');
const collaboration = require('../services/leadCollaboration');
const { rawLeadFilter, workingLeadFilter, droppedHoldLeadFilter, DROPPED_OR_HOLD } = require('../utils/leadActivity');
const { latestNotes } = require('../services/leadCollaboration');
const { parseLeadIds, previewBulkReassign, runBulkReassign, loadRun } = require('../services/bulkReassign');
const BulkAssignmentRun = require('../models/BulkAssignmentRun');
const { derivePriority } = require('../utils/serviceQualification');
const { getLeadScoringSettings, computeLeadScore } = require('../services/leadScoring');

// Which leads a login may see and change comes from req.pageScope, set by
// requirePageAccess on each route (routes/leadRoutes.js): every lead with
// '*' / leads.viewAll (or an "all leads" grant), their own with leads.view,
// or their reporting tree with a "team" grant. A lead outside the scope
// answers "not found", so an ID can't be used to read or change it.
// Assigners can also open and hand out unassigned leads (the pool).
const { leadFilter, leadInScope, assigneeIds, canAssignLeads, oid } = require('../utils/leadScope');
const { pageScope } = require('../config/pageAccess');

const notFound = (res) => res.status(404).json({ success: false, message: 'Lead not found' });

// Assigning: the lead must be in the person's assign scope (or unassigned), and
// so must the BD it goes to. Returns an error message or null.
async function assignError(req, leadId, targetId) {
  const lead = await findLeadRaw(leadId, await leadFilter(req, req.pageScope, { unassigned: true, shared: false }));
  if (!lead) return { status: 404, message: 'Lead not found' };
  if (targetId) {
    const ids = await assigneeIds(req);
    if (ids && !ids.includes(String(targetId))) return { status: 403, message: 'You can only assign leads to people in your scope.' };
  }
  return null;
}

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

    // Raw (assigned, not connected yet) vs Working (connected) vs Dropped &
    // Hold — defined in utils/leadActivity.js so the pages never show the
    // same lead twice. Unassigned leads have their own page (assignedTo=Unassigned). stageGroup wins over
    // a plain status filter so a page can't leak another page's leads.
    query.$and = [];
    if (req.query.stageGroup === 'raw') {
      query.$and.push(rawLeadFilter());
    } else if (req.query.stageGroup === 'working') {
      query.$and.push(workingLeadFilter());
      if (req.query.status && req.query.status !== 'All') query.status = req.query.status;
    } else if (req.query.stageGroup === 'dropped-hold') {
      query.$and.push(droppedHoldLeadFilter());
      if (DROPPED_OR_HOLD.includes(req.query.status)) query.status = req.query.status;
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

    // Interest level (latest call outcome)
    if (req.query.interestLevel && req.query.interestLevel !== 'All') {
      // 'Not rated' = the lead has no interest level yet (Leads Overview drill-down)
      query.interestLevel = req.query.interestLevel === 'Not rated' ? { $in: [null, ''] } : req.query.interestLevel;
    }

    // Follow-up due date — its own range so it combines with the
    // received/assigned/last-call range below
    if (req.query.followUpFrom || req.query.followUpTo) {
      const due = {};
      if (req.query.followUpFrom) due.$gte = new Date(req.query.followUpFrom);
      if (req.query.followUpTo) {
        const endOfDay = new Date(req.query.followUpTo);
        endOfDay.setHours(23, 59, 59, 999);
        due.$lte = endOfDay;
      }
      query.nextFollowUpDate = due;
    }

    // "Open pipeline" shorthand — every non-terminal, non-Hold lead, same set
    // activityController.js's getPipelineSummary already uses for pipelineValue.
    // Only applies when no explicit status/stageGroup filter already set one.
    if (req.query.stage === 'open' && !query.status) {
      query.status = { $nin: [...TERMINAL_STATUSES, 'Hold'] };
    }

    // Date range filter — on when the lead was received (createdAt, the
    // default), assigned (assignedAt) or last called (lastCallAt; leads last
    // called before that field existed match on their callLogs, or failing
    // that the call-timer/imported callDate).
    if (req.query.dateFrom || req.query.dateTo) {
      const range = {};
      if (req.query.dateFrom) range.$gte = new Date(req.query.dateFrom);
      if (req.query.dateTo) {
        // Treat dateTo as inclusive of the whole day.
        const endOfDay = new Date(req.query.dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        range.$lte = endOfDay;
      }
      if (req.query.dateField === 'assigned') {
        query.assignedAt = range;
      } else if (req.query.dateField === 'lastActivity') {
        query.lastActivityAt = range;
      } else if (req.query.dateField === 'lastCall') {
        query.$and = query.$and || [];
        query.$and.push({
          $or: [
            { lastCallAt: range },
            { lastCallAt: null, callLogs: { $elemMatch: { callDate: range } } },
            { lastCallAt: null, 'callLogs.0': { $exists: false }, callDate: range }
          ]
        });
      } else {
        query.createdAt = range;
      }
    }

    // Visibility: only leads inside the person's scope (all / team / own),
    // however they filter. The "Assigned BD" filter can pick a person in the
    // scope; 'Unassigned' shows the pool to anyone who can assign leads.
    const visibleIds = await assigneeIds(req);
    const wanted = req.query.assignedTo && req.query.assignedTo !== 'All' ? String(req.query.assignedTo) : null;
    if (!visibleIds) {
      if (wanted) query.assignedTo = wanted === 'Unassigned' ? null : wanted;
    } else if (wanted === 'Unassigned') {
      query.assignedTo = canAssignLeads(req.user) ? null : { $in: [] };
    } else if (wanted) {
      query.assignedTo = visibleIds.includes(wanted) ? wanted : { $in: [] };
    } else {
      // Their own leads plus any cross-assigned to someone in the scope
      const inIds = { $in: visibleIds.map(oid) };
      query.$and = query.$and || [];
      query.$and.push({ $or: [{ assignedTo: inIds }, { 'sharedWith.admin': inIds }] });
    }

    // Search by text (using $text index or regex if $text doesn't cover partial well)
    // Note: MongoDB $text search is word-based. For partial matching (e.g. typing part of an email), 
    // regex is often more intuitive for admin panels, though less scalable than raw $text.
    // For optimal scalability with partial matches, we use an $or with regex.
    // Since we added an index on these fields, the regex search on anchored/indexed fields can be optimized.
    if (req.query.search) {
      const term = String(req.query.search).trim();
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escaped, 'i');
      query.$or = [
        { fullName: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
        { businessName: searchRegex },
        // Vedhunt Lead ID or Meta (Facebook/Instagram) Lead ID
        { leadId: new RegExp(`^${escaped}`, 'i') },
        { fbLeadId: new RegExp(`^${escaped}`) }
      ];
    }

    let sort = { createdAt: -1 };
    if (req.query.sortBy) {
      const order = req.query.sortOrder === 'asc' ? 1 : -1;
      sort = { [req.query.sortBy]: order };
    }

    if (!query.$and.length) delete query.$and; // MongoDB rejects an empty $and

    // Bulk-select support: every id matching the current filters (not just this
    // page), so "select all N matching" can reassign beyond one page.
    if (req.query.idsOnly === 'true') {
      const idDocs = await Lead.find(query).sort(sort).select('_id').lean();
      return res.status(200).json({
        success: true,
        totalLeads: idDocs.length,
        ids: idDocs.map((d) => String(d._id))
      });
    }

    const totalLeads = await Lead.countDocuments(query);

    let leadsQuery = Lead.find(query).sort(sort).populate('assignedTo', 'firstName lastName email');

    if (!isExport) {
      leadsQuery = leadsQuery.skip(startIndex).limit(limit);
    }
    
    let leads = await leadsQuery;

    // The CSV export's "Latest note" column: the newest note this person may read on each lead
    if (isExport && leads.length) {
      const notes = await latestNotes(leads.map((l) => l._id), req.user);
      leads = leads.map((l) => {
        const note = notes.get(String(l._id));
        return { ...l.toObject(), latestNote: note ? { text: note.text, author: note.author, createdAt: note.createdAt } : null };
      });
    }

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
    if (!lead || !(await leadInScope(req, lead, req.pageScope, { unassigned: canAssignLeads(req.user) }))) {
      return notFound(res);
    }

    let assignedTo = null;
    if (lead.assignedTo) {
      const admin = await Admin.findById(lead.assignedTo).select('firstName lastName email');
      if (admin) assignedTo = { _id: admin._id, firstName: admin.firstName, lastName: admin.lastName, email: admin.email };
    }

    const sharedWith = await collaboration.sharedWithDetails(lead);
    res.status(200).json({ success: true, data: { ...lead, assignedTo, sharedWith } });
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
    const denied = await assignError(req, req.params.id, assignedTo);
    if (denied) return res.status(denied.status).json({ success: false, message: denied.message });
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
      // Round robin spreads leads across every BD, so it needs company-wide assign access
      if (req.pageScope) {
        return res.status(403).json({ success: false, message: 'Round-robin assignment needs access to assign all leads.' });
      }
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

    const opts = await bulkOptions(req);
    if (opts.error) return res.status(opts.status).json({ success: false, message: opts.error });

    const run = await runBulkReassign(opts, {
      filters: req.body.filters && typeof req.body.filters === 'object' ? req.body.filters : {},
      selection: req.body.selection,
      reason: String(reason || '').slice(0, 500),
    });
    const assigned = run.succeeded.length;
    const failed = run.failed.length;
    const verb = opts.target ? 'Reassigned' : 'Unassigned';
    const message = failed
      ? `${verb} ${assigned} of ${run.requested} lead${run.requested === 1 ? '' : 's'}. ${failed} could not be ${verb.toLowerCase()}.`
      : `${verb} all ${assigned} lead${assigned === 1 ? '' : 's'}.`;

    // success is true only when every selected lead moved
    res.status(200).json({
      success: failed === 0,
      partial: failed > 0 && assigned > 0,
      message,
      runId: run._id,
      requested: run.requested,
      assigned,
      failed,
      failures: run.failed
    });
  } catch (error) {
    logger.error('Error in bulk assign:', error);
    next(error);
  }
};

/**
 * Shared input checks for preview and run: lead ids, destination (inside the
 * person's scope, active), and the owner the selection was filtered by.
 */
async function bulkOptions(req) {
  const { leadIds, assignedTo, expectedOwner } = req.body;
  const parsed = parseLeadIds(leadIds);
  if (parsed.error) return { status: 400, error: parsed.error };

  const target = assignedTo && assignedTo !== 'unassign' ? String(assignedTo) : null;
  if (!assignedTo) return { status: 400, error: 'Choose who to reassign the leads to.' };
  if (target) {
    if (!mongoose.isValidObjectId(target)) return { status: 400, error: 'That BD account does not exist' };
    const targetAdmin = await Admin.findById(target).select('isActive').lean();
    if (!targetAdmin || targetAdmin.isActive === false) return { status: 400, error: 'That BD account does not exist or is inactive' };
    const ids = await assigneeIds(req);
    if (ids && !ids.includes(target)) return { status: 403, error: 'You can only assign leads to people in your scope.' };
  }
  if (expectedOwner && !mongoose.isValidObjectId(expectedOwner)) return { status: 400, error: 'Invalid owner filter.' };

  return {
    ids: parsed.ids,
    target,
    expectedOwner: expectedOwner || null,
    actorId: req.user._id,
    scopeFilter: await leadFilter(req, req.pageScope, { unassigned: true, shared: false })
  };
}

// @desc    Preview a bulk reassignment: counts by current owner, destination,
//          and every selected lead that can't be moved, with the reason
// @route   POST /api/leads/bulk-assign/preview
// @access  Private (leads.assign)
exports.previewBulkAssign = async (req, res, next) => {
  try {
    const opts = await bulkOptions(req);
    if (opts.error) return res.status(opts.status).json({ success: false, message: opts.error });
    res.status(200).json({ success: true, data: await previewBulkReassign(opts) });
  } catch (error) {
    logger.error('Error previewing bulk assign:', error);
    next(error);
  }
};

// @desc    Bulk reassignment runs (all for full-access admins, else your own)
// @route   GET /api/leads/bulk-assign/runs[/:runId]
// @access  Private (leads.assign)
exports.getBulkAssignRuns = async (req, res, next) => {
  try {
    const own = req.pageScope ? { initiatedBy: req.user._id } : {};
    if (req.params.runId) {
      const run = await loadRun(req.params.runId, own);
      if (!run) return res.status(404).json({ success: false, message: 'Run not found' });
      return res.status(200).json({ success: true, data: run });
    }
    // Counts only — the full per-lead lists come with a single run
    const runs = await BulkAssignmentRun.aggregate([
      { $match: own },
      { $sort: { createdAt: -1 } },
      { $limit: 50 },
      { $project: { initiatedBy: 1, toAdmin: 1, expectedOwner: 1, filters: 1, selection: 1, reason: 1, requested: 1, status: 1, createdAt: 1, finishedAt: 1, succeededCount: { $size: '$succeeded' }, failedCount: { $size: '$failed' } } }
    ]);
    await BulkAssignmentRun.populate(runs, [
      { path: 'initiatedBy', select: 'firstName lastName email' },
      { path: 'toAdmin', select: 'firstName lastName email' },
      { path: 'expectedOwner', select: 'firstName lastName email' }
    ]);
    res.status(200).json({ success: true, data: runs });
  } catch (error) {
    logger.error('Error fetching bulk assign runs:', error);
    next(error);
  }
};

// @desc    Assignment/reassignment audit trail for one lead
// @route   GET /api/leads/:id/assignment-history
// @access  Private (Admin)
exports.getAssignmentHistory = async (req, res, next) => {
  try {
    const lead = await findLeadRaw(req.params.id);
    if (!lead || !(await leadInScope(req, lead, req.pageScope, { unassigned: canAssignLeads(req.user) }))) {
      return notFound(res);
    }

    const history = await AssignmentLog.find({ lead: lead._id })
      .sort({ createdAt: -1 })
      .populate('fromAdmin', 'firstName lastName email')
      .populate('toAdmin', 'firstName lastName email')
      .populate('assignedBy', 'firstName lastName email');

    res.status(200).json({ success: true, data: history });
  } catch (error) {
    logger.error('Error fetching assignment history:', error);
    next(error);
  }
};

// What happened, from the stored fields (one label for the page and filters)
const OWNERSHIP_MODES = ['Manual', 'Auto-RoundRobin'];
const ASSIGNMENT_EVENTS = {
  assigned: { mode: { $in: OWNERSHIP_MODES }, fromAdmin: null, toAdmin: { $ne: null } },
  reassigned: { mode: { $in: OWNERSHIP_MODES }, fromAdmin: { $ne: null }, toAdmin: { $ne: null } },
  unassigned: { mode: { $in: OWNERSHIP_MODES }, toAdmin: null },
  'cross-assigned': { mode: 'Cross-Assign' },
  'access-removed': { mode: 'Cross-Unassign' },
};
function assignmentEvent(log) {
  if (log.mode === 'Cross-Assign') return 'Cross-assigned';
  if (log.mode === 'Cross-Unassign') return 'Access removed';
  if (!log.toAdmin) return 'Unassigned';
  return log.fromAdmin ? 'Reassigned' : 'Assigned';
}

// Which side of the change ?employee is on
const EMPLOYEE_ROLES = {
  from: (id) => [{ fromAdmin: id }],
  to: (id) => [{ toAdmin: id }],
  actor: (id) => [{ assignedBy: id }],
  any: (id) => [{ fromAdmin: id }, { toAdmin: id }, { assignedBy: id }, { leadOwner: id }],
};

// @desc    Lead Assignment Logs — every assignment, reassignment, unassignment,
//          cross-assignment and access removal. Filters: ?dateFrom/dateTo
//          (whole days, server timezone — IST), ?employee + ?role
//          (from | to | actor | any), ?event, ?lead (lead ID or name).
// @route   GET /api/leads/assignments/all
// @access  Private (audit.view)
exports.getAllAssignmentLogs = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const startIndex = (page - 1) * limit;
    const empty = () => res.status(200).json({ success: true, count: 0, totalLogs: 0, totalPages: 0, currentPage: page, data: [] });

    const and = [];

    // Lead: ID prefix, or name (older callers send ?leadId)
    const leadTerm = String(req.query.lead || req.query.leadId || '').trim().slice(0, 100);
    if (leadTerm) {
      const escaped = leadTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const leads = await Lead.find(
        { $or: [{ leadId: new RegExp(`^${escaped}`, 'i') }, { fullName: new RegExp(escaped, 'i') }] },
        { _id: 1 }
      ).limit(500).lean();
      if (!leads.length) return empty();
      and.push({ lead: { $in: leads.map((l) => l._id) } });
    }

    const employee = req.query.employee || req.query.userId;
    if (employee && employee !== 'All') {
      if (!mongoose.isValidObjectId(employee)) return empty();
      const id = new mongoose.Types.ObjectId(String(employee));
      and.push({ $or: (EMPLOYEE_ROLES[req.query.role] || EMPLOYEE_ROLES.any)(id) });
    }

    if (ASSIGNMENT_EVENTS[req.query.event]) and.push(ASSIGNMENT_EVENTS[req.query.event]);
    if (req.query.bulk === 'true') and.push({ bulkRun: { $ne: null } });

    if (req.query.dateFrom || req.query.dateTo) {
      const range = {};
      if (req.query.dateFrom) range.$gte = new Date(`${req.query.dateFrom}T00:00:00`);
      if (req.query.dateTo) range.$lte = new Date(`${req.query.dateTo}T23:59:59.999`);
      if (Object.values(range).some((d) => Number.isNaN(d.getTime()))) {
        return res.status(400).json({ success: false, message: 'Pick a valid date range.' });
      }
      and.push({ createdAt: range });
    }

    const query = and.length ? { $and: and } : {};
    const totalLogs = await AssignmentLog.countDocuments(query);
    const logs = await AssignmentLog.find(query)
      .sort({ createdAt: -1 })
      .skip(startIndex)
      .limit(limit)
      .populate('lead', 'leadId fullName email phone')
      .populate('fromAdmin', 'firstName lastName email')
      .populate('toAdmin', 'firstName lastName email')
      .populate('assignedBy', 'firstName lastName email')
      .populate('leadOwner', 'firstName lastName email')
      .lean();

    res.status(200).json({
      success: true,
      count: logs.length,
      totalLogs,
      totalPages: Math.ceil(totalLogs / limit),
      currentPage: page,
      data: logs.map((log) => ({ ...log, event: assignmentEvent(log) }))
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
    const lead = await findLeadRaw(req.params.id, await leadFilter(req));
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    const LOCK_TIMEOUT_MS = 5 * 60 * 1000;
    if (lead.lockedBy && String(lead.lockedBy) !== String(req.user._id)) {
      if (lead.lockedAt && (Date.now() - new Date(lead.lockedAt).getTime()) < LOCK_TIMEOUT_MS) {
        return res.status(409).json({ success: false, message: 'Lead is currently locked by another user.' });
      }
    }
    // Opening a lead mid-call must not take it away from the caller.
    if (hasActiveCallByOther(lead, req.user._id)) {
      return res.status(409).json({ success: false, message: 'Another user is on a call with this lead right now.' });
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

    const canReactivate = req.user?.permissions?.includes('leads.reactivate');
    const result = await applyLeadUpdate(req.params.id, updates, { id: req.user?._id, isSuperAdmin, canReactivate }, await leadFilter(req));
    if (!result.ok) {
      return res.status(result.status).json({ success: false, message: result.message });
    }

    res.status(200).json({ success: true, data: result.lead });
  } catch (error) {
    logger.error('Error updating lead:', error);
    next(error);
  }
};

// @desc    Dry run of a lead import: what every row would create/update/skip
//          and why. Read-only — nothing is written until POST /api/leads/import.
// @route   POST /api/leads/import/preview
// @access  Private (Super Admin)
exports.previewImportLeads = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const prepared = await prepareImport(req.file.buffer, req.file.originalname);
    const preview = await previewImport(prepared);
    res.status(200).json({ success: true, data: preview });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    logger.error('Error previewing lead import:', error);
    next(error);
  }
};

// @desc    Confirmed bulk import of an Excel (.xlsx) or CSV file (the same file
//          the admin previewed). Re-validates every row against the current DB,
//          then runs as a background job and returns its id — poll
//          GET /api/leads/import/:jobId for progress.
// @route   POST /api/leads/import
// @access  Private (Super Admin)
exports.importLeads = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const prepared = await prepareImport(req.file.buffer, req.file.originalname);
    const jobId = startImportJob(prepared, req.file.originalname, { id: req.user?._id });
    res.status(202).json({ success: true, data: { jobId, rowCount: prepared.rowCount } });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    logger.error('Error importing leads:', error);
    next(error);
  }
};

// @desc    Progress/result of a lead import job started by POST /api/leads/import
// @route   GET /api/leads/import/:jobId
// @access  Private (Super Admin)
exports.getImportStatus = async (req, res) => {
  const job = getImportJob(req.params.jobId);
  if (!job || job.ownerId !== String(req.user?._id || '')) {
    return res.status(404).json({ success: false, message: 'Import job not found' });
  }
  res.status(200).json({
    success: true,
    data: {
      status: job.status,
      processed: job.processed,
      rowCount: job.rowCount,
      summary: job.summary,
      error: job.error
    }
  });
};

// @desc    Delete lead
// @route   DELETE /api/leads/:id
// @access  Private (Admin)
exports.deleteLead = async (req, res, next) => {
  try {
    if (req.pageScope && !(await findLeadRaw(req.params.id, await leadFilter(req, req.pageScope, { shared: false })))) return notFound(res);
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
    const result = await listTasks(req.params.id, await leadFilter(req));
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
    if (req.pageScope) {
      if (!(await findLeadRaw(req.params.id, await leadFilter(req)))) return notFound(res);
      const ids = await assigneeIds(req);
      if (assignedTo && ids && !ids.includes(String(assignedTo))) {
        return res.status(403).json({ success: false, message: 'You can only give tasks to people in your scope.' });
      }
    }
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
    // Completing someone else's task is follow-up management
    const canManage = pageScope(req.user, 'followups', 'edit') !== false;
    const result = await completeTask(req.params.id, req.params.taskId, req.body.result, req.user._id, { canManage }, await leadFilter(req));
    if (!result.ok) {
      return res.status(result.status).json({ success: false, message: result.message });
    }
    res.status(200).json({ success: true, task: result.task });
  } catch (error) {
    logger.error('Error completing lead task:', error);
    next(error);
  }
};

const respondResult = (res, result, status = 200) => (result.ok
  ? res.status(status).json({ success: true, ...(result.note && { data: result.note }) })
  : res.status(result.status).json({ success: false, message: result.message }));

// @desc    Notes on a lead the person may read (private ones: author + all-leads admins)
// @route   GET /api/leads/:id/notes
// @access  Private (leads view)
exports.getLeadNotes = async (req, res, next) => {
  try {
    const lead = await findLeadRaw(req.params.id, await leadFilter(req));
    if (!lead) return notFound(res);
    res.status(200).json({ success: true, data: await collaboration.listNotes(lead._id, req.user) });
  } catch (error) {
    logger.error('Error fetching lead notes:', error);
    next(error);
  }
};

// @desc    Add a shared or private note
// @route   POST /api/leads/:id/notes
// @access  Private (leads view)
exports.addLeadNote = async (req, res, next) => {
  try {
    const lead = await findLeadRaw(req.params.id, await leadFilter(req));
    if (!lead) return notFound(res);
    respondResult(res, await collaboration.addNote(lead, req.user, req.body), 201);
  } catch (error) {
    logger.error('Error adding lead note:', error);
    next(error);
  }
};

// @desc    Cross-assign: give another BD access while the owner keeps the lead
// @route   POST /api/leads/:id/share
// @access  Private (leads.assign)
exports.shareLeadWith = async (req, res, next) => {
  try {
    const { adminId, reason } = req.body;
    const lead = await findLeadRaw(req.params.id, await leadFilter(req, req.pageScope, { shared: false }));
    if (!lead) return notFound(res);
    const ids = await assigneeIds(req);
    if (ids && !ids.includes(String(adminId))) {
      return res.status(403).json({ success: false, message: 'You can only share leads with people in your scope.' });
    }
    respondResult(res, await collaboration.shareLead(lead, adminId, req.user._id, reason || ''), 201);
  } catch (error) {
    logger.error('Error sharing lead:', error);
    next(error);
  }
};

// @desc    Remove a cross-assignment
// @route   DELETE /api/leads/:id/share/:adminId (POST .../remove fallback)
// @access  Private (leads.assign)
exports.unshareLeadWith = async (req, res, next) => {
  try {
    const lead = await findLeadRaw(req.params.id, await leadFilter(req, req.pageScope, { shared: false }));
    if (!lead) return notFound(res);
    respondResult(res, await collaboration.unshareLead(lead, req.params.adminId, req.user._id, req.body?.reason || ''));
  } catch (error) {
    logger.error('Error removing lead share:', error);
    next(error);
  }
};
