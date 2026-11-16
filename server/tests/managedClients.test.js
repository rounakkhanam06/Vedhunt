const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// An employee sees the clients they are Account Manager of on the Clients
// page, on top of any client grant. In-memory MongoDB; nothing touches .env.

const { withManagedClients } = require('../middleware/withManagedClients');

let mongo;
const oid = () => new mongoose.Types.ObjectId();

function run(mw, user) {
  return new Promise((resolve, reject) => {
    const req = { user, params: {} };
    const res = { code: 200, status(c) { this.code = c; return this; }, json(b) { resolve({ allowed: false, code: this.code, b }); return this; } };
    mw(req, res, (err) => (err ? reject(err) : resolve({ allowed: true, scope: req.pageScope })));
  });
}

describe('account manager client access', () => {
  let adminId; let managedId; let grantedId;
  before(async () => { mongo = await MongoMemoryServer.create(); await mongoose.connect(mongo.getUri()); });
  after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  beforeEach(async () => {
    const db = mongoose.connection.db;
    await db.collection('employees').deleteMany({});
    await db.collection('clients').deleteMany({});
    adminId = oid(); managedId = oid(); grantedId = oid();
    const empId = oid();
    await db.collection('employees').insertOne({ _id: empId, adminId });
    await db.collection('clients').insertMany([
      { _id: managedId, businessName: 'apa', email: 'a@x.com', profile: { accountManager: empId }, deletedAt: null },
      { _id: oid(), businessName: 'other', email: 'b@x.com', profile: { accountManager: oid() }, deletedAt: null },
      { _id: oid(), businessName: 'archived', email: 'c@x.com', profile: { accountManager: empId }, deletedAt: new Date() },
    ]);
  });

  const grant = (clients, actions = ['view']) => ({ _id: adminId, permissions: [], accessGrants: [{ page: 'clients', actions, scope: { mode: 'clients', clients } }] });

  test('empty client grant still shows the managed client', async () => {
    const r = await run(withManagedClients('clients', 'view'), grant([]));
    assert.equal(r.allowed, true);
    assert.deepEqual(r.scope.clients, [String(managedId)]);
  });

  test('managed clients are added to granted ones', async () => {
    const r = await run(withManagedClients('clients', 'view'), grant([String(grantedId)]));
    assert.deepEqual(r.scope.clients.sort(), [String(grantedId), String(managedId)].sort());
  });

  test('no grant: view only, on managed clients', async () => {
    const none = { _id: adminId, permissions: [], accessGrants: [] };
    const v = await run(withManagedClients('clients', 'view'), none);
    assert.deepEqual(v.scope.clients, [String(managedId)]);
    assert.equal((await run(withManagedClients('clients', 'edit'), none)).allowed, false);
  });

  test('not an account manager and no grant: refused', async () => {
    const r = await run(withManagedClients('clients', 'view'), { _id: oid(), permissions: [], accessGrants: [] });
    assert.equal(r.allowed, false);
  });

  test('create is never widened', async () => {
    assert.equal((await run(withManagedClients('clients', 'create'), grant([]))).allowed, false);
  });

  test('full access unchanged', async () => {
    const r = await run(withManagedClients('clients', 'view'), { _id: adminId, permissions: ['*'] });
    assert.equal(r.allowed, true);
    assert.equal(r.scope, null);
  });
});
