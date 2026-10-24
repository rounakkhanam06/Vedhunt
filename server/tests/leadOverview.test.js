const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { foldRows, INTEREST_COLUMNS, STAGE_COLUMNS, NOT_RATED } = require('../services/leadOverview');

const g = (owner, key, count) => ({ _id: { owner, key }, count });
const names = new Map([['a1', 'Jyoti'], ['a2', 'Amit']]);

describe('Leads Overview — folding groups into BD rows', () => {
  test('interest columns are the six levels plus Not rated', () => {
    assert.deepEqual(INTEREST_COLUMNS, ['Hot Lead', 'Warm', 'Cold', 'Interested', 'Not Interested', 'Wrong / Junk Lead', NOT_RATED]);
  });

  test('stage columns are the nine PRD stages', () => {
    assert.deepEqual(STAGE_COLUMNS, ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation', 'Won', 'Lost', 'Dropped', 'Hold']);
  });

  test('one row per owner, zero-filled, with row and column totals', () => {
    const out = foldRows([g('a1', 'Warm', 3), g('a1', 'Cold', 2), g('a2', 'Warm', 4)], INTEREST_COLUMNS, names);
    assert.deepEqual(out.rows.map((r) => r.name), ['Amit', 'Jyoti']);
    const jyoti = out.rows.find((r) => r.name === 'Jyoti');
    assert.equal(jyoti.counts.Warm, 3);
    assert.equal(jyoti.counts['Hot Lead'], 0);
    assert.equal(jyoti.total, 5);
    assert.equal(out.totals.Warm, 7);
    assert.equal(out.totals.total, 9);
  });

  test('row totals add up to the grand total (no lead counted twice)', () => {
    const out = foldRows([g('a1', 'Won', 1), g('a2', 'Won', 2), g(null, 'New', 5)], STAGE_COLUMNS, names);
    assert.equal(out.rows.reduce((s, r) => s + r.total, 0), out.totals.total);
    assert.equal(out.totals.total, 8);
  });

  test('unassigned leads get their own row, listed last', () => {
    const out = foldRows([g(null, 'New', 5), g('a2', 'New', 1)], STAGE_COLUMNS, names);
    assert.equal(out.rows.at(-1).name, 'Unassigned');
    assert.equal(out.rows.at(-1).unassigned, true);
    assert.equal(out.rows.at(-1).counts.New, 5);
  });

  test('an owner that no longer exists is labelled, not dropped', () => {
    const out = foldRows([g('gone', 'Lost', 2)], STAGE_COLUMNS, names);
    assert.equal(out.rows[0].name, 'Deleted user');
    assert.equal(out.totals.Lost, 2);
  });

  test('values outside the columns are ignored rather than miscounted', () => {
    const out = foldRows([g('a1', 'Mystery', 9), g('a1', 'Won', 1)], STAGE_COLUMNS, names);
    assert.equal(out.totals.total, 1);
  });

  test('empty input yields zeroed totals and no rows', () => {
    const out = foldRows([], STAGE_COLUMNS);
    assert.deepEqual(out.rows, []);
    assert.equal(out.totals.total, 0);
  });
});
