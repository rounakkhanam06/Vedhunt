// Lead-scope checks for routes behind requirePageAccess on a lead page.
// A lead belongs to whoever it is assigned to (Lead.assignedTo → Admin) and is
// also reachable by every BD it is cross-assigned to (Lead.sharedWith), so a
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
 * asks for it with { unassigned: true }. Ownership actions (reassign, delete)
 * pass { shared: false } so a cross-assigned BD can work a lead but not take
 * it away from its owner.
 */
async function leadFilter(req, scope = req.pageScope, { unassigned = false, shared = true } = {}) {
  const ids = await assigneeIds(req, scope);
  if (!ids) return {};
  const inIds = { $in: ids.map(oid) };
  const or = [{ assignedTo: inIds }];
  if (shared) or.push({ 'sharedWith.admin': inIds });
  if (unassigned) or.push({ assignedTo: null });
  return { $or: or };
}

/** Query filter for the leads one person works: owned by them or shared with them. */
const accessibleTo = (adminId) => ({ $or: [{ assignedTo: oid(adminId) }, { 'sharedWith.admin': oid(adminId) }] });

/** Whether `adminId` owns `lead` or has it shared with them. */
const hasLeadAccess = (lead, adminId) =>
  String(lead.assignedTo?._id || lead.assignedTo || '') === String(adminId)
  || (lead.sharedWith || []).some((s) => String(s.admin?._id || s.admin) === String(adminId));

/** Admins with all-leads access see every note, private ones included. */
const seesAllLeadNotes = (user) => pageScope(user, 'leads', 'view') === null;

/** Whether this login can assign leads at all (role or grant). */
const canAssignLeads = (user) => pageScope(user, 'leads', 'assign') !== false;

/** True when `lead` (with its assignedTo) is inside the scope. */
async function leadInScope(req, lead, scope = req.pageScope, { unassigned = false } = {}) {
  const ids = await assigneeIds(req, scope);
  if (!ids) return true;
  if (ids.some((id) => hasLeadAccess(lead, id))) return true;
  return !lead.assignedTo && unassigned;
}

module.exports = { teamAdminIds, assigneeIds, leadFilter, leadInScope, canAssignLeads, accessibleTo, hasLeadAccess, seesAllLeadNotes, oid };
