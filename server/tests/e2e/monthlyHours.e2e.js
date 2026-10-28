/**
 * Employees list "Working Hours" (services/attendanceRegister.js monthlyHours)
 * against a throwaway in-memory MongoDB (never the database in server/.env):
 *
 *   npm run test:e2e
 */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'a'.repeat(64);

let mongo;
let monthlyHours;
const oid = () => new mongoose.Types.ObjectId();
const full = oid();
const joiner = oid();
const day = (d) => new Date(`2026-09-${String(d).padStart(2, '0')}T00:00:00`);

describe('Monthly working hours', () => {
  before(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    ({ monthlyHours } = require('../../services/attendanceRegister'));
    const db = mongoose.connection.db;
    // September 2026: 30 days, 4 Sundays (6, 13, 20, 27), a holiday on Tue 15
    await db.collection('holidays').insertOne({ date: day(15), name: 'Test Holiday', type: 'Public' });
    await db.collection('employees').insertMany([
      {
        _id: full, employeeId: 'VH-T1', adminId: oid(), firstName: 'Full', lastName: 'Month', joinDate: new Date('2026-01-01'),
        attendance: [
          { date: day(1), clockIn: '09:00', clockOut: '18:00', status: 'Present' }, // 9 h
          { date: day(2), clockIn: '09:00', clockOut: '17:00', status: 'Present' }, // 8 h
          { date: day(15), clockIn: '10:00', clockOut: '14:00', status: 'Present' }, // 4 h on the holiday
          { date: day(16), clockIn: '09:00', status: 'Present' }, // missed clock-out: no hours
        ],
      },
      // Joined mid-month: only the days from the 16th are expected
      { _id: joiner, employeeId: 'VH-T2', adminId: oid(), firstName: 'Mid', lastName: 'Joiner', joinDate: day(16), attendance: [] },
    ]);
  });

  after(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  test('standard = 8 h × working days, Sundays and holidays excluded', async () => {
    const r = await monthlyHours({ month: '2026-09' });
    assert.equal(r.ok, true);
    const f = r.employees.find((e) => String(e._id) === String(full));
    assert.equal(f.standardDays, 25); // 30 − 4 Sundays − 1 holiday
    assert.equal(f.standardMinutes, 25 * 480);
    assert.equal(f.standardMinutesToDate, 25 * 480); // a past month is all due
    assert.equal(f.workedMinutes, (9 + 8 + 4) * 60); // holiday work counts as worked, not as due
    assert.equal(f.holiday, 0); // worked on it, so not an untouched holiday
    assert.equal(f.missedClockOut, 1);
  });

  test('a mid-month joiner is only due from the joining date', async () => {
    const r = await monthlyHours({ month: '2026-09' });
    const j = r.employees.find((e) => String(e._id) === String(joiner));
    assert.equal(j.standardDays, 13); // 16–30, minus Sundays 20 and 27
    assert.equal(j.workedMinutes, 0);
  });

  test('rejects a bad month', async () => {
    assert.equal((await monthlyHours({ month: '2026-9' })).ok, false);
  });
});
