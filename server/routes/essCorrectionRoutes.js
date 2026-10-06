// Employee-side attendance regularization / timesheet correction requests —
// mounted at /ess/corrections by employeePortalRoutes.js.
const express = require('express');
const { sendResult: respond } = require('../utils/apiResponse');
const corrections = require('../services/corrections');
const { uploadTicketAttachment } = require('../utils/cloudinary');

const router = express.Router();

router.get('/', async (req, res) => respond(res, await corrections.listOwnRequests(req.user._id)));

// Optional proof (PDF/JPG/PNG/WEBP, 5MB) — same rules as ticket attachments.
router.post('/attendance', uploadTicketAttachment.single('proof'), async (req, res) => {
  respond(res, await corrections.createAttendanceRequest(req.user, req.body, req.file?.path), 201);
});

router.post('/timesheet', async (req, res) => {
  respond(res, await corrections.createTimesheetRequest(req.user, req.body), 201);
});

router.put('/:id/cancel', async (req, res) => {
  respond(res, await corrections.cancelOwnRequest(req.user._id, req.params.id));
});

module.exports = router;
