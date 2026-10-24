// Who has not clocked in on a day (System Activity & Audit Logs). "Signed in"
// means the attendance clock-in on Employee.attendance — logging in to the
// panel does not count. Days are calendar days in the server timezone (IST by
// default, see server.js). Employees who are excused that day (Sunday, a
// holiday, approved leave, not yet joined, terminated) are returned apart from
// the missing list rather than silently dropped.
const Employee = require('../models/Employee');
const Holiday = require('../models/Holiday');
const LeaveRequest = require('../models/LeaveRequest');

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** { start, end } for a YYYY-MM-DD day, or null when the input is not a valid day. */
function dayBounds(day) {
  if (!DAY.test(String(day || ''))) return null;
  const start = new Date(`${day}T00:00:00`);
  const end = new Date(`${day}T23:59:59.999`);
  return Number.isNaN(start.getTime()) ? null : { start, end };
}

const todayKey = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Why `emp` is not expected to clock in between start and end, or null. */
function excuse(emp, { start, end }, { sunday, holiday, leaveIds }) {
  if (emp.probation?.status === 'Terminated' && emp.probation.terminatedAt && new Date(emp.probation.terminatedAt) <= end) return 'Terminated';
  if (emp.joinDate && new Date(emp.joinDate) > end) return 'Not joined yet';
  if (sunday) return 'Weekend';
  if (holiday) return `Holiday: ${holiday.name}`;
  if (leaveIds.has(String(emp._id))) return 'On approved leave';
  return null;
}

/**
 * @param {string} day       YYYY-MM-DD (defaults to today)
 * @param {object} [options] { employeeId } narrows to one Employee _id
 * @returns {Promise<null|{date, missing: object[], excused: object[], clockedIn: number}>} null for a bad date
 */
async function clockInReport(day = todayKey(), { employeeId } = {}) {
  const bounds = dayBounds(day);
  if (!bounds) return null;
  const { start, end } = bounds;

  const filter = employeeId ? { _id: employeeId } : {};
  const [employees, holiday, leaves] = await Promise.all([
    Employee.find(filter, 'employeeId firstName lastName department designation joinDate probation attendance').lean(),
    Holiday.findOne({ date: { $gte: start, $lte: end } }).lean(),
    LeaveRequest.find({ status: 'Approved', startDate: { $lte: end }, endDate: { $gte: start } }, 'employeeId').lean(),
  ]);
  const leaveIds = new Set(leaves.map((l) => String(l.employeeId)));
  const ctx = { sunday: start.getDay() === 0, holiday, leaveIds };

  const missing = [];
  const excused = [];
  let clockedIn = 0;
  for (const emp of employees) {
    const log = (emp.attendance || []).find((a) => a.clockIn && new Date(a.date) >= start && new Date(a.date) <= end);
    if (log) { clockedIn += 1; continue; }
    const row = {
      _id: emp._id,
      employeeId: emp.employeeId,
      name: `${emp.firstName} ${emp.lastName}`.trim(),
      department: emp.department || '',
      designation: emp.designation || '',
    };
    const reason = excuse(emp, bounds, ctx);
    if (reason) excused.push({ ...row, reason });
    else missing.push(row);
  }
  const byName = (a, b) => a.name.localeCompare(b.name);
  return { date: day, missing: missing.sort(byName), excused: excused.sort(byName), clockedIn };
}

module.exports = { clockInReport, dayBounds };
