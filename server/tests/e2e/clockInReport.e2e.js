/**
 * Not-clocked-in report against a throwaway in-memory MongoDB (never the
 * database in server/.env):
 *
 *   npm run test:e2e
 */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'a'.repeat(64);

let mongo;
let Employee;
let Holiday;
let LeaveRequest;
let clockInReport;

// Monday 2026-10-19 and Sunday 2026-10-25, noon local (server timezone)
const MON = '2026-10-19';
const SUN = '2026-10-25';
const at = (day, time = '12:00:00') => new Date(`${day}T${time}`);

let seq = 0;
const makeEmployee = (overrides = {}) => {
  seq += 1;
  return Employee.collection.insertOne({
    employeeId: `E${seq}`,
    adminId: new mongoose.Types.ObjectId(),
    firstName: `Emp${seq}`,
    lastName: 'Test',
    attendance: [],
    ...overrides,
  }).then((r) => r.insertedId);
};

describe('clock-in report', () => {
  before(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    Employee = require('../../models/Employee');
    Holiday = require('../../models/Holiday');
    LeaveRequest = require('../../models/LeaveRequest');
    ({ clockInReport } = require('../../services/clockInReport'));
  });

  after(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  test('rejects a malformed date', async () => {
    assert.equal(await clockInReport('24-10-2026'), null);
    assert.equal(await clockInReport('2026-13-40'), null);
  });

  test('lists only employees with no clock-in that day', async () => {
    const clocked = await makeEmployee({ attendance: [{ date: at(MON, '09:40:00'), status: 'Present', clockIn: '09:40 AM' }] });
    const absent = await makeEmployee();
    const otherDay = await makeEmployee({ attendance: [{ date: at('2026-10-18'), status: 'Present', clockIn: '09:40 AM' }] });

    const report = await clockInReport(MON);
    const missing = report.missing.map((e) => String(e._id));
    assert.ok(!missing.includes(String(clocked)));
    assert.ok(missing.includes(String(absent)));
    assert.ok(missing.includes(String(otherDay)), 'a clock-in on another day does not count');
    assert.equal(report.clockedIn, 1);
  });

  test('an attendance row without a clock-in time (Absent) is still missing', async () => {
    const id = await makeEmployee({ attendance: [{ date: at(MON), status: 'Absent' }] });
    const report = await clockInReport(MON);
    assert.ok(report.missing.some((e) => String(e._id) === String(id)));
  });

  test('approved leave is excused, a pending request is not', async () => {
    const onLeave = await makeEmployee();
    const pending = await makeEmployee();
    const base = { leaveType: 'CL', startDate: at(MON, '00:00:00'), endDate: at(MON, '00:00:00'), totalDays: 1, reason: 'test' };
    await LeaveRequest.collection.insertMany([
      { ...base, employeeId: onLeave, status: 'Approved' },
      { ...base, employeeId: pending, status: 'Pending' },
    ]);
    const report = await clockInReport(MON);
    assert.equal(report.excused.find((e) => String(e._id) === String(onLeave))?.reason, 'On approved leave');
    assert.ok(report.missing.some((e) => String(e._id) === String(pending)));
  });

  test('Sunday and holidays excuse everyone', async () => {
    const id = await makeEmployee();
    const sunday = await clockInReport(SUN);
    assert.equal(sunday.missing.length, 0);
    assert.equal(sunday.excused.find((e) => String(e._id) === String(id))?.reason, 'Weekend');

    await Holiday.collection.insertOne({ date: at('2026-10-20', '00:00:00'), name: 'Festival', type: 'Public' });
    const holiday = await clockInReport('2026-10-20');
    assert.equal(holiday.missing.length, 0);
    assert.match(holiday.excused[0].reason, /Holiday: Festival/);
  });

  test('not-yet-joined and terminated employees are excused', async () => {
    const future = await makeEmployee({ joinDate: at('2026-11-01') });
    const gone = await makeEmployee({ probation: { status: 'Terminated', terminatedAt: at('2026-10-01') } });
    const report = await clockInReport(MON);
    assert.equal(report.excused.find((e) => String(e._id) === String(future))?.reason, 'Not joined yet');
    assert.equal(report.excused.find((e) => String(e._id) === String(gone))?.reason, 'Terminated');
  });

  test('can be narrowed to one employee', async () => {
    const id = await makeEmployee();
    const report = await clockInReport(MON, { employeeId: id });
    assert.equal(report.missing.length + report.excused.length + report.clockedIn, 1);
    assert.equal(String(report.missing[0]._id), String(id));
  });
});
