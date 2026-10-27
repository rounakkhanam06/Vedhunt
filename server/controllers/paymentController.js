const PaymentProof = require('../models/PaymentProof');
const Invoice = require('../models/Invoice');
const Client = require('../models/Client');
const { isScoped, clientAllowed } = require('../utils/clientScope');
const { notifyPaymentApproved, notifyPaymentRejected } = require('../services/clientNotify');
const { applyPaymentToInvoice, invoiceBalance, round2 } = require('../services/finance');
const { recordAudit } = require('../services/audit');

/**
 * @desc    Submit a new payment proof
 * @route   POST /api/client/payments
 * @access  Private (Client)
 */
exports.submitPaymentProof = async (req, res) => {
  try {
    const { invoice_ref, amountPaid, utrNumber, paymentDate, screenshotUrl } = req.body;

    if (!invoice_ref || !amountPaid || !utrNumber) {
      return res.status(400).json({ message: 'Amount and UTR fields are required' });
    }

    if (!/^[a-zA-Z0-9]{12,22}$/.test(utrNumber)) {
      return res.status(400).json({ message: 'Invalid UTR/Transaction ID.' });
    }

    const amount = round2(amountPaid);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ message: 'Amount must be greater than zero.' });
    }

    // Verify invoice belongs to the client
    const invoice = await Invoice.findOne({ _id: invoice_ref, client_ref: req.client._id, unsent: { $ne: true } });
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found or unauthorized' });
    }
    if (invoice.paymentStatus === 'Paid' || invoiceBalance(invoice) <= 0) {
      return res.status(400).json({ message: 'This invoice is already fully paid.' });
    }
    if (amount > invoiceBalance(invoice)) {
      return res.status(400).json({ message: `Amount cannot exceed the outstanding balance of ${invoiceBalance(invoice)}.` });
    }

    // The same UTR can only back one live proof — a repeat would double-credit the invoice
    const duplicate = await PaymentProof.exists({ utrNumber, status: { $in: ['Pending', 'Approved'] } });
    if (duplicate) {
      return res.status(409).json({ message: 'A payment with this UTR/Transaction ID has already been submitted.' });
    }

    const proof = new PaymentProof({
      invoice_ref,
      client_ref: req.client._id,
      amountPaid: amount,
      utrNumber,
      paymentDate: paymentDate || Date.now(),
      screenshotUrl,
      status: 'Pending'
    });

    await proof.save();

    // Optionally send an email notification to Admin here

    res.status(201).json({
      message: 'Payment proof submitted successfully. Pending verification.',
      data: proof
    });
  } catch (error) {
    console.error('Error submitting payment proof:', error);
    res.status(500).json({ message: 'Server error while submitting payment proof' });
  }
};

/**
 * @desc    Get client's payment history
 * @route   GET /api/client/payments/history
 * @access  Private (Client)
 */
exports.getClientPayments = async (req, res) => {
  try {
    const { invoice_ref } = req.query;
    const filter = { client_ref: req.client._id };

    if (invoice_ref) {
      filter.invoice_ref = invoice_ref;
    }

    const payments = await PaymentProof.find(filter)
      .populate('invoice_ref', 'invoiceId totalAmount paidAmount')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: payments });
  } catch (error) {
    console.error('Error fetching client payments:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc    Get all payments (for Admin)
 * @route   GET /api/admin/payments
 * @access  Private (Admin)
 */
exports.getAllPayments = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;
    // A person-wise grant sees only its clients (utils/clientScope.js)
    if (isScoped(req)) filter.client_ref = { $in: req.pageScope.clients };

    const payments = await PaymentProof.find(filter)
      .populate('client_ref', 'contactName businessName')
      .populate('invoice_ref', 'invoiceId totalAmount paidAmount paymentStatus')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: payments });
  } catch (error) {
    console.error('Error fetching all payments:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc    Approve a payment proof
 * @route   PUT /api/admin/payments/:id/approve
 * @access  Private (Admin)
 */
exports.approvePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await PaymentProof.findById(id).lean();

    if (!existing || !clientAllowed(req, existing.client_ref)) {
      return res.status(404).json({ message: 'Payment proof not found' });
    }

    // Claim the proof atomically: only one request can move it out of
    // Pending, so a double-click or concurrent reviewer can't credit it twice.
    const payment = await PaymentProof.findOneAndUpdate(
      { _id: id, status: 'Pending' },
      { $set: { status: 'Approved', verifiedBy: req.user._id, verifiedAt: new Date() } },
      { new: true }
    );
    if (!payment) {
      const current = await PaymentProof.findById(id, { status: 1 }).lean();
      return res.status(400).json({ message: `Payment is already ${current?.status || 'processed'}` });
    }

    let invoice;
    try {
      invoice = await applyPaymentToInvoice(payment.invoice_ref, payment.amountPaid, {
        paidOn: payment.paymentDate || new Date(),
      });
      if (!invoice) throw new Error('Invoice not found');
    } catch (err) {
      // The invoice wasn't credited, so put the proof back for another attempt
      await PaymentProof.updateOne({ _id: id }, { $set: { status: 'Pending' }, $unset: { verifiedBy: 1, verifiedAt: 1 } });
      throw err;
    }

    await recordAudit(req, 'PAYMENT_APPROVE', 'Payment', payment._id, { status: 'Pending', invoicePaid: round2(invoice.paidAmount - payment.amountPaid) }, {
      status: 'Approved', amount: payment.amountPaid, utr: payment.utrNumber,
      invoiceId: invoice.invoiceId, invoicePaid: invoice.paidAmount, invoiceStatus: invoice.paymentStatus,
    });
    await notifyPaymentApproved(payment, invoice);

    res.json({ success: true, message: 'Payment approved successfully', data: payment });
  } catch (error) {
    console.error('Error approving payment:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc    Reject a payment proof
 * @route   PUT /api/admin/payments/:id/reject
 * @access  Private (Admin)
 */
exports.rejectPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;

    const existing = await PaymentProof.findById(id).lean();

    if (!existing || !clientAllowed(req, existing.client_ref)) {
      return res.status(404).json({ message: 'Payment proof not found' });
    }

    const payment = await PaymentProof.findOneAndUpdate(
      { _id: id, status: 'Pending' },
      { $set: { status: 'Rejected', rejectionReason: rejectionReason || 'No reason provided', verifiedBy: req.user._id, verifiedAt: new Date() } },
      { new: true }
    );
    if (!payment) {
      const current = await PaymentProof.findById(id, { status: 1 }).lean();
      return res.status(400).json({ message: `Payment is already ${current?.status || 'processed'}` });
    }

    await recordAudit(req, 'PAYMENT_REJECT', 'Payment', payment._id, { status: 'Pending' }, {
      status: 'Rejected', reason: payment.rejectionReason, amount: payment.amountPaid, utr: payment.utrNumber,
    });
    await notifyPaymentRejected(payment, await Invoice.findById(payment.invoice_ref).select('invoiceId').lean());

    res.json({ success: true, message: 'Payment rejected', data: payment });
  } catch (error) {
    console.error('Error rejecting payment:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
