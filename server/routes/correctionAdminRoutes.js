// Manager review of attendance regularization / timesheet correction
// requests (Admin panel → HRMS → Correction Requests).
const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const corrections = require('../services/corrections');
const { sendResult } = require('../utils/apiResponse');

const mongoose = require('mongoose');
const requirePageAccess = require('../middleware/requirePageAccess');
const CorrectionRequest = require('../models/CorrectionRequest');
const { scopedEmployeeIds, employeeInScope } = require('../utils/employeeScope');

// Correction Requests page: View lists, Edit approves / rejects — limited to the
// employees in the person's scope (role attendance.manage: everyone, as before).
// No auth here: used by the Admin panel below and mounted behind the Employee
// Portal auth at /api/employee-portal/grants/corrections.
const scoped = express.Router();

scoped.get('/', requirePageAccess('corrections', 'view'), async (req, res) => {
  res.json({ success: true, requests: await corrections.listForReview(req.query, await scopedEmployeeIds(req)) });
});

scoped.put('/:id/status', requirePageAccess('corrections', 'edit'), async (req, res) => {
  if (req.pageScope) {
    const request = mongoose.Types.ObjectId.isValid(req.params.id) ? await CorrectionRequest.findById(req.params.id, { employee: 1 }).lean() : null;
    if (!request || !employeeInScope(await scopedEmployeeIds(req), request.employee)) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }
  }
  sendResult(res, await corrections.reviewRequest(req.user, req.params.id, req.body.status, req.body.comment, req.ip));
});

const router = express.Router();
router.use(authMiddleware, scoped);

module.exports = router;
module.exports.scopedCorrectionRouter = scoped;
