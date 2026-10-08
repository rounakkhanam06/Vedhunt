// Proposal endpoints, shared by both portals. The Employee Portal mounts the
// default export (employeePortalRoutes.js, behind employeeAuthMiddleware +
// leads.view), scoped to leads assigned to the caller; the admin panel mounts
// an unscoped copy for Super Admins (adminProposalRoutes.js).
const express = require('express');
const { sendResult: respond } = require('../utils/apiResponse');
const proposals = require('../services/proposals');

/**
 * @param {(req) => object} leadScope extra lead filter for every call, e.g. { assignedTo } — {} for all leads
 * @returns {{ leadProposalRouter, proposalRouter }} mounted at …/leads/:leadId/proposals and …/proposals
 */
function buildProposalRouters(leadScope) {
  // …/leads/:leadId/proposals
  const leadProposalRouter = express.Router({ mergeParams: true });

  leadProposalRouter.get('/', async (req, res) => {
    respond(res, await proposals.listForLead(req.params.leadId, leadScope(req)));
  });

  leadProposalRouter.post('/', async (req, res) => {
    respond(res, await proposals.createDraft(req.user, req.params.leadId, req.body, leadScope(req)), 201);
  });

  // …/proposals/:id
  const proposalRouter = express.Router();

  proposalRouter.put('/:id', async (req, res) => {
    respond(res, await proposals.updateDraft(req.params.id, req.body, leadScope(req)));
  });

  proposalRouter.get('/:id/pdf', async (req, res) => {
    const result = await proposals.renderPdf(req.params.id, req.user, leadScope(req));
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
    const result = await proposals.renderProforma(req.user, req.params.id, leadScope(req));
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
    respond(res, await proposals.finalize(req.user, req.params.id, leadScope(req)));
  });

  proposalRouter.post('/:id/share', async (req, res) => {
    const { channel, recipient, message } = req.body;
    respond(res, await proposals.share(req.user, req.params.id, { channel, recipient, message }, leadScope(req)));
  });

  return { leadProposalRouter, proposalRouter };
}

module.exports = {
  ...buildProposalRouters((req) => ({ assignedTo: req.user._id })),
  buildProposalRouters,
};
