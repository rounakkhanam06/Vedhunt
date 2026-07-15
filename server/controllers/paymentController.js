const PaymentProof = require('../models/PaymentProof');
const Invoice = require('../models/Invoice');
const Client = require('../models/Client');

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

    // Verify invoice belongs to the client
    const invoice = await Invoice.findOne({ _id: invoice_ref, client_ref: req.client._id });
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found or unauthorized' });
    }

    const proof = new PaymentProof({
      invoice_ref,
      client_ref: req.client._id,
      amountPaid,
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
    const payment = await PaymentProof.findById(id).populate('invoice_ref');

    if (!payment) {
      return res.status(404).json({ message: 'Payment proof not found' });
    }

    if (payment.status !== 'Pending') {
      return res.status(400).json({ message: `Payment is already ${payment.status}` });
    }

    const invoice = payment.invoice_ref;

    // Approve the payment
    payment.status = 'Approved';
    payment.verifiedBy = req.user._id;
    payment.verifiedAt = Date.now();
    await payment.save();

    // Update the invoice paidAmount
    const newPaidAmount = (invoice.paidAmount || 0) + payment.amountPaid;
    invoice.paidAmount = newPaidAmount;

    // Check if fully paid
    if (newPaidAmount >= invoice.totalAmount) {
      invoice.paymentStatus = 'Paid';
    } else {
      // If it was unpaid/overdue, keep it that way unless we want 'Partial' 
      // Based on prompt, keep the logic standard or whatever was there.
    }

    await invoice.save();

    // Optionally send email to client that payment is approved

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

    const payment = await PaymentProof.findById(id);

    if (!payment) {
      return res.status(404).json({ message: 'Payment proof not found' });
    }

    if (payment.status !== 'Pending') {
      return res.status(400).json({ message: `Payment is already ${payment.status}` });
    }

    payment.status = 'Rejected';
    payment.rejectionReason = rejectionReason || 'No reason provided';
    payment.verifiedBy = req.user._id;
    payment.verifiedAt = Date.now();
    await payment.save();

    // Optionally send email to client

    res.json({ success: true, message: 'Payment rejected', data: payment });
  } catch (error) {
    console.error('Error rejecting payment:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
