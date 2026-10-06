// Employee Portal → My Projects. Mounted at /ess/projects by
// employeePortalRoutes.js. The PM updates milestones and resolves
// escalations; anyone on the project can view it and raise an escalation.
const express = require('express');
const delivery = require('../services/projectDelivery');
const { sendResult } = require('../utils/apiResponse');

const router = express.Router();

router.get('/', async (req, res) => sendResult(res, await delivery.listMyProjects(req.user._id)));

router.put('/:id/milestones/:milestoneId', async (req, res) => {
  sendResult(res, await delivery.updateMilestoneStatus(req.user._id, req.params.id, req.params.milestoneId, req.body.status));
});

router.post('/:id/escalations', async (req, res) => {
  const { project, error } = await delivery.loadForEmployee(req.user._id, req.params.id, { allowMember: true });
  if (error) return sendResult(res, error);
  sendResult(res, await delivery.addEscalation(project, req.user, req.body), 201);
});

router.put('/:id/escalations/:escalationId/resolve', async (req, res) => {
  const { project, error } = await delivery.loadForEmployee(req.user._id, req.params.id);
  if (error) return sendResult(res, error);
  sendResult(res, await delivery.resolveEscalation(project, req.user, req.params.escalationId, req.body.resolution));
});

module.exports = router;
