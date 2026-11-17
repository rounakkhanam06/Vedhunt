const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Lead = require('../models/Lead');
const { applyLeadUpdate } = require('../services/leadLifecycle');

// An admin calling a lead must not stop its assignee from logging her own calls.
let mongo;
before(async () => { mongo = await MongoMemoryServer.create(); await mongoose.connect(mongo.getUri()); });
after(async () => { await mongoose.disconnect(); await mongo.stop(); });

const outcome = (t) => ({ connected: 'No', notConnectedReason: 'Number Busy', nextFollowUpDate: t, nextActionType: 'Call' });

test('assignee logs her call while an admin call is open, and after it', async () => {
  const admin = { id: new mongoose.Types.ObjectId(), isSuperAdmin: true };
  const emp = { id: new mongoose.Types.ObjectId() };
  const lead = await Lead.create({ fullName: 'S', phone: '9191919191', email: 's@x.com', source: 't', consent: true, service: 'SEO', assignedTo: emp.id });
  const t = (s) => new Date(Date.now() + s * 1000).toISOString();
  const ok = async (u, a) => { const r = await applyLeadUpdate(lead._id, u, a); assert.equal(r.ok, true, r.message); };

  await ok({ callStartTime: t(0) }, admin);           // admin starts, leaves it open
  await ok({ callStartTime: t(10) }, emp);
  await ok({ callEndTime: t(20) }, emp);
  await ok(outcome(t(86400)), emp);
  await ok({ callStartTime: t(30) }, admin);
  await ok({ callEndTime: t(40) }, admin);
  await ok(outcome(t(86400)), admin);
  await ok({ callStartTime: t(50) }, emp);            // admin's lock still fresh
  await ok({ callEndTime: t(60) }, emp);
  await ok(outcome(t(86400)), emp);

  const { callLogs } = await Lead.findById(lead._id).lean();
  const who = callLogs.map((c) => (String(c.calledBy) === String(emp.id) ? 'emp' : 'admin'));
  assert.deepEqual(who, ['emp', 'admin', 'emp']);
});

test('someone else still cannot edit a lead the admin has locked', async () => {
  const admin = { id: new mongoose.Types.ObjectId(), isSuperAdmin: true };
  const other = { id: new mongoose.Types.ObjectId() };
  const lead = await Lead.create({ fullName: 'S', phone: '9191919192', email: 't@x.com', source: 't', consent: true, service: 'SEO', assignedTo: new mongoose.Types.ObjectId() });
  await applyLeadUpdate(lead._id, { callStartTime: new Date().toISOString() }, admin);
  const r = await applyLeadUpdate(lead._id, { callStartTime: new Date().toISOString() }, other);
  assert.equal(r.status, 409);
});

test('a connected call keeps the minutes the caller entered', async () => {
  const emp = { id: new mongoose.Types.ObjectId() };
  const lead = await Lead.create({ fullName: 'D', phone: '9191919193', email: 'd@x.com', source: 't', consent: true, service: 'SEO', assignedTo: emp.id });
  const bad = await applyLeadUpdate(lead._id, { connected: 'Yes', interestLevel: 'Cold', callDurationEntered: 0 }, emp);
  assert.equal(bad.status, 400);
  const r = await applyLeadUpdate(lead._id, { connected: 'Yes', interestLevel: 'Cold', callDurationEntered: 12 }, emp);
  assert.equal(r.ok, true, r.message);
  const saved = await Lead.findById(lead._id).lean();
  assert.equal(saved.callLogs[0].callDuration, 12);
  assert.equal(saved.callLogs[0].durationEntered, 12);
  assert.equal(saved.callDurationEntered, undefined);
  const { listCallActivity } = require('../services/callActivity');
  const act = await listCallActivity({ _id: lead._id }, {});
  assert.equal(act.data[0].duration, 12);
});
