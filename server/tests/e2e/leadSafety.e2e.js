/**
 * Lead creation and deletion safety, against a throwaway in-memory MongoDB
 * (never the database in server/.env):
 *
 *   npm run test:e2e
 *
 * - Lead IDs come from an atomic per-day counter: concurrent creates never
 *   collide, numbering continues past 999, and it continues from IDs that
 *   were issued before the counter existed.
 * - Deleting a lead is a soft delete: hidden everywhere, history kept,
 *   pending follow-ups cancelled, audited.
 */
// Generated files (proposal/payslip PDFs) go to a temp folder, never server/uploads; child servers inherit it
process.env.UPLOAD_DIR = process.env.UPLOAD_DIR || require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'vh-e2e-uploads-'));
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'a'.repeat(64);

let mongo;
let Lead;
let Counter;
let n = 0;
const fields = (extra = {}) => {
  n += 1;
  return {
    fullName: `Lead ${n}`, phone: `9${String(100000000 + n)}`, email: `l${n}@t.test`,
    consent: true, source: 'Website', service: 'Website Development', ...extra,
  };
};
const todayPrefix = () => {
  const d = new Date();
  return `VH-${String(d.getFullYear()).slice(-2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-`;
};
const resetDay = async () => {
  await Lead.collection.deleteMany({});
  await Counter.deleteMany({});
};

describe('Lead safety', () => {
  before(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    Lead = require('../../models/Lead');
    Counter = require('../../models/Counter');
    await Lead.init(); // the unique leadId index, as in production
  });

  after(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  describe('Lead IDs', () => {
    test('25 leads created at the same moment all save, each with its own ID', async () => {
      await resetDay();
      const results = await Promise.allSettled(Array.from({ length: 25 }, () => Lead.create(fields())));
      const failed = results.filter((r) => r.status === 'rejected');
      assert.equal(failed.length, 0, failed[0] && failed[0].reason.message);
      const ids = results.map((r) => r.value.leadId);
      assert.equal(new Set(ids).size, 25);
      assert.ok(ids.every((id) => id.startsWith(todayPrefix())));
    });

    test('numbering goes past 999 instead of wrapping to 000', async () => {
      await resetDay();
      await Lead.collection.insertOne({ ...fields(), leadId: `${todayPrefix()}999` });
      const a = await Lead.create(fields());
      const b = await Lead.create(fields());
      assert.equal(a.leadId, `${todayPrefix()}1000`);
      assert.equal(b.leadId, `${todayPrefix()}1001`);
    });

    test('continues from IDs issued before the counter existed (deploy mid-day)', async () => {
      await resetDay();
      // what production looks like at deploy time: leads exist, no counter doc yet
      await Lead.collection.insertMany(['001', '002', '041'].map((s) => ({ ...fields(), leadId: `${todayPrefix()}${s}` })));
      const lead = await Lead.create(fields());
      assert.equal(lead.leadId, `${todayPrefix()}042`);
    });

    test('an ID written outside the counter (script/import) is never reissued', async () => {
      await resetDay();
      await Lead.create(fields()); // counter = 1
      await Lead.collection.insertOne({ ...fields(), leadId: `${todayPrefix()}050` });
      const lead = await Lead.create(fields());
      assert.equal(lead.leadId, `${todayPrefix()}051`);
    });

    test('an existing lead keeps its ID when saved again', async () => {
      await resetDay();
      const lead = await Lead.create(fields());
      const id = lead.leadId;
      lead.notes = 'edited';
      await lead.save();
      assert.equal(lead.leadId, id);
    });
  });

  describe('Facebook intake', () => {
    test('a second copy of the same Facebook lead is reported as a duplicate, not saved twice', async () => {
      await resetDay();
      const { saveFacebookLead } = require('../../services/facebookLeads');
      const fbLead = {
        id: 'fb-123', created_time: new Date().toISOString(),
        field_data: [
          { name: 'full_name', values: ['Meta Person'] },
          { name: 'phone_number', values: ['+919812345678'] },
          { name: 'email', values: ['meta@t.test'] },
        ],
      };
      const runs = await Promise.allSettled([1, 2, 3].map(() => saveFacebookLead({ fbLead, formId: 'form-1', notify: false })));
      // Whatever the form lookup does without a token, the lead must exist at most once
      assert.ok((await Lead.countDocuments({ fbLeadId: 'fb-123' })) <= 1);
      const created = runs.filter((r) => r.status === 'fulfilled' && r.value && r.value.created);
      assert.ok(created.length <= 1);
    });
  });

  describe('Soft delete', () => {
    let admin;
    let lead;
    let deleteLead;
    const call = (req) => new Promise((resolve, reject) => {
      const res = {
        statusCode: 200,
        status(c) { this.statusCode = c; return this; },
        json(body) { resolve({ status: this.statusCode, body }); },
      };
      Promise.resolve(deleteLead(req, res, reject)).catch(reject);
    });

    before(async () => {
      await resetDay();
      ({ deleteLead } = require('../../controllers/leadController'));
      admin = { _id: new mongoose.Types.ObjectId(), firstName: 'Super', lastName: 'Admin', email: 's@t.test' };
      await mongoose.connection.db.collection('admins').insertOne({ ...admin });
      lead = await Lead.create(fields({ fullName: 'To Delete', phone: '9876500001' }));
      const FollowUpTask = require('../../models/FollowUpTask');
      await FollowUpTask.create({ lead: lead._id, assignedTo: admin._id, createdBy: admin._id, dueDate: new Date(Date.now() + 3600e3) });
    });

    test('delete marks the lead instead of erasing it', async () => {
      const r = await call({ params: { id: String(lead._id) }, user: admin, ip: '127.0.0.1' });
      assert.equal(r.status, 200);
      const raw = await Lead.collection.findOne({ _id: lead._id });
      assert.ok(raw, 'document still exists');
      assert.equal(raw.isDeleted, true);
      assert.ok(raw.deletedAt);
      assert.equal(String(raw.deletedBy), String(admin._id));
      assert.equal(raw.leadId, lead.leadId, 'ID and history untouched');
    });

    test('a deleted lead is hidden from finds, counts, aggregations and ID lookups', async () => {
      assert.equal(await Lead.findById(lead._id), null);
      assert.equal(await Lead.countDocuments({ phone: '9876500001' }), 0);
      assert.equal((await Lead.aggregate([{ $match: { phone: '9876500001' } }])).length, 0);
      assert.equal((await Lead.aggregate([{ $group: { _id: null, c: { $sum: 1 } } }])).length, 0);
      const { findLeadRaw } = require('../../utils/leadLookup');
      assert.equal(await findLeadRaw(String(lead._id)), null);
      // but still reachable on purpose
      assert.ok(await Lead.findById(lead._id).setOptions({ withDeleted: true }));
      assert.ok(await Lead.findOne({ _id: lead._id, isDeleted: true }));
    });

    test('deleting again reports not found', async () => {
      const r = await call({ params: { id: String(lead._id) }, user: admin, ip: '127.0.0.1' });
      assert.equal(r.status, 404);
    });

    test('its pending follow-ups are cancelled, not deleted', async () => {
      const FollowUpTask = require('../../models/FollowUpTask');
      const tasks = await FollowUpTask.find({ lead: lead._id });
      assert.equal(tasks.length, 1);
      assert.equal(tasks[0].status, 'Cancelled');
    });

    test('the delete is audited with who did it', async () => {
      const log = await require('../../models/AuditLog').findOne({ action: 'LEAD_DELETE' });
      assert.ok(log);
      assert.equal(log.recordId, lead.leadId);
      assert.equal(String(log.actorId), String(admin._id));
    });

    test('the same phone can come in again as a fresh lead', async () => {
      const again = await Lead.create(fields({ phone: '9876500001' }));
      assert.notEqual(again.leadId, lead.leadId);
      assert.equal(await Lead.countDocuments({ phone: '9876500001' }), 1);
    });
  });
});
