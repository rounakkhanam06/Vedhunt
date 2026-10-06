// Employee Portal → Team Approvals: a reporting manager reviews their direct
// reports' leave and correction requests. Mounted at /ess/team by
// employeePortalRoutes.js. HR keeps the same powers in the Admin panel.
const express = require('express');
const Employee = require('../models/Employee');
const LeaveRequest = require('../models/LeaveRequest');
const CorrectionRequest = require('../models/CorrectionRequest');
const { directReportIds } = require('../services/approvalRouting');
const { reviewLeaveRequest } = require('../services/leaveReview');
const corrections = require('../services/corrections');
const { sendResult } = require('../utils/apiResponse');

const router = express.Router();

const notMine = { ok: false, status: 404, message: 'Request not found among your team.' };

// My direct reports and their requests (pending first, then the last 30 days of decisions)
router.get('/', async (req, res) => {
  const ids = await directReportIds(req.user._id);
  if (!ids.length) return res.json({ success: true, reports: [], leaveRequests: [], corrections: [] });
  const since = new Date(Date.now() - 30 * 86400000);
  const recentOrPending = { $or: [{ status: 'Pending' }, { updatedAt: { $gte: since } }] };
  const [reports, leaveRequests, correctionRequests] = await Promise.all([
    Employee.find({ _id: { $in: ids } }, { firstName: 1, lastName: 1, employeeId: 1, designation: 1, roleDept: 1 }).lean(),
    LeaveRequest.find({ employeeId: { $in: ids }, ...recentOrPending })
      .sort({ status: -1, createdAt: -1 }).limit(200)
      .populate('employeeId', 'firstName lastName employeeId').lean(),
    CorrectionRequest.find({ employee: { $in: ids }, ...recentOrPending })
      .sort({ status: -1, createdAt: -1 }).limit(200)
      .populate('employee', 'firstName lastName employeeId').lean(),
  ]);
  res.json({ success: true, reports, leaveRequests, corrections: correctionRequests });
});

router.put('/leave/:id/status', async (req, res) => {
  const ids = (await directReportIds(req.user._id)).map(String);
  const leave = await LeaveRequest.findById(req.params.id, { employeeId: 1 }).lean().catch(() => null);
  if (!leave || !ids.includes(String(leave.employeeId))) return sendResult(res, notMine);
  sendResult(res, await reviewLeaveRequest(req.params.id, req.body.status, req.body.comment, { reviewerLabel: 'Your manager', reviewerId: req.user._id }));
});

router.put('/corrections/:id/status', async (req, res) => {
  const ids = (await directReportIds(req.user._id)).map(String);
  const request = await CorrectionRequest.findById(req.params.id, { employee: 1 }).lean().catch(() => null);
  if (!request || !ids.includes(String(request.employee))) return sendResult(res, notMine);
  sendResult(res, await corrections.reviewRequest(req.user, req.params.id, req.body.status, req.body.comment, req.ip));
});

module.exports = router;
