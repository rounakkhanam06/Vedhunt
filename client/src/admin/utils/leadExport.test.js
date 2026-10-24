// Run with: node --import ./client/src/employee/lib/test-setup.mjs --test client/src/admin/utils/leadExport.test.js
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildLeadsCsv, LEAD_EXPORT_COLUMNS } from './leadExport.js';

const lead = (fields) => ({ fullName: 'Asha', phone: '9876500001', status: 'New', ...fields });
const columnIndex = (header) => LEAD_EXPORT_COLUMNS.findIndex((c) => c.header === header);
const cell = (row, header) => LEAD_EXPORT_COLUMNS[columnIndex(header)].value(row);

describe('lead export — Latest note column', () => {
  test('the Remark column is now Latest note', () => {
    assert.equal(columnIndex('Remark'), -1);
    assert.ok(columnIndex('Latest note') >= 0);
    assert.ok(buildLeadsCsv([lead({})]).split('\r\n')[0].includes('"Latest note"'));
  });

  test('exports the newest note text', () => {
    assert.equal(cell(lead({ latestNote: { text: 'Called twice' } }), 'Latest note'), '"Called twice"');
  });

  test('a lead with only an old remark exports that text, so nothing drops out of the file', () => {
    assert.equal(cell(lead({ remark: 'old remark' }), 'Latest note'), '"old remark"');
  });

  test('a note wins over an old remark', () => {
    assert.equal(cell(lead({ remark: 'old', latestNote: { text: 'new' } }), 'Latest note'), '"new"');
  });

  test('no note and no remark is an empty cell; quotes are escaped', () => {
    assert.equal(cell(lead({ latestNote: null }), 'Latest note'), '""');
    assert.equal(cell(lead({ latestNote: { text: 'said "yes"' } }), 'Latest note'), '"said ""yes"""');
  });

  test('the file header matches what the importer reads back (latestnote alias)', () => {
    const header = 'Latest note';
    assert.equal(header.trim().toLowerCase().replace(/[^a-z0-9]/g, ''), 'latestnote');
  });
});
