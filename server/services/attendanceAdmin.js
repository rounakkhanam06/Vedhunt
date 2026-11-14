// Admin manual attendance entry — for moving manual (paper/Excel) records into
// the system and fixing any past day directly. Unlike employee correction
// requests (last 30 days, manager approval), an admin with attendance edit
// access can set any past day. Every change is written to the audit log with
// the previous values.
const Employee = require('../models/Employee');
const Settings = require('../models/Settings');
const AuditLog = require('../models/AuditLog');
const { formatHHmm, parseClock, lateByMinutes } = require('../utils/clockTime');
const logger = require('../utils/logger');

const STATUSES = ['Present', 'Absent', 'Leave', 'Holiday', 'Weekend'];

const ok = (data = {}) => ({ ok: true, ...data });
const fail = (status, message) => ({ ok: false, status, message });

const parseDayStr = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '').slice(0, 10));
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getMonth() === Number(m[2]) - 1 ? d : null;
};

const snapshot = (a) =>
  a
    ? {
        status: a.status,
        clockIn: a.clockIn || '',
        clockOut: a.clockOut || '',
        lateByMins: a.lateByMins || 0,
        missedClockOut: Boolean(a.missedClockOut),
      }
    : null;

/**
 * Set (create or overwrite) one employee's attendance for one day.
 * body: { date: 'YYYY-MM-DD', status, clockIn?, clockOut?, reason }
 */
async function setAttendanceDay(admin, employeeId, body, ipAddress) {
  const day = parseDayStr(body.date);
  if (!day) return fail(400, 'Please choose a valid date.');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (day > today) return fail(400, 'Attendance cannot be entered for a future date.');

  const status = String(body.status || '');
  if (!STATUSES.includes(status)) return fail(400, `Status must be one of: ${STATUSES.join(', ')}.`);

  const reason = String(body.reason || '').trim();
  if (reason.length < 3) return fail(400, 'Please enter a reason (e.g. "Migrated from manual register").');
  if (reason.length > 500) return fail(400, 'Reason is too long (max 500 characters).');

  let clockIn = '';
  let clockOut = '';
  if (status === 'Present') {
    clockIn = formatHHmm(body.clockIn);
    if (!clockIn) return fail(400, 'Please enter the check-in time for a Present day.');
    if (body.clockOut) {
      clockOut = formatHHmm(body.clockOut);
      if (!clockOut) return fail(400, 'Check-out time is not valid.');
      if (parseClock(clockOut) <= parseClock(clockIn)) return fail(400, 'Check-out must be after check-in.');
    }
  }

  const start = new Date(day);
  const end = new Date(day);
  end.setHours(23, 59, 59, 999);
  const employee = await Employee.findById(employeeId, {
    firstName: 1,
    lastName: 1,
    attendance: { $elemMatch: { date: { $gte: start, $lte: end } } },
  }).lean();
  if (!employee) return fail(404, 'Employee not found.');
  const existing = employee.attendance?.[0] || null;

  let lateByMins = 0;
  if (status === 'Present') {
    const officeTimings = (await Settings.findOne({ key: 'office_timings' }).lean())?.value;
    lateByMins = lateByMinutes(parseClock(clockIn), officeTimings?.standardStartTime);
  }

  const fields = {
    status,
    clockIn,
    clockOut,
    lateByMins,
    // A past Present day with no check-out is shown as a missed clock-out
    missedClockOut: status === 'Present' && !clockOut && day < today,
    manualEntry: true,
    editedBy: admin._id,
    editedAt: new Date(),
    editReason: reason,
  };

  if (existing) {
    const set = Object.fromEntries(Object.entries(fields).map(([k, v]) => [`attendance.$.${k}`, v]));
    await Employee.updateOne({ _id: employee._id, 'attendance._id': existing._id }, { $set: set });
  } else {
    // Stored at the check-in time (or start of day), like clock-in records
    const date = status === 'Present' ? new Date(start.getTime() + parseClock(clockIn) * 60000) : start;
    await Employee.updateOne({ _id: employee._id }, { $push: { attendance: { date, ...fields } } });
  }

  await AuditLog.create({
    adminId: admin._id,
    action: existing ? 'ATTENDANCE_EDITED' : 'ATTENDANCE_ADDED',
    resource: 'Attendance',
    beforeSnapshot: existing ? { employee: employee._id, date: start, ...snapshot(existing) } : null,
    afterSnapshot: { employee: employee._id, date: start, status, clockIn, clockOut, lateByMins, reason },
    ipAddress,
  }).catch((e) => logger.error('Audit log failed (attendance edit):', e.message));

  return ok({
    message: `${existing ? 'Updated' : 'Added'} attendance for ${employee.firstName} ${employee.lastName}.`,
    record: { date: start, ...fields },
  });
}

/** Remove one day's attendance record (e.g. entered by mistake). */
async function clearAttendanceDay(admin, employeeId, dateStr, reason, ipAddress) {
  const day = parseDayStr(dateStr);
  if (!day) return fail(400, 'Please choose a valid date.');
  const text = String(reason || '').trim();
  if (text.length < 3) return fail(400, 'Please enter a reason for removing this record.');

  const end = new Date(day);
  end.setHours(23, 59, 59, 999);
  const employee = await Employee.findById(employeeId, {
    attendance: { $elemMatch: { date: { $gte: day, $lte: end } } },
  }).lean();
  if (!employee) return fail(404, 'Employee not found.');
  const existing = employee.attendance?.[0];
  if (!existing) return fail(404, 'There is no attendance record for that day.');

  await Employee.updateOne({ _id: employee._id }, { $pull: { attendance: { _id: existing._id } } });
  await AuditLog.create({
    adminId: admin._id,
    action: 'ATTENDANCE_REMOVED',
    resource: 'Attendance',
    beforeSnapshot: { employee: employee._id, date: day, ...snapshot(existing) },
    afterSnapshot: { reason: text },
    ipAddress,
  }).catch((e) => logger.error('Audit log failed (attendance remove):', e.message));
  return ok({ message: 'Attendance record removed.' });
}

module.exports = { setAttendanceDay, clearAttendanceDay, STATUSES };
