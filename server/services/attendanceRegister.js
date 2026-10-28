// Attendance Register: each employee's day-by-day attendance for any date range
// (a day, a month, or From–To), with per-employee and per-month summaries and
// an Excel export. Used by the Admin panel (HRMS → Attendance → Register) and
// by employees for their own record (Employee Portal → Attendance).
//
// What a day counts as, in this order:
//   before the joining date / after termination → Not employed (not counted)
//   Sunday → Weekly Off, a Holiday → Holiday (a day worked anyway shows as worked)
//   approved leave (LeaveRequest) or a 'Leave' attendance entry → Leave
//   approved leave beyond the balance → Leave, marked unpaid (payroll: LOP)
//   clocked in → Present, or Half Day when the check-in is after the half-day
//     limit or the hours are under the half-day threshold (Settings.attendance_rules).
//     A missed clock-out (checked in, never checked out) counts as Present.
//   Payroll counts days exactly from this register (services/attendanceEngine.js).
//   no clock-in on a past working day → Absent; today → Not clocked in; future → Upcoming
//
// Check-in / check-out come from the attendance clock (Employee.attendance, which an
// approved regularization overwrites). Days with no clock-in but timer entries
// (WorkLog) fall back to the first start and last end of those entries.
//
// Working hours = check-out − check-in. Colour band for complete days:
//   more than 8 h → 'over' (green), exactly 8 h → 'exact' (amber), less → 'under' (red)
const ExcelJS = require('exceljs');
const mongoose = require('mongoose');
const Employee = require('../models/Employee');
const WorkLog = require('../models/WorkLog');
const Holiday = require('../models/Holiday');
const LeaveRequest = require('../models/LeaveRequest');
const Settings = require('../models/Settings');
const { parseClock, formatClock } = require('../utils/clockTime');
const { unpaidDatesOf } = require('./leavePolicy');

const MAX_RANGE_DAYS = 366;
const STANDARD_MINUTES = 8 * 60;
const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "YYYY-MM-DD" → local midnight, or null. */
function parseDay(value) {
  const m = DAY_RE.exec(String(value || '').trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getMonth() === Number(m[2]) - 1 ? d : null;
}

/** 510 → "8h 30m" */
const hoursText = (minutes) => (minutes == null ? '' : `${Math.floor(minutes / 60)}h ${pad(minutes % 60)}m`);

/** 'over' (> 8 h, green), 'exact' (8 h, amber), 'under' (< 8 h, red) */
const hoursBand = (minutes) => (minutes == null ? null : minutes > STANDARD_MINUTES ? 'over' : minutes === STANDARD_MINUTES ? 'exact' : 'under');

/** Validates the range: { from, to } as dates, or { error }. */
function parseRange(fromStr, toStr) {
  const from = parseDay(fromStr);
  const to = parseDay(toStr || fromStr);
  if (!from || !to) return { error: 'Please choose a valid From and To date.' };
  if (to < from) return { error: 'The To date cannot be before the From date.' };
  const span = Math.round((to - from) / 86400000) + 1;
  if (span > MAX_RANGE_DAYS) return { error: `A range can cover up to ${MAX_RANGE_DAYS} days.` };
  return { from, to };
}

const emptyTotals = () => ({
  present: 0, halfDay: 0, absent: 0, leave: 0, unpaidLeave: 0, holiday: 0, weeklyOff: 0,
  lateDays: 0, missedClockOut: 0, workedMinutes: 0, daysWithHours: 0, standardDays: 0, standardDaysToDate: 0,
});

function addToTotals(t, day) {
  if (day.status === 'Present') t.present += 1;
  else if (day.status === 'Half Day') t.halfDay += 1;
  else if (day.status === 'Absent') t.absent += 1;
  else if (day.status === 'Leave') { t.leave += 1; if (day.unpaidLeave) t.unpaidLeave += 1; }
  else if (day.status === 'Holiday') t.holiday += 1;
  else if (day.status === 'Weekly Off') t.weeklyOff += 1;
  if (day.lateByMins > 0) t.lateDays += 1;
  // Standard hours: every day of employment except Sundays and holidays, 8 h each
  // (leave days included — they are still working days, just not worked)
  if (!day.offDay && day.status !== 'Not employed') {
    t.standardDays += 1;
    if (day.status !== 'Upcoming') t.standardDaysToDate += 1;
  }
  if (day.missedClockOut) t.missedClockOut += 1;
  if (day.workedMinutes != null) { t.workedMinutes += day.workedMinutes; t.daysWithHours += 1; }
}

function finishTotals(t) {
  return {
    ...t,
    // Days the employee was expected to work (excludes weekly offs and holidays)
    workingDays: t.present + t.halfDay + t.absent + t.leave,
    // Present days with a half day counted as 0.5
    presentDays: t.present + t.halfDay / 2,
    avgMinutes: t.daysWithHours ? Math.round(t.workedMinutes / t.daysWithHours) : null,
    standardMinutes: t.standardDays * STANDARD_MINUTES,
    standardMinutesToDate: t.standardDaysToDate * STANDARD_MINUTES,
  };
}

/**
 * @param {object} opts
 * @param {string} opts.from        YYYY-MM-DD
 * @param {string} opts.to          YYYY-MM-DD (defaults to from)
 * @param {Array|null} opts.employeeIds  limit to these Employee _ids (null = everyone)
 * @param {string} [opts.search]    employee name / ID / email contains
 * @returns {Promise<{ok:false,status,message}|{ok:true, from, to, dates, employees}>}
 */
async function buildRegister({ from: fromStr, to: toStr, employeeIds = null, search = '' }) {
  const range = parseRange(fromStr, toStr);
  if (range.error) return { ok: false, status: 400, message: range.error };
  const { from, to } = range;
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999);

  const match = { adminId: { $exists: true } };
  if (employeeIds) match._id = { $in: employeeIds.map((id) => new mongoose.Types.ObjectId(String(id))) };
  const text = String(search || '').trim().slice(0, 60);
  if (text) {
    const words = text.split(/\s+/).map((w) => new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
    match.$and = words.map((re) => ({ $or: [{ firstName: re }, { lastName: re }, { employeeId: re }, { email: re }] }));
  }
  const employees = await Employee.aggregate([
    { $match: match },
    { $sort: { firstName: 1, lastName: 1 } },
    { $project: {
      firstName: 1, lastName: 1, employeeId: 1, email: 1, department: 1, roleDept: 1, designation: 1, joinDate: 1,
      'probation.status': 1, 'probation.terminatedAt': 1,
      attendance: { $filter: { input: { $ifNull: ['$attendance', []] }, as: 'a', cond: { $and: [{ $gte: ['$$a.date', from] }, { $lte: ['$$a.date', end] }] } } },
    } },
  ]);
  const ids = employees.map((e) => e._id);

  const [holidays, leaves, worklogs, rulesDoc] = await Promise.all([
    Holiday.find({ date: { $gte: from, $lte: end } }).select('date name').lean(),
    LeaveRequest.find({ employeeId: { $in: ids }, status: 'Approved', startDate: { $lte: end }, endDate: { $gte: from } }).select('employeeId startDate endDate leaveType unpaidDays').lean(),
    WorkLog.find({ employeeId: { $in: ids }, startTime: { $gte: from, $lte: end } }).select('employeeId startTime endTime duration').sort({ startTime: 1 }).lean(),
    Settings.findOne({ key: 'attendance_rules' }).lean(),
  ]);
  const rules = { halfDayCheckInLimit: '13:00', halfDayHoursThreshold: 4.5, ...(rulesDoc?.value || {}) };
  const halfDayLimit = parseClock(rules.halfDayCheckInLimit) ?? 13 * 60;
  const halfDayMinutes = Number(rules.halfDayHoursThreshold || 4.5) * 60;

  const holidayOn = new Map(holidays.map((h) => [ymd(new Date(h.date)), h.name || 'Holiday']));
  const leavesOf = new Map();
  for (const l of leaves) {
    l.unpaidOn = await unpaidDatesOf(l);
    const k = String(l.employeeId);
    leavesOf.set(k, [...(leavesOf.get(k) || []), l]);
  }
  const logsOf = new Map();
  for (const w of worklogs) {
    const k = `${w.employeeId}|${ymd(new Date(w.startTime))}`;
    logsOf.set(k, [...(logsOf.get(k) || []), w]);
  }

  const now = new Date();
  const todayKey = ymd(now);
  const dates = [];
  for (let d = new Date(from); d <= to; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) dates.push(d);

  const rows = employees.map((emp) => {
    const attendanceOn = new Map((emp.attendance || []).map((a) => [ymd(new Date(a.date)), a]));
    const myLeaves = leavesOf.get(String(emp._id)) || [];
    const joined = emp.joinDate ? new Date(emp.joinDate) : null;
    const left = emp.probation?.status === 'Terminated' && emp.probation.terminatedAt ? new Date(emp.probation.terminatedAt) : null;
    const totals = emptyTotals();
    const months = new Map();

    const days = dates.map((d) => {
      const key = ymd(d);
      const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
      const att = attendanceOn.get(key);
      const logs = logsOf.get(`${emp._id}|${key}`) || [];
      const leave = myLeaves.find((l) => d >= new Date(l.startDate).setHours(0, 0, 0, 0) && d <= new Date(l.endDate).setHours(23, 59, 59, 999));
      const isFuture = key > todayKey;
      const isToday = key === todayKey;
      const day = {
        date: key, weekday: WEEKDAY[d.getDay()], status: 'Absent',
        checkIn: null, checkOut: null, workedMinutes: null, hoursBand: null,
        lateByMins: 0, missedClockOut: false, regularized: false, inProgress: false, unpaidLeave: false, note: '',
        offDay: d.getDay() === 0 || holidayOn.has(key), // weekly off or holiday: never loss of pay
      };

      // Times: the attendance clock first, then timer entries
      let inMin = null;
      if (att?.clockIn) {
        day.checkIn = att.clockIn;
        day.checkOut = att.clockOut || null;
        day.lateByMins = att.lateByMins || 0;
        day.regularized = Boolean(att.regularized);
        inMin = parseClock(att.clockIn);
        const outMin = parseClock(att.clockOut);
        if (inMin != null && outMin != null && outMin > inMin) day.workedMinutes = outMin - inMin;
      } else if (logs.length) {
        const first = new Date(logs[0].startTime);
        const closed = logs.filter((w) => w.endTime);
        const lastEnd = closed.length ? new Date(Math.max(...closed.map((w) => new Date(w.endTime).getTime()))) : null;
        day.checkIn = formatClock(first);
        day.checkOut = lastEnd && closed.length === logs.length ? formatClock(lastEnd) : null;
        inMin = first.getHours() * 60 + first.getMinutes();
        if (day.checkOut) day.workedMinutes = closed.reduce((n, w) => n + (w.duration || 0), 0);
        day.note = 'From timesheet entries';
      }
      const worked = Boolean(day.checkIn);
      if (worked && !day.checkOut) {
        if (isToday) day.inProgress = true;
        else day.missedClockOut = true;
      }

      if ((joined && dayEnd < joined) || (left && d > left)) {
        day.status = 'Not employed';
      } else if (!worked && d.getDay() === 0) {
        day.status = 'Weekly Off';
      } else if (!worked && holidayOn.has(key)) {
        day.status = 'Holiday';
        day.note = holidayOn.get(key);
      } else if (leave || att?.status === 'Leave') {
        // Sundays and holidays inside a leave range stay Weekly Off / Holiday (leave is not charged for them)
        day.status = 'Leave';
        day.unpaidLeave = Boolean(leave?.unpaidOn?.has(d.toDateString()));
        day.note = [leave?.leaveType, day.unpaidLeave ? 'unpaid (beyond balance)' : '', worked ? 'clocked in while on leave' : ''].filter(Boolean).join(' · ');
      } else if (worked) {
        // A missed clock-out is a full day (no check-out to judge the hours or a late half day by)
        const halfDay = !day.missedClockOut && ((inMin != null && inMin > halfDayLimit) || (day.workedMinutes != null && day.workedMinutes < halfDayMinutes));
        day.status = halfDay ? 'Half Day' : 'Present';
        if (d.getDay() === 0) day.note = 'Worked on weekly off';
        else if (holidayOn.has(key)) day.note = `Worked on holiday (${holidayOn.get(key)})`;
      } else if (isFuture) {
        day.status = 'Upcoming';
      } else if (isToday) {
        day.status = 'Not clocked in';
      } else {
        day.status = 'Absent';
      }
      if (day.missedClockOut && !day.note) day.note = 'Clock-out missing';
      if (day.regularized && !day.note) day.note = 'Regularized';
      day.hoursBand = day.inProgress ? null : hoursBand(day.workedMinutes);

      addToTotals(totals, day);
      const mk = monthKey(d);
      if (!months.has(mk)) months.set(mk, emptyTotals());
      addToTotals(months.get(mk), day);
      return day;
    });

    return {
      _id: emp._id,
      employeeId: emp.employeeId || '',
      name: `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
      email: emp.email || '',
      department: emp.department || emp.roleDept || '',
      designation: emp.designation || '',
      days,
      summary: finishTotals(totals),
      months: [...months].map(([key, t]) => {
        const [y, m] = key.split('-').map(Number);
        return { month: key, label: `${MONTH[m - 1]} ${y}`, ...finishTotals(t) };
      }),
    };
  });

  return { ok: true, from: ymd(from), to: ymd(to), dates: dates.map(ymd), employees: rows };
}

// ── Excel ────────────────────────────────────────────────────────────────────

const FILL = {
  over: 'FFC6EFCE', exact: 'FFFFE699', under: 'FFFFC7CE', // green / amber / red (hours)
  Present: 'FFC6EFCE', 'Half Day': 'FFFFE699', Absent: 'FFFFC7CE', Leave: 'FFBDD7EE',
  Holiday: 'FFE4DFEC', 'Weekly Off': 'FFEDEDED',
};
const FONT = { over: 'FF006100', exact: 'FF7F6000', under: 'FF9C0006' };
const fill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const dayLabel = (key) => {
  const d = parseDay(key);
  return `${pad(d.getDate())} ${MONTH[d.getMonth()]} ${d.getFullYear()}`;
};

function styleHeader(sheet) {
  const row = sheet.getRow(1);
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.eachCell((c) => { c.fill = fill('FF1F3864'); c.alignment = { vertical: 'middle' }; });
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
}

/** The register as an .xlsx workbook: Date-wise, Summary and Monthly Summary sheets. */
async function registerWorkbook(register) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Vedhunt';
  wb.created = new Date();
  const hours = (m) => (m == null ? '' : Math.round((m / 60) * 100) / 100);

  const daily = wb.addWorksheet('Date-wise');
  daily.columns = [
    { header: 'Employee ID', key: 'employeeId', width: 14 },
    { header: 'Name', key: 'name', width: 24 },
    { header: 'Department', key: 'department', width: 18 },
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Day', key: 'weekday', width: 6 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Check-in', key: 'checkIn', width: 11 },
    { header: 'Check-out', key: 'checkOut', width: 11 },
    { header: 'Working hours', key: 'hoursText', width: 14 },
    { header: 'Hours (decimal)', key: 'hours', width: 14 },
    { header: 'Late by (min)', key: 'late', width: 13 },
    { header: 'Note', key: 'note', width: 30 },
  ];
  for (const e of register.employees) {
    for (const d of e.days) {
      const row = daily.addRow({
        employeeId: e.employeeId, name: e.name, department: e.department,
        date: dayLabel(d.date), weekday: d.weekday, status: d.status,
        checkIn: d.checkIn || '', checkOut: d.checkOut || (d.inProgress ? 'In progress' : ''),
        hoursText: hoursText(d.workedMinutes), hours: hours(d.workedMinutes),
        late: d.lateByMins || '', note: d.note,
      });
      if (FILL[d.status]) row.getCell('status').fill = fill(FILL[d.status]);
      if (d.hoursBand) {
        for (const k of ['hoursText', 'hours']) {
          row.getCell(k).fill = fill(FILL[d.hoursBand]);
          row.getCell(k).font = { color: { argb: FONT[d.hoursBand] }, bold: true };
        }
      }
    }
  }
  styleHeader(daily);

  const totalsColumns = [
    { header: 'Working days', key: 'workingDays', width: 13 },
    { header: 'Present', key: 'present', width: 9 },
    { header: 'Half Day', key: 'halfDay', width: 9 },
    { header: 'Absent', key: 'absent', width: 9 },
    { header: 'Leave', key: 'leave', width: 9 },
    { header: 'Unpaid leave', key: 'unpaidLeave', width: 12 },
    { header: 'Holidays', key: 'holiday', width: 9 },
    { header: 'Weekly offs', key: 'weeklyOff', width: 11 },
    { header: 'Present days (half = 0.5)', key: 'presentDays', width: 22 },
    { header: 'Late days', key: 'lateDays', width: 10 },
    { header: 'Missed clock-out', key: 'missedClockOut', width: 16 },
    { header: 'Total hours', key: 'totalHours', width: 12 },
    { header: 'Avg hours / day', key: 'avgHours', width: 15 },
  ];
  const totalsRow = (t) => ({
    workingDays: t.workingDays, present: t.present, halfDay: t.halfDay, absent: t.absent, leave: t.leave, unpaidLeave: t.unpaidLeave,
    holiday: t.holiday, weeklyOff: t.weeklyOff, presentDays: t.presentDays, lateDays: t.lateDays,
    missedClockOut: t.missedClockOut, totalHours: hours(t.workedMinutes), avgHours: hours(t.avgMinutes),
  });
  const colourAvg = (row, t) => {
    const band = hoursBand(t.avgMinutes);
    if (band) { row.getCell('avgHours').fill = fill(FILL[band]); row.getCell('avgHours').font = { color: { argb: FONT[band] }, bold: true }; }
  };

  const summary = wb.addWorksheet('Summary');
  summary.columns = [
    { header: 'Employee ID', key: 'employeeId', width: 14 },
    { header: 'Name', key: 'name', width: 24 },
    { header: 'Department', key: 'department', width: 18 },
    ...totalsColumns,
  ];
  for (const e of register.employees) {
    colourAvg(summary.addRow({ employeeId: e.employeeId, name: e.name, department: e.department, ...totalsRow(e.summary) }), e.summary);
  }
  styleHeader(summary);

  const monthly = wb.addWorksheet('Monthly Summary');
  monthly.columns = [
    { header: 'Month', key: 'label', width: 11 },
    { header: 'Employee ID', key: 'employeeId', width: 14 },
    { header: 'Name', key: 'name', width: 24 },
    { header: 'Department', key: 'department', width: 18 },
    ...totalsColumns,
  ];
  const byMonth = [...new Set(register.employees.flatMap((e) => e.months.map((m) => m.month)))].sort();
  for (const mk of byMonth) {
    for (const e of register.employees) {
      const m = e.months.find((x) => x.month === mk);
      if (m) colourAvg(monthly.addRow({ label: m.label, employeeId: e.employeeId, name: e.name, department: e.department, ...totalsRow(m) }), m);
    }
  }
  styleHeader(monthly);

  const info = wb.addWorksheet('About');
  info.columns = [{ width: 28 }, { width: 70 }];
  info.addRows([
    ['Attendance Register', `${dayLabel(register.from)} – ${dayLabel(register.to)}`],
    ['Generated', new Date().toLocaleString('en-IN')],
    ['Employees', register.employees.length],
    [],
    ['Working hours colour', ''],
    ['More than 8 hours', 'Green'],
    ['Exactly 8 hours', 'Amber'],
    ['Less than 8 hours', 'Red'],
    [],
    ['Working hours', 'Check-out minus check-in (attendance clock). Days with no clock-in use timesheet entries.'],
    ['Half Day', 'Check-in after the half-day limit or hours below the half-day threshold (Settings → Attendance rules). A missed clock-out counts as Present.'],
    ['Unpaid leave', 'Approved leave beyond the leave balance — deducted as loss of pay.'],
  ]);
  info.getRow(1).font = { bold: true, size: 13 };
  info.getCell('B6').fill = fill(FILL.over);
  info.getCell('B7').fill = fill(FILL.exact);
  info.getCell('B8').fill = fill(FILL.under);

  return wb.xlsx.writeBuffer();
}

/** Sends the register as an .xlsx download. */
async function sendRegisterWorkbook(res, register, namePart = 'attendance-register') {
  const buffer = await registerWorkbook(register);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${namePart}_${register.from}_to_${register.to}.xlsx"`);
  res.send(Buffer.from(buffer));
}

/**
 * Worked vs standard hours per employee for one calendar month ("YYYY-MM") —
 * the register's monthly totals without the day-by-day rows.
 */
async function monthlyHours({ month, employeeIds = null }) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(month || ''));
  if (!m) return { ok: false, status: 400, message: 'Please choose a valid month.' };
  const last = new Date(Number(m[1]), Number(m[2]), 0).getDate();
  const result = await buildRegister({ from: `${m[1]}-${m[2]}-01`, to: `${m[1]}-${m[2]}-${pad(last)}`, employeeIds });
  if (!result.ok) return result;
  return {
    ok: true,
    month: `${m[1]}-${m[2]}`,
    employees: result.employees.map((e) => ({
      _id: e._id,
      workedMinutes: e.summary.workedMinutes,
      standardMinutes: e.summary.standardMinutes,
      standardDays: e.summary.standardDays,
      standardMinutesToDate: e.summary.standardMinutesToDate,
      presentDays: e.summary.presentDays,
      leave: e.summary.leave,
      holiday: e.summary.holiday,
      missedClockOut: e.summary.missedClockOut,
    })),
  };
}

module.exports = { monthlyHours, buildRegister, registerWorkbook, sendRegisterWorkbook, hoursBand, parseRange, MAX_RANGE_DAYS };
