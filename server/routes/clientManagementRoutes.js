const express = require('express');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const authMiddleware = require('../middleware/authMiddleware');
const Client = require('../models/Client');
const Invoice = require('../models/Invoice');
const Project = require('../models/Project');
const Retainer = require('../models/Retainer');
const SupportTicket = require('../models/SupportTicket');
const Lead = require('../models/Lead');
const logger = require('../utils/logger');
const { sendEmail } = require('../utils/sendEmail');

const router = express.Router();

// All routes require admin auth
router.use(authMiddleware);

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

// ══════════════════════════════════════════════════════════════════════════════
// CLIENTS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * @route  GET /api/admin/clients
 * @desc   List all clients (paginated, searchable)
 */
router.get('/clients', async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = {};

    // Text search across business name, contact name, email
    if (req.query.search) {
      filter.$text = { $search: req.query.search };
    }
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === 'true';
    }

    const [clients, total] = await Promise.all([
      Client.find(filter)
        .select('+notes +temporaryPasswordText -password -refreshToken -resetPasswordToken -resetPasswordExpire')
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
 * @route  GET /api/admin/clients/:id
 * @desc   Get single client with all linked data summary
 */
router.get('/clients/:id', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid client ID' });
    }

    const client = await Client.findById(req.params.id)
      .select('+notes +temporaryPasswordText -password -refreshToken -resetPasswordToken -resetPasswordExpire')
      .populate('leadRef', 'fullName phone email status')
      .lean();

    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    // Fetch summary counts
    const [invoiceCount, projectCount, retainerCount, ticketCount] = await Promise.all([
      Invoice.countDocuments({ client_ref: client._id }),
      Project.countDocuments({ client_ref: client._id }),
      Retainer.countDocuments({ client_ref: client._id, status: 'Active' }),
      SupportTicket.countDocuments({ client_ref: client._id, status: { $in: ['Open', 'In Progress'] } }),
    ]);

    res.json({
      success: true,
      data: {
        ...client,
        summary: { invoiceCount, projectCount, activeRetainerCount: retainerCount, openTicketCount: ticketCount },
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
router.post('/clients', async (req, res) => {
  try {
    const { businessName, contactName, email, phone, password, notes, leadRef } = req.body;

    if (!businessName || !contactName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'businessName, contactName, email and password are required',
      });
    }

    const existingClient = await Client.findOne({ email: email.toLowerCase().trim() }).lean();
    if (existingClient) {
      return res.status(409).json({ success: false, message: 'A client with this email already exists' });
    }

    const clientData = {
      businessName,
      contactName,
      email,
      phone,
      password,
      temporaryPasswordText: password,
      notes,
      isTemporaryPassword: true,
      createdBy: req.user._id,
    };

    if (leadRef && isValidId(leadRef)) {
      clientData.leadRef = leadRef;
      // Update the lead status to Won if not already
      await Lead.findByIdAndUpdate(leadRef, { status: 'Won' });
    }

    const client = await Client.create(clientData);

    // Send welcome email with temporary credentials
    try {
      await sendEmail({
        email: client.email,
        subject: 'Welcome to Vedhunt Client Portal',
        message: `Hello ${client.contactName},\n\nYour client portal account has been created.\n\nLogin at: ${process.env.FRONTEND_URL || 'http://localhost:5173'}/client/login\nEmail: ${client.email}\nTemporary Password: ${password}\n\nPlease change your password upon first login.\n\n— Vedhunt Team`,
      });
    } catch (emailErr) {
      logger.warn('Welcome email failed for new client:', emailErr.message);
    }

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
router.put('/clients/:id', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid client ID' });
    }

    const { businessName, contactName, email, phone, notes, isActive, newPassword } = req.body;

    const client = await Client.findById(req.params.id).select('+password');
    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }

    if (businessName !== undefined) client.businessName = businessName;
    if (contactName !== undefined) client.contactName = contactName;
    if (email !== undefined) client.email = email.toLowerCase().trim();
    if (phone !== undefined) client.phone = phone;
    if (notes !== undefined) client.notes = notes;
    if (isActive !== undefined) client.isActive = isActive;
    if (newPassword) {
      client.password = newPassword;
      client.temporaryPasswordText = newPassword;
      client.isTemporaryPassword = true;
    }

    await client.save();

    res.json({ success: true, message: 'Client updated successfully' });
  } catch (error) {
    logger.error('Admin update client error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @route  DELETE /api/admin/clients/:id
 * @desc   Soft-delete (deactivate) a client
 */
router.delete('/clients/:id', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid client ID' });
    }
    await Client.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'Client deactivated' });
  } catch (error) {
    logger.error('Admin delete client error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// INVOICES
// ══════════════════════════════════════════════════════════════════════════════

router.get('/invoices', async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = {};

    if (req.query.client_ref && isValidId(req.query.client_ref)) {
      filter.client_ref = req.query.client_ref;
    }
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

router.get('/invoices/:id', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid invoice ID' });
    }
    const invoice = await Invoice.findById(req.params.id)
      .populate('client_ref', 'businessName contactName email clientId')
      .lean();
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
    res.json({ success: true, data: invoice });
  } catch (error) {
    logger.error('Admin get invoice error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/invoices', async (req, res) => {
  try {
    const { client_ref, issueDate, dueDate, lineItems, subtotal, taxPercent, taxAmount, totalAmount, notes } = req.body;

    if (!client_ref || !dueDate || !lineItems || !totalAmount) {
      return res.status(400).json({ success: false, message: 'client_ref, dueDate, lineItems and totalAmount are required' });
    }

    const invoice = await Invoice.create({
      client_ref, issueDate, dueDate, lineItems,
      subtotal: subtotal || totalAmount,
      taxPercent: taxPercent || 0,
      taxAmount: taxAmount || 0,
      totalAmount,
      notes,
    });

    res.status(201).json({ success: true, message: 'Invoice created', data: { invoiceId: invoice.invoiceId, _id: invoice._id } });
  } catch (error) {
    logger.error('Admin create invoice error:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/invoices/:id', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid invoice ID' });
    }
    const update = { ...req.body };
    delete update._id; delete update.invoiceId; delete update.client_ref;

    const invoice = await Invoice.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
    res.json({ success: true, message: 'Invoice updated', data: invoice });
  } catch (error) {
    logger.error('Admin update invoice error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/invoices/:id', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid invoice ID' });
    }
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

router.get('/projects', async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = {};
    if (req.query.client_ref && isValidId(req.query.client_ref)) filter.client_ref = req.query.client_ref;
    if (req.query.status) filter.status = req.query.status;

    const [projects, total] = await Promise.all([
      Project.find(filter)
        .populate('client_ref', 'businessName contactName clientId')
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

router.get('/projects/:id', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid project ID' });
    const project = await Project.findById(req.params.id)
      .populate('client_ref', 'businessName contactName email clientId');
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
    res.json({ success: true, data: project });
  } catch (error) {
    logger.error('Admin get project error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/projects', async (req, res) => {
  try {
    const { client_ref, projectName, internalNotes, startDate, expectedEndDate, status, milestones } = req.body;
    if (!client_ref || !projectName) {
      return res.status(400).json({ success: false, message: 'client_ref and projectName are required' });
    }
    const project = await Project.create({ client_ref, projectName, internalNotes, startDate, expectedEndDate, status, milestones });
    res.status(201).json({ success: true, message: 'Project created', data: { projectId: project.projectId, _id: project._id } });
  } catch (error) {
    logger.error('Admin create project error:', error);
    if (error.name === 'ValidationError') return res.status(400).json({ success: false, message: error.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/projects/:id', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid project ID' });
    const update = { ...req.body };
    delete update._id; delete update.projectId; delete update.client_ref;

    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

    Object.assign(project, update);
    await project.save();

    res.json({ success: true, message: 'Project updated', data: project });
  } catch (error) {
    logger.error('Admin update project error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/projects/:id', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid project ID' });
    await Project.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Project deleted' });
  } catch (error) {
    logger.error('Admin delete project error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// RETAINERS
// ══════════════════════════════════════════════════════════════════════════════

router.get('/retainers', async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = {};
    if (req.query.client_ref && isValidId(req.query.client_ref)) filter.client_ref = req.query.client_ref;
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

router.get('/retainers/:id', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid retainer ID' });
    const retainer = await Retainer.findById(req.params.id)
      .populate('client_ref', 'businessName contactName email clientId');
    if (!retainer) return res.status(404).json({ success: false, message: 'Retainer not found' });
    res.json({ success: true, data: retainer.toObject({ virtuals: true }) });
  } catch (error) {
    logger.error('Admin get retainer error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/retainers', async (req, res) => {
  try {
    const { client_ref, packageName, monthlyAmount, billingCycle, supportHoursPerMonth, contractStartDate, contractEndDate, status, autoRenew, renewalNotes } = req.body;
    if (!client_ref || !packageName || !monthlyAmount || !supportHoursPerMonth || !contractStartDate || !contractEndDate) {
      return res.status(400).json({ success: false, message: 'client_ref, packageName, monthlyAmount, supportHoursPerMonth, contractStartDate and contractEndDate are required' });
    }
    const retainer = await Retainer.create({ client_ref, packageName, monthlyAmount, billingCycle, supportHoursPerMonth, contractStartDate, contractEndDate, status, autoRenew, renewalNotes });
    res.status(201).json({ success: true, message: 'Retainer created', data: { retainerId: retainer.retainerId, _id: retainer._id } });
  } catch (error) {
    logger.error('Admin create retainer error:', error);
    if (error.name === 'ValidationError') return res.status(400).json({ success: false, message: error.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/retainers/:id', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid retainer ID' });
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

router.delete('/retainers/:id', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid retainer ID' });
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

router.get('/tickets', async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = {};
    if (req.query.client_ref && isValidId(req.query.client_ref)) filter.client_ref = req.query.client_ref;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.priority) filter.priority = req.query.priority;

    const [tickets, total] = await Promise.all([
      SupportTicket.find(filter)
        .populate('client_ref', 'businessName contactName email clientId')
        .select('+resolution +assignedTo') // admin sees full fields
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

router.get('/tickets/:id', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid ticket ID' });
    const ticket = await SupportTicket.findById(req.params.id)
      .populate('client_ref', 'businessName contactName email clientId')
      .populate('assignedTo', 'firstName lastName email')
      .select('+resolution +assignedTo');
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
    res.json({ success: true, data: ticket.toObject({ virtuals: true }) });
  } catch (error) {
    logger.error('Admin get ticket error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/tickets/:id', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid ticket ID' });
    const { status, priority, resolution, assignedTo } = req.body;
    const update = {};
    if (status) update.status = status;
    if (priority) update.priority = priority;
    if (resolution !== undefined) update.resolution = resolution;
    if (assignedTo) update.assignedTo = assignedTo;

    const ticket = await SupportTicket.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
    res.json({ success: true, message: 'Ticket updated', data: ticket.toObject({ virtuals: true }) });
  } catch (error) {
    logger.error('Admin update ticket error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/tickets', async (req, res) => {
  try {
    const { client_ref, subject, description, category, priority, status, resolution } = req.body;
    if (!client_ref || !subject || !description || !category) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    const ticket = new SupportTicket({
      client_ref,
      subject,
      description,
      category,
      priority,
      status,
      resolution,
      assignedTo: req.user._id,
    });
    await ticket.save();
    res.status(201).json({ success: true, message: 'Ticket created', data: ticket.toObject({ virtuals: true }) });
  } catch (error) {
    logger.error('Admin create ticket error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/tickets/:id', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid ticket ID' });
    const ticket = await SupportTicket.findByIdAndDelete(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
    res.json({ success: true, message: 'Ticket deleted' });
  } catch (error) {
    logger.error('Admin delete ticket error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
