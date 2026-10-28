/**
 * Client IDs after a permanent delete (models/Client.js) against a throwaway
 * in-memory MongoDB (never the database in server/.env):
 *
 *   npm run test:e2e
 */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'a'.repeat(64);

let mongo;
let Client;
const make = (n) => Client.create({ businessName: `Biz ${n}`, contactName: `Person ${"ABCD"[n - 1]}`, email: `c${n}@test.in`, password: 'secret-pass-1' });

describe('Client ID sequence', () => {
  before(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    Client = require('../../models/Client');
    // Unique clientId, as in production (the duplicate key the bug hit)
    await mongoose.connection.db.collection('clients').createIndex({ clientId: 1 }, { unique: true, name: 'clientId_unique' });
  });

  after(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  test('numbers continue from the highest ID, even after a permanent delete', async () => {
    const a = await make(1);
    await make(2);
    const c = await make(3);
    assert.equal(c.clientId, 'VH-CL-0003');

    // The bug: deleting one dropped the count to 2, so the next account got VH-CL-0003 again
    await Client.deleteOne({ _id: a._id });
    const d = await make(4);
    assert.equal(d.clientId, 'VH-CL-0004');
  });
});
