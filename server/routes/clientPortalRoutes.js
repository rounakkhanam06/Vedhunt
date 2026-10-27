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
const invoiceDocument = require('../services/invoiceDocument');
const PaymentProof = require('../models/PaymentProof');
const CreditNote = require('../models/CreditNote');
const { buildReceiptPdf, buildCreditNotePdf } = require('../services/receiptPdf');
const kpi = require('../services/kpi');
const { uploadTicketAttachment, deleteFromCloudinary } = require('../utils/cloudinary');
const { notifyTicketStaff, notifyPermissionHolders } = require('../services/staffNotify');
const multer = require('multer');
const kyc = require('../services/kyc');
const onboardingService = require('../services/onboarding');
const OnboardingChecklist = require('../models/OnboardingChecklist');
const { workSummary } = require('../services/clientWork');
const adPerformance = require('../services/adPerformance');
const Client = require('../models/Client');
const { recordAudit } = require('../services/audit');
const finance = require('../services/finance');
const { attachUsage, attachUsageWithHistory } = require('../services/retainerUsage');
const strategy = require('../services/strategy');
const { buildOverview } = require('../services/clientOverview');

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
// OVERVIEW (the landing page)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * @route  GET /api/client/overview
 * @desc   Client-safe summary across billing, projects, retainer hours, support and
 *         strategy, plus the things that need the client's attention.
 * @access Client Private
 */
router.get('/overview', async (req, res) => {
  try {
    res.json({ success: true, data: await buildOverview(req.client._id) });
  } catch (error) {
    logger.error('Client overview error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

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
    const base = { client_ref: req.client._id, unsent: { $ne: true } }; // saved-but-unsent invoices are not the client's yet
    // Overdue is derived (balance still owed + past due date), so filter and
    // count on the derived status — matching what the table shows.
    const statusQuery = {
      Paid: { paymentStatus: 'Paid' },
      Unpaid: finance.unpaidNotOverdueFilter(now),
      Overdue: finance.overdueFilter(now),
    };

    const filter = statusQuery[req.query.status]
      ? { ...base, ...statusQuery[req.query.status] }
      : base;

    const [invoices, total, allCount, paidCount, unpaidCount, overdueCount] = await Promise.all([
      Invoice.find(filter)
        .select('-notes -documents.sentBy -documents.sentByName') // strip internal notes and who sent it
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

    // Derived status + balance (the model post-hook doesn't fire on lean)
    const data = invoices.map((inv) => finance.withDerived(inv, now));

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
      unsent: { $ne: true },
    })
      .select('-notes -documents.sentBy -documents.sentByName')
      .lean();

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    const derivedInvoice = finance.withDerived(invoice);

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

    // What has been paid (with receipts) and credited, for the client's own statement
    const [payments, creditNotes] = await Promise.all([
      PaymentProof.find({ invoice_ref: invoice._id, status: 'Approved' }).select('amountPaid paymentDate method utrNumber receiptNumber').sort({ paymentDate: 1 }).lean(),
      CreditNote.find({ invoice_ref: invoice._id }).select('number date amount taxAmount totalAmount reason').sort({ number: 1 }).lean(),
    ]);
    res.json({ success: true, data: { ...derivedInvoice, payments, creditNotes }, paymentInfo });
  } catch (error) {
    logger.error('Client get invoice detail error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// The client's own receipt / credit note PDFs (only for their own, sent invoices)
const ownInvoice = (req) => (mongoose.Types.ObjectId.isValid(req.params.id)
  ? Invoice.findOne({ _id: req.params.id, client_ref: req.client._id, unsent: { $ne: true } }).lean()
  : null);
const sendPdf = (res, buffer, filename) => {
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${filename}"`, 'Content-Length': buffer.length, 'Cache-Control': 'private, no-store' });
  res.send(buffer);
};

router.get('/invoices/:id/payments/:paymentId/receipt', async (req, res) => {
  try {
    const invoice = await ownInvoice(req);
    const payment = invoice && mongoose.Types.ObjectId.isValid(req.params.paymentId)
      && await PaymentProof.findOne({ _id: req.params.paymentId, invoice_ref: invoice._id, status: 'Approved' }).lean();
    if (!payment || !payment.receiptNumber) return res.status(404).json({ success: false, message: 'Receipt not found' });
    sendPdf(res, await buildReceiptPdf(payment, invoice, req.client), `Receipt-${payment.receiptNumber}.pdf`);
  } catch (error) {
    logger.error('Client receipt error:', error);
    res.status(500).json({ success: false, message: 'Could not generate the receipt' });
  }
});

router.get('/invoices/:id/credit-notes/:noteId/pdf', async (req, res) => {
  try {
    const invoice = await ownInvoice(req);
    const note = invoice && mongoose.Types.ObjectId.isValid(req.params.noteId)
      && await CreditNote.findOne({ _id: req.params.noteId, invoice_ref: invoice._id }).lean();
    if (!note) return res.status(404).json({ success: false, message: 'Credit note not found' });
    sendPdf(res, await buildCreditNotePdf(note, invoice, req.client), `Credit-Note-${note.number}.pdf`);
  } catch (error) {
    logger.error('Client credit note error:', error);
    res.status(500).json({ success: false, message: 'Could not generate the credit note' });
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

    const invoice = await Invoice.findOne({ _id: req.params.id, client_ref: req.client._id, unsent: { $ne: true } }).lean();
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    // Sent as a Proforma / Tax Invoice: the GST document staff sent. Older invoices keep the simple layout.
    const sentDoc = invoiceDocument.latestDocument(invoice);
    const pdf = sentDoc
      ? (await invoiceDocument.renderDocument(invoice, req.client, { type: sentDoc.type })).buffer
      : await buildInvoicePdfBuffer(finance.withDerived(invoice), req.client, await loadInvoiceContext());
    const filename = sentDoc
      ? `${sentDoc.type.replace(/ /g, '-')}-${sentDoc.number}.pdf`
      : `Invoice-${(invoice.invoiceId || invoice._id).toString().replace(/[^\w-]/g, '_')}.pdf`;
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
        .select('-internalNotes -milestones.internalDescription -projectManager -teamMembers')
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
      .select('-internalNotes -milestones.internalDescription -projectManager -teamMembers')
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

    paginatedResponse(res, { data: await attachUsageWithHistory(retainers), total, page, limit });
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
    const [withUsage] = await attachUsageWithHistory([retainer.toObject({ virtuals: true })]);
    res.json({ success: true, data: withUsage });
  } catch (error) {
    logger.error('Client get retainer detail error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// CAMPAIGN STRATEGY
// ══════════════════════════════════════════════════════════════════════════════

/**
 * @route  GET /api/client/strategy
 * @desc   The latest strategy version Vedhunt has approved for sharing — client-safe
 *         fields only (no competitor notes, authorship or change notes). data is null
 *         until a version has been shared.
 * @access Client Private
 */
router.get('/strategy', async (req, res) => {
  try {
    const doc = await strategy.latestSharedFor(req.client._id);
    res.json({ success: true, data: doc ? strategy.clientView(doc) : null });
  } catch (error) {
    logger.error('Client get strategy error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// AD PERFORMANCE — the client's own campaign results (manually entered by Vedhunt)
// ══════════════════════════════════════════════════════════════════════════════

const perfQuery = (req) => ({ period: req.query.period, from: req.query.from, to: req.query.to, group: req.query.group, platform: req.query.platform, forClient: true });

/**
 * @route  GET /api/client/performance?period=&from=&to=&group=day|week|month&platform=
 * @desc   Totals, period comparison, series, campaigns and budget pacing — hidden rows and internal notes excluded
 * @access Client Private
 */
router.get('/performance', async (req, res) => {
  try {
    const client = await Client.findById(req.client._id).select('profile.monthlyAdBudget').lean();
    const data = await adPerformance.report(req.client._id, { ...perfQuery(req), monthlyAdBudget: client?.profile?.monthlyAdBudget });
    if (!data) return res.status(400).json({ success: false, message: 'Choose a valid date range (up to one year).' });
    res.json({ success: true, data });
  } catch (error) {
    logger.error('Client performance error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/performance/export.csv', async (req, res) => {
  try {
    const data = await adPerformance.report(req.client._id, perfQuery(req));
    if (!data) return res.status(400).json({ success: false, message: 'Choose a valid date range (up to one year).' });
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="ad-performance-${data.current.from}-to-${data.current.to}.csv"`, 'Cache-Control': 'private, no-store' });
    res.send(adPerformance.toCsv(data.rows));
  } catch (error) {
    logger.error('Client performance export error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @route  GET /api/client/kpi-report?frequency=&from=&to=&platform=
 * @desc   The client's KPI report (services/kpi.js): budget plan vs spend, targets vs actual,
 *         and the qualified leads / verified orders / actions the team entered. View only;
 *         gross margin and internal notes are never included.
 */
router.get('/kpi-report', async (req, res) => {
  try {
    const data = await kpi.kpiReport(req.client._id, {
      frequency: req.query.frequency, from: req.query.from || undefined, to: req.query.to || undefined, platform: req.query.platform, forClient: true,
    });
    if (!data) return res.status(400).json({ success: false, message: 'Choose a valid date range.' });
    res.json({ success: true, data });
  } catch (error) {
    logger.error('Client KPI report error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// WORK LOG — time the team spent for this client, by activity and project
// ══════════════════════════════════════════════════════════════════════════════

/**
 * @route  GET /api/client/work?period=this_week|this_month|last_month|last_3_months|custom&from=&to=
 * @desc   Totals by activity and project plus recent entries — no employee names or internal notes
 * @access Client Private
 */
router.get('/work', async (req, res) => {
  try {
    const data = await workSummary(req.client._id, { period: req.query.period, from: req.query.from, to: req.query.to });
    if (!data) return res.status(400).json({ success: false, message: 'Choose a valid date range (up to one year).' });
    res.json({ success: true, data });
  } catch (error) {
    logger.error('Client work summary error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ONBOARDING — the client's view of their launch checklist
// ══════════════════════════════════════════════════════════════════════════════

/**
 * @route  GET /api/client/onboarding
 * @desc   Status of each setup step, what we need from the client, and proof links staff chose to share.
 *         data is null until a checklist exists. Internal notes, owners and exceptions are never included.
 * @access Client Private
 */
router.get('/onboarding', async (req, res) => {
  try {
    const doc = await OnboardingChecklist.findOne({ client_ref: req.client._id }).lean();
    res.json({ success: true, data: onboardingService.clientView(doc) });
  } catch (error) {
    logger.error('Client onboarding error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// KYC — advertiser identity and business verification
// ══════════════════════════════════════════════════════════════════════════════

// Held in memory, size-capped, one file per request; the content is checked by its bytes in services/kyc.js
const kycUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: kyc.MAX_FILE_BYTES, files: 1, fields: 4 } });

const kycItem = (req, res, next) => {
  if (!kyc.ITEMS.some((i) => i.key === req.params.item)) return res.status(404).json({ success: false, message: 'Unknown KYC item' });
  next();
};

/**
 * @route  GET /api/client/kyc
 * @desc   The client's own KYC status per item: masked numbers, review status and rejection reasons
 * @access Client Private
 */
router.get('/kyc', async (req, res) => {
  try {
    res.json({ success: true, data: kyc.clientView(await kyc.getOrCreate(req.client._id)) });
  } catch (error) {
    logger.error('Client get KYC error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @route  PUT /api/client/kyc/:item   (multipart: file + value)
 * @desc   Submit or re-submit one KYC item. A verified item is locked.
 * @access Client Private
 */
router.put('/kyc/:item', kycItem, (req, res, next) => {
  kycUpload.single('file')(req, res, (err) => {
    if (!err) return next();
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'The file must be 5MB or smaller.' : 'The upload could not be read. Please try again.';
    return res.status(400).json({ success: false, message });
  });
}, async (req, res) => {
  try {
    const result = await kyc.submitItem(req.client._id, req.params.item, { value: req.body.value, file: req.file });
    if (!result.ok) return res.status(result.status).json({ success: false, message: result.message });

    const label = kyc.ITEMS.find((i) => i.key === req.params.item).label;
    // The audit entry records that and when, never the numbers or the document
    await recordAudit(null, 'KYC_SUBMIT', 'ClientKyc', `${req.client._id}:${req.params.item}`, null,
      { item: req.params.item, status: 'Submitted', attempts: result.doc.items[req.params.item].attempts },
      { actor: { actorType: 'Client', actorId: req.client._id, actorName: req.client.businessName || req.client.contactName }, source: 'client-portal' });
    await notifyPermissionHolders('cms.manage', {
      type: 'kyc_submitted',
      title: `KYC submitted - ${req.client.businessName || 'a client'}`,
      message: `${label} is waiting for review.`,
      link: '/admin/clients',
    });
    res.json({ success: true, message: `${label} submitted for review.`, data: kyc.clientView(result.doc) });
  } catch (error) {
    logger.error('Client submit KYC error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @route  GET /api/client/kyc/:item/file
 * @desc   The client's own uploaded document (private, never cached)
 * @access Client Private
 */
router.get('/kyc/:item/file', kycItem, async (req, res) => {
  try {
    const file = await kyc.readFile(req.client._id, req.params.item);
    if (!file) return res.status(404).json({ success: false, message: 'No document uploaded yet' });
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
    logger.error('Client KYC file error:', error);
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
