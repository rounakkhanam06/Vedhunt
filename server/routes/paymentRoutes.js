const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const clientAuth = require('../middleware/clientAuthMiddleware'); // Client auth middleware if separate

// Admin payment verification (GET /admin/payments, PUT /admin/payments/:id/approve|reject)
// lives in clientManagementRoutes.js, so it is scoped like the other CRM pages.

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
