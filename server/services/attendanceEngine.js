const { buildRegister } = require('./attendanceRegister');

/**
 * Day-by-day attendance for one employee/month, used by the payroll engine to
 * derive LOP (loss-of-pay) days.
 *
 * Reads the Attendance Register (services/attendanceRegister.js), so payroll
 * and the register HR sees always agree. Check-in / check-out on
 * Employee.attendance is the source of truth; timesheet entries only stand in
 * on a day with no clock-in (timesheets otherwise track project / billable
 * hours, not attendance).
 *
 * Per working day (Sundays and holidays are never loss of pay):
 *   Present (incl. a missed clock-out)  → 1 present
 *   Half Day                            → 0.5 present + 0.5 LOP
 *   Absent                              → 1 LOP
 *   Leave, paid                         → 1 paid leave
 *   Leave beyond the balance (unpaid)   → 1 LOP
 *   Not employed / today not clocked in yet / future → not counted
 *
 * If HR approved more leave than a balance allows, the extra days are already
 * unpaid on the LeaveRequest (services/leavePolicy.js). The payroll review step
 * (PayrollRun stays Draft/UnderReview until HR approves) is still the place to
 * correct lopDays by hand.
 *
 * @param {import('mongoose').Document} employee
 * @param {number} month 1-12
 * @param {number} year
 * @returns {Promise<{ totalDaysInMonth: number, presentDays: number, paidLeaveDays: number, lopDays: number }>}
 */
async function computeMonthlyAttendance(employee, month, year) {
  const pad = (n) => String(n).padStart(2, '0');
  const totalDaysInMonth = new Date(year, month, 0).getDate();
  const register = await buildRegister({
    from: `${year}-${pad(month)}-01`,
    to: `${year}-${pad(month)}-${pad(totalDaysInMonth)}`,
    employeeIds: [employee._id],
  });
  const days = register.ok ? register.employees[0]?.days || [] : [];

  let presentDays = 0;
  let paidLeaveDays = 0;
  let lopDays = 0;
  for (const day of days) {
    if (day.status === 'Leave') {
      if (day.unpaidLeave) lopDays += 1; else paidLeaveDays += 1;
    } else if (day.offDay) {
      // Weekly off or holiday — not a working day, even if worked
    } else if (day.status === 'Present') {
      presentDays += 1;
    } else if (day.status === 'Half Day') {
      presentDays += 0.5;
      lopDays += 0.5;
    } else if (day.status === 'Absent') {
      lopDays += 1;
    }
  }
  return { totalDaysInMonth, presentDays, paidLeaveDays, lopDays };
}

module.exports = { computeMonthlyAttendance };
