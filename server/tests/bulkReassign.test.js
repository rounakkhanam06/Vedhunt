const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Reassignment keeps the lead intact — status, history, notes — and hands the
// pending follow-ups to the new owner. Runs on a throwaway in-memory MongoDB;
// nothing touches the database in server/.env. Run: npm test

const { manualAssign } = require('../services/leadAssignment');
const FollowUpTask = require('../models/FollowUpTask');
const AssignmentLog = require('../models/AssignmentLog');

let mongo;
const oid = () => new mongoose.Types.ObjectId();

describe('lead reassignment', () => {
  before(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  });

  after(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  async function setup() {
    const db = mongoose.connection.db;
    await db.collection('admins').deleteMany({});
    await db.collection('leads').deleteMany({});
    await db.collection('followuptasks').deleteMany({});
    await db.collection('assignmentlogs').deleteMany({});
    const [oldBd, newBd, boss, otherBd] = [oid(), oid(), oid(), oid()];
    await db.collection('admins').insertMany(
      [oldBd, newBd, otherBd].map((_id, i) => ({ _id, firstName: `BD${i}`, lastName: 'T', email: `bd${i}@x.com`, isActive: true }))
    );
    const leadId = oid();
    const history = [{ status: 'Contacted', date: new Date('2026-09-01') }, { status: 'Proposal Sent', date: new Date('2026-09-05') }];
    await db.collection('leads').insertOne({
      _id: leadId,
      fullName: 'Asha',
      service: 'SEO',
      platform: 'Facebook',
      status: 'Proposal Sent',
      assignedTo: oldBd,
      pipelineHistory: history,
      callLogs: [{ callDate: new Date('2026-09-02'), outcome: 'Connected' }],
      remarks: 'Wants a callback on Friday'
    });
    return { leadId, oldBd, newBd, boss, otherBd, history };
  }

  test('keeps status, history and notes; records who moved it', async () => {
    const { leadId, oldBd, newBd, boss, history } = await setup();

    await manualAssign({ leadId, toAdmin: newBd, assignedBy: boss, reason: 'Bulk Reassignment' });

    const lead = await mongoose.connection.db.collection('leads').findOne({ _id: leadId });
    assert.equal(String(lead.assignedTo), String(newBd));
    assert.equal(lead.status, 'Proposal Sent');
    assert.deepEqual(lead.pipelineHistory.map((h) => h.status), history.map((h) => h.status));
    assert.equal(lead.callLogs.length, 1);
    assert.equal(lead.remarks, 'Wants a callback on Friday');

    const logs = await AssignmentLog.find({ lead: leadId });
    assert.equal(logs.length, 1);
    assert.equal(String(logs[0].fromAdmin), String(oldBd));
    assert.equal(String(logs[0].toAdmin), String(newBd));
    assert.equal(String(logs[0].assignedBy), String(boss));
    assert.equal(logs[0].reason, 'Bulk Reassignment');
  });

  test('moves only the previous owner\'s pending follow-ups', async () => {
    const { leadId, oldBd, newBd, boss, otherBd } = await setup();
    const due = new Date('2030-01-01');
    const mk = (assignedTo, status) => FollowUpTask.create({ lead: leadId, assignedTo, createdBy: boss, dueDate: due, status });
    const pending = await mk(oldBd, 'Pending');
    const done = await mk(oldBd, 'Completed');
    const managers = await mk(otherBd, 'Pending');

    await manualAssign({ leadId, toAdmin: newBd, assignedBy: boss });

    assert.equal(String((await FollowUpTask.findById(pending._id)).assignedTo), String(newBd));
    assert.equal(String((await FollowUpTask.findById(done._id)).assignedTo), String(oldBd));
    assert.equal(String((await FollowUpTask.findById(managers._id)).assignedTo), String(otherBd));
  });
});
