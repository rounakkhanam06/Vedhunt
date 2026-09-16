/**
 * probationScheduler.js
 *
 * Daily midnight cron that manages three probation lifecycle tasks:
 *
 * 1. EL Accrual   — Credits Emergency Leave to probationary employees once
 *                   per calendar month (tracked via elAccruedMonths to avoid
 *                   double-crediting).
 * 2. Auto-Promote — When endDate has passed and status is still 'Probation',
 *                   auto-confirms the employee and activates full leave policy.
 * 3. Reminders    — Fires a bell notification to every Super Admin
 *                   `reviewReminderDaysBefore` days before probation ends
 *                   (default 14 days). Sets reviewReminderSent=true so it
 *                   only fires once.
 */

const cron = require('node-cron');
const Employee = require('../models/Employee');
const Admin = require('../models/Admin');
const Notification = require('../models/Notification');
const Settings = require('../models/Settings');
const logger = require('../utils/logger');

// -- Helpers ------------------------------------------------------------------

async function getProbationPolicy() {
  try {
    const doc = await Settings.findOne({ key: 'probation_policy' });
    if (doc && doc.value) {
      return {
        leavesPerMonth: doc.value.leavesPerMonth ?? 1,
        reviewReminderDaysBefore: doc.value.reviewReminderDaysBefore ?? 14,
        autoDeactivateOnTermination: doc.value.autoDeactivateOnTermination ?? false,
        defaultCLOnConfirm: doc.value.defaultCLOnConfirm ?? 6,
        defaultSLOnConfirm: doc.value.defaultSLOnConfirm ?? 6,
        defaultPLOnConfirm: doc.value.defaultPLOnConfirm ?? 12,
      };
    }
  } catch (err) {
    logger.error('[Probation Scheduler] Failed to load probation_policy:', err.message);
  }
  return {
    leavesPerMonth: 1,
    reviewReminderDaysBefore: 14,
    autoDeactivateOnTermination: false,
    defaultCLOnConfirm: 6,
    defaultSLOnConfirm: 6,
    defaultPLOnConfirm: 12,
  };
}

async function getSuperAdminIds() {
  const Role = require('../models/Role');
  const superRole = await Role.findOne({ name: 'SUPER_ADMIN' }).select('_id');
  if (!superRole) return [];
  const admins = await Admin.find({ roles: superRole._id, isActive: true }).select('_id');
  return admins.map(a => a._id);
}

// -- Main Job -----------------------------------------------------------------

async function runProbationJob() {
  logger.info('[Probation Scheduler] Running daily probation checks...');
  const policy = await getProbationPolicy();
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const probationaryEmployees = await Employee.find({
    'probation.isApplicable': true,
    'probation.status': 'Probation',
    employmentStatus: 'Probation',
  });

  logger.info(`[Probation Scheduler] Found ${probationaryEmployees.length} probationary employee(s).`);
  const superAdminIds = await getSuperAdminIds();

  for (const emp of probationaryEmployees) {
    const p = emp.probation;
    if (!p || !p.endDate) continue;

    const endDate = new Date(p.endDate);
    const daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
    let changed = false;

    // 1. EL Accrual
    if (!emp.probation.elAccruedMonths) emp.probation.elAccruedMonths = [];
    if (!emp.probation.elAccruedMonths.includes(currentMonth)) {
      emp.leaveBalances.EL = (emp.leaveBalances.EL || 0) + policy.leavesPerMonth;
      emp.probation.elAccruedMonths.push(currentMonth);
      changed = true;
      logger.info(`[Probation Scheduler] Credited ${policy.leavesPerMonth} EL to ${emp.employeeId} for ${currentMonth}`);
    }

    // 2. Auto-Promote
    if (daysRemaining <= 0) {
      emp.probation.status = 'Confirmed';
      emp.probation.confirmedAt = now;
      emp.employmentStatus = 'Permanent';
      emp.leaveBalances.CL = policy.defaultCLOnConfirm;
      emp.leaveBalances.SL = policy.defaultSLOnConfirm;
      emp.leaveBalances.PL = policy.defaultPLOnConfirm;
      changed = true;
      logger.info(`[Probation Scheduler] Auto-promoted ${emp.employeeId} to Permanent.`);
      for (const adminId of superAdminIds) {
        await Notification.create({
          recipient: adminId,
          type: 'probation_auto_confirmed',
          title: 'Probation Period Completed',
          message: `${emp.firstName} ${emp.lastName} (${emp.employeeId}) has been automatically confirmed as a permanent employee.`,
          link: '/admin/employees',
        });
      }
      await emp.save();
      continue;
    }

    // 3. Review Reminder
    if (daysRemaining <= policy.reviewReminderDaysBefore && !emp.probation.reviewReminderSent) {
      emp.probation.reviewReminderSent = true;
      changed = true;
      logger.info(`[Probation Scheduler] Sending review reminder for ${emp.employeeId} (${daysRemaining} days left).`);
      for (const adminId of superAdminIds) {
        await Notification.create({
          recipient: adminId,
          type: 'probation_review_due',
          title: 'Probation Review Due',
          message: `${emp.firstName} ${emp.lastName} (${emp.employeeId}) has ${daysRemaining} day(s) remaining in probation. Please confirm, extend, or terminate.`,
          link: '/admin/employees',
        });
      }
    }

    if (changed) await emp.save();
  }

  logger.info('[Probation Scheduler] Daily probation checks complete.');
}

// -- Register Cron ------------------------------------------------------------

function startProbationScheduler() {
  cron.schedule('5 0 * * *', async () => {
    try {
      await runProbationJob();
    } catch (err) {
      logger.error('[Probation Scheduler] Unhandled error in daily job:', err);
    }
  });
  logger.info('[Probation Scheduler] Registered -- fires daily at 00:05.');
}

module.exports = { startProbationScheduler, runProbationJob };
