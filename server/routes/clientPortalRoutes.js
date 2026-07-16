const express = require('express');
const mongoose = require('mongoose');
const clientAuthMiddleware = require('../middleware/clientAuthMiddleware');
const Invoice = require('../models/Invoice');
const Project = require('../models/Project');
const Retainer = require('../models/Retainer');
const SupportTicket = require('../models/SupportTicket');
const Settings = require('../models/Settings');
const logger = require('../utils/logger');
const { getAgreement, acceptAgreement } = require('../controllers/agreementController');

const router = express.Router();

// All routes in this file are protected — apply middleware globally
router.use(clientAuthMiddleware);

// ─── Utility ─────────────────────────────────────────────────────────────────
const parsePagination = (query) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit) || 20));
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

// ══════════════════════════════════════════════════════════════════════════════
// INVOICES
// ══════════════════════════════════════════════════════════════════════════════

/**
 * @route  GET /api/client/invoices
 * @desc   Get all invoices for the logged-in client (paginated)
 * @access Client Private
 */
router.get('/invoices', async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = { client_ref: req.client._id };

    // Optional status filter
    if (req.query.status && ['Paid', 'Unpaid', 'Overdue'].includes(req.query.status)) {
      filter.paymentStatus = req.query.status;
    }

    const [invoices, total] = await Promise.all([
      Invoice.find(filter)
        .select('-notes') // strip internal notes
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Invoice.countDocuments(filter),
    ]);

    // Compute overdue status in-memory (model post-hook doesn't fire on lean)
    const now = new Date();
    const data = invoices.map((inv) => ({
      ...inv,
      paymentStatus:
        inv.paymentStatus === 'Unpaid' && inv.dueDate && inv.dueDate < now
          ? 'Overdue'
          : inv.paymentStatus,
    }));

    paginatedResponse(res, { data, total, page, limit });
  } catch (error) {
    logger.error('Client get invoices error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @route  GET /api/client/invoices/:id
 * @desc   Get single invoice detail + UPI payment info from Settings
 * @access Client Private
 */
router.get('/invoices/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid invoice ID' });
    }

    const invoice = await Invoice.findOne({
      _id: req.params.id,
      client_ref: req.client._id, // Ownership check
    })
      .select('-notes')
      .lean();

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    // Compute overdue
    const now = new Date();
    if (invoice.paymentStatus === 'Unpaid' && invoice.dueDate && invoice.dueDate < now) {
      invoice.paymentStatus = 'Overdue';
    }

    // Fetch UPI/bank payment details from Settings (static QR — admin uploads)
    let paymentInfo = null;
    try {
      const paymentDoc = await Settings.findOne({ key: 'paymentSettings' }).lean();
      if (paymentDoc?.value) {
        paymentInfo = {
          upiId: paymentDoc.value.upiId || null,
          upiQrCodeUrl: paymentDoc.value.upiQrCodeUrl || paymentDoc.value.qrCodeUrl || null,
          bankDetails: paymentDoc.value.bankDetails || null,
        };
      }
    } catch (_) {
      // Settings might not have these fields yet — non-fatal
    }

    res.json({ success: true, data: invoice, paymentInfo });
  } catch (error) {
    logger.error('Client get invoice detail error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// PROJECTS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * @route  GET /api/client/projects
 * @desc   Get all projects for the logged-in client
 * @access Client Private
 */
router.get('/projects', async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = { client_ref: req.client._id };

    const [projects, total] = await Promise.all([
      Project.find(filter)
        .select('-internalNotes -milestones.internalDescription')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Project.countDocuments(filter),
    ]);

    paginatedResponse(res, { data: projects, total, page, limit });
  } catch (error) {
    logger.error('Client get projects error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @route  GET /api/client/projects/:id
 * @desc   Get single project with milestones (no internal fields)
 * @access Client Private
 */
router.get('/projects/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid project ID' });
    }

    const project = await Project.findOne({
      _id: req.params.id,
      client_ref: req.client._id,
    })
      .select('-internalNotes -milestones.internalDescription')
      .lean();

    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    res.json({ success: true, data: project });
  } catch (error) {
    logger.error('Client get project detail error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// RETAINERS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * @route  GET /api/client/retainers
 * @desc   Get all retainer agreements for the logged-in client
 * @access Client Private
 */
router.get('/retainers', async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = { client_ref: req.client._id };

    const [retainers, total] = await Promise.all([
      Retainer.find(filter)
        .select('-renewalNotes')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean({ virtuals: true }),
      Retainer.countDocuments(filter),
    ]);

    paginatedResponse(res, { data: retainers, total, page, limit });
  } catch (error) {
    logger.error('Client get retainers error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @route  GET /api/client/retainers/:id
 * @desc   Get single retainer detail with virtual fields
 * @access Client Private
 */
router.get('/retainers/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid retainer ID' });
    }

    const retainer = await Retainer.findOne({
      _id: req.params.id,
      client_ref: req.client._id,
    })
      .select('-renewalNotes');

    if (!retainer) {
      return res.status(404).json({ success: false, message: 'Retainer not found' });
    }

    // Use toObject with virtuals to include isNearingExpiry, hoursRemaining
    res.json({ success: true, data: retainer.toObject({ virtuals: true }) });
  } catch (error) {
    logger.error('Client get retainer detail error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// SUPPORT TICKETS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * @route  GET /api/client/tickets
 * @desc   Get all support tickets for the logged-in client (paginated + filtered)
 * @access Client Private
 */
router.get('/tickets', async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = { client_ref: req.client._id };

    if (req.query.status) {
      const validStatuses = ['Open', 'In Progress', 'Pending Client', 'Resolved', 'Closed'];
      if (validStatuses.includes(req.query.status)) {
        filter.status = req.query.status;
      }
    }

    const [tickets, total] = await Promise.all([
      SupportTicket.find(filter)
        .populate('assignedTo', 'firstName lastName')
        .select('-resolution') // strip internal fields
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean({ virtuals: true }),
      SupportTicket.countDocuments(filter),
    ]);

    paginatedResponse(res, { data: tickets, total, page, limit });
  } catch (error) {
    logger.error('Client get tickets error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @route  POST /api/client/tickets
 * @desc   Create a new support ticket
 * @access Client Private
 */
router.post('/tickets', async (req, res) => {
  try {
    const { subject, description, category, priority } = req.body;

    if (!subject || !description || !category) {
      return res.status(400).json({
        success: false,
        message: 'Subject, description and category are required',
      });
    }

    const ticket = await SupportTicket.create({
      client_ref: req.client._id,
      subject,
      description,
      category,
      priority: priority || 'Medium',
    });

    // Return without internal fields
    const safeTicket = ticket.toObject({ virtuals: true });
    delete safeTicket.resolution;
    delete safeTicket.assignedTo;

    res.status(201).json({
      success: true,
      message: `Ticket ${ticket.ticketId} created successfully`,
      data: safeTicket,
    });
  } catch (error) {
    logger.error('Client create ticket error:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @route  GET /api/client/tickets/:id
 * @desc   Get single ticket detail + SLA info
 * @access Client Private
 */
router.get('/tickets/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid ticket ID' });
    }

    const ticket = await SupportTicket.findOne({
      _id: req.params.id,
      client_ref: req.client._id,
    })
      .populate('assignedTo', 'firstName lastName')
      .select('-resolution');

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    res.json({ success: true, data: ticket.toObject({ virtuals: true }) });
  } catch (error) {
    logger.error('Client get ticket detail error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @route  POST /api/client/tickets/:id/messages
 * @desc   Add message to ticket (client)
 * @access Client Private
 */
router.post('/tickets/:id/messages', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ success: false, message: 'Message text is required' });
    
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid ticket ID' });
    }

    const ticket = await SupportTicket.findOne({
      _id: req.params.id,
      client_ref: req.client._id,
    });

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    ticket.messages.push({
      senderModel: 'Client',
      senderId: req.client._id,
      senderName: req.client.contactName || 'Client',
      text
    });

    await ticket.save();
    res.json({ success: true, message: 'Message sent', data: ticket.toObject({ virtuals: true }) });
  } catch (error) {
    logger.error('Client add ticket message error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// AGREEMENT
// ══════════════════════════════════════════════════════════════════════════════

router.get('/agreement', getAgreement);
router.post('/accept-agreement', acceptAgreement);

module.exports = router;
