const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { plannedBudget, periodsBetween, validateSetup, validateEntry } = require('../services/kpi');

describe('KPI budget plan — calendar days of each month', () => {
  test('a whole month plans exactly the approved budget, whatever its length', () => {
    assert.equal(plannedBudget(30000, '2026-10-01', '2026-10-31'), 30000);
    assert.equal(plannedBudget(30000, '2026-09-01', '2026-09-30'), 30000);
    assert.equal(plannedBudget(30000, '2027-02-01', '2027-02-28'), 30000);
  });
  test('a day is the budget ÷ the days in its month', () => {
    assert.equal(plannedBudget(30000, '2026-10-05', '2026-10-05'), 967.74); // 31 days
    assert.equal(plannedBudget(30000, '2026-09-05', '2026-09-05'), 1000); // 30 days
  });
  test('a week across two months uses each month’s own day rate', () => {
    // 28–30 Sep (3 × 1000) + 1–4 Oct (4 × 967.74…)
    assert.equal(plannedBudget(30000, '2026-09-28', '2026-10-04'), 6870.97);
  });
});

describe('KPI budget history and goal matching', () => {
  const { withBudget, budgetForMonth, countsForGoal } = require('../services/kpi');
  test('a change replaces only its own month; an old setup keeps its past', () => {
    const legacy = { monthlyBudget: 30000, budgetHistory: [] };
    const h = withBudget(legacy, 40000, '2026-10');
    assert.deepEqual(h, [{ month: '2000-01', monthlyBudget: 30000 }, { month: '2026-10', monthlyBudget: 40000 }]);
    const s = { budgetHistory: h };
    assert.equal(budgetForMonth(s, '2026-09'), 30000);
    assert.equal(budgetForMonth(s, '2026-10'), 40000);
    assert.equal(budgetForMonth(s, '2027-01'), 40000);
  });
  test('a plan across a budget change uses each month’s budget', () => {
    const s = { budgetHistory: [{ month: '2026-09', monthlyBudget: 30000 }, { month: '2026-10', monthlyBudget: 31000 }] };
    // 30 Sep (1000) + 1 Oct (31000 / 31 = 1000)
    assert.equal(plannedBudget((m) => budgetForMonth(s, m), '2026-09-30', '2026-10-01'), 2000);
  });
  test('only results matching the goal are conversions', () => {
    assert.equal(countsForGoal('Purchases', 'Purchase'), true);
    assert.equal(countsForGoal('Purchases', 'Leads'), false);
    assert.equal(countsForGoal('Leads', 'Lead form leads'), true);
    assert.equal(countsForGoal('Qualified Leads', 'Leads'), true);
    assert.equal(countsForGoal('Purchases', ''), false, 'an entry with no result type is not a purchase');
    assert.equal(countsForGoal('Other', 'Link clicks'), true, 'Other counts everything');
  });
});

describe('KPI periods', () => {
  test('weeks run Monday–Sunday and are clipped to the range', () => {
    const p = periodsBetween('2026-10-01', '2026-10-14', 'Weekly');
    assert.deepEqual(p.map((x) => [x.key, x.start, x.end]), [
      ['2026-09-28', '2026-10-01', '2026-10-04'],
      ['2026-10-05', '2026-10-05', '2026-10-11'],
      ['2026-10-12', '2026-10-12', '2026-10-14'],
    ]);
  });
  test('months are calendar months; days are days', () => {
    assert.deepEqual(periodsBetween('2026-08-15', '2026-10-03', 'Monthly').map((x) => [x.key, x.start, x.end]), [
      ['2026-08-01', '2026-08-15', '2026-08-31'], ['2026-09-01', '2026-09-01', '2026-09-30'], ['2026-10-01', '2026-10-01', '2026-10-03'],
    ]);
    assert.equal(periodsBetween('2026-10-01', '2026-10-31', 'Daily').length, 31);
  });
});

describe('KPI setup and entry validation', () => {
  const setup = { monthlyBudget: 30000, reportingFrequency: 'Monthly', primaryGoal: 'Purchases', targetCpa: 250, targetRoas: 2.5, grossMarginPercent: 55 };
  test('a complete setup passes; blanks become "not set"', () => {
    const { value } = validateSetup({ ...setup, targetRoas: '' });
    assert.equal(value.monthlyBudget, 30000);
    assert.equal(value.targetRoas, undefined);
  });
  test('budget, frequency and goal are required and checked', () => {
    assert.match(validateSetup({ ...setup, monthlyBudget: 0 }).error, /monthly budget/);
    assert.match(validateSetup({ ...setup, reportingFrequency: 'Hourly' }).error, /Daily, Weekly or Monthly/);
    assert.match(validateSetup({ ...setup, grossMarginPercent: 120 }).error, /Gross margin/);
  });
  test('an entry belongs to a real period start, with whole counts', () => {
    assert.ok(validateEntry({ platform: 'Meta', frequency: 'Weekly', periodStart: '2026-10-05', qualifiedLeads: 4 }).value);
    assert.match(validateEntry({ platform: 'Meta', frequency: 'Weekly', periodStart: '2026-10-06' }).error, /Monday/);
    assert.match(validateEntry({ platform: 'Meta', frequency: 'Monthly', periodStart: '2026-10-02' }).error, /1st/);
    assert.match(validateEntry({ platform: 'Meta', frequency: 'Daily', periodStart: '2026-10-02', verifiedOrders: 1.5 }).error, /whole number/);
    assert.equal(validateEntry({ platform: 'Meta', frequency: 'Daily', periodStart: '2026-10-02', verifiedOrders: '' }).value.verifiedOrders, null);
  });
});
