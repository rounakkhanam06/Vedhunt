const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { bucketOf, pastDay, ageingCsv, BUCKETS } = require('../services/receivables');
const { netTotal, invoiceBalance, withDerived } = require('../services/finance');

const NOW = new Date('2026-10-27T10:00:00');
const daysAgo = (n) => new Date(NOW.getTime() - n * 864e5);

describe('ageing buckets — how long an unpaid invoice has been overdue', () => {
  test('not yet due, or no due date', () => {
    assert.equal(bucketOf(new Date(NOW.getTime() + 864e5), NOW), 'notDue');
    assert.equal(bucketOf(null, NOW), 'notDue');
  });
  test('the edges of each bucket', () => {
    assert.equal(bucketOf(daysAgo(1), NOW), 'd1_30');
    assert.equal(bucketOf(daysAgo(30), NOW), 'd1_30');
    assert.equal(bucketOf(daysAgo(31), NOW), 'd31_60');
    assert.equal(bucketOf(daysAgo(60), NOW), 'd31_60');
    assert.equal(bucketOf(daysAgo(61), NOW), 'd61_90');
    assert.equal(bucketOf(daysAgo(90), NOW), 'd61_90');
    assert.equal(bucketOf(daysAgo(91), NOW), 'd90plus');
  });
  test('a few hours past due is already overdue (1–30), not "not due"', () => {
    assert.equal(bucketOf(new Date(NOW.getTime() - 3 * 3600e3), NOW), 'd1_30');
  });
});

describe('credit notes lower what is owed, not the invoice as issued', () => {
  const inv = { totalAmount: 11800, creditedAmount: 2360, paidAmount: 0, dueDate: daysAgo(10), paymentStatus: 'Unpaid' };
  test('net total and balance', () => {
    assert.equal(netTotal(inv), 9440);
    assert.equal(invoiceBalance(inv), 9440);
    assert.equal(invoiceBalance({ ...inv, paidAmount: 9440 }), 0);
    assert.equal(invoiceBalance({ totalAmount: 5000, paidAmount: 1000 }), 4000, 'older invoices have no credit field');
  });
  test('an invoice paid up to its net total is not overdue', () => {
    const d = withDerived({ ...inv, paidAmount: 9440 }, NOW);
    assert.equal(d.isOverdue, false);
    assert.equal(d.balance, 0);
    assert.equal(withDerived(inv, NOW).isOverdue, true);
  });
});

describe('dates staff type', () => {
  test('a past day or today passes; the future and nonsense do not', () => {
    assert.ok(pastDay('2026-10-01', NOW));
    assert.ok(pastDay('2026-10-27', NOW), 'today');
    assert.ok(pastDay(undefined, NOW), 'blank = today');
    assert.equal(pastDay('2026-10-28', NOW), null);
    assert.equal(pastDay('2026-02-31', NOW), null);
    assert.equal(pastDay('not a date', NOW), null);
  });
});

describe('ageing CSV', () => {
  test('one line per client plus a total', () => {
    const empty = { notDue: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0, total: 0, invoices: 0 };
    const csv = ageingCsv({
      buckets: BUCKETS,
      rows: [{ ...empty, clientId: 'VH-CL-0001', businessName: 'Acme, Ltd', d1_30: 1000, total: 1000, invoices: 1 }],
      totals: { ...empty, d1_30: 1000, total: 1000, invoices: 1 },
    }).split('\n');
    assert.equal(csv.length, 3);
    assert.match(csv[0], /^Client ID,Client,Not due yet/);
    assert.match(csv[1], /^VH-CL-0001,"Acme, Ltd",0,1000,0,0,0,1000,1$/);
    assert.match(csv[2], /^,Total,0,1000/);
  });
});
