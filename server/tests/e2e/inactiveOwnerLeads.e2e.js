/**
 * Leads of deactivated accounts (services/leadAssignment.js releaseLeadsOfInactiveOwners)
 * against a throwaway in-memory MongoDB (never the database in server/.env):
 *
 *   npm run test:e2e
 */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongo;
let release;
const oid = () => new mongoose.Types.ObjectId();
const gone = oid();
const active = oid();
const later = oid();
const L = Object.fromEntries(['open-gone', 'hold-gone', 'lost-gone', 'won-gone', 'open-active', 'open-later'].map((k) => [k, oid()]));

describe('Leads of deactivated owners', () => {
  before(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    ({ releaseLeadsOfInactiveOwners: release } = require('../../services/leadAssignment'));
    const db = mongoose.connection.db;
    await db.collection('admins').insertMany([
      { _id: gone, firstName: 'Left', lastName: 'Company', email: 'gone@e2e.test', isActive: false },
      { _id: active, firstName: 'Still', lastName: 'Here', email: 'active@e2e.test', isActive: true },
      { _id: later, firstName: 'Leaving', lastName: 'Soon', email: 'later@e2e.test', isActive: true },
    ]);
    const lead = (id, owner, status) => ({ _id: L[id], fullName: id, status, assignedTo: owner, bd: 'x', leadType: 'Sales' });
    await db.collection('leads').insertMany([
      lead('open-gone', gone, 'Contacted'),
      lead('hold-gone', gone, 'Hold'),
      lead('lost-gone', gone, 'Lost'),
      lead('won-gone', gone, 'Won'),
      lead('open-active', active, 'New'),
      lead('open-later', later, 'Qualified'),
    ]);
  });

  after(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  const ownerOf = async (id) => (await mongoose.connection.db.collection('leads').findOne({ _id: L[id] })).assignedTo;

  test('safety net: open leads of every inactive account go to Unassigned; closed ones keep the owner', async () => {
    const r = await release();
    assert.equal(r.released, 2);
    assert.equal(await ownerOf('open-gone'), null);
    assert.equal(await ownerOf('hold-gone'), null);
    assert.equal(String(await ownerOf('lost-gone')), String(gone));
    assert.equal(String(await ownerOf('won-gone')), String(gone));
    assert.equal(String(await ownerOf('open-active')), String(active));
    const logs = await mongoose.connection.db.collection('assignmentlogs').find({ lead: L['open-gone'] }).toArray();
    assert.equal(logs.length, 1);
    assert.equal(String(logs[0].fromAdmin), String(gone));
    assert.equal(logs[0].toAdmin, null);
    assert.match(logs[0].reason, /deactivated/);
  });

  test('running again changes nothing', async () => {
    assert.equal((await release()).released, 0);
  });

  test('on deactivation of one account, only that account is released', async () => {
    await mongoose.connection.db.collection('admins').updateOne({ _id: later }, { $set: { isActive: false } });
    const r = await release({ adminId: later, assignedBy: active });
    assert.equal(r.released, 1);
    assert.equal(await ownerOf('open-later'), null);
    assert.equal(String(await ownerOf('open-active')), String(active));
  });
});
