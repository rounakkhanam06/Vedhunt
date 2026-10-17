
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
  notifyInvoiceCreated, notifyAgreementUpdated, notifyTicketReply, notifyTicketStatus,
} = require('../services/clientNotify');

const { PAGE_CATALOG, pageScope, hasBaseAccess } = require('../config/pageAccess');
const requirePageAccess = require('../middleware/requirePageAccess');
const { isScoped, clientAllowed, scopedClientRef, outOfScope } = require('../utils/clientScope');
const paymentController = require('../controllers/paymentController');
const Admin = require('../models/Admin');

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
    if (!/^[A-Za-z\s]+$/.test(data.contactName)) {
      errors.push('Contact name cannot contain numbers or special characters');
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

    const { businessName, contactName, email, phone, notes, agreementDetails } = req.body;
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
    if (agreementResignRequired) await notifyAgreementUpdated(client._id);

    res.json({ success: true, message: 'Client updated successfully', agreementResignRequired });
  } catch (error) {
    logger.error('Admin update client error:', error);
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
// INVOICES
// ══════════════════════════════════════════════════════════════════════════════

router.get('/invoices', crm('invoices', 'view'), async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = {};

    const clientRef = scopedClientRef(req, req.query.client_ref);
    if (clientRef) filter.client_ref = clientRef;
    if (req.query.status) filter.paymentStatus = req.query.status;

    const [invoices, total] = await Promise.all([
      Invoice.find(filter)
        .populate('client_ref', 'businessName contactName email clientId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Invoice.countDocuments(filter),
    ]);

    paginatedResponse(res, { data: invoices, total, page, limit });
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
    res.json({ success: true, data: invoice });
  } catch (error) {
    logger.error('Admin get invoice error:', error);
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

    const invoice = await Invoice.create({
      client_ref, issueDate, dueDate, lineItems,
      subtotal: subtotal || totalAmount,
      taxPercent: taxPercent || 0,
      taxAmount: taxAmount || 0,
      totalAmount,
      notes,
    });
    await notifyInvoiceCreated(invoice);

    res.status(201).json({ success: true, message: 'Invoice created', data: { invoiceId: invoice.invoiceId, _id: invoice._id } });
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

    const invoice = await Invoice.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
    res.json({ success: true, message: 'Invoice updated', data: invoice });
  } catch (error) {
    logger.error('Admin update invoice error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/invoices/:id', crm('invoices', 'delete'), async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid invoice ID' });
    }
    const existing = await Invoice.findById(req.params.id, { client_ref: 1 }).lean();
    if (!existing || !clientAllowed(req, existing.client_ref)) return outOfScope(res, 'Invoice');
    await Invoice.findByIdAndDelete(req.params.id);
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

    paginatedResponse(res, { data: retainers, total, page, limit });
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
    res.json({ success: true, data: retainer.toObject({ virtuals: true }) });
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

    const retainer = await Retainer.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!retainer) return res.status(404).json({ success: false, message: 'Retainer not found' });
    res.json({ success: true, message: 'Retainer updated', data: retainer.toObject({ virtuals: true }) });
  } catch (error) {
    logger.error('Admin update retainer error:', error);
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
        .select('+resolution') // admin sees full fields
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean({ virtuals: true }),
      SupportTicket.countDocuments(filter),
    ]);

    paginatedResponse(res, { data: tickets, total, page, limit });
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
      .select('+resolution');
    if (!ticket || !clientAllowed(req, ticket.client_ref)) return outOfScope(res, 'Ticket');
    res.json({ success: true, data: ticket.toObject({ virtuals: true }) });
  } catch (error) {
    logger.error('Admin get ticket error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/tickets/:id', crm('tickets', 'edit'), async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid ticket ID' });
    const { status, priority, resolution, assignedTo } = req.body;
    const update = {};
    if (status) update.status = status;
    if (priority) update.priority = priority;
    if (resolution !== undefined) update.resolution = resolution;
    if (assignedTo !== undefined) {
      if (assignedTo && !isValidId(assignedTo)) return res.status(400).json({ success: false, message: 'Invalid assignee' });
      update.assignedTo = assignedTo || null;
    }

    // load + save (not findByIdAndUpdate) so the model's pre-save hook stamps
    // resolvedAt / closedAt when the status changes
    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket || !clientAllowed(req, ticket.client_ref)) return outOfScope(res, 'Ticket');
    const previousStatus = ticket.status;
    const previousAssignee = ticket.assignedTo ? String(ticket.assignedTo) : null;
    ticket.set(update);
    await ticket.save();
    if (status && previousStatus !== ticket.status) await notifyTicketStatus(ticket);
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
