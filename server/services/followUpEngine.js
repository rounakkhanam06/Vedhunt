/**
 * Follow-Up & Revenue Protection Engine — keeps a scheduled follow-up from
 * silently slipping. Four checkpoints, each idempotent (guarded by its own
 * "already notified" timestamp on the Lead so a 5-minute cron tick never
 * double-fires):
 *
 *   30 min prior  -> reminder to the BD
 *   due time      -> "due now" nudge to the BD
 *   1 hr overdue  -> overdue alert to the BD
 *   EOD overdue   -> escalation to Managers (team.manage/* permission)
 *   next-day      -> Follow-up Breach flag, to BD + Managers
 *
 * All four "already notified" fields are cleared by services/leadLifecycle.js
 * whenever nextFollowUpDate changes, so rescheduling restarts the cycle.
 */

const Lead = require('../models/Lead');
const Role = require('../models/Role');
const Admin = require('../models/Admin');
const Notification = require('../models/Notification');
const logger = require('../utils/logger');
const { TERMINAL_STATUSES } = require('../utils/leadStateMachine');

const NON_ACTIVE_STATUSES = [...TERMINAL_STATUSES, 'Hold'];

async function getManagerAdminIds() {
  const roles = await Role.find({ permissions: { $in: ['team.manage', '*'] } }).select('_id').lean();
  if (!roles.length) return [];
  const admins = await Admin.find({ roles: { $in: roles.map((r) => r._id) }, isActive: true }).select('_id').lean();
  return admins.map((a) => a._id);
}

async function notifyReminders(now) {
  const windowStart = new Date(now.getTime() + 25 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 30 * 60 * 1000);
  const leads = await Lead.find({
    status: { $nin: NON_ACTIVE_STATUSES },
    assignedTo: { $ne: null },
    nextFollowUpDate: { $gte: windowStart, $lte: windowEnd },
    followUpReminderSentAt: null
  }).select('fullName assignedTo nextFollowUpDate');

  for (const lead of leads) {
    await Notification.create({
      recipient: lead.assignedTo,
      type: 'followup_reminder',
      title: 'Follow-up in 30 minutes',
      message: `${lead.fullName} is due for a follow-up at ${new Date(lead.nextFollowUpDate).toLocaleTimeString()}`,
      link: `/employee/dashboard?tab=leads&leadId=${lead._id}`,
      lead: lead._id
    });
    await Lead.updateOne({ _id: lead._id }, { $set: { followUpReminderSentAt: now } });
  }
  return leads.length;
}

async function notifyDue(now) {
  const leads = await Lead.find({
    status: { $nin: NON_ACTIVE_STATUSES },
    assignedTo: { $ne: null },
    nextFollowUpDate: { $lte: now },
    followUpDueNotifiedAt: null
  }).select('fullName assignedTo nextFollowUpDate');

  for (const lead of leads) {
    await Notification.create({
      recipient: lead.assignedTo,
      type: 'followup_due',
      title: 'Follow-up due now',
      message: `${lead.fullName}'s scheduled follow-up is due now.`,
      link: `/employee/dashboard?tab=leads&leadId=${lead._id}`,
      lead: lead._id
    });
    await Lead.updateOne({ _id: lead._id }, { $set: { followUpDueNotifiedAt: now } });
  }
  return leads.length;
}

async function notifyOverdueBD(now) {
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const leads = await Lead.find({
    status: { $nin: NON_ACTIVE_STATUSES },
    assignedTo: { $ne: null },
    nextFollowUpDate: { $lte: oneHourAgo },
    followUpOverdueBDNotifiedAt: null
  }).select('fullName assignedTo nextFollowUpDate');

  for (const lead of leads) {
    await Notification.create({
      recipient: lead.assignedTo,
      type: 'followup_overdue',
      title: 'Follow-up overdue',
      message: `${lead.fullName}'s follow-up is over an hour overdue.`,
      link: `/employee/dashboard?tab=leads&leadId=${lead._id}`,
      lead: lead._id
    });
    await Lead.updateOne({ _id: lead._id }, { $set: { followUpOverdueBDNotifiedAt: now } });
  }
  return leads.length;
}

async function escalateToManagers(now) {
  const leads = await Lead.find({
    status: { $nin: NON_ACTIVE_STATUSES },
    assignedTo: { $ne: null },
    nextFollowUpDate: { $lte: now },
    followUpOverdueManagerNotifiedAt: null
  }).select('fullName assignedTo nextFollowUpDate');

  if (!leads.length) return 0;
  const managerIds = await getManagerAdminIds();

  for (const lead of leads) {
    for (const managerId of managerIds) {
      await Notification.create({
        recipient: managerId,
        type: 'followup_overdue_manager',
        title: 'BD follow-up overdue (EOD)',
        message: `${lead.fullName}'s follow-up is still overdue at end of day.`,
        link: `/admin/leads?leadId=${lead._id}`,
        lead: lead._id
      });
    }
    await Lead.updateOne({ _id: lead._id }, { $set: { followUpOverdueManagerNotifiedAt: now } });
  }
  return leads.length;
}

async function flagBreaches(now) {
  const leads = await Lead.find({
    status: { $nin: NON_ACTIVE_STATUSES },
    assignedTo: { $ne: null },
    nextFollowUpDate: { $lte: now },
    // Mongo's exact-match {field: false} would miss legacy leads that
    // predate this field entirely — {$ne: true} catches both false and absent.
    followUpBreached: { $ne: true }
  }).select('fullName assignedTo nextFollowUpDate');

  if (!leads.length) return 0;
  const managerIds = await getManagerAdminIds();

  for (const lead of leads) {
    await Notification.create({
      recipient: lead.assignedTo,
      type: 'followup_breach',
      title: 'Follow-up Breach',
      message: `${lead.fullName}'s follow-up was missed and is now flagged as a breach.`,
      link: `/employee/dashboard?tab=leads&leadId=${lead._id}`,
      lead: lead._id
    });
    for (const managerId of managerIds) {
      await Notification.create({
        recipient: managerId,
        type: 'followup_breach',
        title: 'Follow-up Breach',
        message: `${lead.fullName}'s follow-up was missed and is now flagged as a breach.`,
        link: `/admin/leads?leadId=${lead._id}`,
        lead: lead._id
      });
    }
    await Lead.updateOne({ _id: lead._id }, { $set: { followUpBreached: true, followUpBreachedAt: now } });
  }
  return leads.length;
}

/** Runs the 30-min-prior / due / 1hr-overdue-to-BD checks. Called every 5 minutes. */
async function runFollowUpChecks() {
  const now = new Date();
  try {
    const [reminders, due, overdue] = await Promise.all([
      notifyReminders(now),
      notifyDue(now),
      notifyOverdueBD(now)
    ]);
    if (reminders || due || overdue) {
      logger.info(`Follow-up engine: ${reminders} reminders, ${due} due-now, ${overdue} overdue-to-BD.`);
    }
  } catch (error) {
    logger.error('Error in follow-up engine (checks):', error);
  }
}

/** EOD escalation to managers. Called once daily. */
async function runEODEscalation() {
  const now = new Date();
  try {
    const count = await escalateToManagers(now);
    if (count) logger.info(`Follow-up engine: escalated ${count} overdue leads to managers.`);
  } catch (error) {
    logger.error('Error in follow-up engine (EOD escalation):', error);
  }
}

/** Next-day breach flagging. Called once daily. */
async function runBreachFlagging() {
  const now = new Date();
  try {
    const count = await flagBreaches(now);
    if (count) logger.info(`Follow-up engine: flagged ${count} leads as Follow-up Breach.`);
  } catch (error) {
    logger.error('Error in follow-up engine (breach flagging):', error);
  }
}

module.exports = { runFollowUpChecks, runEODEscalation, runBreachFlagging };
