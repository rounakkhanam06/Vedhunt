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
const FollowUpTask = require('../models/FollowUpTask');
const logger = require('../utils/logger');
const { TERMINAL_STATUSES } = require('../utils/leadStateMachine');
const { sendPushToAdmin } = require('../utils/pushNotify');

const NON_ACTIVE_STATUSES = [...TERMINAL_STATUSES, 'Hold'];

async function getManagerAdminIds() {
  const roles = await Role.find({ permissions: { $in: ['team.manage', '*'] } }).select('_id').lean();
  if (!roles.length) return [];
  const admins = await Admin.find({ roles: { $in: roles.map((r) => r._id) }, isActive: true }).select('_id').lean();
  return admins.map((a) => a._id);
}

/** Creates the in-app Notification and fires the paired push (no-ops if Firebase isn't configured — see utils/pushNotify.js). */
async function notify({ recipient, type, title, message, link, lead }) {
  await Notification.create({ recipient, type, title, message, link, lead });
  await sendPushToAdmin(recipient, { title, body: message, link });
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
    await notify({
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
  }).select('fullName leadId assignedTo nextFollowUpDate');

  for (const lead of leads) {
    await notify({
      recipient: lead.assignedTo,
      // Distinct type from the 30-min reminder so the frontend can render it
      // with priority treatment (spec: "priority notification").
      type: 'followup_due_priority',
      title: 'Follow-up due now',
      message: `${lead.fullName} (${lead.leadId}) is due right now — ${new Date(lead.nextFollowUpDate).toLocaleTimeString()}.`,
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
    await notify({
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

/**
 * Same 30-min/due-now/1hr-overdue cadence as the Lead-level checks above,
 * but for manager-created Parallel tasks (models/FollowUpTask.js) — these
 * aren't reflected in Lead.nextFollowUpDate at all, so they need their own
 * reminder pass over the FollowUpTask collection.
 */
async function notifyParallelTaskReminders(now) {
  const windowStart = new Date(now.getTime() + 25 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 30 * 60 * 1000);
  const tasks = await FollowUpTask.find({
    type: 'Parallel',
    status: 'Pending',
    dueDate: { $gte: windowStart, $lte: windowEnd },
    reminderSentAt: null
  }).select('lead assignedTo dueDate note');

  for (const task of tasks) {
    await notify({
      recipient: task.assignedTo,
      type: 'followup_reminder',
      title: 'Follow-up task in 30 minutes',
      message: task.note || 'A follow-up task you were assigned is due in 30 minutes.',
      link: `/employee/dashboard?tab=leads&leadId=${task.lead}`,
      lead: task.lead
    });
    await FollowUpTask.updateOne({ _id: task._id }, { $set: { reminderSentAt: now } });
  }
  return tasks.length;
}

async function notifyParallelTaskDue(now) {
  const tasks = await FollowUpTask.find({
    type: 'Parallel',
    status: 'Pending',
    dueDate: { $lte: now },
    dueNotifiedAt: null
  }).select('lead assignedTo dueDate note');

  for (const task of tasks) {
    await notify({
      recipient: task.assignedTo,
      type: 'followup_due_priority',
      title: 'Follow-up task due now',
      message: task.note || 'A follow-up task you were assigned is due now.',
      link: `/employee/dashboard?tab=leads&leadId=${task.lead}`,
      lead: task.lead
    });
    await FollowUpTask.updateOne({ _id: task._id }, { $set: { dueNotifiedAt: now } });
  }
  return tasks.length;
}

async function notifyParallelTaskOverdue(now) {
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const tasks = await FollowUpTask.find({
    type: 'Parallel',
    status: 'Pending',
    dueDate: { $lte: oneHourAgo },
    overdueNotifiedAt: null
  }).select('lead assignedTo dueDate note');

  for (const task of tasks) {
    await notify({
      recipient: task.assignedTo,
      type: 'followup_overdue',
      title: 'Follow-up task overdue',
      message: task.note || 'A follow-up task you were assigned is over an hour overdue.',
      link: `/employee/dashboard?tab=leads&leadId=${task.lead}`,
      lead: task.lead
    });
    await FollowUpTask.updateOne({ _id: task._id }, { $set: { overdueNotifiedAt: now } });
  }
  return tasks.length;
}

/**
 * EOD manager escalation — one consolidated digest notification per manager
 * (spec: "Manager exception report"), not one notification per overdue lead.
 */
async function escalateToManagers(now) {
  const leads = await Lead.find({
    status: { $nin: NON_ACTIVE_STATUSES },
    assignedTo: { $ne: null },
    nextFollowUpDate: { $lte: now },
    followUpOverdueManagerNotifiedAt: null
  }).populate('assignedTo', 'firstName lastName').select('fullName assignedTo nextFollowUpDate');

  if (!leads.length) return 0;
  const managerIds = await getManagerAdminIds();

  // Group by BD for the digest's breakdown line.
  const byBd = new Map();
  for (const lead of leads) {
    const bdName = lead.assignedTo ? `${lead.assignedTo.firstName} ${lead.assignedTo.lastName}`.trim() : 'Unassigned';
    byBd.set(bdName, (byBd.get(bdName) || 0) + 1);
  }
  const breakdown = [...byBd.entries()].map(([name, count]) => `${name}: ${count}`).join(', ');

  for (const managerId of managerIds) {
    await notify({
      recipient: managerId,
      type: 'followup_eod_report',
      title: `${leads.length} follow-up(s) overdue at end of day`,
      message: `By BD — ${breakdown}`,
      link: '/admin/follow-ups?bucket=Overdue',
      lead: null
    });
  }
  await Lead.updateMany(
    { _id: { $in: leads.map((l) => l._id) } },
    { $set: { followUpOverdueManagerNotifiedAt: now } }
  );
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
    await notify({
      recipient: lead.assignedTo,
      type: 'followup_breach',
      title: 'Follow-up Breach',
      message: `${lead.fullName}'s follow-up was missed and is now flagged as a breach.`,
      link: `/employee/dashboard?tab=leads&leadId=${lead._id}`,
      lead: lead._id
    });
    for (const managerId of managerIds) {
      await notify({
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

/** Runs the 30-min-prior / due / 1hr-overdue-to-BD checks (Lead + Parallel Task). Called every 5 minutes. */
async function runFollowUpChecks() {
  const now = new Date();
  try {
    const [reminders, due, overdue, taskReminders, taskDue, taskOverdue] = await Promise.all([
      notifyReminders(now),
      notifyDue(now),
      notifyOverdueBD(now),
      notifyParallelTaskReminders(now),
      notifyParallelTaskDue(now),
      notifyParallelTaskOverdue(now)
    ]);
    if (reminders || due || overdue || taskReminders || taskDue || taskOverdue) {
      logger.info(
        `Follow-up engine: ${reminders} reminders, ${due} due-now, ${overdue} overdue-to-BD ` +
        `(+ ${taskReminders} task reminders, ${taskDue} task due-now, ${taskOverdue} task overdue).`
      );
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
