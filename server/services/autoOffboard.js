// Automatic In-Active (offboard) for clients who neither pay nor answer, driven by the
// Super Admin rule in Settings (services/clientPolicies.js getAutoOffboard). Off by default.
//
// The line is Hold first, then In-Active (client decision, Oct 2026). A client qualifies when:
//   • it is On hold (by the auto-hold rule or by staff),
//   • its oldest overdue invoice is at least `daysOverdue` days late, and
//   • the last `unansweredCalls` calls logged since it went on hold were all not answered.
// It is never undone automatically: a Super Admin marks the client Active again.
const Client = require('../models/Client');
const ClientCall = require('../models/ClientCall');
const { portfolioFinance } = require('./finance');
const { getAutoOffboard } = require('./clientPolicies');
const { recordAudit } = require('./audit');
const logger = require('../utils/logger');

const SYSTEM = { actor: { actorType: 'System', actorName: 'Auto In-Active rule' }, source: 'scheduler' };
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

/** The client's calls since `since`, newest first: are the last `n` all unanswered? */
async function unansweredStreak(clientId, since, n) {
  const calls = await ClientCall.find({ client_ref: clientId, ...(since ? { calledAt: { $gte: since } } : {}) })
    .sort({ calledAt: -1 }).limit(n).select('connected').lean();
  return calls.length >= n && calls.every((c) => !c.connected);
}

/** One pass. Returns { enabled, offboarded: [clientId] }. */
async function runAutoOffboard(now = new Date()) {
  const policy = await getAutoOffboard();
  const result = { enabled: policy.enabled, offboarded: [] };
  if (!policy.enabled) return result;

  const candidates = await Client.find({ deletedAt: null, offboardedAt: null, serviceStatus: 'Hold' })
    .select('clientId businessName holdSince').lean();
  if (!candidates.length) return result;
  const { perClient } = await portfolioFinance({ clientIds: candidates.map((c) => c._id), now });

  for (const c of candidates) {
    try {
      const fin = perClient.get(String(c._id));
      if (!(fin && fin.overdueInvoices > 0 && fin.daysOverdue >= policy.daysOverdue)) continue;
      if (!(await unansweredStreak(c._id, c.holdSince, policy.unansweredCalls))) continue;

      const reason = `Automatic: ${inr(fin.overdueAmount)} overdue (oldest ${fin.daysOverdue} days) and the last ${policy.unansweredCalls} calls since the hold were not answered.`;
      // offboardedAt: null in the filter keeps two overlapping runs (or a Super Admin) from marking twice
      const done = await Client.updateOne({ _id: c._id, offboardedAt: null }, {
        $set: { offboardedAt: now, offboardReason: reason, offboardSource: 'auto', offboardedByName: 'Automatic (unpaid, not answering)' },
        $unset: { offboardedBy: 1 },
      });
      if (done.modifiedCount) {
        await recordAudit(null, 'CLIENT_OFFBOARD', 'Client', c.clientId, null, { reason, source: 'auto', rule: policy }, SYSTEM);
        result.offboarded.push(String(c._id));
      }
    } catch (err) {
      logger.error(`Auto In-Active failed for ${c.clientId}:`, err.message);
    }
  }
  return result;
}

module.exports = { runAutoOffboard, unansweredStreak };
