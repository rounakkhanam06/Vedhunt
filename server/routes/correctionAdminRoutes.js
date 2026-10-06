// Manager review of attendance regularization / timesheet correction
// requests (Admin panel → HRMS → Correction Requests).
const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const requirePermission = require('../middleware/requirePermission');
const corrections = require('../services/corrections');
const { sendResult } = require('../utils/apiResponse');

const router = express.Router();
router.use(authMiddleware, requirePermission('team.manage'));

router.get('/', async (req, res) => {
  res.json({ success: true, requests: await corrections.listForReview(req.query) });
});

router.put('/:id/status', async (req, res) => {
  sendResult(res, await corrections.reviewRequest(req.user, req.params.id, req.body.status, req.body.comment, req.ip));
});

module.exports = router;
