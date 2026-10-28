/**
 * Leads Overview tiles/charts/lists (services/leadDashboard.js) against a
 * throwaway in-memory MongoDB (never the database in server/.env):
 *
 *   npm run test:e2e
 */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'a'.repeat(64);

let mongo;
let leadDashboard;
const oid = () => new mongoose.Types.ObjectId();
const jyoti = oid();
const amit = oid();

// Period: 1–10 Oct 2026; the period before it is 21–30 Sep
const FROM = new Date('2026-10-01T00:00:00');
const TO = new Date('2026-10-10T23:59:59.999');
const at = (day, time = '12:00:00') => new Date(`${day}T${time}`);
const DAY = 24 * 60 * 60 * 1000;
const today = new Date(); today.setHours(12, 0, 0, 0);

let seq = 0;
const lead = (fields) => {
  seq += 1;
  return {
    fullName: `Lead ${seq}`, phone: `98000000${seq}`, leadType: 'Sales', status: 'New', platform: 'Website',
    service: 'Website Development', createdAt: at('2026-10-05'), updatedAt: at('2026-10-05'), ...fields,
  };
};
const call = { connected: 'Yes', callDate: at('2026-10-06') };

describe('Leads Overview dashboard', () => {
  before(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    await mongoose.connection.db.collection('admins').insertMany([
      { _id: jyoti, firstName: 'Jyoti', lastName: 'S', email: 'j@t.test' },
      { _id: amit, firstName: 'Amit', lastName: 'C', email: 'a@t.test' },
    ]);
    ({ leadDashboard } = require('../../services/leadDashboard'));

    await mongoose.connection.db.collection('leads').insertMany([
      // Jyoti: Won (went through Qualified + Proposal), on 7 Oct
      lead({
        assignedTo: jyoti, status: 'Won', platform: 'Instagram', dealValue: 90000, callLogs: [call],
        pipelineHistory: [{ status: 'Qualified', date: at('2026-10-06') }, { status: 'Proposal Sent', date: at('2026-10-06') }, { status: 'Won', date: at('2026-10-07') }],
      }),
      // Jyoti: open, Qualified, worth 50k, follow-up overdue by 3 days
      lead({ assignedTo: jyoti, status: 'Qualified', dealValue: 50000, leadScore: 80, callLogs: [call], nextFollowUpDate: new Date(today.getTime() - 3 * DAY) }),
      // Amit: Lost, never called
      lead({ assignedTo: amit, status: 'Lost', platform: 'Instagram', service: 'App Development' }),
      // Amit: Hold — not open, so not in the pipeline value or follow-ups
      lead({ assignedTo: amit, status: 'Hold', dealValue: 70000, nextFollowUpDate: new Date(today.getTime() - DAY) }),
      // Unassigned, open, due today (unassigned → not a follow-up)
      lead({ status: 'New', nextFollowUpDate: today }),
      // Previous period: 2 leads
      lead({ createdAt: at('2026-09-25'), assignedTo: jyoti }),
      lead({ createdAt: at('2026-09-30', '23:00:00') }),
      // Before both periods, open, Amit, due in 3 days
      lead({ createdAt: at('2026-08-01'), assignedTo: amit, status: 'Contacted', nextFollowUpDate: new Date(today.getTime() + 3 * DAY) }),
      // Not Sales: ignored
      lead({ leadType: 'Hiring', assignedTo: jyoti, status: 'Won' }),
    ]);
  });

  after(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  test('KPI tiles count the period cohort and compare with the period before', async () => {
    const { kpis } = await leadDashboard({ from: FROM, to: TO });
    assert.equal(kpis.received, 5);
    assert.equal(kpis.receivedChange, 150); // 5 vs 2
    assert.equal(kpis.assigned + kpis.unassigned, kpis.received);
    assert.equal(kpis.assigned, 4);
    assert.equal(kpis.won, 1);
    assert.equal(kpis.wonPct, 20);
    assert.equal(kpis.lost, 1);
    assert.equal(kpis.openValue, 50000); // Won and Hold excluded
    assert.equal(kpis.neverContacted, 3);
  });

  test('follow-ups are live: open, assigned leads only', async () => {
    const { kpis, overdueLeads } = await leadDashboard({ from: FROM, to: TO });
    assert.equal(kpis.overdueFollowUps, 1);
    assert.equal(kpis.followUpsToday, 0);
    assert.equal(kpis.followUpsUpcoming, 1);
    assert.equal(overdueLeads.length, 1);
    assert.equal(overdueLeads[0].daysOverdue, 3);
    assert.equal(overdueLeads[0].bde, 'Jyoti S');
  });

  test('breakdowns add up to Leads Received', async () => {
    const d = await leadDashboard({ from: FROM, to: TO });
    for (const rows of [d.bySource, d.byService, d.byInterest, d.statusSummary]) {
      assert.equal(rows.reduce((s, r) => s + r.count, 0), 5);
    }
    assert.equal(d.stages.reduce((s, r) => s + r.count, 0), 5);
    assert.deepEqual(d.statusSummary.map((r) => r.count), [2, 1, 1, 0, 1]);
  });

  test('trend has one point per day; Won is on the day it was won', async () => {
    const { trend } = await leadDashboard({ from: FROM, to: TO });
    assert.equal(trend.length, 10);
    assert.equal(trend.find((t) => t.date === '2026-10-05').received, 5);
    assert.equal(trend.find((t) => t.date === '2026-10-07').won, 1);
  });

  test('BDE-wise counts the furthest stage reached', async () => {
    const { bde } = await leadDashboard({ from: FROM, to: TO });
    const j = bde.rows.find((r) => r.name === 'Jyoti S');
    assert.deepEqual([j.assigned, j.contacted, j.qualified, j.proposal, j.won, j.lost, j.convRate], [2, 2, 2, 1, 1, 0, 50]);
    assert.equal(bde.rows.at(-1).name, 'Unassigned');
    assert.equal(bde.totals.assigned, 5);
  });

  test('filters narrow every section', async () => {
    const d = await leadDashboard({ from: FROM, to: TO, platform: 'Instagram' });
    assert.equal(d.kpis.received, 2);
    assert.equal(d.kpis.overdueFollowUps, 0);
    const a = await leadDashboard({ from: FROM, to: TO, assignedTo: String(amit) });
    assert.equal(a.kpis.received, 2);
    assert.equal(a.kpis.followUpsUpcoming, 1);
    assert.equal(a.topLeads.length, 1); // only the open Contacted lead
    const u = await leadDashboard({ from: FROM, to: TO, assignedTo: 'Unassigned' });
    assert.equal(u.kpis.received, 1);
    assert.equal(u.kpis.followUpsToday, 0);
  });
});
