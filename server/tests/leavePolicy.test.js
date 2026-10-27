const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { allowanceFor, leaveYear } = require('../services/leavePolicy');

const rules = (over = {}) => ({
  yearStartMonth: 1, period: 'Month', amounts: { CL: 1, SL: 1, PL: 2 }, el: { mode: 'Month', amount: 1 }, ...over,
});
const day = (y, m, d) => new Date(y, m - 1, d);
const permanent = { joinDate: day(2020, 1, 1) };

describe('leave year', () => {
  test('January start', () => {
    const y = leaveYear(day(2026, 10, 27), 1);
    assert.deepEqual([y.start, y.end], [day(2026, 1, 1), day(2027, 1, 1)]);
  });
  test('April start: Feb 2027 belongs to the year that began April 2026', () => {
    const y = leaveYear(day(2027, 2, 10), 4);
    assert.deepEqual([y.start, y.end], [day(2026, 4, 1), day(2027, 4, 1)]);
    assert.deepEqual(leaveYear(day(2026, 4, 1), 4).start, day(2026, 4, 1));
  });
});

describe('monthly accrual carries forward within the leave year', () => {
  test('CL 1 per month → 6 by June, 12 by December, back to 1 in January', () => {
    assert.equal(allowanceFor(permanent, 'CL', rules(), day(2026, 6, 15)).allowance, 6);
    assert.equal(allowanceFor(permanent, 'CL', rules(), day(2026, 12, 31)).allowance, 12);
    assert.equal(allowanceFor(permanent, 'CL', rules(), day(2027, 1, 2)).allowance, 1);
  });
  test('April leave year: May is the 2nd month', () => {
    assert.equal(allowanceFor(permanent, 'PL', rules({ yearStartMonth: 4 }), day(2026, 5, 3)).allowance, 4);
    assert.equal(allowanceFor(permanent, 'PL', rules({ yearStartMonth: 4 }), day(2026, 3, 31)).allowance, 24);
  });
  test('joined mid-year: earns from the joining month', () => {
    assert.equal(allowanceFor({ joinDate: day(2026, 9, 20) }, 'CL', rules(), day(2026, 10, 27)).allowance, 2);
    assert.equal(allowanceFor({ joinDate: day(2026, 11, 1) }, 'CL', rules(), day(2026, 10, 27)).allowance, 0);
  });
  test('confirmed after probation: CL/SL/PL earn from the confirmation month', () => {
    const emp = { joinDate: day(2026, 1, 5), probation: { isApplicable: true, confirmedAt: day(2026, 7, 5) } };
    assert.equal(allowanceFor(emp, 'CL', rules(), day(2026, 9, 1)).allowance, 3);
  });
  test('a per-person override replaces the company amount', () => {
    assert.equal(allowanceFor({ ...permanent, leaveOverrides: { CL: 2 } }, 'CL', rules(), day(2026, 3, 1)).allowance, 6);
    assert.equal(allowanceFor({ ...permanent, leaveOverrides: { CL: null } }, 'CL', rules(), day(2026, 3, 1)).allowance, 3);
  });
});

describe('yearly allowance', () => {
  test('the full amount from the start of the year', () => {
    const r = rules({ period: 'Year', amounts: { CL: 6, SL: 6, PL: 12 } });
    assert.equal(allowanceFor(permanent, 'CL', r, day(2026, 1, 1)).allowance, 6);
    assert.equal(allowanceFor(permanent, 'PL', r, day(2026, 11, 1)).allowance, 12);
  });
});

describe('Emergency Leave during probation', () => {
  const probation = { joinDate: day(2026, 8, 10), probation: { isApplicable: true, startDate: day(2026, 8, 10), endDate: day(2027, 2, 10) } };
  test('per month of probation, carried forward', () => {
    assert.equal(allowanceFor(probation, 'EL', rules(), day(2026, 10, 27)).allowance, 3);
    // stops at the end of probation
    assert.equal(allowanceFor(probation, 'EL', rules(), day(2027, 6, 1)).allowance, 7);
  });
  test('fixed for the whole probation', () => {
    const a = allowanceFor(probation, 'EL', rules({ el: { mode: 'Fixed', amount: 4 } }), day(2026, 8, 11));
    assert.equal(a.allowance, 4);
    assert.equal(a.period, 'Probation');
  });
  test('EL usage counts from the probation start, not the leave year', () => {
    assert.deepEqual(allowanceFor(probation, 'EL', rules(), day(2027, 1, 5)).window.start, day(2026, 8, 10));
  });
});
