const Holiday = require('../models/Holiday');
const WorkLog = require('../models/WorkLog');
const LeaveRequest = require('../models/LeaveRequest');
const Settings = require('../models/Settings');

/**
 * Day-by-day attendance reconciliation for one employee/month, used by the
 * payroll engine to derive LOP (loss-of-pay) days.
 *
 * Mirrors the day-status logic already used by
 * GET /employees/admin/attendance/monthly/:id (Present/Half Day/Absent from
 * WorkLog + Holiday + Settings.attendance_rules half-day threshold), pulled
 * out here so payroll and the attendance roster agree on what a day counts
 * as. The one addition: paid-leave days are read directly from Approved
 * LeaveRequest documents, not the legacy Employee.attendance[] 'Leave'
 * marker.
 *
 * Deliberately does NOT try to detect "approved leave beyond remaining
 * balance" as LOP — that's a leave-approval-process concern, not payroll's;
 * if HR approved more leave than a balance allows, the payroll review step
 * (PayrollRun stays Draft/UnderReview until HR approves) is the place to
 * correct lopDays by hand.
 *
 * @param {import('mongoose').Document} employee
 * @param {number} month 1-12
 * @param {number} year
 * @returns {Promise<{ totalDaysInMonth: number, presentDays: number, paidLeaveDays: number, lopDays: number }>}
 */
async function computeMonthlyAttendance(employee, month, year) {
  const monthIndex = month - 1; // JS Date months are 0-indexed
  const startDate = new Date(year, monthIndex, 1);
  const endDate = new Date(year, monthIndex + 1, 0);
  endDate.setHours(23, 59, 59, 999);
  const totalDaysInMonth = endDate.getDate();

  const today = new Date();
  const limitDate = endDate > today ? today : endDate;

  const [settingDoc, holidays, worklogs, approvedLeaves] = await Promise.all([
    Settings.findOne({ key: 'attendance_rules' }),
    Holiday.find({ date: { $gte: startDate, $lte: endDate } }),
    WorkLog.find({ employeeId: employee._id, startTime: { $gte: startDate, $lte: endDate } }),
    LeaveRequest.find({
      employeeId: employee._id,
      status: 'Approved',
      startDate: { $lte: endDate },
      endDate: { $gte: startDate }
    })
  ]);

  const rules = settingDoc ? settingDoc.value : { halfDayCheckInLimit: '13:00', halfDayHoursThreshold: 4.5 };
  const [halfDayHour, halfDayMin] = rules.halfDayCheckInLimit.split(':').map(Number);

  const holidayDates = new Set(holidays.map((h) => new Date(h.date).toDateString()));

  const worklogsByDate = {};
  worklogs.forEach((wl) => {
    const key = new Date(wl.startTime).toDateString();
    (worklogsByDate[key] = worklogsByDate[key] || []).push(wl);
  });

  const isOnApprovedLeave = (date) =>
    approvedLeaves.some((lr) => date >= new Date(lr.startDate).setHours(0, 0, 0, 0) && date <= new Date(lr.endDate).setHours(23, 59, 59, 999));

  let presentDays = 0;
  let paidLeaveDays = 0;
  let lopDays = 0;

  const cursor = new Date(startDate);
  while (cursor <= limitDate) {
    const dateStr = cursor.toDateString();
    const isWeekend = cursor.getDay() === 0;
    const isHoliday = holidayDates.has(dateStr);

    if (isWeekend || isHoliday) {
      // Not a working day — excluded from present/paid-leave/LOP tallies.
    } else if (isOnApprovedLeave(cursor.getTime())) {
      paidLeaveDays += 1;
    } else {
      const dayLogs = worklogsByDate[dateStr] || [];
      if (dayLogs.length === 0) {
        lopDays += 1;
      } else {
        let totalMins = 0;
        const checkIn = new Date(dayLogs[0].startTime);
        dayLogs.forEach((wl) => { if (wl.endTime) totalMins += wl.duration || 0; });
        const totalHours = totalMins / 60;

        const halfDayLimit = new Date(cursor);
        halfDayLimit.setHours(halfDayHour, halfDayMin, 0, 0);

        if (checkIn > halfDayLimit || totalHours < rules.halfDayHoursThreshold) {
          presentDays += 0.5;
          lopDays += 0.5;
        } else {
          presentDays += 1;
        }
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return { totalDaysInMonth, presentDays, paidLeaveDays, lopDays };
}

module.exports = { computeMonthlyAttendance };
