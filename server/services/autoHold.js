// Automatic hold for unpaid clients, driven by the Super Admin rule in Settings
// (services/clientPolicies.js). Off by default. A manual hold is never lifted by
// this job, and the job never touches suspended or deleted accounts.
const Client = require('../models/Client');
const { portfolioFinance } = require('./finance');
const { getAutoHold } = require('./clientPolicies');
const { recordAudit } = require('./audit');
const { notifyAccountHold, notifyAccountReleased } = require('./clientNotify');
const logger = require('../utils/logger');

const SYSTEM = { actor: { actorType: 'System', actorName: 'Auto-hold rule' }, source: 'scheduler' };
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

/**
 * One pass. Returns { held: [clientId], released: [clientId] }.
 * A client qualifies when its OLDEST overdue invoice is at least `daysOverdue`
 * days late and the total overdue is at least `minOverdueAmount`.
 */
async function runAutoHold(now = new Date()) {
  const policy = await getAutoHold();
  const result = { enabled: policy.enabled, held: [], released: [] };

  const candidates = await Client.find({ deletedAt: null, isActive: true }).select('serviceStatus holdSource businessName clientId').lean();
  const { perClient } = await portfolioFinance({ clientIds: candidates.map((c) => c._id), now });

  for (const c of candidates) {
    const fin = perClient.get(String(c._id));
    const qualifies = !!fin && fin.overdueInvoices > 0 && fin.daysOverdue >= policy.daysOverdue && fin.overdueAmount >= policy.minOverdueAmount;
    try {
      if (policy.enabled && qualifies && c.serviceStatus !== 'Hold') {
        const reason = `Payment overdue: ${inr(fin.overdueAmount)} unpaid, oldest invoice ${fin.daysOverdue} days past due.`;
        // The status check in the filter keeps two overlapping runs from holding twice
        const done = await Client.updateOne({ _id: c._id, serviceStatus: { $ne: 'Hold' } }, {
          $set: { serviceStatus: 'Hold', holdReason: reason, holdSince: now, holdSource: 'auto', holdByName: 'Automatic (overdue payment)' },
        });
        if (done.modifiedCount) {
          await recordAudit(null, 'CLIENT_HOLD', 'Client', c.clientId, { serviceStatus: 'Active' }, { serviceStatus: 'Hold', reason, rule: { daysOverdue: policy.daysOverdue } }, SYSTEM);
          await notifyAccountHold(c._id, reason);
          result.held.push(String(c._id));
        }
      } else if (policy.autoRelease && c.serviceStatus === 'Hold' && c.holdSource === 'auto' && !(fin && fin.overdueInvoices > 0)) {
        // Only holds this rule placed, and only once nothing at all is overdue
        const done = await Client.updateOne({ _id: c._id, serviceStatus: 'Hold', holdSource: 'auto' }, {
          $set: { serviceStatus: 'Active' }, $unset: { holdReason: 1, holdSince: 1, holdSource: 1, holdBy: 1, holdByName: 1 },
        });
        if (done.modifiedCount) {
          await recordAudit(null, 'CLIENT_RELEASE', 'Client', c.clientId, { serviceStatus: 'Hold' }, { serviceStatus: 'Active', reason: 'No overdue invoices' }, SYSTEM);
          await notifyAccountReleased(c._id);
          result.released.push(String(c._id));
        }
      }
    } catch (err) {
      logger.error(`Auto-hold failed for ${c.clientId}:`, err.message);
    }
  }
  return result;
}

module.exports = { runAutoHold };
