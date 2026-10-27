
const express = require('express');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const authMiddleware = require('../middleware/authMiddleware');
const Client = require('../models/Client');
const Invoice = require('../models/Invoice');
const Project = require('../models/Project');
const Employee = require('../models/Employee');
const delivery = require('../services/projectDelivery');
const { sendResult } = require('../utils/apiResponse');
const Retainer = require('../models/Retainer');
const SupportTicket = require('../models/SupportTicket');
const AssignmentLog = require('../models/AssignmentLog');
const logger = require('../utils/logger');
const { updateAgreement, getAgreement } = require('../controllers/agreementController');
const { provisionClientAccount } = require('../services/clientProvisioning');
const { agreementDetailsChanged, nextAgreementVersion } = require('../services/agreementVersioning');
const requirePermission = require('../middleware/requirePermission');
const { notifyTicketAssigned } = require('../services/staffNotify');
const AuditLog = require('../models/AuditLog');
const PaymentProof = require('../models/PaymentProof');
const ClientNotification = require('../models/ClientNotification');
const {
  notifyInvoiceCreated, notifyAgreementUpdated, notifyTicketReply, notifyTicketStatus, notifyKycRejected, notifyKycVerified, notifyAccountHold, notifyAccountReleased, notifyOnboardingRequest,
} = require('../services/clientNotify');

const invoiceDocument = require('../services/invoiceDocument');
const { buildRegister, fyOf } = require('../services/clientRegister');
const { GST_STATE_CODES } = require('../config/gstStates');
const { validateGstin, validatePan } = require('../services/kycValidators');
const { PAGE_CATALOG, pageScope, hasBaseAccess } = require('../config/pageAccess');
const requirePageAccess = require('../middleware/requirePageAccess');
const { isScoped, clientAllowed, scopedClientRef, outOfScope } = require('../utils/clientScope');
const paymentController = require('../controllers/paymentController');
const Admin = require('../models/Admin');
const finance = require('../services/finance');
const { attachUsage, attachUsageWithHistory } = require('../services/retainerUsage');
const { buildPortfolio } = require('../services/portfolio');
const onboarding = require('../services/onboarding');
const strategy = require('../services/strategy');
const kyc = require('../services/kyc');
const extraHoursBilling = require('../services/extraHoursBilling');
const billingSchedule = require('../services/billingSchedule');
const clientCreationIssues = require('../services/clientCreationIssues');
const ClientCreationIssue = require('../models/ClientCreationIssue');
const Lead = require('../models/Lead');
const { convertWonLeadToClient } = require('../services/clientProvisioning');
const clientPolicies = require('../services/clientPolicies');
const BillingSchedule = require('../models/BillingSchedule');
const InvoiceDraft = require('../models/InvoiceDraft');
const adPerformance = require('../services/adPerformance');
const AdPerformance = require('../models/AdPerformance');
const CampaignStrategy = require('../models/CampaignStrategy');
const WorkLog = require('../models/WorkLog');
const { sanitizeProfile, profileDateErrors, profileAuditSnapshot } = require('../services/clientProfile');
const { recordAudit } = require('../services/audit');

// No auth here — mounted twice at the bottom of this file: behind the Admin
// auth at /api/admin, and behind the Employee Portal auth for person-wise
// grants. Every route checks page + action through requirePageAccess, which
// gives cms.manage / '*' full access and limits a grant to its clients.
const router = express.Router();
const crm = requirePageAccess;

// Client fields never sent; the temporary portal password is for full CRM access only
const clientSelect = (req) => `+notes ${hasBaseAccess(req.user, 'clients') ? '+temporaryPasswordText ' : ''}-password -refreshToken -resetPasswordToken -resetPasswordExpire`;

// ─── Utility ─────────────────────────────────────────────────────────────────
const parsePagination = (query) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

const paginatedResponse = (res, { data, total, page, limit }) => {
  res.json({
    success: true,
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
};

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const validateClientInput = (data) => {
  const errors = [];
  if (data.businessName !== undefined) {
    if (data.businessName.length < 2 || data.businessName.length > 100) {
      errors.push('Business name must be between 2 and 100 characters');
    }
  }
  if (data.contactName !== undefined) {
    if (data.contactName.length < 2 || data.contactName.length > 50) {
      errors.push('Contact name must be between 2 and 50 characters');
    }
    if (!/^[\p{L}][\p{L}\s.'’-]*$/u.test(data.contactName)) {
      errors.push('Contact name can only contain letters, spaces, dots, hyphens and apostrophes');
    }
  }
  if (data.email !== undefined) {
    if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(data.email)) {
      errors.push('Please enter a valid email address');
    }
  }
  if (data.phone !== undefined && data.phone !== '') {
    if (!/^\+?[1-9]\d{9,14}$/.test(data.phone)) {
      errors.push('Please enter a valid phone number (10-15 digits)');
    }
  }
  return errors;
};

// ══════════════════════════════════════════════════════════════════════════════
// CLIENTS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * @route  GET /api/admin/clients
 * @desc   List all clients (paginated, searchable)
 */
router.get('/clients', crm('clients', 'view'), async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = {};
    if (isScoped(req)) filter._id = { $in: req.pageScope.clients };

    // Text search across business name, contact name, email
    if (req.query.search) {
      filter.$text = { $search: req.query.search };
    }
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === 'true';
    }
    // Archived ("deleted") clients are hidden everywhere unless asked for —
    // this also keeps them out of the invoice/project/ticket client pickers.
    const STATUS_FILTERS = {
      active: { isActive: true, deletedAt: null },
      suspended: { isActive: false, deletedAt: null },
      archived: { deletedAt: { $ne: null } },
      all: {},
    };
    Object.assign(filter, STATUS_FILTERS[req.query.status] || { deletedAt: null });

    const [clients, total] = await Promise.all([
      Client.find(filter)
        .select(clientSelect(req))
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Client.countDocuments(filter),
    ]);

    paginatedResponse(res, { data: clients, total, page, limit });
  } catch (error) {
    logger.error('Admin get clients error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @route  GET /api/admin/portfolio
 * @desc   Client portfolio: KPI cards + one row per client with fee, collection
 *         and defaulter figures derived from retainers / invoices / payments.
 *         Default order is highest monthly recurring fee first.
 *         ?status=all|active|inactive|archived &sector= &service= &accountManager=
 *         &billing=overdue|outstanding|clear &sort=fee|name|outstanding|overdue|newest &search=
 *         &revenueFrom= &revenueTo=  (period for "top clients by revenue")
 */
router.get('/portfolio', crm('clients', 'view'), async (req, res) => {
  try {
    const date = (v) => { const d = v ? new Date(v) : null; return d && !Number.isNaN(d.getTime()) ? d : undefined; };
    const portfolio = await buildPortfolio({
      clientIds: isScoped(req) ? req.pageScope.clients : undefined,
      status: req.query.status,
      sector: req.query.sector,
      service: req.query.service,
      accountManager: req.query.accountManager && isValidId(req.query.accountManager) ? req.query.accountManager : undefined,
      billing: req.query.billing,
      sort: req.query.sort,
      search: req.query.search,
      revenueFrom: date(req.query.revenueFrom),
      revenueTo: date(req.query.revenueTo),
    });

    // Money figures need invoice access — a clients-only grant sees the account data without them
    const invoiceScope = pageScope(req.user, 'invoices', 'view');
    const stripFinance = ({ finance, isDefaulter, monthlyRecurringFee, ...row }) => row;
    if (invoiceScope === false) {
      const { monthlyRecurringRevenue, outstandingReceivables, overdueReceivables, paymentDefaulters, collectionPercent, ...kpis } = portfolio.kpis;
      portfolio.kpis = kpis;
      portfolio.topByRevenue = [];
      portfolio.rows = portfolio.rows.map(stripFinance);
    } else if (invoiceScope?.mode === 'clients') {
      // Invoice access covers only some clients: show money figures for those rows alone,
      // and drop the portfolio-wide money KPIs (they would include clients outside the grant)
      const allowed = new Set(invoiceScope.clients);
      portfolio.rows = portfolio.rows.map((row) => (allowed.has(String(row._id)) ? row : stripFinance(row)));
      const { monthlyRecurringRevenue, outstandingReceivables, overdueReceivables, paymentDefaulters, collectionPercent, ...kpis } = portfolio.kpis;
      portfolio.kpis = kpis;
      portfolio.topByRevenue = [];
    }

    const { page, limit, skip } = parsePagination(req.query);
    const total = portfolio.rows.length;
    const sectors = [...new Set(portfolio.rows.flatMap((r) => r.profile.sectors || []))].sort();
    const services = [...new Set(portfolio.rows.flatMap((r) => r.profile.services || []))].sort();
    res.json({
      success: true,
      kpis: portfolio.kpis,
      topByRevenue: portfolio.topByRevenue,
      revenuePeriod: { ...portfolio.revenuePeriod, partial: true },
      filterOptions: { sectors, services },
      data: portfolio.rows.slice(skip, skip + limit),
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error('Admin portfolio error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @route  GET /api/admin/client-register?fy=2026  (+ the same filters as /portfolio)
 * @desc   The spreadsheet view of the client list (services/clientRegister.js): every
 *         matching client, with package, received, balance and money received per month
 *         of the financial year. Money columns follow the same invoice-access rules as /portfolio.
 */
router.get('/client-register', crm('clients', 'view'), async (req, res) => {
  try {
    const portfolio = await buildPortfolio({
      clientIds: isScoped(req) ? req.pageScope.clients : undefined,
      status: req.query.status,
      sector: req.query.sector,
      service: req.query.service,
      accountManager: req.query.accountManager && isValidId(req.query.accountManager) ? req.query.accountManager : undefined,
      billing: req.query.billing,
      sort: req.query.sort,
      search: req.query.search,
    });
    const invoiceScope = pageScope(req.user, 'invoices', 'view');
    const allowed = invoiceScope?.mode === 'clients' ? new Set(invoiceScope.clients) : null;
    const rows = portfolio.rows.map((row) => {
      if (invoiceScope === false || (allowed && !allowed.has(String(row._id)))) {
        const { finance, ...rest } = row;
        return rest;
      }
      return row;
    });
    const fy = Number.isInteger(Number(req.query.fy)) && Number(req.query.fy) > 2000 ? Number(req.query.fy) : fyOf(new Date());
    res.json({ success: true, data: await buildRegister(rows, fy) });
  } catch (error) {
    logger.error('Admin client register error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Staff the account manager / dedicated team can be picked from (names + role only)
router.get('/clients-staff', crm('clients', 'view'), async (req, res) => {
  try {
    const staff = await Employee.find({}, 'firstName lastName designation roleDept employeeId adminId').sort({ firstName: 1 }).limit(1000).lean();
    res.json({ success: true, data: staff });
  } catch (error) {
    logger.error('Admin clients staff error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @route  GET /api/admin/client-options?page=invoices&action=create
 * @desc   Client picker for a CRM page — only the clients the person may use
 *         there (every non-archived client for full CRM access).
 */
router.get('/client-options', async (req, res) => {
  try {
    const page = PAGE_CATALOG.some((p) => p.key === req.query.page && p.scope === 'client') ? req.query.page : 'clients';
    const action = req.query.action === 'create' ? 'create' : 'view';
    const scope = pageScope(req.user, page, action);
    if (scope === false) return res.json({ success: true, data: [] });
    const filter = { deletedAt: null };
    if (scope?.mode === 'clients') filter._id = { $in: scope.clients };
    const data = await Client.find(filter, 'businessName contactName email clientId isActive')
      .sort({ businessName: 1 }).limit(1000).lean();
    res.json({ success: true, data });
  } catch (error) {
    logger.error('Admin client options error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @route  GET /api/admin/clients/:id
 * @desc   Get single client with all linked data summary
 */
router.get('/clients/:id', crm('clients', 'view'), async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid client ID' });
    }
    if (!clientAllowed(req, req.params.id)) return outOfScope(res, 'Client');

    const client = await Client.findById(req.params.id)
      .select(clientSelect(req))
      .populate('leadRef', 'fullName phone email status pipelineHistory callLogs dealValue dealCloseValue createdAt')
      .lean();

    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    // Fetch summary counts
    const [invoiceCount, projectCount, retainerCount, ticketCount, assignmentHistory] = await Promise.all([
      Invoice.countDocuments({ client_ref: client._id }),
      Project.countDocuments({ client_ref: client._id }),
      Retainer.countDocuments({ client_ref: client._id, status: 'Active' }),
      SupportTicket.countDocuments({ client_ref: client._id, status: { $in: ['Open', 'In Progress'] } }),
      client.leadRef
        ? AssignmentLog.find({ lead: client.leadRef._id })
            .sort({ createdAt: -1 })
            .populate('fromAdmin', 'firstName lastName')
            .populate('toAdmin', 'firstName lastName')
            .lean()
        : [],
    ]);

    res.json({
      success: true,
      data: {
        ...client,
        summary: { invoiceCount, projectCount, activeRetainerCount: retainerCount, openTicketCount: ticketCount },
        // Client 360: the full pre-sale timeline from the lead this client
        // converted from — pipeline/stage history, every call attempt, and
        // ownership changes — so nothing pre-sale is lost once a lead becomes
        // a client record.
        preSaleTimeline: client.leadRef
          ? {
              pipelineHistory: client.leadRef.pipelineHistory || [],
              callLogs: client.leadRef.callLogs || [],
              assignmentHistory,
            }
          : null,
      },
    });
  } catch (error) {
    logger.error('Admin get client detail error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @route  POST /api/admin/clients
 * @desc   Create a new client account (with optional lead link)
 */
router.post('/clients', crm('clients', 'create'), async (req, res) => {
  try {
    // A brand-new client can't be inside a fixed client list
    if (isScoped(req)) {
      return res.status(403).json({ success: false, message: 'Creating clients needs access to all clients.' });
    }
    const { businessName, contactName, email, phone, password, notes, leadRef } = req.body;

    if (!businessName || !contactName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'businessName, contactName, email and password are required',
      });
    }

    const validationErrors = validateClientInput(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: validationErrors.join(', '),
      });
    }

    const existingClient = await Client.findOne({ email: email.toLowerCase().trim() }).lean();
    if (existingClient) {
      return res.status(409).json({ success: false, message: 'A client with this email already exists' });
    }

    // Lead status is no longer forced to Won from here — a lead reaches Won
    // (and auto-provisions its own client account) only through the sales
    // state machine in services/leadLifecycle.js. Linking an existing Won
    // lead here just records the traceability pointer.
    const client = await provisionClientAccount({
      businessName,
      contactName,
      email,
      phone,
      password,
      notes,
      leadRef: leadRef && isValidId(leadRef) ? leadRef : undefined,
      createdBy: req.user._id,
    });

    res.status(201).json({
      success: true,
      message: 'Client account created successfully',
      data: {
        _id: client._id,
        clientId: client.clientId,
        businessName: client.businessName,
        contactName: client.contactName,
        email: client.email,
      },
    });
  } catch (error) {
    logger.error('Admin create client error:', error);
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Email already in use' });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @route  PUT /api/admin/clients/:id
 * @desc   Update client info / reset password / toggle active
 */
router.put('/clients/:id', crm('clients', 'edit'), async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid client ID' });
    }
    if (!clientAllowed(req, req.params.id)) return outOfScope(res, 'Client');

    const { businessName, contactName, email, phone, notes, agreementDetails, profile } = req.body;
    // Portal status and passwords stay with full CRM access; a grant edits details only
    const { isActive, newPassword } = hasBaseAccess(req.user, 'clients') ? req.body : {};

    const validationErrors = validateClientInput(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: validationErrors.join(', '),
      });
    }

    const client = await Client.findById(req.params.id).select('+password');
    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    if (isActive !== undefined && client.deletedAt) {
      return res.status(400).json({ success: false, message: 'This account is archived. Restore it before changing its status.' });
    }

    if (businessName !== undefined) client.businessName = businessName;
    if (contactName !== undefined) client.contactName = contactName;
    if (email !== undefined) client.email = email.toLowerCase().trim();
    if (phone !== undefined) client.phone = phone;
    if (notes !== undefined) client.notes = notes;
    if (isActive !== undefined && Boolean(isActive) !== client.isActive) {
      applySuspension(client, !isActive, req.user._id);
      await auditClient(req, isActive ? 'CLIENT_REACTIVATE' : 'CLIENT_SUSPEND', client);
    }
    if (newPassword) {
      client.password = newPassword;
      client.temporaryPasswordText = newPassword;
      client.isTemporaryPassword = true;
    }
    let profileBefore = null;
    if (profile && typeof profile === 'object') {
      const { value, errors } = sanitizeProfile(profile);
      const current = client.toObject().profile || {};
      const merged = { ...current, ...value };
      errors.push(...profileDateErrors(merged));
      if (errors.length) return res.status(400).json({ success: false, message: errors.join(', ') });
      profileBefore = profileAuditSnapshot(current);
      for (const [key, val] of Object.entries(value)) client.set(`profile.${key}`, val === null ? undefined : val);
    }
    let agreementResignRequired = false;
    if (agreementDetails) {
      const before = client.toObject().agreementDetails;
      client.agreementDetails = { ...client.agreementDetails, ...agreementDetails };
      // New/changed terms → the client must review and sign the agreement again
      if (agreementDetailsChanged(before, client.toObject().agreementDetails)) {
        client.agreementVersion = nextAgreementVersion(client);
        agreementResignRequired = true;
      }
    }

    await client.save();
    if (profileBefore) {
      const after = profileAuditSnapshot(client.toObject().profile);
      if (JSON.stringify(profileBefore) !== JSON.stringify(after)) {
        await recordAudit(req, 'CLIENT_PROFILE_UPDATE', 'Client', client.clientId, profileBefore, after);
      }
    }
    if (agreementResignRequired) await notifyAgreementUpdated(client._id);

    res.json({ success: true, message: 'Client updated successfully', agreementResignRequired });
  } catch (error) {
    logger.error('Admin update client error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── Service status: hold / release (manual, client decision Oct 2026) ───────

router.post('/clients/:id/hold', crm('clients', 'edit'), async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid client ID' });
    if (!clientAllowed(req, req.params.id)) return outOfScope(res, 'Client');
    const reason = String(req.body.reason || '').trim();
    if (reason.length < 5) return res.status(400).json({ success: false, message: 'Give a reason the client will see (at least 5 characters).' });
    const client = await Client.findById(req.params.id);
    if (!client || client.deletedAt) return outOfScope(res, 'Client');
    if (client.serviceStatus === 'Hold') return res.status(409).json({ success: false, message: 'This client is already on hold.' });
    const name = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ').trim() || req.user.email;
    client.serviceStatus = 'Hold';
    client.holdReason = reason.slice(0, 500);
    client.holdSince = new Date();
    client.holdSource = 'manual';
    client.holdBy = req.user._id;
    client.holdByName = name;
    await client.save();
    await recordAudit(req, 'CLIENT_HOLD', 'Client', client.clientId, { serviceStatus: 'Active' }, { serviceStatus: 'Hold', reason: client.holdReason });
    await notifyAccountHold(client._id, client.holdReason);
    res.json({ success: true, message: `${client.businessName} is on hold` });
  } catch (error) {
    logger.error('Admin hold client error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/clients/:id/release', crm('clients', 'edit'), async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid client ID' });
    if (!clientAllowed(req, req.params.id)) return outOfScope(res, 'Client');
    const client = await Client.findById(req.params.id);
    if (!client || client.deletedAt) return outOfScope(res, 'Client');
    if (client.serviceStatus !== 'Hold') return res.status(409).json({ success: false, message: 'This client is not on hold.' });
    const before = { serviceStatus: 'Hold', reason: client.holdReason };
    client.serviceStatus = 'Active';
    client.holdReason = undefined;
    client.holdSince = undefined;
    client.holdSource = undefined;
    client.holdBy = undefined;
    client.holdByName = undefined;
    await client.save();
    await recordAudit(req, 'CLIENT_RELEASE', 'Client', client.clientId, before, { serviceStatus: 'Active' });
    await notifyAccountReleased(client._id);
    res.json({ success: true, message: `${client.businessName} is active again` });
  } catch (error) {
    logger.error('Admin release client error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── Offboard / onboard again: the engagement ended ("In-Active" in the register) ──
// Login stays open (they can still see and pay invoices); retainers are not touched.

router.post('/clients/:id/offboard', crm('clients', 'edit'), async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid client ID' });
    if (!clientAllowed(req, req.params.id)) return outOfScope(res, 'Client');
    const reason = String(req.body.reason || '').trim();
    if (reason.length < 5) return res.status(400).json({ success: false, message: 'Give the reason for offboarding (at least 5 characters).' });
    const client = await Client.findById(req.params.id);
    if (!client || client.deletedAt) return outOfScope(res, 'Client');
    if (client.offboardedAt) return res.status(409).json({ success: false, message: 'This client is already offboarded.' });
    client.offboardedAt = new Date();
    client.offboardReason = reason.slice(0, 500);
    client.offboardedBy = req.user._id;
    client.offboardedByName = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ').trim() || req.user.email;
    await client.save();
    const activeRetainers = await Retainer.countDocuments({ client_ref: client._id, status: 'Active' });
    await recordAudit(req, 'CLIENT_OFFBOARD', 'Client', client.clientId, null, { reason: client.offboardReason, activeRetainers });
    res.json({
      success: true,
      message: activeRetainers
        ? `${client.businessName} is offboarded. ${activeRetainers} retainer${activeRetainers === 1 ? ' is' : 's are'} still Active — end ${activeRetainers === 1 ? 'it' : 'them'} in Retainers so no new invoices are drafted.`
        : `${client.businessName} is offboarded`,
      activeRetainers,
    });
  } catch (error) {
    logger.error('Admin offboard client error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/clients/:id/onboard-again', crm('clients', 'edit'), async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid client ID' });
    if (!clientAllowed(req, req.params.id)) return outOfScope(res, 'Client');
    const client = await Client.findById(req.params.id);
    if (!client || client.deletedAt) return outOfScope(res, 'Client');
    if (!client.offboardedAt) return res.status(409).json({ success: false, message: 'This client is not offboarded.' });
    const before = { offboardedAt: client.offboardedAt, reason: client.offboardReason };
    client.offboardedAt = undefined;
    client.offboardReason = undefined;
    client.offboardedBy = undefined;
    client.offboardedByName = undefined;
    await client.save();
    await recordAudit(req, 'CLIENT_ONBOARD_AGAIN', 'Client', client.clientId, before, null);
    res.json({ success: true, message: `${client.businessName} is active again` });
  } catch (error) {
    logger.error('Admin onboard-again client error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─── Account status: suspend / reactivate / archive / restore / delete ───────

const cleanReason = (r) => (typeof r === 'string' ? r.trim().slice(0, 500) : '');

// Suspended = isActive false. Bumping tokenVersion signs the client out of
// every device at once (clientAuthMiddleware), and keeps old sessions dead
// after a later reactivation.
function applySuspension(client, suspend, adminId, reason = '') {
  if (suspend) {
    client.isActive = false;
    client.suspendedAt = new Date();
    client.suspendedBy = adminId;
    client.suspensionReason = reason || undefined;
    client.tokenVersion = (client.tokenVersion || 0) + 1;
  } else {
    client.isActive = true;
    client.suspendedAt = undefined;
    client.suspendedBy = undefined;
    client.suspensionReason = undefined;
  }
}

const auditSnapshot = (c) => ({
  clientId: c.clientId, businessName: c.businessName, email: c.email, isActive: c.isActive,
  suspendedAt: c.suspendedAt, suspensionReason: c.suspensionReason,
  deletedAt: c.deletedAt, deletionReason: c.deletionReason,
});

async function auditClient(req, action, client, before) {
  try {
    await AuditLog.create({
      adminId: req.user._id,
      action,
      resource: 'Client',
      beforeSnapshot: before,
      afterSnapshot: auditSnapshot(client),
      ipAddress: req.ip,
    });
  } catch (err) {
    logger.error(`Audit log failed (${action}):`, err.message);
  }
}

async function linkedRecordCounts(clientId) {
  const [invoices, payments, projects, retainers, tickets] = await Promise.all([
    Invoice.countDocuments({ client_ref: clientId }),
    PaymentProof.countDocuments({ client_ref: clientId }),
    Project.countDocuments({ client_ref: clientId }),
    Retainer.countDocuments({ client_ref: clientId }),
    SupportTicket.countDocuments({ client_ref: clientId }),
  ]);
  return { invoices, payments, projects, retainers, tickets, total: invoices + payments + projects + retainers + tickets };
}

const loadClient = async (req, res) => {
  if (!isValidId(req.params.id)) {
    res.status(400).json({ success: false, message: 'Invalid client ID' });
    return null;
  }
  const client = await Client.findById(req.params.id);
  if (!client) res.status(404).json({ success: false, message: 'Client not found' });
  return client;
};

/**
 * @route  POST /api/admin/clients/:id/suspend   { reason? }
 * @desc   Block portal access (signs the client out everywhere). Reversible.
 */
router.post('/clients/:id/suspend', requirePermission('cms.manage'), async (req, res) => {
  try {
    const client = await loadClient(req, res);
    if (!client) return;
    if (client.deletedAt) return res.status(400).json({ success: false, message: 'This account is archived.' });
    if (!client.isActive) return res.status(400).json({ success: false, message: 'This account is already suspended.' });

    const before = auditSnapshot(client);
    applySuspension(client, true, req.user._id, cleanReason(req.body.reason));
    await client.save();
    await auditClient(req, 'CLIENT_SUSPEND', client, before);
    res.json({ success: true, message: `${client.businessName} has been suspended` });
  } catch (error) {
    logger.error('Admin suspend client error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @route  POST /api/admin/clients/:id/reactivate
 */
router.post('/clients/:id/reactivate', requirePermission('cms.manage'), async (req, res) => {
  try {
    const client = await loadClient(req, res);
    if (!client) return;
    if (client.deletedAt) return res.status(400).json({ success: false, message: 'This account is archived. Restore it first.' });
    if (client.isActive) return res.status(400).json({ success: false, message: 'This account is already active.' });

    const before = auditSnapshot(client);
    applySuspension(client, false, req.user._id);
    await client.save();
    await auditClient(req, 'CLIENT_REACTIVATE', client, before);
    res.json({ success: true, message: `${client.businessName} has been reactivated` });
  } catch (error) {
    logger.error('Admin reactivate client error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @route  GET /api/admin/clients/:id/linked-records
 * @desc   What is attached to this client (decides if permanent delete is allowed)
 */
router.get('/clients/:id/linked-records', requirePermission('*'), async (req, res) => {
  try {
    const client = await loadClient(req, res);
    if (!client) return;
    res.json({ success: true, data: await linkedRecordCounts(client._id) });
  } catch (error) {
    logger.error('Admin client linked-records error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @route  DELETE /api/admin/clients/:id   { reason? }
 * @desc   Archive ("delete") the account — Super Admin only. Login blocked,
 *         hidden from lists, all invoices/projects/tickets kept. Restorable.
 */
router.delete('/clients/:id', requirePermission('*'), async (req, res) => {
  try {
    const client = await loadClient(req, res);
    if (!client) return;
    if (client.deletedAt) return res.status(400).json({ success: false, message: 'This account is already archived.' });

    const before = auditSnapshot(client);
    client.deletedAt = new Date();
    client.deletedBy = req.user._id;
    client.deletionReason = cleanReason(req.body?.reason) || undefined;
    client.isActive = false;
    client.tokenVersion = (client.tokenVersion || 0) + 1; // signed out everywhere
    client.refreshToken = undefined;
    await client.save();
    await auditClient(req, 'CLIENT_ARCHIVE', client, before);
    res.json({ success: true, message: `${client.businessName} has been deleted (archived). Their records are kept and the account can be restored.` });
  } catch (error) {
    logger.error('Admin archive client error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @route  POST /api/admin/clients/:id/restore
 * @desc   Bring an archived account back — it returns SUSPENDED, so portal
 *         access is only given back by an explicit Reactivate.
 */
router.post('/clients/:id/restore', requirePermission('*'), async (req, res) => {
  try {
    const client = await loadClient(req, res);
    if (!client) return;
    if (!client.deletedAt) return res.status(400).json({ success: false, message: 'This account is not archived.' });

    const before = auditSnapshot(client);
    client.deletedAt = undefined;
    client.deletedBy = undefined;
    client.deletionReason = undefined;
    client.isActive = false;
    client.suspendedAt = new Date();
    client.suspendedBy = req.user._id;
    client.suspensionReason = 'Restored from archive';
    await client.save();
    await auditClient(req, 'CLIENT_RESTORE', client, before);
    res.json({ success: true, message: `${client.businessName} has been restored as Suspended. Reactivate it to give portal access.` });
  } catch (error) {
    logger.error('Admin restore client error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @route  DELETE /api/admin/clients/:id/permanent   { confirm: <clientId> }
 * @desc   Irreversible. Only for an ARCHIVED client with no invoices,
 *         payments, projects, retainers or tickets (financial records must
 *         never be orphaned or lost).
 */
router.delete('/clients/:id/permanent', requirePermission('*'), async (req, res) => {
  try {
    const client = await loadClient(req, res);
    if (!client) return;
    if (!client.deletedAt) {
      return res.status(400).json({ success: false, message: 'Delete (archive) the account first.' });
    }
    if (!req.body?.confirm || req.body.confirm !== client.clientId) {
      return res.status(400).json({ success: false, message: `Type the Client ID (${client.clientId}) to confirm.` });
    }
    const linked = await linkedRecordCounts(client._id);
    if (linked.total > 0) {
      return res.status(409).json({
        success: false,
        message: 'This client has invoices, payments, projects, retainers or tickets, so it can only stay archived.',
        data: linked,
      });
    }

    const before = auditSnapshot(client);
    await ClientNotification.deleteMany({ client: client._id });
    await Client.deleteOne({ _id: client._id });
    await auditClient(req, 'CLIENT_DELETE_PERMANENT', { ...before, deletedAt: new Date() }, before);
    res.json({ success: true, message: `${before.businessName} was permanently deleted` });
  } catch (error) {
    logger.error('Admin permanent delete client error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ONBOARDING CHECKLIST + GO-LIVE GATE
// ══════════════════════════════════════════════════════════════════════════════

const checklistView = (doc, now = new Date()) => {
  const obj = doc.toObject();
  const items = obj.items.map((i) => ({ ...i, overdue: onboarding.isItemOverdue(i, now) }));
  const blockers = onboarding.launchBlockers(items, now);
  return {
    _id: obj._id,
    client_ref: obj.client_ref,
    scope: obj.scope,
    items,
    blockers,
    readyForGoLive: blockers.length === 0,
    goLive: obj.goLive,
    summary: {
      total: items.length,
      done: items.filter((i) => onboarding.DONE.includes(i.status)).length,
      blocked: items.filter((i) => i.status === 'Blocked').length,
      overdue: items.filter((i) => i.overdue).length,
    },
  };
};

// Loads the client's checklist after the id + client-scope checks every route needs
async function loadChecklist(req, res) {
  if (!isValidId(req.params.id)) { res.status(400).json({ success: false, message: 'Invalid client ID' }); return null; }
  if (!clientAllowed(req, req.params.id)) { outOfScope(res, 'Client'); return null; }
  const doc = await onboarding.getOrCreateChecklist(req.params.id);
  if (!doc) { outOfScope(res, 'Client'); return null; }
  return doc;
}

router.get('/clients/:id/onboarding', crm('clients', 'view'), async (req, res) => {
  try {
    const doc = await loadChecklist(req, res);
    if (!doc) return;
    // Pick up steps for services/platforms added to the profile since the list was built
    if (!doc.goLive.isLive) await onboarding.syncChecklist(doc);
    res.json({ success: true, data: checklistView(doc) });
  } catch (error) {
    logger.error('Admin get onboarding error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/clients/:id/onboarding/items/:key', crm('clients', 'edit'), async (req, res) => {
  try {
    const doc = await loadChecklist(req, res);
    if (!doc) return;
    const item = doc.items.find((i) => i.key === req.params.key);
    if (!item) return res.status(404).json({ success: false, message: 'Checklist step not found' });

    const { value, errors } = onboarding.validateItemUpdate(item.toObject(), req.body);
    if (errors.length) return res.status(400).json({ success: false, message: errors.join('. ') });

    const snap = () => ({ status: item.status, owner: item.owner ? String(item.owner) : null, dueDate: item.dueDate || null, remarks: item.remarks || '', clientMessage: item.clientMessage || '' });
    const before = snap();
    item.set(value);
    if (value.status === 'Completed' && !item.completedAt) item.completedAt = new Date();
    if (value.status && value.status !== 'Completed') item.completedAt = undefined;
    if (value.status && value.status !== 'Blocked') item.blocker = undefined;
    if (value.status && value.status !== 'Not Applicable') item.naReason = undefined;
    item.updatedBy = req.user._id;
    item.updatedAt = new Date();
    await doc.save();

    await recordAudit(req, 'ONBOARDING_ITEM_UPDATE', 'OnboardingChecklist', `${req.params.id}:${item.key}`, before, snap());
    // A new or changed request to the client is worth a notification (it also appears on their Overview)
    if (item.clientMessage && item.clientMessage !== before.clientMessage && !onboarding.DONE.includes(item.status)) {
      await notifyOnboardingRequest(req.params.id, item.label, item.clientMessage);
    }
    res.json({ success: true, message: 'Step updated', data: checklistView(doc) });
  } catch (error) {
    logger.error('Admin update onboarding item error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/clients/:id/onboarding/go-live', crm('clients', 'edit'), async (req, res) => {
  try {
    const doc = await loadChecklist(req, res);
    if (!doc) return;
    if (doc.goLive.isLive) return res.status(409).json({ success: false, message: 'This campaign is already marked live.' });

    // Client decision: Admins, and Project Managers who have access to this client's assets.
    // Route access (clients edit + client scope) is already enforced above.
    const isProjectManager = (req.user.roles || []).some((r) => /project\s*manager/i.test(r?.name || ''));
    const canAuthoriseException = !!req.user.permissions?.includes('*')
      || hasBaseAccess(req.user, 'clients', 'edit')
      || isProjectManager;
    const decision = onboarding.evaluateGoLive(doc.items.map((i) => i.toObject()), { exception: req.body.exception, canAuthoriseException });
    if (!decision.allowed) {
      return res.status(409).json({
        success: false,
        message: decision.error || `Campaign cannot go live: ${decision.blockers.length} launch-critical step(s) incomplete.`,
        blockers: decision.blockers,
      });
    }

    const links = Array.isArray(req.body.platformLinks) ? req.body.platformLinks.map((l) => String(l).trim()).filter(Boolean).slice(0, 20) : [];
    doc.goLive.isLive = true;
    doc.goLive.liveDate = req.body.liveDate && !Number.isNaN(new Date(req.body.liveDate).getTime()) ? new Date(req.body.liveDate) : new Date();
    doc.goLive.liveBy = req.user._id;
    doc.goLive.platformLinks = links;
    if (decision.exception) {
      doc.goLive.exception = { ...decision.exception, authorisedBy: req.user._id, authorisedAt: new Date() };
    }
    await doc.save();

    // Keep the client profile's ad-account-live date in step with the go-live
    await Client.updateOne({ _id: req.params.id, 'profile.adAccountLiveDate': { $exists: false } }, { $set: { 'profile.adAccountLiveDate': doc.goLive.liveDate } });

    await recordAudit(req, decision.exception ? 'CAMPAIGN_GO_LIVE_EXCEPTION' : 'CAMPAIGN_GO_LIVE', 'OnboardingChecklist', req.params.id,
      { isLive: false }, { isLive: true, liveDate: doc.goLive.liveDate, exception: decision.exception || null, platformLinks: links });
    res.json({ success: true, message: decision.exception ? 'Campaign marked live with a logged exception.' : 'Campaign marked live.', data: checklistView(doc) });
  } catch (error) {
    logger.error('Admin go-live error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// CAMPAIGN STRATEGY NOTES (versioned; the client sees only versions approved for sharing)
// ══════════════════════════════════════════════════════════════════════════════

const strategyClientCheck = (req, res) => {
  if (!isValidId(req.params.id)) { res.status(400).json({ success: false, message: 'Invalid client ID' }); return false; }
  if (!clientAllowed(req, req.params.id)) { outOfScope(res, 'Client'); return false; }
  return true;
};

router.get('/clients/:id/strategy', crm('clients', 'view'), async (req, res) => {
  try {
    if (!strategyClientCheck(req, res)) return;
    const versions = await CampaignStrategy.find({ client_ref: req.params.id }).sort({ version: -1 }).lean();
    // Say what each version changed relative to the one before it
    const data = versions.map((v, i) => ({ ...v, changedFields: strategy.changedFields(versions[i + 1], v) }));
    res.json({ success: true, data });
  } catch (error) {
    logger.error('Admin get strategy error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/clients/:id/strategy', crm('clients', 'edit'), async (req, res) => {
  try {
    if (!strategyClientCheck(req, res)) return;
    if (!(await Client.exists({ _id: req.params.id }))) return outOfScope(res, 'Client');
    const result = await strategy.saveNewVersion(req.params.id, req.body, req.user);
    if (!result.ok) return res.status(result.status).json({ success: false, message: result.message });
    await recordAudit(req, 'STRATEGY_VERSION_CREATE', 'CampaignStrategy', `${req.params.id}:v${result.doc.version}`,
      result.previous ? { version: result.previous.version } : null,
      { version: result.doc.version, changedFields: strategy.changedFields(result.previous, result.doc), changeNote: result.doc.changeNote || '' });
    res.status(201).json({ success: true, message: `Saved as version ${result.doc.version}`, data: result.doc });
  } catch (error) {
    logger.error('Admin save strategy error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/clients/:id/strategy/:version/share', crm('clients', 'edit'), async (req, res) => {
  try {
    if (!strategyClientCheck(req, res)) return;
    const version = Number(req.params.version);
    const share = req.body.shared !== false;
    const doc = await CampaignStrategy.findOne({ client_ref: req.params.id, version });
    if (!doc) return res.status(404).json({ success: false, message: 'Strategy version not found' });
    if (doc.sharedWithClient === share) return res.json({ success: true, message: share ? 'Already shared with the client' : 'Already hidden from the client', data: doc });

    const name = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ').trim() || req.user.email;
    doc.sharedWithClient = share;
    doc.sharedBy = share ? req.user._id : undefined;
    doc.sharedByName = share ? name : undefined;
    doc.sharedAt = share ? new Date() : undefined;
    await doc.save();
    await recordAudit(req, share ? 'STRATEGY_SHARE' : 'STRATEGY_UNSHARE', 'CampaignStrategy', `${req.params.id}:v${version}`,
      { sharedWithClient: !share }, { sharedWithClient: share });
    res.json({ success: true, message: share ? `Version ${version} is now visible to the client` : `Version ${version} hidden from the client`, data: doc });
  } catch (error) {
    logger.error('Admin share strategy error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// AD PERFORMANCE — manually entered Daily Tracker rows (client decision Oct 2026)
// ══════════════════════════════════════════════════════════════════════════════

const adQuery = (req) => ({ period: req.query.period, from: req.query.from, to: req.query.to, group: req.query.group, platform: req.query.platform });
const adSnap = (r) => ({ day: r.day, platform: r.platform, campaignName: r.campaignName, spend: r.spend, impressions: r.impressions, clicks: r.clicks, results: r.results, revenue: r.revenue ?? null, hidden: !!r.hidden });

async function adClient(req, res) {
  if (!isValidId(req.params.id)) { res.status(400).json({ success: false, message: 'Invalid client ID' }); return null; }
  if (!clientAllowed(req, req.params.id)) { outOfScope(res, 'Client'); return null; }
  const client = await Client.findById(req.params.id).select('profile.monthlyAdBudget businessName clientId').lean();
  if (!client) { outOfScope(res, 'Client'); return null; }
  return client;
}

router.get('/clients/:id/ad-performance', crm('clients', 'view'), async (req, res) => {
  try {
    const client = await adClient(req, res);
    if (!client) return;
    const data = await adPerformance.report(client._id, { ...adQuery(req), monthlyAdBudget: client.profile?.monthlyAdBudget });
    if (!data) return res.status(400).json({ success: false, message: 'Choose a valid date range (up to one year).' });
    res.json({ success: true, data });
  } catch (error) {
    logger.error('Admin ad performance error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/clients/:id/ad-performance/export.csv', crm('clients', 'view'), async (req, res) => {
  try {
    const client = await adClient(req, res);
    if (!client) return;
    const data = await adPerformance.report(client._id, adQuery(req));
    if (!data) return res.status(400).json({ success: false, message: 'Choose a valid date range (up to one year).' });
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="ad-performance-${client.clientId}-${data.current.from}-to-${data.current.to}.csv"`, 'Cache-Control': 'private, no-store' });
    res.send(adPerformance.toCsv(data.rows, { internal: true }));
  } catch (error) {
    logger.error('Admin ad performance export error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/clients/:id/ad-performance', crm('clients', 'edit'), async (req, res) => {
  try {
    const client = await adClient(req, res);
    if (!client) return;
    const { value, error } = adPerformance.validateRow(req.body);
    if (error) return res.status(400).json({ success: false, message: error });
    const name = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ').trim() || req.user.email;
    let row;
    try {
      row = await AdPerformance.create({ ...value, client_ref: client._id, enteredBy: req.user._id, enteredByName: name, updatedBy: req.user._id });
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ success: false, message: 'This day already has a row for that platform, campaign and creative — edit it instead.' });
      throw err;
    }
    await recordAudit(req, 'AD_PERFORMANCE_CREATE', 'AdPerformance', String(row._id), null, adSnap(row));
    res.status(201).json({ success: true, message: 'Entry saved', data: row });
  } catch (error) {
    logger.error('Admin ad performance create error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/clients/:id/ad-performance/:rowId', crm('clients', 'edit'), async (req, res) => {
  try {
    const client = await adClient(req, res);
    if (!client) return;
    if (!isValidId(req.params.rowId)) return res.status(400).json({ success: false, message: 'Invalid entry ID' });
    const row = await AdPerformance.findOne({ _id: req.params.rowId, client_ref: client._id });
    if (!row) return res.status(404).json({ success: false, message: 'Entry not found' });
    const before = adSnap(row);
    const { value, error } = adPerformance.validateRow(req.body, row.toObject());
    if (error) return res.status(400).json({ success: false, message: error });
    row.set({ ...value, updatedBy: req.user._id });
    try {
      await row.save();
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ success: false, message: 'Another entry already exists for that day, platform, campaign and creative.' });
      throw err;
    }
    await recordAudit(req, 'AD_PERFORMANCE_UPDATE', 'AdPerformance', String(row._id), before, adSnap(row));
    res.json({ success: true, message: 'Entry updated', data: row });
  } catch (error) {
    logger.error('Admin ad performance update error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/clients/:id/ad-performance/:rowId', crm('clients', 'edit'), async (req, res) => {
  try {
    const client = await adClient(req, res);
    if (!client) return;
    if (!isValidId(req.params.rowId)) return res.status(400).json({ success: false, message: 'Invalid entry ID' });
    const row = await AdPerformance.findOneAndDelete({ _id: req.params.rowId, client_ref: client._id });
    if (!row) return res.status(404).json({ success: false, message: 'Entry not found' });
    await recordAudit(req, 'AD_PERFORMANCE_DELETE', 'AdPerformance', String(row._id), adSnap(row), null);
    res.json({ success: true, message: 'Entry deleted' });
  } catch (error) {
    logger.error('Admin ad performance delete error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// RECURRING INVOICES — per-client billing schedule + admin approval of scheduled drafts
// ══════════════════════════════════════════════════════════════════════════════

const draftView = (d) => ({
  _id: d._id, client: d.client_ref, invoiceDate: d.invoiceDate, periodStart: d.periodStart, periodEnd: d.periodEnd, dueDate: d.dueDate,
  lineItems: d.lineItems, subtotal: d.subtotal, taxPercent: d.taxPercent, taxAmount: d.taxAmount, totalAmount: d.totalAmount,
  status: d.status, problems: d.problems, note: d.note || '', corrected: !!d.corrected,
  decidedByName: d.decidedByName || null, decidedAt: d.decidedAt || null, skipReason: d.skipReason || '', invoice_ref: d.invoice_ref || null,
});
const draftSnap = (d) => ({ invoiceDate: d.invoiceDate, status: d.status, totalAmount: d.totalAmount, lineItems: (d.lineItems || []).map((i) => ({ description: i.description, amount: i.amount })), dueDate: d.dueDate });

router.get('/clients/:id/billing-schedule', crm('invoices', 'view'), async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid client ID' });
    if (!clientAllowed(req, req.params.id)) return outOfScope(res, 'Client');
    const client = await Client.findById(req.params.id).select('profile.onboardingDate').lean();
    if (!client) return outOfScope(res, 'Client');
    const [schedule, policy] = await Promise.all([BillingSchedule.findOne({ client_ref: req.params.id }).lean(), clientPolicies.getBilling()]);
    const today = adPerformance.dayOf(new Date());
    res.json({
      success: true,
      data: {
        schedule,
        suggestedStartDate: billingSchedule.suggestStartDate(client.profile?.onboardingDate),
        defaultDueDays: policy.defaultDueDays,
        upcoming: schedule ? billingSchedule.upcomingDates(schedule, today, 4).map((d) => ({ invoiceDate: d, ...billingSchedule.periodFor(schedule, d) })) : [],
        // Scheduled dates that have passed with no draft or invoice — staff can create their drafts now
        missed: schedule ? (await billingSchedule.missedDates(schedule)).map((d) => ({ invoiceDate: d, ...billingSchedule.periodFor(schedule, d) })) : [],
      },
    });
  } catch (error) {
    logger.error('Admin get billing schedule error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/clients/:id/billing-schedule', crm('invoices', 'edit'), async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid client ID' });
    if (!clientAllowed(req, req.params.id)) return outOfScope(res, 'Client');
    if (!(await Client.exists({ _id: req.params.id, deletedAt: null }))) return outOfScope(res, 'Client');
    const policy = await clientPolicies.getBilling();
    const { value, error } = billingSchedule.validateSchedule(req.body, policy.defaultDueDays);
    if (error) return res.status(400).json({ success: false, message: error });
    const before = await BillingSchedule.findOne({ client_ref: req.params.id }).lean();
    const schedule = await BillingSchedule.findOneAndUpdate({ client_ref: req.params.id }, { $set: { ...value, updatedBy: req.user._id } }, { upsert: true, new: true });
    const snap = (s) => (s ? { active: s.active, billingDay: s.billingDay, startDate: s.startDate, dueDays: s.dueDays } : null);
    await recordAudit(req, 'BILLING_SCHEDULE_UPDATE', 'BillingSchedule', req.params.id, snap(before), snap(schedule));
    res.json({ success: true, message: schedule.active ? 'Billing schedule saved and switched on' : 'Billing schedule saved (switched off)', data: schedule });
  } catch (error) {
    logger.error('Admin save billing schedule error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/clients/:id/billing-schedule/draft', crm('invoices', 'create'), async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid client ID' });
    if (!clientAllowed(req, req.params.id)) return outOfScope(res, 'Client');
    const r = await billingSchedule.createDraftFor(req.params.id, req.body.invoiceDate);
    if (!r.ok) return res.status(r.status).json({ success: false, message: r.message });
    await recordAudit(req, 'INVOICE_DRAFT_CREATE_NOW', 'InvoiceDraft', `${req.params.id}:${r.draft.invoiceDate}`, null, draftSnap(r.draft));
    res.status(201).json({
      success: true,
      message: r.state === 'needAttention' ? 'Draft created, but it needs attention before it can be approved (see Invoices → Awaiting approval).' : 'Draft created — approve it under Invoices → Awaiting approval.',
      data: draftView(r.draft),
    });
  } catch (error) {
    logger.error('Admin create draft now error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/invoice-drafts', crm('invoices', 'view'), async (req, res) => {
  try {
    const filter = {};
    const clientRef = scopedClientRef(req, req.query.client_ref);
    if (clientRef) filter.client_ref = clientRef;
    const status = req.query.status;
    if (status === 'open') filter.status = { $in: ['Pending Approval', 'Needs Attention'] };
    else if (InvoiceDraft.STATUSES.includes(status)) filter.status = status;
    const drafts = await InvoiceDraft.find(filter).populate('client_ref', 'businessName clientId email').sort({ invoiceDate: -1, createdAt: -1 }).limit(200).lean();
    const openCount = await InvoiceDraft.countDocuments({ ...filter, status: { $in: ['Pending Approval', 'Needs Attention'] } });
    res.json({ success: true, data: drafts.map(draftView), openCount });
  } catch (error) {
    logger.error('Admin list invoice drafts error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Loads a draft the person may act on (client scope applies)
async function loadDraft(req, res) {
  if (!isValidId(req.params.id)) { res.status(400).json({ success: false, message: 'Invalid ID' }); return null; }
  const d = await InvoiceDraft.findById(req.params.id).lean();
  if (!d || !clientAllowed(req, d.client_ref)) { outOfScope(res, 'Scheduled invoice'); return null; }
  return d;
}

router.put('/invoice-drafts/:id', crm('invoices', 'edit'), async (req, res) => {
  try {
    const before = await loadDraft(req, res);
    if (!before) return;
    const r = await billingSchedule.editDraft(req.params.id, req.body, req.user);
    if (!r.ok) return res.status(r.status).json({ success: false, message: r.message });
    await recordAudit(req, 'INVOICE_DRAFT_CORRECT', 'InvoiceDraft', `${before.client_ref}:${before.invoiceDate}`, draftSnap(before), draftSnap(r.draft));
    res.json({ success: true, message: r.draft.problems.length ? 'Saved — it still needs attention' : 'Saved — ready to approve', data: draftView(r.draft) });
  } catch (error) {
    logger.error('Admin correct invoice draft error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/invoice-drafts/:id/rebuild', crm('invoices', 'edit'), async (req, res) => {
  try {
    const before = await loadDraft(req, res);
    if (!before) return;
    const r = await billingSchedule.rebuildDraft(req.params.id);
    if (!r.ok) return res.status(r.status).json({ success: false, message: r.message });
    await recordAudit(req, 'INVOICE_DRAFT_REBUILD', 'InvoiceDraft', `${before.client_ref}:${before.invoiceDate}`, draftSnap(before), draftSnap(r.draft));
    res.json({ success: true, message: 'Rebuilt from the current retainers', data: draftView(r.draft) });
  } catch (error) {
    logger.error('Admin rebuild invoice draft error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/invoice-drafts/:id/approve', crm('invoices', 'create'), async (req, res) => {
  try {
    const before = await loadDraft(req, res);
    if (!before) return;
    const r = await billingSchedule.approveDraft(req.params.id, req.user);
    if (!r.ok) return res.status(r.status).json({ success: false, message: r.message });
    await recordAudit(req, 'INVOICE_DRAFT_APPROVE', 'InvoiceDraft', `${before.client_ref}:${before.invoiceDate}`, draftSnap(before),
      { ...draftSnap(r.draft), invoiceId: r.invoice.invoiceId, corrected: !!r.draft.corrected });
    res.json({ success: true, message: `Invoice ${r.invoice.invoiceId} created. Add its billing details and send it from Invoices.`, data: { invoiceId: r.invoice.invoiceId, _id: r.invoice._id } });
  } catch (error) {
    logger.error('Admin approve invoice draft error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/invoice-drafts/:id/skip', crm('invoices', 'edit'), async (req, res) => {
  try {
    const before = await loadDraft(req, res);
    if (!before) return;
    const r = await billingSchedule.skipDraft(req.params.id, req.body.reason, req.user);
    if (!r.ok) return res.status(r.status).json({ success: false, message: r.message });
    await recordAudit(req, 'INVOICE_DRAFT_SKIP', 'InvoiceDraft', `${before.client_ref}:${before.invoiceDate}`, draftSnap(before), { ...draftSnap(r.draft), reason: r.draft.skipReason });
    res.json({ success: true, message: 'Skipped', data: draftView(r.draft) });
  } catch (error) {
    logger.error('Admin skip invoice draft error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create any drafts that are due, now (the same pass the daily job runs). Needs access to all clients.
router.post('/invoice-drafts-run', crm('invoices', 'create'), async (req, res) => {
  try {
    if (isScoped(req)) return res.status(403).json({ success: false, message: 'This needs access to all clients.' });
    res.json({ success: true, ...(await billingSchedule.generateDrafts()) });
  } catch (error) {
    logger.error('Admin generate invoice drafts error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// WON LEADS WITHOUT A CLIENT ACCOUNT — why creation failed, and the ways to fix it
// ══════════════════════════════════════════════════════════════════════════════

const issueView = (i) => ({
  _id: i._id, status: i.status, reasons: i.reasons, attempts: i.attempts, lastAttemptAt: i.lastAttemptAt, source: i.source,
  lead: i.lead_ref && { _id: i.lead_ref._id, fullName: i.lead_ref.fullName, businessName: i.lead_ref.businessName, email: i.lead_ref.email, phone: i.lead_ref.phone, dealCloseValue: i.lead_ref.dealCloseValue },
  existingClient: i.existingClient && { _id: i.existingClient._id, clientId: i.existingClient.clientId, businessName: i.existingClient.businessName, deleted: !!i.existingClient.deletedAt, linkedToLead: !!i.existingClient.leadRef },
  resolvedAt: i.resolvedAt || null, resolvedByName: i.resolvedByName || null, resolution: i.resolution || '',
});

// Creating accounts needs access to every client, like creating one by hand
const needAllClients = (req, res) => {
  if (!isScoped(req)) return true;
  res.status(403).json({ success: false, message: 'This needs access to all clients.' });
  return false;
};

async function loadIssue(req, res) {
  if (!isValidId(req.params.id)) { res.status(400).json({ success: false, message: 'Invalid ID' }); return null; }
  const issue = await ClientCreationIssue.findById(req.params.id);
  if (!issue) { res.status(404).json({ success: false, message: 'Not found' }); return null; }
  return issue;
}
const populateIssue = (q) => q.populate('lead_ref', 'fullName businessName email phone dealCloseValue').populate('existingClient', 'clientId businessName deletedAt leadRef');

router.get('/client-creation-issues', crm('clients', 'view'), async (req, res) => {
  try {
    if (!needAllClients(req, res)) return;
    const status = ['Open', 'Resolved', 'Dismissed'].includes(req.query.status) ? req.query.status : 'Open';
    const [rows, openCount] = await Promise.all([
      populateIssue(ClientCreationIssue.find({ status }).sort({ lastAttemptAt: -1 }).limit(200)).lean(),
      ClientCreationIssue.countDocuments({ status: 'Open' }),
    ]);
    res.json({ success: true, data: rows.map(issueView), openCount });
  } catch (error) {
    logger.error('Admin list client creation issues error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Find Won leads that never got an account (e.g. from before this existed) and record why
router.post('/client-creation-issues/scan', crm('clients', 'create'), async (req, res) => {
  try {
    if (!needAllClients(req, res)) return;
    const result = await clientCreationIssues.scanWonLeads();
    await recordAudit(req, 'CLIENT_CREATION_SCAN', 'ClientCreationIssue', 'scan', null, result);
    res.json({ success: true, ...result, openCount: await ClientCreationIssue.countDocuments({ status: 'Open' }) });
  } catch (error) {
    logger.error('Admin scan won leads error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Try again with the lead's current details (after someone corrected the lead)
router.post('/client-creation-issues/:id/retry', crm('clients', 'create'), async (req, res) => {
  try {
    if (!needAllClients(req, res)) return;
    const issue = await loadIssue(req, res);
    if (!issue) return;
    if (issue.status !== 'Open') return res.status(409).json({ success: false, message: `This issue is already ${issue.status.toLowerCase()}.` });
    const lead = await Lead.findById(issue.lead_ref).lean();
    if (!lead || lead.status !== 'Won') return res.status(409).json({ success: false, message: 'This lead is no longer Won.' });
    const client = await convertWonLeadToClient(lead, req.user._id, { source: 'retry' });
    await recordAudit(req, 'CLIENT_CREATION_RETRY', 'ClientCreationIssue', String(issue.lead_ref), null, { created: !!client, clientId: client?.clientId });
    const fresh = await populateIssue(ClientCreationIssue.findById(issue._id)).lean();
    if (client) return res.json({ success: true, created: true, message: `Client account ${client.clientId} created`, data: issueView(fresh) });
    res.json({ success: true, created: false, message: 'Still not possible — see the reasons below.', data: issueView(fresh) });
  } catch (error) {
    logger.error('Admin retry client creation error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create the account with corrected details (the lead's own record is left as it is)
router.post('/client-creation-issues/:id/create', crm('clients', 'create'), async (req, res) => {
  try {
    if (!needAllClients(req, res)) return;
    const issue = await loadIssue(req, res);
    if (!issue) return;
    if (issue.status !== 'Open') return res.status(409).json({ success: false, message: `This issue is already ${issue.status.toLowerCase()}.` });
    const lead = await Lead.findById(issue.lead_ref).lean();
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
    if (await Client.exists({ leadRef: lead._id })) return res.status(409).json({ success: false, message: 'This lead already has a client account.' });

    const details = clientCreationIssues.detailsFromLead(lead, req.body || {});
    const { reasons } = await clientCreationIssues.diagnose(details);
    if (reasons.length) return res.status(400).json({ success: false, message: reasons.map((r) => r.message).join(' '), reasons });

    const client = await provisionClientAccount({ ...details, leadRef: lead._id, createdBy: req.user._id });
    await Lead.updateOne({ _id: lead._id }, { $push: { pipelineHistory: { status: 'Converted to Client', date: new Date(), updatedBy: req.user._id, note: `Client account ${client.clientId} created by ${clientCreationIssues.nameOf(req.user)} with corrected details` } } });
    await clientCreationIssues.resolveIssue(lead._id, client, { resolution: `Account ${client.clientId} created with corrected details`, user: req.user });
    await recordAudit(req, 'CLIENT_CREATION_MANUAL', 'ClientCreationIssue', String(lead._id), null, { clientId: client.clientId, email: details.email });
    res.status(201).json({ success: true, message: `Client account ${client.clientId} created and the login details were emailed`, data: { _id: client._id, clientId: client.clientId } });
  } catch (error) {
    logger.error('Admin create client from issue error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// The customer already has an account: attach this lead to it
router.post('/client-creation-issues/:id/link', crm('clients', 'edit'), async (req, res) => {
  try {
    if (!needAllClients(req, res)) return;
    const issue = await loadIssue(req, res);
    if (!issue) return;
    if (issue.status !== 'Open') return res.status(409).json({ success: false, message: `This issue is already ${issue.status.toLowerCase()}.` });
    if (!isValidId(req.body.client_id)) return res.status(400).json({ success: false, message: 'Choose the client to link.' });
    const client = await Client.findById(req.body.client_id);
    if (!client || client.deletedAt) return res.status(404).json({ success: false, message: 'That client account was not found (or is deleted — restore it first).' });
    if (client.leadRef && String(client.leadRef) !== String(issue.lead_ref)) return res.status(409).json({ success: false, message: 'That account is already linked to a different lead.' });
    client.leadRef = issue.lead_ref;
    await client.save();
    await Lead.updateOne({ _id: issue.lead_ref }, { $push: { pipelineHistory: { status: 'Converted to Client', date: new Date(), updatedBy: req.user._id, note: `Linked to existing client account ${client.clientId} by ${clientCreationIssues.nameOf(req.user)}` } } });
    await clientCreationIssues.resolveIssue(issue.lead_ref, client, { resolution: `Linked to existing account ${client.clientId}`, user: req.user });
    await recordAudit(req, 'CLIENT_CREATION_LINK', 'ClientCreationIssue', String(issue.lead_ref), null, { clientId: client.clientId });
    res.json({ success: true, message: `Linked to ${client.clientId}` });
  } catch (error) {
    logger.error('Admin link client from issue error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/client-creation-issues/:id/dismiss', crm('clients', 'edit'), async (req, res) => {
  try {
    if (!needAllClients(req, res)) return;
    const issue = await loadIssue(req, res);
    if (!issue) return;
    const reason = String(req.body.reason || '').trim();
    if (reason.length < 5) return res.status(400).json({ success: false, message: 'Say why no account is needed (at least 5 characters).' });
    if (issue.status !== 'Open') return res.status(409).json({ success: false, message: `This issue is already ${issue.status.toLowerCase()}.` });
    issue.status = 'Dismissed';
    issue.resolvedAt = new Date();
    issue.resolvedBy = req.user._id;
    issue.resolvedByName = clientCreationIssues.nameOf(req.user);
    issue.resolution = reason.slice(0, 500);
    await issue.save();
    await recordAudit(req, 'CLIENT_CREATION_DISMISS', 'ClientCreationIssue', String(issue.lead_ref), null, { reason: issue.resolution });
    res.json({ success: true, message: 'Dismissed' });
  } catch (error) {
    logger.error('Admin dismiss client creation issue error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// KYC REVIEW (GST, PAN, Aadhaar, photo, brand authorisation)
// ══════════════════════════════════════════════════════════════════════════════

const kycRequest = (req, res) => {
  if (!isValidId(req.params.id)) { res.status(400).json({ success: false, message: 'Invalid client ID' }); return false; }
  if (!clientAllowed(req, req.params.id)) { outOfScope(res, 'Client'); return false; }
  if (req.params.item && !kyc.ITEMS.some((i) => i.key === req.params.item)) { res.status(404).json({ success: false, message: 'Unknown KYC item' }); return false; }
  return true;
};

router.get('/clients/:id/kyc', crm('clients', 'view'), async (req, res) => {
  try {
    if (!kycRequest(req, res)) return;
    if (!(await Client.exists({ _id: req.params.id }))) return outOfScope(res, 'Client');
    res.json({ success: true, data: await kyc.adminView(await kyc.getOrCreate(req.params.id)) });
  } catch (error) {
    logger.error('Admin get KYC error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Identity documents need edit access (the people who review them), not just view
router.get('/clients/:id/kyc/:item/file', crm('clients', 'edit'), async (req, res) => {
  try {
    if (!kycRequest(req, res)) return;
    const file = await kyc.readFile(req.params.id, req.params.item);
    if (!file) return res.status(404).json({ success: false, message: 'No document uploaded' });
    await recordAudit(req, 'KYC_DOCUMENT_VIEW', 'ClientKyc', `${req.params.id}:${req.params.item}`, null, { item: req.params.item });
    res.set({
      'Content-Type': file.mimeType,
      'Content-Length': file.size,
      'Content-Disposition': `inline; filename="${encodeURIComponent(file.originalName || 'document')}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    });
    res.send(file.data);
  } catch (error) {
    logger.error('Admin KYC file error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/clients/:id/kyc/:item/review', crm('clients', 'edit'), async (req, res) => {
  try {
    if (!kycRequest(req, res)) return;
    if (!(await Client.exists({ _id: req.params.id }))) return outOfScope(res, 'Client');
    const result = await kyc.reviewItem(req.params.id, req.params.item, { decision: req.body.decision, reason: req.body.reason }, req.user);
    if (!result.ok) return res.status(result.status).json({ success: false, message: result.message });

    const verified = req.body.decision === 'verify';
    await recordAudit(req, verified ? 'KYC_VERIFY' : 'KYC_REJECT', 'ClientKyc', `${req.params.id}:${req.params.item}`,
      { status: 'Submitted' }, { status: verified ? 'Verified' : 'Rejected', reason: verified ? undefined : String(req.body.reason).trim().slice(0, 500) });
    if (verified) await notifyKycVerified(req.params.id, result.item.label, result.becameVerified);
    else await notifyKycRejected(req.params.id, result.item.label, String(req.body.reason).trim());

    res.json({
      success: true,
      message: verified ? `${result.item.label} verified` : `${result.item.label} rejected - the client has been asked to resubmit`,
      data: await kyc.adminView(result.doc),
    });
  } catch (error) {
    logger.error('Admin review KYC error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// INVOICES
// ══════════════════════════════════════════════════════════════════════════════

router.get('/invoices', crm('invoices', 'view'), async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = {};

    const clientRef = scopedClientRef(req, req.query.client_ref);
    if (clientRef) filter.client_ref = clientRef;
    // Overdue is derived from balance + due date, never read from a stored flag
    const now = new Date();
    const status = req.query.status;
    if (status === 'Overdue') Object.assign(filter, finance.overdueFilter(now));
    else if (status === 'Unpaid') Object.assign(filter, finance.unpaidNotOverdueFilter(now));
    else if (status) filter.paymentStatus = status;

    const [invoices, total] = await Promise.all([
      Invoice.find(filter)
        .populate('client_ref', 'businessName contactName email clientId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Invoice.countDocuments(filter),
    ]);

    paginatedResponse(res, { data: invoices.map((inv) => finance.withDerived(inv, now)), total, page, limit });
  } catch (error) {
    logger.error('Admin get invoices error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/invoices/:id', crm('invoices', 'view'), async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid invoice ID' });
    }
    const invoice = await Invoice.findById(req.params.id)
      .populate('client_ref', 'businessName contactName email clientId')
      .lean();
    if (!invoice || !clientAllowed(req, invoice.client_ref)) return outOfScope(res, 'Invoice');
    res.json({ success: true, data: finance.withDerived(invoice) });
  } catch (error) {
    logger.error('Admin get invoice error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Who the invoice is made out to. Blank fields are dropped; a GSTIN / PAN that is
// filled in must be valid. Returns { value } (undefined when nothing was given) or { error }.
function cleanBilling(input) {
  if (!input || typeof input !== 'object') return { value: undefined };
  const value = {};
  for (const key of ['name', 'address', 'phone', 'placeOfSupply']) {
    const v = String(input[key] ?? '').trim();
    if (v) value[key] = v;
  }
  if (value.placeOfSupply && !GST_STATE_CODES[value.placeOfSupply]) return { error: 'Choose the place of supply from the list.' };
  for (const [key, check] of [['gstin', validateGstin], ['pan', validatePan]]) {
    if (!String(input[key] ?? '').trim()) continue;
    const r = check(input[key]);
    if (!r.ok) return { error: r.error };
    value[key] = r.value;
  }
  return { value: Object.keys(value).length ? value : undefined };
}

/**
 * @route  GET /api/admin/invoice-documents/info
 * @desc   What the "Send as" dialog and the billing form need: GST states and the next
 *         proforma / tax invoice numbers.
 */
router.get('/invoice-documents/info', crm('invoices', 'view'), async (req, res) => {
  try {
    const [proforma, taxInvoice] = await Promise.all([invoiceDocument.nextNumber('Proforma Invoice'), invoiceDocument.nextNumber('Tax Invoice')]);
    res.json({
      success: true,
      data: { states: Object.entries(GST_STATE_CODES).map(([name, code]) => ({ name, code })), next: { proforma, taxInvoice } },
    });
  } catch (error) {
    logger.error('Admin invoice document info error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/** Billing details to start an invoice for this client from (last invoice → client record → KYC GSTIN). */
router.get('/invoice-documents/billing-defaults/:clientId', crm('invoices', 'view'), async (req, res) => {
  try {
    if (!isValidId(req.params.clientId) || !clientAllowed(req, req.params.clientId)) return outOfScope(res, 'Client');
    const data = await invoiceDocument.billingDefaults(req.params.clientId);
    if (!data) return outOfScope(res, 'Client');
    res.json({ success: true, data });
  } catch (error) {
    logger.error('Admin invoice billing defaults error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/invoices', crm('invoices', 'create'), async (req, res) => {
  try {
    const { client_ref, issueDate, dueDate, lineItems, subtotal, taxPercent, taxAmount, totalAmount, notes } = req.body;

    if (!client_ref || !dueDate || !lineItems || !totalAmount) {
      return res.status(400).json({ success: false, message: 'client_ref, dueDate, lineItems and totalAmount are required' });
    }
    if (!clientAllowed(req, client_ref)) return res.status(403).json({ success: false, message: "You can't create invoices for this client." });
    const billing = cleanBilling(req.body.billing);
    if (billing.error) return res.status(400).json({ success: false, message: billing.error });

    // Saved, not sent: the client sees it (and it counts as owed) only after Send
    const invoice = await Invoice.create({
      client_ref, issueDate, dueDate, lineItems,
      subtotal: subtotal || totalAmount,
      taxPercent: taxPercent || 0,
      taxAmount: taxAmount || 0,
      totalAmount,
      billing: billing.value,
      unsent: true,
      notes,
    });
    await recordAudit(req, 'INVOICE_CREATE', 'Invoice', invoice.invoiceId, null, {
      invoiceId: invoice.invoiceId, client_ref: invoice.client_ref, totalAmount: invoice.totalAmount,
      taxAmount: invoice.taxAmount, dueDate: invoice.dueDate,
    });

    res.status(201).json({ success: true, message: 'Invoice saved. Send it to the client when it is ready.', data: { invoiceId: invoice.invoiceId, _id: invoice._id } });
  } catch (error) {
    logger.error('Admin create invoice error:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/invoices/:id', crm('invoices', 'edit'), async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid invoice ID' });
    }
    const existing = await Invoice.findById(req.params.id, { client_ref: 1 }).lean();
    if (!existing || !clientAllowed(req, existing.client_ref)) return outOfScope(res, 'Invoice');
    const update = { ...req.body };
    delete update._id; delete update.invoiceId; delete update.client_ref;
    // Set only by sending (services/invoiceDocument.js)
    delete update.documents; delete update.unsent;
    if ('billing' in update) {
      const billing = cleanBilling(update.billing);
      if (billing.error) return res.status(400).json({ success: false, message: billing.error });
      update.billing = billing.value || null;
    }

    // Overdue is derived from the due date and balance — it is never stored as a typed status
    if (update.paymentStatus === 'Overdue') update.paymentStatus = 'Unpaid';

    // Keep the amounts consistent with the status chosen in the dropdown:
    // marking Paid records the full amount as received (and when), and moving
    // a fully-paid invoice back to Unpaid clears that auto-filled payment.
    if (update.paymentStatus) {
      const current = await Invoice.findById(req.params.id, { totalAmount: 1, paidAmount: 1, paidOn: 1 }).lean();
      if (current) {
        const total = Number(update.totalAmount ?? current.totalAmount) || 0;
        const paid = Number(update.paidAmount ?? current.paidAmount) || 0;
        if (update.paymentStatus === 'Paid') {
          if (paid < total) update.paidAmount = total;
          if (!update.paidOn && !current.paidOn) update.paidOn = new Date();
        } else if (paid >= total && total > 0) {
          update.paidAmount = 0;
          update.paidOn = null;
        }
      }
    }

    const before = await Invoice.findById(req.params.id).lean();
    const invoice = await Invoice.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
    const money = (i) => ({ totalAmount: i.totalAmount, taxAmount: i.taxAmount, paidAmount: i.paidAmount, paymentStatus: i.paymentStatus, dueDate: i.dueDate });
    await recordAudit(req, 'INVOICE_UPDATE', 'Invoice', invoice.invoiceId, money(before || {}), money(invoice));
    res.json({ success: true, message: 'Invoice updated', data: invoice });
  } catch (error) {
    logger.error('Admin update invoice error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @route  GET /api/admin/invoices/:id/document?type=Tax Invoice&date=YYYY-MM-DD
 * @desc   The invoice as a Proforma / Tax Invoice PDF, for staff to look at. Once it has been
 *         sent as that type this is exactly what the client gets; before that it is a
 *         preview (number "DRAFT").
 */
router.get('/invoices/:id/document', crm('invoices', 'view'), async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid invoice ID' });
    const invoice = await Invoice.findById(req.params.id).lean();
    if (!invoice || !clientAllowed(req, invoice.client_ref)) return outOfScope(res, 'Invoice');
    const client = await Client.findById(invoice.client_ref).select('businessName phone').lean();
    const { buffer, type, number } = await invoiceDocument.renderDocument(invoice, client || {}, {
      type: req.query.type, previewDate: invoiceDocument.parseDay(req.query.date) || undefined,
    });
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${req.query.download === '1' ? 'attachment' : 'inline'}; filename="${type.replace(/ /g, '-')}-${number || 'draft'}.pdf"`,
      'Content-Length': buffer.length,
      'Cache-Control': 'private, no-store',
    });
    res.send(buffer);
  } catch (error) {
    logger.error('Admin invoice document error:', error);
    res.status(500).json({ success: false, message: 'Could not generate the invoice PDF' });
  }
});

/**
 * @route  POST /api/admin/invoices/:id/send   { type: 'Proforma Invoice' | 'Tax Invoice', date: 'YYYY-MM-DD' }
 * @desc   Send the invoice to the client as that document: allocates its number the first time,
 *         records the date staff typed, makes the invoice visible to the client and notifies them.
 */
router.post('/invoices/:id/send', crm('invoices', 'edit'), async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid invoice ID' });
    const existing = await Invoice.findById(req.params.id, { client_ref: 1 }).lean();
    if (!existing || !clientAllowed(req, existing.client_ref)) return outOfScope(res, 'Invoice');

    const r = await invoiceDocument.sendInvoice(req.params.id, { type: req.body.type, date: req.body.date }, req.user);
    if (!r.ok) return res.status(r.status).json({ success: false, message: r.message });
    await recordAudit(req, 'INVOICE_SEND', 'Invoice', r.invoice.invoiceId, null, {
      invoiceId: r.invoice.invoiceId, type: r.document.type, number: r.document.number, date: r.document.date, resent: !r.created,
    });
    res.json({
      success: true,
      message: `${r.document.type} ${r.document.number} ${r.created ? 'sent' : 'sent again'} to the client`,
      data: { _id: r.invoice._id, invoiceId: r.invoice.invoiceId, document: r.document },
    });
  } catch (error) {
    logger.error('Admin send invoice error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/invoices/:id', crm('invoices', 'delete'), async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid invoice ID' });
    }
    const existing = await Invoice.findById(req.params.id, { client_ref: 1, documents: 1 }).lean();
    if (!existing || !clientAllowed(req, existing.client_ref)) return outOfScope(res, 'Invoice');
    // A tax invoice number is issued once; deleting it would leave a gap in the sequence
    const taxDoc = (existing.documents || []).find((d) => d.type === 'Tax Invoice');
    if (taxDoc) return res.status(409).json({ success: false, message: `This invoice was sent as Tax Invoice ${taxDoc.number}, so it can't be deleted.` });
    const removed = await Invoice.findByIdAndDelete(req.params.id);
    if (removed) {
      await recordAudit(req, 'INVOICE_DELETE', 'Invoice', removed.invoiceId, {
        invoiceId: removed.invoiceId, client_ref: removed.client_ref, totalAmount: removed.totalAmount, paidAmount: removed.paidAmount,
      }, null);
    }
    res.json({ success: true, message: 'Invoice deleted' });
  } catch (error) {
    logger.error('Admin delete invoice error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// PROJECTS
// ══════════════════════════════════════════════════════════════════════════════

const PEOPLE = 'firstName lastName designation roleDept';

// Employees for the Project Manager / team pickers
router.get('/projects-staff', crm('projects', 'view'), async (req, res) => {
  const staff = await Employee.find({}, PEOPLE + ' employeeId').sort({ firstName: 1 }).lean();
  res.json({ success: true, data: staff });
});

router.get('/projects', crm('projects', 'view'), async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = {};
    const clientRef = scopedClientRef(req, req.query.client_ref);
    if (clientRef) filter.client_ref = clientRef;
    if (req.query.status) filter.status = req.query.status;

    const [projects, total] = await Promise.all([
      Project.find(filter)
        .select('+escalations')
        .populate('client_ref', 'businessName contactName clientId')
        .populate('projectManager', PEOPLE)
        .populate('teamMembers', PEOPLE)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Project.countDocuments(filter),
    ]);

    paginatedResponse(res, { data: projects, total, page, limit });
  } catch (error) {
    logger.error('Admin get projects error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/projects/:id', crm('projects', 'view'), async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid project ID' });
    const project = await Project.findById(req.params.id)
      .select('+escalations')
      .populate('client_ref', 'businessName contactName email clientId')
      .populate('projectManager', PEOPLE)
      .populate('teamMembers', PEOPLE);
    if (!project || !clientAllowed(req, project.client_ref)) return outOfScope(res, 'Project');
    res.json({ success: true, data: project });
  } catch (error) {
    logger.error('Admin get project error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/projects', crm('projects', 'create'), async (req, res) => {
  try {
    const { client_ref, projectName, internalNotes, startDate, expectedEndDate, status, milestones } = req.body;
    if (!client_ref || !projectName) {
      return res.status(400).json({ success: false, message: 'client_ref and projectName are required' });
    }
    if (!clientAllowed(req, client_ref)) return res.status(403).json({ success: false, message: "You can't create projects for this client." });
    const { value: assignment, error } = await delivery.cleanAssignment(req.body);
    if (error) return res.status(400).json({ success: false, message: error });
    const project = await Project.create({ client_ref, projectName, internalNotes, startDate, expectedEndDate, status, milestones, ...assignment });
    await delivery.notifyNewAssignees(project);
    res.status(201).json({ success: true, message: 'Project created', data: { projectId: project.projectId, _id: project._id } });
  } catch (error) {
    logger.error('Admin create project error:', error);
    if (error.name === 'ValidationError') return res.status(400).json({ success: false, message: error.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/projects/:id', crm('projects', 'edit'), async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid project ID' });
    const update = { ...req.body };
    // Identity, the escalation log and completion stamps are never set directly.
    ['_id', 'projectId', 'client_ref', 'escalations', 'completedAt', 'projectManager', 'teamMembers'].forEach((k) => delete update[k]);
    const { value: assignment, error } = await delivery.cleanAssignment(req.body);
    if (error) return res.status(400).json({ success: false, message: error });

    const project = await Project.findById(req.params.id);
    if (!project || !clientAllowed(req, project.client_ref)) return outOfScope(res, 'Project');
    const before = { projectManager: project.projectManager, teamMembers: [...(project.teamMembers || [])] };

    Object.assign(project, update, assignment);
    await project.save();
    await delivery.notifyNewAssignees(project, before);

    res.json({ success: true, message: 'Project updated', data: project });
  } catch (error) {
    logger.error('Admin update project error:', error);
    if (error.name === 'ValidationError') return res.status(400).json({ success: false, message: error.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/projects/:id', crm('projects', 'delete'), async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid project ID' });
    const existing = await Project.findById(req.params.id, { client_ref: 1 }).lean();
    if (!existing || !clientAllowed(req, existing.client_ref)) return outOfScope(res, 'Project');
    await Project.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Project deleted' });
  } catch (error) {
    logger.error('Admin delete project error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Escalations — logged/resolved by admin here, or by the PM in the Employee Portal
router.post('/projects/:id/escalations', crm('projects', 'edit'), async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid project ID' });
  const project = await Project.findById(req.params.id).select('+escalations');
  if (!project || !clientAllowed(req, project.client_ref)) return outOfScope(res, 'Project');
  sendResult(res, await delivery.addEscalation(project, req.user, req.body), 201);
});

router.put('/projects/:id/escalations/:escalationId/resolve', crm('projects', 'edit'), async (req, res) => {
  if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid project ID' });
  const project = await Project.findById(req.params.id).select('+escalations');
  if (!project || !clientAllowed(req, project.client_ref)) return outOfScope(res, 'Project');
  sendResult(res, await delivery.resolveEscalation(project, req.user, req.params.escalationId, req.body.resolution));
});

// ══════════════════════════════════════════════════════════════════════════════
// RETAINERS
// ══════════════════════════════════════════════════════════════════════════════

router.get('/retainers', crm('retainers', 'view'), async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = {};
    const clientRef = scopedClientRef(req, req.query.client_ref);
    if (clientRef) filter.client_ref = clientRef;
    if (req.query.status) filter.status = req.query.status;

    const [retainers, total] = await Promise.all([
      Retainer.find(filter)
        .populate('client_ref', 'businessName contactName clientId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean({ virtuals: true }),
      Retainer.countDocuments(filter),
    ]);

    paginatedResponse(res, { data: await attachUsageWithHistory(retainers), total, page, limit });
  } catch (error) {
    logger.error('Admin get retainers error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/retainers/:id', crm('retainers', 'view'), async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid retainer ID' });
    const retainer = await Retainer.findById(req.params.id)
      .populate('client_ref', 'businessName contactName email clientId');
    if (!retainer || !clientAllowed(req, retainer.client_ref)) return outOfScope(res, 'Retainer');
    const [withUsage] = await attachUsageWithHistory([retainer.toObject({ virtuals: true })]);
    res.json({ success: true, data: withUsage });
  } catch (error) {
    logger.error('Admin get retainer error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/retainers', crm('retainers', 'create'), async (req, res) => {
  try {
    const { client_ref, packageName, monthlyAmount, billingCycle, supportHoursPerMonth, contractStartDate, contractEndDate, status, autoRenew, renewalNotes } = req.body;
    if (!client_ref || !packageName || !monthlyAmount || !supportHoursPerMonth || !contractStartDate || !contractEndDate) {
      return res.status(400).json({ success: false, message: 'client_ref, packageName, monthlyAmount, supportHoursPerMonth, contractStartDate and contractEndDate are required' });
    }
    if (!clientAllowed(req, client_ref)) return res.status(403).json({ success: false, message: "You can't create retainers for this client." });
    const retainer = await Retainer.create({ client_ref, packageName, monthlyAmount, billingCycle, supportHoursPerMonth, contractStartDate, contractEndDate, status, autoRenew, renewalNotes });
    await recordAudit(req, 'RETAINER_CREATE', 'Retainer', retainer.retainerId, null, {
      client_ref: retainer.client_ref, monthlyAmount: retainer.monthlyAmount, billingCycle: retainer.billingCycle,
      supportHoursPerMonth: retainer.supportHoursPerMonth, status: retainer.status,
    });
    res.status(201).json({ success: true, message: 'Retainer created', data: { retainerId: retainer.retainerId, _id: retainer._id } });
  } catch (error) {
    logger.error('Admin create retainer error:', error);
    if (error.name === 'ValidationError') return res.status(400).json({ success: false, message: error.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/retainers/:id', crm('retainers', 'edit'), async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid retainer ID' });
    const existing = await Retainer.findById(req.params.id, { client_ref: 1 }).lean();
    if (!existing || !clientAllowed(req, existing.client_ref)) return outOfScope(res, 'Retainer');
    const update = { ...req.body };
    delete update._id; delete update.retainerId; delete update.client_ref;

    const beforeRet = await Retainer.findById(req.params.id).lean();
    const retainer = await Retainer.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!retainer) return res.status(404).json({ success: false, message: 'Retainer not found' });
    const retSnap = (r) => ({ monthlyAmount: r.monthlyAmount, billingCycle: r.billingCycle, supportHoursPerMonth: r.supportHoursPerMonth, status: r.status, contractStartDate: r.contractStartDate, contractEndDate: r.contractEndDate });
    await recordAudit(req, 'RETAINER_UPDATE', 'Retainer', retainer.retainerId, retSnap(beforeRet || {}), retSnap(retainer));
    res.json({ success: true, message: 'Retainer updated', data: retainer.toObject({ virtuals: true }) });
  } catch (error) {
    logger.error('Admin update retainer error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Extra hours (beyond the plan): preview a finished month, then invoice it — only if the Super Admin
// policy is set to bill. Never automatic; one invoice per retainer per month.
router.get('/retainers/:id/extra-hours', crm('retainers', 'view'), async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid retainer ID' });
    const retainer = await Retainer.findById(req.params.id).lean();
    if (!retainer || !clientAllowed(req, retainer.client_ref)) return outOfScope(res, 'Retainer');
    const p = await extraHoursBilling.previewMonth(retainer, req.query.month);
    if (!p.ok) return res.status(p.status).json({ success: false, message: p.message });
    res.json({ success: true, data: p });
  } catch (error) {
    logger.error('Admin extra hours preview error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/retainers/:id/extra-hours-invoice', crm('invoices', 'create'), async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid retainer ID' });
    const retainer = await Retainer.findById(req.params.id, { client_ref: 1 }).lean();
    if (!retainer || !clientAllowed(req, retainer.client_ref)) return outOfScope(res, 'Retainer');
    const r = await extraHoursBilling.createInvoice(req.params.id, req.body.month);
    if (!r.ok) return res.status(r.status).json({ success: false, message: r.message });
    await recordAudit(req, 'EXTRA_HOURS_INVOICE', 'Invoice', r.invoice.invoiceId, null, {
      retainer: req.params.id, month: req.body.month, billableHours: r.preview.billableHours, total: r.invoice.totalAmount,
    });
    await notifyInvoiceCreated(r.invoice);
    res.status(201).json({ success: true, message: `Invoice ${r.invoice.invoiceId} created for ${r.preview.label} extra hours`, data: { invoiceId: r.invoice.invoiceId, _id: r.invoice._id } });
  } catch (error) {
    logger.error('Admin extra hours invoice error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/retainers/:id', crm('retainers', 'delete'), async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid retainer ID' });
    const existing = await Retainer.findById(req.params.id, { client_ref: 1 }).lean();
    if (!existing || !clientAllowed(req, existing.client_ref)) return outOfScope(res, 'Retainer');
    await Retainer.findByIdAndUpdate(req.params.id, { status: 'Cancelled' });
    res.json({ success: true, message: 'Retainer cancelled' });
  } catch (error) {
    logger.error('Admin cancel retainer error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// SUPPORT TICKETS
// ══════════════════════════════════════════════════════════════════════════════

// Staff a ticket can be assigned to (the Team Management list, names only)
router.get('/tickets-staff', crm('tickets', 'view'), async (req, res) => {
  try {
    const admins = await Admin.find({ isActive: true }, 'firstName lastName email roles')
      .populate('roles', 'name').sort({ firstName: 1 }).lean();
    res.json({ success: true, admins });
  } catch (error) {
    logger.error('Admin tickets staff error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Technical time spent per ticket = the sum of the work logs linked to it, so
// the same logged time also counts in the client's hours and the project's
// actual hours — it is never typed in twice.
async function ticketMinutes(ticketIds) {
  if (!ticketIds.length) return new Map();
  const rows = await WorkLog.aggregate([
    { $match: { ticket_ref: { $in: ticketIds } } },
    { $group: { _id: '$ticket_ref', minutes: { $sum: '$duration' } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.minutes]));
}

router.get('/tickets', crm('tickets', 'view'), async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = {};
    const clientRef = scopedClientRef(req, req.query.client_ref);
    if (clientRef) filter.client_ref = clientRef;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.priority) filter.priority = req.query.priority;

    const [tickets, total] = await Promise.all([
      SupportTicket.find(filter)
        .populate('client_ref', 'businessName contactName email clientId')
        .populate({
          path: 'assignedTo',
          select: 'firstName lastName email roles',
          populate: { path: 'roles', select: 'name' }
        })
        .select('+resolution +rootCause') // admin sees full fields
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean({ virtuals: true }),
      SupportTicket.countDocuments(filter),
    ]);

    const minutes = await ticketMinutes(tickets.map((t) => t._id));
    const data = tickets.map((t) => ({ ...t, technicalMinutes: minutes.get(String(t._id)) || 0 }));
    paginatedResponse(res, { data, total, page, limit });
  } catch (error) {
    logger.error('Admin get tickets error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/tickets/:id', crm('tickets', 'view'), async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid ticket ID' });
    const ticket = await SupportTicket.findById(req.params.id)
      .populate('client_ref', 'businessName contactName email clientId')
      .populate({
        path: 'assignedTo',
        select: 'firstName lastName email roles',
        populate: { path: 'roles', select: 'name' }
      })
      .select('+resolution +rootCause');
    if (!ticket || !clientAllowed(req, ticket.client_ref)) return outOfScope(res, 'Ticket');
    const minutes = await ticketMinutes([ticket._id]);
    res.json({ success: true, data: { ...ticket.toObject({ virtuals: true }), technicalMinutes: minutes.get(String(ticket._id)) || 0 } });
  } catch (error) {
    logger.error('Admin get ticket error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/tickets/:id', crm('tickets', 'edit'), async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid ticket ID' });
    const { status, priority, resolution, assignedTo, rootCause, project_ref } = req.body;
    const update = {};
    if (status) update.status = status;
    if (priority) update.priority = priority;
    if (resolution !== undefined) update.resolution = resolution;
    if (rootCause !== undefined) update.rootCause = String(rootCause || '').slice(0, 1000);
    if (assignedTo !== undefined) {
      if (assignedTo && !isValidId(assignedTo)) return res.status(400).json({ success: false, message: 'Invalid assignee' });
      update.assignedTo = assignedTo || null;
    }

    // load + save (not findByIdAndUpdate) so the model's pre-save hook stamps
    // resolvedAt / closedAt when the status changes
    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket || !clientAllowed(req, ticket.client_ref)) return outOfScope(res, 'Ticket');
    if (project_ref !== undefined) {
      if (project_ref && !isValidId(project_ref)) return res.status(400).json({ success: false, message: 'Invalid project' });
      if (project_ref) {
        const project = await Project.findById(project_ref, { client_ref: 1 }).lean();
        if (!project || String(project.client_ref) !== String(ticket.client_ref)) {
          return res.status(400).json({ success: false, message: "That project doesn't belong to this ticket's client." });
        }
      }
      update.project_ref = project_ref || null;
    }
    const previousStatus = ticket.status;
    const previousAssignee = ticket.assignedTo ? String(ticket.assignedTo) : null;
    const ticketBefore = { status: ticket.status, priority: ticket.priority, assignedTo: previousAssignee };
    ticket.set(update);
    await ticket.save();
    if (status && previousStatus !== ticket.status) await notifyTicketStatus(ticket);
    const ticketAfter = { status: ticket.status, priority: ticket.priority, assignedTo: ticket.assignedTo ? String(ticket.assignedTo) : null };
    if (JSON.stringify(ticketBefore) !== JSON.stringify(ticketAfter)) {
      await recordAudit(req, 'TICKET_UPDATE', 'SupportTicket', ticket.ticketId, ticketBefore, ticketAfter);
    }
    // Tell the new assignee (not when an admin assigns the ticket to themselves)
    const newAssignee = ticket.assignedTo ? String(ticket.assignedTo) : null;
    if (newAssignee && newAssignee !== previousAssignee && newAssignee !== String(req.user._id)) {
      await notifyTicketAssigned(ticket, newAssignee);
    }
    res.json({ success: true, message: 'Ticket updated', data: ticket.toObject({ virtuals: true }) });
  } catch (error) {
    logger.error('Admin update ticket error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/tickets', crm('tickets', 'create'), async (req, res) => {
  try {
    const { client_ref, subject, description, category, priority, status, resolution, assignedTo } = req.body;
    if (!client_ref || !subject || !description || !category) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    if (!isValidId(client_ref) || (assignedTo && !isValidId(assignedTo))) {
      return res.status(400).json({ success: false, message: 'Invalid client or assignee' });
    }
    if (!clientAllowed(req, client_ref)) return res.status(403).json({ success: false, message: "You can't create tickets for this client." });
    const ticket = new SupportTicket({
      client_ref,
      subject,
      description,
      category,
      priority,
      status,
      resolution,
      assignedTo: assignedTo || req.user._id,
    });
    await ticket.save();
    if (String(ticket.assignedTo) !== String(req.user._id)) await notifyTicketAssigned(ticket, ticket.assignedTo);
    res.status(201).json({ success: true, message: 'Ticket created', data: ticket.toObject({ virtuals: true }) });
  } catch (error) {
    logger.error('Admin create ticket error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/tickets/:id/messages', crm('tickets', 'edit'), async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid ticket ID' });
    const { text } = req.body;
    if (!text) return res.status(400).json({ success: false, message: 'Message text is required' });
    
    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket || !clientAllowed(req, ticket.client_ref)) return outOfScope(res, 'Ticket');
    
    const senderName = req.user.firstName ? `${req.user.firstName} ${req.user.lastName || ''}`.trim() : 'Admin';
    
    ticket.messages.push({
      senderModel: 'Admin',
      senderId: req.user._id,
      senderName,
      text
    });
    
    await ticket.save();
    await notifyTicketReply(ticket, senderName, text);
    res.json({ success: true, message: 'Message sent', data: ticket.toObject({ virtuals: true }) });
  } catch (error) {
    logger.error('Admin add ticket message error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/tickets/:id', crm('tickets', 'delete'), async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid ticket ID' });
    const existing = await SupportTicket.findById(req.params.id, { client_ref: 1 }).lean();
    if (!existing || !clientAllowed(req, existing.client_ref)) return outOfScope(res, 'Ticket');
    await SupportTicket.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Ticket deleted' });
  } catch (error) {
    logger.error('Admin delete ticket error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// AGREEMENT
// ══════════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════════
// PAYMENT VERIFICATION (moved here from paymentRoutes.js — same URLs)
// ══════════════════════════════════════════════════════════════════════════════

router.get('/payments', crm('payments', 'view'), paymentController.getAllPayments);
router.put('/payments/:id/approve', crm('payments', 'edit'), paymentController.approvePayment);
router.put('/payments/:id/reject', crm('payments', 'edit'), paymentController.rejectPayment);

// ══════════════════════════════════════════════════════════════════════════════
// CLIENT AGREEMENTS — per-client agreement details (own page, own grant)
// ══════════════════════════════════════════════════════════════════════════════

const AGREEMENT_FIELDS = 'clientId businessName contactName email phone agreementDetails agreementVersion acceptedAgreementVersion agreementAcceptedAt';

router.get('/agreements', crm('agreements', 'view'), async (req, res) => {
  try {
    const filter = { deletedAt: null };
    if (isScoped(req)) filter._id = { $in: req.pageScope.clients };
    const data = await Client.find(filter, AGREEMENT_FIELDS).sort({ businessName: 1 }).limit(500).lean();
    res.json({ success: true, data });
  } catch (error) {
    logger.error('Admin list agreements error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/agreements/:id', crm('agreements', 'edit'), async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid client ID' });
    if (!clientAllowed(req, req.params.id)) return outOfScope(res, 'Client');
    const { agreementDetails } = req.body;
    if (!agreementDetails || typeof agreementDetails !== 'object') {
      return res.status(400).json({ success: false, message: 'agreementDetails is required' });
    }
    const client = await Client.findOne({ _id: req.params.id, deletedAt: null });
    if (!client) return outOfScope(res, 'Client');

    const before = client.toObject().agreementDetails;
    client.agreementDetails = { ...client.agreementDetails, ...agreementDetails };
    // New/changed terms → the client must review and sign the agreement again
    const agreementResignRequired = agreementDetailsChanged(before, client.toObject().agreementDetails);
    if (agreementResignRequired) client.agreementVersion = nextAgreementVersion(client);
    await client.save();
    if (agreementResignRequired) await notifyAgreementUpdated(client._id);
    res.json({ success: true, message: 'Agreement details updated', agreementResignRequired });
  } catch (error) {
    logger.error('Admin update agreement error:', error);
    if (error.name === 'ValidationError') return res.status(400).json({ success: false, message: error.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// The global agreement template isn't client data — full CRM access only
router.get('/agreement', requirePermission('cms.manage'), getAgreement);
router.put('/agreement', requirePermission('cms.manage'), updateAgreement);

// Admin panel: /api/admin/* behind the Admin auth, as before
const adminRouter = express.Router();
adminRouter.use(authMiddleware, router);

module.exports = adminRouter;
// Auth-less CRM router — the Employee Portal mounts it behind its own auth
module.exports.crmRouter = router;
