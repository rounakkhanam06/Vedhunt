const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const authMiddleware = require('../middleware/authMiddleware'); // Assuming this checks standard user auth
const clientAuth = require('../middleware/clientAuthMiddleware'); // Client auth middleware if separate
const roleMiddleware = require('../middleware/roleMiddleware'); // Admin role check

// -- Admin Routes --
router.get(
  '/admin/payments',
  authMiddleware,
  roleMiddleware('SUPER_ADMIN', 'EDITOR'), // or whatever roles can verify payments
  paymentController.getAllPayments
);

router.put(
  '/admin/payments/:id/approve',
  authMiddleware,
  roleMiddleware('SUPER_ADMIN', 'EDITOR'),
  paymentController.approvePayment
);

router.put(
  '/admin/payments/:id/reject',
  authMiddleware,
  roleMiddleware('SUPER_ADMIN', 'EDITOR'),
  paymentController.rejectPayment
);

// -- Client Routes --
// Note: If you have a separate clientAuth middleware, replace authMiddleware with clientAuth below
router.post(
  '/client/payments',
  clientAuth, 
  paymentController.submitPaymentProof
);

router.get(
  '/client/payments/history',
  clientAuth,
  paymentController.getClientPayments
);

module.exports = router;
