const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const a = require('../services/adPerformance');
const { summarise, resolveRange } = require('../services/clientWork');

const NOW = new Date(2026, 9, 26, 12); // Monday 26 Oct 2026, local time
const sum = (...rows) => a.metrics(rows.reduce(a.addRow, a.emptySums()));

describe('ad metrics are recomputed from totals', () => {
  test('ratios from sums, not averaged daily ratios', () => {
    // Day 1: CTR 10% on 100 impressions. Day 2: CTR 1% on 10,000. Averaging would say 5.5%.
    const m = sum({ spend: 100, impressions: 100, clicks: 10, results: 1 }, { spend: 900, impressions: 10000, clicks: 100, results: 9 });
    assert.equal(m.ctr, 1.09);
    assert.equal(m.cpc, 9.09);
    assert.equal(m.cpm, 99.01);
    assert.equal(m.costPerResult, 100);
  });
  test('zero denominators give null ("--"), never Infinity or 0', () => {
    const m = sum({ spend: 500, impressions: 0, clicks: 0, results: 0 });
    assert.equal(m.ctr, null);
    assert.equal(m.cpc, null);
    assert.equal(m.cpm, null);
    assert.equal(m.costPerResult, null);
  });
  test('ROAS and revenue stay unknown unless some row reported revenue', () => {
    assert.equal(sum({ spend: 100 }).roas, null);
    assert.equal(sum({ spend: 100 }).revenue, null);
    const m = sum({ spend: 100, revenue: 450 }, { spend: 50 });
    assert.equal(m.revenue, 450);
    assert.equal(m.roas, 3);
  });
});

describe('period comparison', () => {
  test('absolute and % change, with direction depending on the metric', () => {
    assert.deepEqual(a.compare('spend', 150, 100), { current: 150, previous: 100, change: 50, pct: 50, isNew: false, good: true });
    assert.equal(a.compare('cpc', 12, 10).good, false, 'a higher cost per click is worse');
    assert.equal(a.compare('costPerResult', 80, 100).good, true, 'a lower cost per result is better');
    assert.equal(a.compare('results', 5, 5).good, null);
  });
  test('a zero baseline is "new", not an infinite percentage', () => {
    const c = a.compare('results', 7, 0);
    assert.equal(c.pct, null);
    assert.equal(c.isNew, true);
    assert.equal(a.compare('results', 0, 0).isNew, false);
    assert.equal(a.compare('roas', null, 2).change, null);
  });
});

describe('periods and buckets', () => {
  test('presets resolve to the right days, and partial periods compare like-for-like', () => {
    const tm = a.resolvePeriod({ period: 'this_month' }, NOW);
    assert.deepEqual([tm.current.from, tm.current.to, tm.current.partial], ['2026-10-01', '2026-10-26', true]);
    assert.deepEqual([tm.previous.from, tm.previous.to], ['2026-09-01', '2026-09-26'], 'month-to-date vs the same days last month');
    const lw = a.resolvePeriod({ period: 'last_week' }, NOW);
    assert.deepEqual([lw.current.from, lw.current.to, lw.previous.from, lw.previous.to], ['2026-10-19', '2026-10-25', '2026-10-12', '2026-10-18']);
    const lm = a.resolvePeriod({ period: 'last_month' }, NOW);
    assert.deepEqual([lm.current.from, lm.current.to, lm.previous.to], ['2026-09-01', '2026-09-30', '2026-08-31']);
    assert.equal(a.resolvePeriod({ period: 'yesterday' }, NOW).current.from, '2026-10-25');
  });
  test('month-to-date on the 31st compares with the whole (shorter) previous month', () => {
    const p = a.resolvePeriod({ period: 'this_month' }, new Date(2026, 2, 31, 12)); // 31 Mar
    assert.deepEqual([p.previous.from, p.previous.to], ['2026-02-01', '2026-02-28']);
  });
  test('custom ranges are validated and compared with the same length just before', () => {
    const c = a.resolvePeriod({ period: 'custom', from: '2026-10-10', to: '2026-10-16' }, NOW);
    assert.deepEqual([c.previous.from, c.previous.to], ['2026-10-03', '2026-10-09']);
    assert.equal(a.resolvePeriod({ period: 'custom', from: '2026-10-16', to: '2026-10-10' }, NOW), null);
    assert.equal(a.resolvePeriod({ period: 'custom', from: '2026-02-30', to: '2026-03-02' }, NOW), null, 'not a real date');
    assert.equal(a.resolvePeriod({ period: 'custom', from: '2024-01-01', to: '2026-01-01' }, NOW), null, 'over a year');
  });
  test('weeks start on Monday; empty buckets are kept', () => {
    assert.equal(a.mondayOf('2026-10-25'), '2026-10-19'); // Sunday belongs to the week before
    assert.equal(a.mondayOf('2026-10-26'), '2026-10-26');
    assert.deepEqual(a.bucketsBetween('2026-10-01', '2026-10-05', 'day'), ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05']);
    assert.deepEqual(a.bucketsBetween('2026-11-15', '2027-01-10', 'month'), ['2026-11', '2026-12', '2027-01']);
  });
});

describe('row validation', () => {
  const ok = { day: '2026-10-20', platform: 'Meta', campaignName: '  Diwali Sale  ', spend: '1500.456', impressions: '20000', clicks: '350', results: '12' };
  test('a good row is cleaned and normalised', () => {
    const { value, error } = a.validateRow(ok, null, NOW);
    assert.equal(error, undefined);
    assert.equal(value.campaignName, 'Diwali Sale');
    assert.equal(value.campaignKey, 'diwali sale');
    assert.equal(value.spend, 1500.46);
    assert.equal(value.impressions, 20000);
  });
  test('bad input is refused with a reason', () => {
    for (const [patch, why] of [
      [{ day: '2026-10-27' }, /future/], [{ day: '20-10-2026' }, /valid date/], [{ platform: 'TikTok' }, /Platform/],
      [{ campaignName: ' ' }, /campaign/], [{ spend: '-5' }, /Spend/], [{ spend: '' }, /Spend/], [{ clicks: '30000' }, /Clicks/],
      [{ currency: 'USD' }, /INR/],
    ]) assert.match(a.validateRow({ ...ok, ...patch }, null, NOW).error || '', why, JSON.stringify(patch));
  });
  test('an edit only validates and changes the fields sent', () => {
    const existing = a.validateRow(ok, null, NOW).value;
    const { value } = a.validateRow({ results: 20 }, existing, NOW);
    assert.equal(value.results, 20);
    assert.equal(value.spend, 1500.46);
    assert.equal(value.campaignName, 'Diwali Sale');
  });
});

describe('CSV export', () => {
  test('values are escaped and spreadsheet formulas are neutralised', () => {
    const csv = a.toCsv([{ day: '2026-10-20', platform: 'Meta', campaignName: '=HYPERLINK("http://x")', objective: 'Sales, Q4', spend: 10 }]);
    const line = csv.split('\n')[1];
    assert.match(line, /"'=HYPERLINK\(""http:\/\/x""\)"/);
    assert.match(line, /"Sales, Q4"/);
    assert.equal(csv.split('\n')[0].includes('notes'), false, 'internal columns only on staff export');
  });
});

describe('client work log summary', () => {
  test('time is grouped by activity and by project, largest first, with shares', () => {
    const s = summarise([
      { duration: 90, activityType: 'Google Ads', projectName: 'Store' },
      { duration: 30, activityType: 'Graphic Design', projectName: 'Store' },
      { duration: 60, activityType: 'Google Ads', projectName: 'Brand site' },
    ]);
    assert.equal(s.totalHours, 3);
    assert.deepEqual(s.byActivity.map((x) => [x.name, x.hours, x.share]), [['Google Ads', 2.5, 83.33], ['Graphic Design', 0.5, 16.67]]);
    assert.deepEqual(s.byProject.map((x) => [x.name, x.hours]), [['Store', 2], ['Brand site', 1]]);
  });
  test('periods resolve, and a bad or over-long custom range is refused', () => {
    assert.equal(resolveRange({ period: 'last_month' }, NOW).from.getMonth(), 8);
    assert.equal(resolveRange({ period: 'custom', from: '2026-10-10', to: '2026-10-01' }, NOW), null);
    assert.equal(resolveRange({ period: 'custom', from: '2024-01-01', to: '2026-01-01' }, NOW), null);
  });
});
