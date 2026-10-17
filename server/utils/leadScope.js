// Lead-scope checks for routes behind requirePageAccess on a lead page.
// A lead belongs to whoever it is assigned to (Lead.assignedTo → Admin), so a
// scope becomes a list of Admin ids:
//   all  → no limit      own → just me
//   team → me plus everyone below me in the reporting tree (Employee.reportingManager)
const mongoose = require('mongoose');
const Employee = require('../models/Employee');
const { pageScope } = require('../config/pageAccess');

const oid = (id) => new mongoose.Types.ObjectId(String(id));

/** Admin ids of me and every employee who reports to me, directly or through others. */
async function teamAdminIds(adminId) {
  const ids = [String(adminId)];
  const me = await Employee.findOne({ adminId }, { _id: 1 }).lean();
  if (!me) return ids;
  const seen = new Set([String(me._id)]);
  let frontier = [me._id];
  while (frontier.length) {
    const reports = await Employee.find({ reportingManager: { $in: frontier } }, { _id: 1, adminId: 1 }).lean();
    frontier = [];
    for (const r of reports) {
      if (seen.has(String(r._id))) continue;
      seen.add(String(r._id));
      frontier.push(r._id);
      if (r.adminId) ids.push(String(r.adminId));
    }
  }
  return [...new Set(ids)];
}

/** null for no limit, else the Admin ids (strings) whose leads the scope covers. */
async function assigneeIds(req, scope = req.pageScope) {
  if (!scope || scope.mode === 'all') return null;
  if (scope.mode === 'own') return [String(req.user._id)];
  if (scope.mode === 'team') {
    req._teamIds = req._teamIds || await teamAdminIds(req.user._id);
    return req._teamIds;
  }
  return [];
}

/**
 * Query filter for the leads a scope covers. Assigners may also reach the
 * unassigned pool (to pick up and hand out leads), but only where a route
 * asks for it with { unassigned: true }.
 */
async function leadFilter(req, scope = req.pageScope, { unassigned = false } = {}) {
  const ids = await assigneeIds(req, scope);
  if (!ids) return {};
  const mine = { assignedTo: { $in: ids.map(oid) } };
  return unassigned ? { $or: [mine, { assignedTo: null }] } : mine;
}

/** Whether this login can assign leads at all (role or grant). */
const canAssignLeads = (user) => pageScope(user, 'leads', 'assign') !== false;

/** True when `lead` (with its assignedTo) is inside the scope. */
async function leadInScope(req, lead, scope = req.pageScope, { unassigned = false } = {}) {
  const ids = await assigneeIds(req, scope);
  if (!ids) return true;
  if (!lead.assignedTo) return unassigned;
  return ids.includes(String(lead.assignedTo?._id || lead.assignedTo));
}

module.exports = { teamAdminIds, assigneeIds, leadFilter, leadInScope, canAssignLeads, oid };
