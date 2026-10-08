// Proposal generation for Super Admins on the admin Lead page — the exact
// same endpoints the Employee Portal's Proposal button uses (see
// essProposalRoutes.js), but across every lead instead of only the caller's
// own. Mounted at /api/admin/sales.
const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const requirePermission = require('../middleware/requirePermission');
const { buildProposalRouters } = require('./essProposalRoutes');
const { SERVICE_MASTER } = require('../config/serviceMaster');
const { GST_STATES } = require('../config/gstStates');

const router = express.Router();
router.use(authMiddleware, requirePermission('*'));

const { leadProposalRouter, proposalRouter } = buildProposalRouters(() => ({}));

router.get('/proposal-masters', (req, res) => {
  res.json({ success: true, services: SERVICE_MASTER, states: GST_STATES });
});
router.use('/proposals', proposalRouter);
router.use('/leads/:leadId/proposals', leadProposalRouter);

module.exports = router;
