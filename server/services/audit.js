// One way to write an audit entry for CRM changes (client status, assignments,
// budgets, agreements, invoices, payments, approvals, permissions). It never
// throws — a failed audit write must not undo or block the change itself.
const AuditLog = require('../models/AuditLog');
const logger = require('../utils/logger');

const plain = (v) => {
  if (v == null) return null;
  const o = typeof v.toObject === 'function' ? v.toObject() : v;
  return JSON.parse(JSON.stringify(o));
};

/** Who is acting, from req.user (Admin or Employee) or an explicit system actor. */
function actorFrom(req) {
  const u = req?.user;
  if (!u) return { actorType: 'System', actorName: 'System' };
  const isEmployee = u.constructor?.modelName === 'Employee' || !!u.employeeId;
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email;
  return isEmployee
    ? { actorType: 'Employee', actorId: u._id, actorName: name, adminId: u.adminId || undefined }
    : { actorType: 'Admin', actorId: u._id, actorName: name, adminId: u._id };
}

/**
 * @param req        express request (for actor + IP), or null for system actions
 * @param action     e.g. 'PAYMENT_APPROVE'
 * @param resource   e.g. 'Payment'
 * @param recordId   the changed record's id (or business id)
 * @param before/after  snapshots (documents are converted to plain objects)
 * @param opts       { source, outcome, actor }
 */
async function recordAudit(req, action, resource, recordId, before, after, opts = {}) {
  try {
    await AuditLog.create({
      ...(opts.actor || actorFrom(req)),
      action,
      resource,
      recordId: recordId == null ? undefined : String(recordId),
      beforeSnapshot: plain(before),
      afterSnapshot: plain(after),
      ipAddress: req?.ip,
      source: opts.source || (req ? 'admin-api' : 'system'),
      outcome: opts.outcome || 'success',
    });
  } catch (err) {
    logger.error(`Audit log failed (${action}):`, err.message);
  }
}

module.exports = { recordAudit, actorFrom };
