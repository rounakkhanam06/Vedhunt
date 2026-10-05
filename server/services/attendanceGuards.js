// Nightly safety net for attendance: anyone who clocked in today but never
// clocked out is flagged (missedClockOut) so HR can correct the day, and a
// still-running work timer is closed instead of counting all night.
const Employee = require('../models/Employee');
const { closeActiveTimer } = require('./workTimer');
const { notifyStaff, notifyPermissionHolders } = require('./staffNotify');
const logger = require('../utils/logger');

async function flagMissedClockOuts(now = new Date()) {
  const today = now.toDateString();
  const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
  const candidates = await Employee.find({ attendance: { $elemMatch: { date: { $gte: dayStart }, clockIn: { $nin: [null, ''] } } } });
  const flagged = [];

  for (const emp of candidates) {
    const log = emp.attendance.find((a) => new Date(a.date).toDateString() === today);
    if (!log || !log.clockIn || log.clockOut || log.missedClockOut) continue;
    log.missedClockOut = true;
    if (emp.activeTimer && emp.activeTimer.startTime) {
      await closeActiveTimer(emp, { remarks: 'Stopped automatically — no clock-out today.' }, now);
    }
    if (!emp.phone) emp.phone = '0000000000'; // legacy records missing a required field
    await emp.save();
    flagged.push(`${emp.firstName} ${emp.lastName}`);
    if (emp.adminId) {
      await notifyStaff(emp.adminId, {
        type: 'attendance_missed_clockout',
        title: 'You did not clock out today',
        message: 'Your attendance for today is marked "clock-out missing". Contact HR if it needs correcting.',
        link: '/employee/dashboard?tab=attendance',
      });
    }
  }

  if (flagged.length) {
    await notifyPermissionHolders('team.manage', {
      type: 'attendance_missed_clockout',
      title: `${flagged.length} missed clock-out${flagged.length > 1 ? 's' : ''} today`,
      message: flagged.slice(0, 5).join(', ') + (flagged.length > 5 ? ` and ${flagged.length - 5} more` : ''),
      link: '/admin/attendance-roster',
    });
  }
  logger.info(`Missed clock-out check: ${flagged.length} flagged.`);
  return flagged;
}

module.exports = { flagMissedClockOuts };
