// Daily alert for launch-critical onboarding steps that are overdue or blocked
// (Client Portal CRM §4 / §13): tells the step's owner and the client-desk
// admins, at most once per step per day.
const OnboardingChecklist = require('../models/OnboardingChecklist');
const Client = require('../models/Client');
const { notifyStaff, notifyPermissionHolders } = require('./staffNotify');
const { findAlertableItems, dayKey } = require('./onboarding');
const logger = require('../utils/logger');

async function runOnboardingAlerts(now = new Date()) {
  const due = await findAlertableItems(now);
  let sent = 0;
  for (const { checklistId, client_ref, item, overdue, blocked } of due) {
    try {
      const client = await Client.findById(client_ref, 'businessName clientId').lean();
      const name = client?.businessName || 'a client';
      const why = blocked ? `is blocked${item.blocker ? `: ${item.blocker}` : ''}` : 'is overdue';
      const payload = {
        type: 'onboarding_alert',
        title: `Launch-critical step ${blocked ? 'blocked' : 'overdue'} — ${name}`,
        message: `"${item.label}" ${why}.`,
        link: '/admin/clients',
      };
      if (item.owner) await notifyStaff(item.owner, payload);
      await notifyPermissionHolders('cms.manage', payload, { exclude: [item.owner] });
      await OnboardingChecklist.updateOne(
        { _id: checklistId, 'items.key': item.key },
        { $set: { 'items.$.lastAlertedOn': dayKey(now) } }
      );
      sent += 1;
    } catch (err) {
      logger.error(`Onboarding alert failed (${item.key}):`, err.message);
    }
  }
  return sent;
}

module.exports = { runOnboardingAlerts };
