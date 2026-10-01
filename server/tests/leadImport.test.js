const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { prepareImport, previewImport } = require('../services/leadImport');

// Import preview (dry run) tests — candidate leads are injected, so no DB is
// touched. Run: npm test

const FUTURE = new Date('2030-01-01T10:00:00.000Z');

const existingLeads = [
  { _id: 'a1', leadId: 'VH-1', fullName: 'Asha', phone: '9876500001', phoneNormalized: '9876500001', emailNormalized: 'asha@x.com', status: 'New', city: 'Pune' },
  { _id: 'b2', leadId: 'VH-2', fullName: 'Bala', phone: '9876500002', phoneNormalized: '9876500002', status: 'Contacted', connected: 'Yes', interestLevel: 'Warm', nextFollowUpDate: FUTURE },
  { _id: 'c3', leadId: 'VH-3', fullName: 'Chen', phone: '9876500003', phoneNormalized: '9876500003', status: 'Won', dealCloseValue: 5000 },
  { _id: 'd4', leadId: 'VH-4', fullName: 'Dev', phone: '9876500004', phoneNormalized: '9876500004', status: 'Contacted', lockedBy: 'someone', lockedAt: new Date() }
];

async function preview(lines) {
  const csv = ['Full Name,Phone,Email,Status,Remark,City', ...lines].join('\n');
  const prepared = await prepareImport(Buffer.from(csv), 'sheet.csv');
  const loadCandidates = async () => existingLeads;
  return previewImport(prepared, { loadCandidates });
}

const rowOf = (out, row) => out.rows.find((r) => r.row === row);

describe('lead import preview', () => {
  test('rejects a file without name/phone columns', async () => {
    await assert.rejects(prepareImport(Buffer.from('Foo,Bar\n1,2\n'), 'x.csv'), /name column and a phone column/);
  });

  test('new contact is a create; missing name / bad phone are skipped with reasons', async () => {
    const out = await preview([
      'New Person,9000000001,new@x.com,,,',
      ',9000000002,,,,',
      'Bad Phone,abc,,,,'
    ]);
    assert.equal(rowOf(out, 2).action, 'create');
    assert.deepEqual(rowOf(out, 3).errors, ['Missing name']);
    assert.match(rowOf(out, 4).errors[0], /Invalid phone number "abc"/);
    assert.equal(out.summary.create, 1);
    assert.equal(out.summary.skip, 2);
  });

  test('invalid email and unrecognized status are surfaced, not silently ignored', async () => {
    const out = await preview(['Odd,9000000003,not-an-email,Maybe Later,,']);
    const r = rowOf(out, 2);
    assert.equal(r.action, 'create');
    assert.ok(r.warnings.some((w) => /Invalid email "not-an-email"/.test(w)));
    assert.ok(r.warnings.some((w) => /Unrecognized status "Maybe Later"/.test(w)));
  });

  test('a status on a brand-new lead is flagged as not applied', async () => {
    const out = await preview(['Fresh,9000000004,,Qualified,,']);
    assert.ok(rowOf(out, 2).warnings.some((w) => /always start as New/.test(w)));
  });

  test('same contact twice in one sheet: second row skipped', async () => {
    const out = await preview(['One,9000000005,,,,', 'Two,+91 90000 00005,,,,']);
    assert.equal(rowOf(out, 3).action, 'skip');
    assert.match(rowOf(out, 3).errors[0], /Same contact as row 2/);
  });

  test('existing lead: field diffs listed, identical values ignored', async () => {
    const out = await preview(['Asha,9876500001,,,called today,Pune']);
    const r = rowOf(out, 2);
    assert.equal(r.action, 'update');
    assert.equal(r.leadId, 'VH-1');
    assert.deepEqual(r.changes.map((c) => c.field), ['remark']);
  });

  test('existing lead with nothing new is unchanged', async () => {
    const out = await preview(['Asha,9876500001,,New,,Pune']);
    assert.equal(rowOf(out, 2).action, 'unchanged');
  });

  test('status is matched case-insensitively and validated by the state machine', async () => {
    const out = await preview([
      'Asha,9876500001,,contacted,,',   // New -> Contacted: allowed
      'Bala,9876500002,,won,,'          // Contacted -> Won: blocked by the same rules as the UI
    ]);
    assert.equal(rowOf(out, 2).action, 'update');
    assert.deepEqual(rowOf(out, 2).statusChange, { from: 'New', to: 'Contacted', closing: false, reopening: false });
    assert.equal(rowOf(out, 3).action, 'skip');
    assert.match(rowOf(out, 3).errors[0], /directly to "Won"/);
    assert.equal(rowOf(out, 3).statusChange.closing, true);
  });

  test('closing and reopening are flagged as critical', async () => {
    const out = await preview([
      'Bala,9876500002,,Lost,,',       // needs a reason -> skipped, still shown as a status change
      'Chen,9876500003,,Contacted,,'   // Super Admin reopen of a Won lead -> allowed
    ]);
    assert.match(rowOf(out, 2).errors[0], /reason is required to mark a lead Lost/);
    assert.equal(rowOf(out, 3).action, 'update');
    assert.equal(rowOf(out, 3).statusChange.reopening, true);
    assert.equal(out.summary.criticalStatusChanges, 1);
  });

  test('a lead locked by another user is skipped', async () => {
    const out = await preview(['Dev,9876500004,,,new remark,']);
    assert.match(rowOf(out, 2).errors[0], /locked/);
  });

  test('preview response carries no internal write payloads', async () => {
    const out = await preview(['New Person,9000000001,,,,', 'Asha,9876500001,,,hi,']);
    for (const r of out.rows) {
      assert.ok(!('_create' in r) && !('_patch' in r));
    }
  });
});
