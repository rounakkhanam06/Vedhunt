// Employee Portal proposal endpoints — mounted by employeePortalRoutes.js
// behind employeeAuthMiddleware + leads.view. Every call is scoped to leads
// assigned to the caller.
const express = require('express');
const { sendResult: respond } = require('../utils/apiResponse');
const proposals = require('../services/proposals');

const ownLeads = (req) => ({ assignedTo: req.user._id });

// /ess/leads/:leadId/proposals
const leadProposalRouter = express.Router({ mergeParams: true });

leadProposalRouter.get('/', async (req, res) => {
  respond(res, await proposals.listForLead(req.params.leadId, ownLeads(req)));
});

leadProposalRouter.post('/', async (req, res) => {
  respond(res, await proposals.createDraft(req.user, req.params.leadId, req.body, ownLeads(req)), 201);
});

// /ess/proposals/:id
const proposalRouter = express.Router();

proposalRouter.put('/:id', async (req, res) => {
  respond(res, await proposals.updateDraft(req.params.id, req.body, ownLeads(req)));
});

proposalRouter.get('/:id/pdf', async (req, res) => {
  const result = await proposals.renderPdf(req.params.id, req.user, ownLeads(req));
  if (!result.ok) return respond(res, result);
  const { buffer, proposal } = result;
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `${req.query.download === '1' ? 'attachment' : 'inline'}; filename="Proposal-${proposal.proposalNumber}-v${proposal.version}.pdf"`,
    'Content-Length': buffer.length,
    'Cache-Control': 'private, no-store',
  });
  res.send(buffer);
});

// Proforma invoice from a final proposal (number allocated on first download)
proposalRouter.get('/:id/proforma', async (req, res) => {
  const result = await proposals.renderProforma(req.user, req.params.id, ownLeads(req));
  if (!result.ok) return respond(res, result);
  const { buffer, proposal } = result;
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `${req.query.download === '1' ? 'attachment' : 'inline'}; filename="Proforma-${proposal.proformaNumber}.pdf"`,
    'Content-Length': buffer.length,
    'Cache-Control': 'private, no-store',
  });
  res.send(buffer);
});

proposalRouter.post('/:id/finalize', async (req, res) => {
  respond(res, await proposals.finalize(req.user, req.params.id, ownLeads(req)));
});

proposalRouter.post('/:id/share', async (req, res) => {
  const { channel, recipient, message } = req.body;
  respond(res, await proposals.share(req.user, req.params.id, { channel, recipient, message }, ownLeads(req)));
});

module.exports = { leadProposalRouter, proposalRouter };
