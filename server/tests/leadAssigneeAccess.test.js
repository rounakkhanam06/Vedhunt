const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// The person a lead is assigned to may work it (lock, update, follow-ups)
// even when their grant gives View only. In-memory MongoDB; nothing touches .env.

const Lead = require('../models/Lead');
const requirePageAccess = require('../middleware/requirePageAccess');
const allowLeadAssignee = require('../middleware/allowLeadAssignee');

let mongo;
const oid = () => new mongoose.Types.ObjectId();
const viewOnly = (_id) => ({ _id, permissions: [], accessGrants: [{ page: 'leads', actions: ['view'], scope: { mode: 'team' } }] });
const noLeads = (_id) => ({ _id, permissions: [], accessGrants: [] });

function run(user, leadId) {
  return new Promise((resolve, reject) => {
    const req = { user, params: { id: String(leadId) } };
    const res = {
      code: 200,
      status(c) { this.code = c; return this; },
      json(b) { resolve({ allowed: false, code: this.code, body: b, req }); return this; },
    };
    allowLeadAssignee(requirePageAccess('leads', 'edit'))(req, res, (err) => (err ? reject(err) : resolve({ allowed: true, req })));
  });
}

describe('lead assignee may work their lead', () => {
  before(async () => { mongo = await MongoMemoryServer.create(); await mongoose.connect(mongo.getUri()); });
  after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  beforeEach(() => mongoose.connection.db.collection('leads').deleteMany({}));

  const makeLead = (extra) => Lead.create({ fullName: 'Shyam', phone: '9191919191', email: 's@x.com', source: 't', consent: true, service: 'SEO', ...extra });

  test('assignee with View-only grant is allowed, scope narrowed to own', async () => {
    const me = oid();
    const lead = await makeLead({ assignedTo: me });
    const r = await run(viewOnly(me), lead._id);
    assert.equal(r.allowed, true);
    assert.deepEqual(r.req.pageScope, { mode: 'own' });
    assert.equal(r.req.viaAssignment, true);
  });

  test('View-only user is refused on someone else\'s lead', async () => {
    const lead = await makeLead({ assignedTo: oid() });
    const r = await run(viewOnly(oid()), lead._id);
    assert.equal(r.allowed, false);
    assert.equal(r.code, 403);
  });

  test('a lead only shared with them is not enough', async () => {
    const me = oid();
    const lead = await makeLead({ assignedTo: oid(), sharedWith: [{ admin: me }] });
    assert.equal((await run(viewOnly(me), lead._id)).allowed, false);
  });

  test('former owner loses access after reassignment', async () => {
    const me = oid();
    const lead = await makeLead({ assignedTo: me });
    await Lead.updateOne({ _id: lead._id }, { assignedTo: oid() });
    assert.equal((await run(viewOnly(me), lead._id)).allowed, false);
  });

  test('assignee with no lead access at all is refused', async () => {
    const me = oid();
    const lead = await makeLead({ assignedTo: me });
    assert.equal((await run(noLeads(me), lead._id)).allowed, false);
  });

  test('normal Edit access still passes untouched', async () => {
    const user = { _id: oid(), permissions: ['leads.viewAll'] };
    const lead = await makeLead({ assignedTo: oid() });
    const r = await run(user, lead._id);
    assert.equal(r.allowed, true);
    assert.equal(r.req.viaAssignment, undefined);
  });
});
