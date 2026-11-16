const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// A returning customer (same phone/email) is attached to their existing lead
// instead of being dropped. In-memory MongoDB only; nothing touches server/.env.

const Lead = require('../models/Lead');
const Notification = require('../models/Notification');
const { recordRepeatEnquiry, DOUBLE_SUBMIT_WINDOW_MS } = require('../services/repeatEnquiry');

let mongo;
const later = (ms) => new Date(Date.now() + ms);

async function makeLead(extra = {}) {
  return Lead.create({
    fullName: 'Asha', phone: '9876543210', email: 'asha@x.com', source: 'test',
    consent: true, service: 'SEO', platform: 'Website', ...extra
  });
}

describe('repeat enquiry', () => {
  before(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  });
  after(async () => { await mongoose.disconnect(); await mongo.stop(); });
  beforeEach(async () => {
    await mongoose.connection.db.collection('leads').deleteMany({});
    await mongoose.connection.db.collection('notifications').deleteMany({});
  });

  test('new service is recorded on the existing lead and the owner is alerted', async () => {
    const owner = new mongoose.Types.ObjectId();
    const lead = await makeLead({ assignedTo: owner });
    const r = await recordRepeatEnquiry(lead, { platform: 'Google Ads', service: 'Website Development', source: 'g' }, { now: later(60_000) });
    assert.equal(r.recorded, true);
    const fresh = await Lead.findById(lead._id);
    assert.equal(fresh.repeatEnquiryCount, 1);
    assert.equal(fresh.repeatEnquiries[0].service, 'Website Development');
    assert.ok(fresh.servicesRequired.includes('Website Development'));
    assert.ok(fresh.pipelineHistory.some((h) => /Repeat enquiry via Google Ads/.test(h.note || '')));
    const notes = await Notification.find({ lead: lead._id });
    assert.equal(notes.length, 1);
    assert.equal(String(notes[0].recipient), String(owner));
  });

  test('same service within the window is a double-submit and ignored', async () => {
    const lead = await makeLead();
    const r = await recordRepeatEnquiry(lead, { platform: 'Website', service: 'seo' }, { now: later(60_000) });
    assert.equal(r.reason, 'double-submit');
    assert.equal((await Lead.findById(lead._id)).repeatEnquiryCount, 0);
  });

  test('same service after the window counts as a repeat', async () => {
    const lead = await makeLead();
    const r = await recordRepeatEnquiry(lead, { platform: 'Website', service: 'SEO' }, { now: later(DOUBLE_SUBMIT_WINDOW_MS + 1000), notify: false });
    assert.equal(r.recorded, true);
  });

  test('Lost lead is reopened', async () => {
    const lead = await makeLead({ status: 'Lost' });
    const r = await recordRepeatEnquiry(lead, { platform: 'Facebook', service: 'Ads' }, { now: later(60_000), notify: false });
    assert.equal(r.reopened, true);
    assert.equal((await Lead.findById(lead._id)).status, 'New');
  });

  test('the same webhook id is never recorded twice', async () => {
    const lead = await makeLead();
    const e = { platform: 'Facebook', service: 'Ads', externalId: 'fb_123' };
    assert.equal((await recordRepeatEnquiry(lead, e, { now: later(60_000), notify: false })).recorded, true);
    assert.equal((await recordRepeatEnquiry(lead, e, { now: later(DOUBLE_SUBMIT_WINDOW_MS * 2), notify: false })).reason, 'already-recorded');
  });
});

describe('repeat enquiry: sameRequest flag', () => {
  before(async () => { mongo = await MongoMemoryServer.create(); await mongoose.connect(mongo.getUri()); });
  after(async () => { await mongoose.disconnect(); await mongo.stop(); });

  test('same service is flagged; a new service is not', async () => {
    await mongoose.connection.db.collection('leads').deleteMany({});
    const lead = await makeLead();
    const dbl = await recordRepeatEnquiry(lead, { service: 'SEO' }, { now: later(60_000), notify: false });
    assert.equal(dbl.sameRequest, true);
    const lateSame = await recordRepeatEnquiry(lead, { service: 'seo' }, { now: later(DOUBLE_SUBMIT_WINDOW_MS * 2), notify: false });
    assert.equal(lateSame.recorded, true);
    assert.equal(lateSame.sameRequest, true);
    const other = await recordRepeatEnquiry(lead, { service: 'Website Development' }, { now: later(DOUBLE_SUBMIT_WINDOW_MS * 3), notify: false });
    assert.equal(other.sameRequest, false);
  });
});
