/**
 * Leads Overview aggregation against a throwaway in-memory MongoDB (never the
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
let leads;
let leadOverview;
const oid = () => new mongoose.Types.ObjectId();
const jyoti = oid();
const amit = oid();

// Period: 1–31 Oct 2026 (server timezone), both ends included
const FROM = new Date('2026-10-01T00:00:00');
const TO = new Date('2026-10-31T23:59:59.999');
const at = (day, time = '12:00:00') => new Date(`${day}T${time}`);

let seq = 0;
const lead = (fields) => {
  seq += 1;
  return {
    fullName: `Lead ${seq}`, phone: `98000000${seq}`, leadType: 'Sales', status: 'New',
    createdAt: at('2026-10-10'), updatedAt: at('2026-10-10'), ...fields,
  };
};

describe('Leads Overview aggregation', () => {
  before(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    await mongoose.connection.db.collection('admins').insertMany([
      { _id: jyoti, firstName: 'Jyoti', lastName: 'S', email: 'j@t.test' },
      { _id: amit, firstName: 'Amit', lastName: 'C', email: 'a@t.test' },
    ]);
    leads = mongoose.connection.db.collection('leads');
    ({ leadOverview } = require('../../services/leadOverview'));

    await leads.insertMany([
      // Jyoti: 2 Warm (one Won), 1 with no interest set
      lead({ assignedTo: jyoti, assignedAt: at('2026-10-11'), interestLevel: 'Warm', status: 'Won' }),
      lead({ assignedTo: jyoti, assignedAt: at('2026-10-11'), interestLevel: 'Warm', status: 'Contacted' }),
      lead({ assignedTo: jyoti, assignedAt: at('2026-10-12'), status: 'Qualified' }),
      // Amit: cross-assigned to Jyoti — still one lead, counted under Amit only
      lead({ assignedTo: amit, assignedAt: at('2026-10-12'), interestLevel: 'Hot Lead', status: 'Hold', sharedWith: [{ admin: jyoti }] }),
      // Unassigned
      lead({ interestLevel: '', status: 'New' }),
      lead({ interestLevel: 'Wrong / Junk Lead', status: 'Dropped' }),
      // Received before the period but assigned inside it: Assigned, not Received
      lead({ createdAt: at('2026-09-20'), assignedTo: amit, assignedAt: at('2026-10-05'), interestLevel: 'Cold' }),
      // Received on the first and last instant of the period (both included)
      lead({ createdAt: at('2026-10-01', '00:00:00'), assignedTo: amit, assignedAt: at('2026-10-01', '00:30:00'), interestLevel: 'Interested' }),
      lead({ createdAt: at('2026-10-31', '23:59:59'), assignedTo: amit, assignedAt: at('2026-11-01'), interestLevel: 'Not Interested' }),
      // Outside the period, and non-Sales: ignored
      lead({ createdAt: at('2026-11-01', '00:00:01'), assignedTo: jyoti, interestLevel: 'Warm' }),
      lead({ leadType: 'Hiring', assignedTo: jyoti, interestLevel: 'Warm' }),
    ]);
  });

  after(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  test('Leads Received counts Sales leads created in the period, both ends included', async () => {
    const o = await leadOverview({ from: FROM, to: TO });
    assert.equal(o.received, 8);
  });

  test('Assigned Leads uses the assignment date, not the received date', async () => {
    const o = await leadOverview({ from: FROM, to: TO });
    // 6 assigned in October, incl. the September lead; the 1 Nov assignment, unassigned and out-of-scope leads are out
    assert.equal(o.assigned, 6);
  });

  test('interest and stage tables both add up to Leads Received', async () => {
    const o = await leadOverview({ from: FROM, to: TO });
    assert.equal(o.interest.totals.total, o.received);
    assert.equal(o.stages.totals.total, o.received);
    for (const t of [o.interest, o.stages]) {
      assert.equal(t.rows.reduce((s, r) => s + r.total, 0), t.totals.total);
    }
  });

  test('interest: six levels plus Not rated, overall and per BD', async () => {
    const { interest } = await leadOverview({ from: FROM, to: TO });
    assert.equal(interest.totals.Warm, 2);
    assert.equal(interest.totals['Hot Lead'], 1);
    assert.equal(interest.totals['Wrong / Junk Lead'], 1);
    assert.equal(interest.totals['Not rated'], 2, 'blank and missing interest are both Not rated');
    const j = interest.rows.find((r) => r.name === 'Jyoti S');
    assert.equal(j.counts.Warm, 2);
    assert.equal(j.counts['Not rated'], 1);
  });

  test('stage: current status of the leads received, overall and per BD', async () => {
    const { stages } = await leadOverview({ from: FROM, to: TO });
    assert.equal(stages.totals.Won, 1);
    assert.equal(stages.totals.Hold, 1);
    assert.equal(stages.totals.Dropped, 1);
    assert.equal(stages.totals.Qualified, 1);
    assert.equal(stages.totals.New, 3);
    assert.equal(stages.rows.find((r) => r.name === 'Jyoti S').counts.Won, 1);
  });

  test('a cross-assigned lead is counted once, under its primary owner', async () => {
    const { stages } = await leadOverview({ from: FROM, to: TO });
    const j = stages.rows.find((r) => r.name === 'Jyoti S');
    const a = stages.rows.find((r) => r.name === 'Amit C');
    assert.equal(a.counts.Hold, 1);
    assert.equal(j.counts.Hold, 0);
    assert.equal(j.total + a.total + stages.rows.find((r) => r.unassigned).total, stages.totals.total);
  });

  test('unassigned leads appear as their own row', async () => {
    const { interest } = await leadOverview({ from: FROM, to: TO });
    const u = interest.rows.find((r) => r.unassigned);
    assert.equal(u.total, 2);
  });

  test('a period with no leads returns zeroes', async () => {
    const o = await leadOverview({ from: at('2020-01-01', '00:00:00'), to: at('2020-01-02', '23:59:59') });
    assert.equal(o.received, 0);
    assert.equal(o.assigned, 0);
    assert.deepEqual(o.interest.rows, []);
    assert.equal(o.stages.totals.total, 0);
  });

  test('a single-day period (Today preset) covers that whole day', async () => {
    const o = await leadOverview({ from: at('2026-10-31', '00:00:00'), to: at('2026-10-31', '23:59:59.999') });
    assert.equal(o.received, 1);
  });
});
