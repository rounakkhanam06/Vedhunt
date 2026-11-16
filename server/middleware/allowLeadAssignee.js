const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const { pageScope } = require('../config/pageAccess');

/**
 * Work actions on a lead (lock, call/stage/qualification updates, follow-ups)
 * for the person the lead is assigned to, even without an Edit grant:
 * assigning a lead is the decision to let that person work it.
 *
 * Wraps a normal page-access check. When that check refuses, the request is
 * still allowed if the logged-in person can see leads at all and is the
 * current assignee of :id. Only the assignee — not people it is shared with,
 * and not a former owner. The scope is narrowed to { mode: 'own' } so the
 * controller's own scope filter applies. Protected fields (phone, email,
 * name, city, owner) stay blocked by updateLead / the assign route.
 */
const allowLeadAssignee = (pageCheck) => (req, res, next) => {
  let refused = null;
  const fakeRes = {
    status(code) { refused = { code }; return this; },
    json(body) { refused = { ...refused, body }; return this; },
  };
  pageCheck(req, fakeRes, async () => {
    // Normal access worked
    refused = 'ok';
  });
  if (refused === 'ok') return next();

  const deny = () => res.status(refused?.code || 403).json(refused?.body || { success: false, message: "You don't have edit access to leads." });
  (async () => {
    if (!req.user || pageScope(req.user, 'leads', 'view') === false) return deny();
    if (!mongoose.isValidObjectId(req.params.id)) return deny();
    const lead = await Lead.findById(req.params.id).select('assignedTo').lean();
    if (!lead || !lead.assignedTo || String(lead.assignedTo) !== String(req.user._id)) return deny();
    req.pageScope = { mode: 'own' };
    req.viaAssignment = true;
    return next();
  })().catch(next);
};

module.exports = allowLeadAssignee;
