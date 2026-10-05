const express = require('express');
const mongoose = require('mongoose');
const clientAuthMiddleware = require('../middleware/clientAuthMiddleware');
const Invoice = require('../models/Invoice');
const Project = require('../models/Project');
const Retainer = require('../models/Retainer');
const SupportTicket = require('../models/SupportTicket');
const Settings = require('../models/Settings');
const ClientNotification = require('../models/ClientNotification');
const logger = require('../utils/logger');
const { getClientAgreement, acceptAgreement } = require('../controllers/agreementController');
const { buildInvoicePdfBuffer, loadInvoiceContext } = require('../services/invoicePdf');
const { uploadTicketAttachment, deleteFromCloudinary } = require('../utils/cloudinary');
const { notifyTicketStaff } = require('../services/staffNotify');

const router = express.Router();

// All routes in this file are protected — apply middleware globally
router.use(clientAuthMiddleware);

// ─── Utility ─────────────────────────────────────────────────────────────────
const DEFAULT_SUPPORT_CATEGORIES = ['Bug Report', 'Feature Request', 'General Inquiry', 'Urgent Fix'];

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
    const now = new Date();
    const base = { client_ref: req.client._id };
    // Overdue is mostly derived (stored as 'Unpaid' with a past dueDate), so
    // filter and count on the derived status — matching what the table shows.
    const statusQuery = {
      Paid: { paymentStatus: 'Paid' },
      Unpaid: { paymentStatus: 'Unpaid', $or: [{ dueDate: null }, { dueDate: { $gte: now } }] },
      Overdue: { $or: [{ paymentStatus: 'Overdue' }, { paymentStatus: 'Unpaid', dueDate: { $lt: now } }] },
    };

    const filter = statusQuery[req.query.status]
      ? { ...base, ...statusQuery[req.query.status] }
      : base;

    const [invoices, total, allCount, paidCount, unpaidCount, overdueCount] = await Promise.all([
      Invoice.find(filter)
        .select('-notes') // strip internal notes
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Invoice.countDocuments(filter),
      Invoice.countDocuments(base),
      Invoice.countDocuments({ ...base, ...statusQuery.Paid }),
      Invoice.countDocuments({ ...base, ...statusQuery.Unpaid }),
      Invoice.countDocuments({ ...base, ...statusQuery.Overdue }),
    ]);

    // Compute overdue status in-memory (model post-hook doesn't fire on lean)
    const data = invoices.map((inv) => ({
      ...inv,
      paymentStatus:
        inv.paymentStatus === 'Unpaid' && inv.dueDate && inv.dueDate < now
          ? 'Overdue'
          : inv.paymentStatus,
    }));

    res.json({
      success: true,
      data,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
      // Across ALL of the client's invoices, independent of filter/page
      summary: { total: allCount, Paid: paidCount, Unpaid: unpaidCount, Overdue: overdueCount },
    });
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

/**
 * @route  GET /api/client/invoices/:id/pdf
 * @desc   Download the invoice as a PDF (only the client's own invoices)
 * @access Client Private
 */
router.get('/invoices/:id/pdf', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid invoice ID' });
    }

    const invoice = await Invoice.findOne({ _id: req.params.id, client_ref: req.client._id }).lean();
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    if (invoice.paymentStatus === 'Unpaid' && invoice.dueDate && invoice.dueDate < new Date()) {
      invoice.paymentStatus = 'Overdue';
    }

    const pdf = await buildInvoicePdfBuffer(invoice, req.client, await loadInvoiceContext());
    const filename = `Invoice-${(invoice.invoiceId || invoice._id).toString().replace(/[^\w-]/g, '_')}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdf.length,
      'Cache-Control': 'private, no-store',
    });
    res.send(pdf);
  } catch (error) {
    logger.error('Client invoice PDF error:', error);
    res.status(500).json({ success: false, message: 'Could not generate the invoice PDF' });
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

    // Accept the categories the admin configured in the Support Desk (plus the
    // built-in defaults, so a ticket form opened before a change still works)
    const categoryDoc = await Settings.findOne({ key: 'support_categories' }).lean();
    const allowedCategories = new Set([
      ...DEFAULT_SUPPORT_CATEGORIES,
      ...(Array.isArray(categoryDoc?.value) ? categoryDoc.value : []),
    ]);
    if (!allowedCategories.has(category)) {
      return res.status(400).json({ success: false, message: 'Please choose a valid category' });
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
    await notifyTicketStaff(ticket, {
      type: 'ticket_client_reply',
      title: `Client replied on ${ticket.ticketId}`,
      message: `${req.client.businessName || req.client.contactName || 'Client'}: ${String(text).slice(0, 140)}`,
    });
    res.json({ success: true, message: 'Message sent', data: ticket.toObject({ virtuals: true }) });
  } catch (error) {
    logger.error('Client add ticket message error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

const MAX_TICKET_ATTACHMENTS = 10;

// Loads the client's own ticket onto req.ticket (before any file is uploaded)
const loadOwnTicket = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid ticket ID' });
    }
    req.ticket = await SupportTicket.findOne({ _id: req.params.id, client_ref: req.client._id });
    if (!req.ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
    next();
  } catch (error) {
    logger.error('Client load ticket error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @route  POST /api/client/tickets/:id/attachments
 * @desc   Attach up to 3 files (PDF/JPG/PNG/WEBP, 5MB each) — max 10 per ticket
 * @access Client Private
 */
router.post('/tickets/:id/attachments', loadOwnTicket, (req, res, next) => {
  if (req.ticket.status === 'Closed') {
    return res.status(400).json({ success: false, message: 'This ticket is closed. Reopen it to add files.' });
  }
  if ((req.ticket.attachments || []).length >= MAX_TICKET_ATTACHMENTS) {
    return res.status(400).json({ success: false, message: `A ticket can have at most ${MAX_TICKET_ATTACHMENTS} attachments.` });
  }
  uploadTicketAttachment.array('files', 3)(req, res, (err) => {
    if (!err) return next();
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'Each file must be 5MB or smaller.'
      : ['LIMIT_FILE_COUNT', 'LIMIT_UNEXPECTED_FILE'].includes(err.code)
        ? 'You can upload up to 3 files at a time.'
        : err.message || 'Upload failed';
    return res.status(400).json({ success: false, message });
  });
}, async (req, res) => {
  const files = req.files || [];
  try {
    if (!files.length) {
      return res.status(400).json({ success: false, message: 'Please choose at least one file.' });
    }
    const existing = req.ticket.attachments || [];
    if (existing.length + files.length > MAX_TICKET_ATTACHMENTS) {
      await Promise.all(files.map((f) => deleteFromCloudinary(f.filename, !f.mimetype.startsWith('image/')).catch(() => {})));
      return res.status(400).json({
        success: false,
        message: `A ticket can have at most ${MAX_TICKET_ATTACHMENTS} attachments (${MAX_TICKET_ATTACHMENTS - existing.length} more allowed).`,
      });
    }

    req.ticket.attachments = [...existing, ...files.map((f) => f.path)];
    await req.ticket.save();
    res.json({ success: true, message: `${files.length} file${files.length > 1 ? 's' : ''} attached`, attachments: req.ticket.attachments });
  } catch (error) {
    logger.error('Client ticket attachment error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @route  PUT /api/client/tickets/:id/status
 * @desc   Client closes their ticket, or reopens a Resolved/Closed one
 *         (optional `message` is added to the conversation)
 * @access Client Private
 */
router.put('/tickets/:id/status', loadOwnTicket, async (req, res) => {
  try {
    const { status } = req.body;
    const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';
    const ticket = req.ticket;

    if (status === 'Closed') {
      if (ticket.status === 'Closed') {
        return res.status(400).json({ success: false, message: 'Ticket is already closed.' });
      }
      ticket.status = 'Closed';
    } else if (status === 'Open') {
      if (!['Resolved', 'Closed'].includes(ticket.status)) {
        return res.status(400).json({ success: false, message: 'Only resolved or closed tickets can be reopened.' });
      }
      ticket.status = 'Open';
      ticket.resolvedAt = undefined;
      ticket.closedAt = undefined;
    } else {
      return res.status(400).json({ success: false, message: 'Status must be "Closed" or "Open".' });
    }

    if (message) {
      ticket.messages.push({
        senderModel: 'Client',
        senderId: req.client._id,
        senderName: req.client.contactName || 'Client',
        text: message,
      });
    }
    await ticket.save();
    await notifyTicketStaff(ticket, {
      type: status === 'Closed' ? 'ticket_client_closed' : 'ticket_client_reopened',
      title: `${ticket.ticketId} ${status === 'Closed' ? 'closed' : 'reopened'} by the client`,
      message: message ? String(message).slice(0, 140) : `${req.client.businessName || 'The client'} ${status === 'Closed' ? 'closed' : 'reopened'} "${String(ticket.subject).slice(0, 80)}"`,
    });

    const fresh = await SupportTicket.findById(ticket._id).populate('assignedTo', 'firstName lastName');
    res.json({
      success: true,
      message: status === 'Closed' ? 'Ticket closed' : 'Ticket reopened',
      data: fresh.toObject({ virtuals: true }),
    });
  } catch (error) {
    logger.error('Client ticket status error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// AGREEMENT
// ══════════════════════════════════════════════════════════════════════════════

router.get('/agreement', getClientAgreement);
router.post('/accept-agreement', acceptAgreement);

// ══════════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS (bell) — created by services/clientNotify.js
// ══════════════════════════════════════════════════════════════════════════════

router.get('/notifications', async (req, res) => {
  try {
    const filter = { client: req.client._id };
    const [notifications, unreadCount] = await Promise.all([
      ClientNotification.find(filter).sort({ createdAt: -1 }).limit(30).lean(),
      ClientNotification.countDocuments({ ...filter, read: false }),
    ]);
    res.json({ success: true, notifications, unreadCount });
  } catch (error) {
    logger.error('Client get notifications error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/notifications/read-all', async (req, res) => {
  try {
    await ClientNotification.updateMany({ client: req.client._id, read: false }, { read: true });
    res.json({ success: true });
  } catch (error) {
    logger.error('Client mark-all notifications error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/notifications/:id/read', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid notification ID' });
    }
    const notification = await ClientNotification.findOneAndUpdate(
      { _id: req.params.id, client: req.client._id },
      { read: true },
      { new: true }
    );
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });
    res.json({ success: true, notification });
  } catch (error) {
    logger.error('Client mark notification error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
