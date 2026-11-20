/**
 * Custom KPIs (services/kpiMetrics.js + KPITarget scoring) against a throwaway in-memory
 * MongoDB (never the database in server/.env):
 *
 *   npm run test:e2e
 */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongo;
let kpiMetrics;
let KPITarget;
const oid = () => new mongoose.Types.ObjectId();

describe('Custom KPIs', () => {
  before(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    kpiMetrics = require('../../services/kpiMetrics');
    KPITarget = require('../../models/KPITarget');
  });

  after(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  test('a created KPI joins the catalog as a manual metric', async () => {
    const { metric, error } = await kpiMetrics.createCustom({ label: '  Designs   Delivered ', unit: 'count' });
    assert.equal(error, undefined);
    assert.equal(metric.label, 'Designs Delivered');
    const defs = await kpiMetrics.getMetricDefs();
    assert.equal(defs[metric.key].custom, true);
    assert.equal(defs[metric.key].auto, false);
    assert.ok(kpiMetrics.selectableTypes(defs).includes(metric.key));
    assert.ok(defs.Revenue, 'built-in metrics stay');
  });

  test('bad input and duplicate names are refused', async () => {
    assert.ok((await kpiMetrics.createCustom({ label: 'x', unit: 'count' })).error);
    assert.ok((await kpiMetrics.createCustom({ label: 'Valid Name', unit: 'bananas' })).error);
    assert.ok((await kpiMetrics.createCustom({ label: 'designs delivered', unit: '%' })).error, 'duplicate of a custom KPI');
    assert.ok((await kpiMetrics.createCustom({ label: 'Attendance %', unit: '%' })).error, 'duplicate of a built-in label');
  });

  test('scoring: higher-is-better and lower-is-better custom KPIs', async () => {
    const { metric: tat } = await kpiMetrics.createCustom({ label: 'Ticket Turnaround', unit: 'hrs', lowerIsBetter: true });
    const designs = (await kpiMetrics.listCustom()).find((m) => m.label === 'Designs Delivered');
    const base = { cycleId: oid(), employeeId: oid() };

    const a = await new KPITarget({ ...base, metricType: designs.key, label: designs.label, targetValue: 40, weightage: 60, actualValue: 30 }).save();
    assert.equal(a.achievementPct, 75);
    assert.equal(a.weightedScore, 45);

    const b = await new KPITarget({ ...base, metricType: tat.key, label: tat.label, lowerIsBetter: true, targetValue: 24, weightage: 40, actualValue: 48 }).save();
    assert.equal(b.achievementPct, 50); // target ÷ actual
    assert.equal(b.weightedScore, 20);
  });

  test('removing archives: hidden from new KPIs, label kept for old ones', async () => {
    const designs = (await kpiMetrics.listCustom()).find((m) => m.label === 'Designs Delivered');
    assert.deepEqual(await kpiMetrics.archiveCustom(designs.key), { ok: true });
    const defs = await kpiMetrics.getMetricDefs();
    assert.equal(defs[designs.key].label, 'Designs Delivered');
    assert.ok(!kpiMetrics.selectableTypes(defs).includes(designs.key));
    assert.ok((await kpiMetrics.archiveCustom('custom_nope')).error);
    // The name is free again once archived
    assert.equal((await kpiMetrics.createCustom({ label: 'Designs Delivered', unit: 'count' })).error, undefined);
  });
});
