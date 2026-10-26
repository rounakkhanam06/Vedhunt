const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  invoiceBalance, daysOverdue, isOverdue, collectionPercent, withDerived, overdueFilter, unpaidNotOverdueFilter,
} = require('../services/finance');

const NOW = new Date('2026-10-26T10:00:00Z');
const day = (n) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);
const inv = (o = {}) => ({ totalAmount: 17700, paidAmount: 0, paymentStatus: 'Unpaid', dueDate: day(-10), ...o });

describe('invoice balance', () => {
  test('is total minus paid, never negative', () => {
    assert.equal(invoiceBalance(inv({ paidAmount: 5000 })), 12700);
    assert.equal(invoiceBalance(inv({ paidAmount: 20000 })), 0);
  });
  test('rounds to paise', () => {
    assert.equal(invoiceBalance({ totalAmount: 100.1, paidAmount: 0.2 }), 99.9);
  });
});

describe('overdue is derived, not typed', () => {
  test('past due with a balance is overdue and counts whole days', () => {
    assert.equal(isOverdue(inv(), NOW), true);
    assert.equal(daysOverdue(inv(), NOW), 10);
  });
  test('not yet due is not overdue', () => {
    assert.equal(isOverdue(inv({ dueDate: day(3) }), NOW), false);
    assert.equal(daysOverdue(inv({ dueDate: day(3) }), NOW), 0);
  });
  test('a fully paid invoice is never overdue, even past its due date', () => {
    assert.equal(isOverdue(inv({ paymentStatus: 'Paid', paidAmount: 17700 }), NOW), false);
    assert.equal(isOverdue(inv({ paidAmount: 17700 }), NOW), false);
  });
  test('a part-paid invoice past its due date is still overdue, for the balance only', () => {
    const part = inv({ paidAmount: 10000 });
    assert.equal(isOverdue(part, NOW), true);
    assert.equal(invoiceBalance(part), 7700);
  });
  test('an invoice with no due date cannot be overdue', () => {
    assert.equal(isOverdue(inv({ dueDate: null }), NOW), false);
  });
  test('withDerived reports Overdue status plus balance and days', () => {
    const d = withDerived(inv({ paidAmount: 700 }), NOW);
    assert.equal(d.paymentStatus, 'Overdue');
    assert.equal(d.balance, 17000);
    assert.equal(d.daysOverdue, 10);
    assert.equal(d.isOverdue, true);
  });
  test('a stale stored "Overdue" is not trusted once the invoice is no longer past due', () => {
    const d = withDerived(inv({ paymentStatus: 'Overdue', dueDate: day(5) }), NOW);
    assert.equal(d.paymentStatus, 'Unpaid');
    assert.equal(d.isOverdue, false);
  });
  test('withDerived leaves a Paid invoice as Paid', () => {
    const d = withDerived(inv({ paymentStatus: 'Paid', paidAmount: 17700 }), NOW);
    assert.equal(d.paymentStatus, 'Paid');
    assert.equal(d.balance, 0);
    assert.equal(d.isOverdue, false);
  });
});

describe('collection percentage', () => {
  test('received / total × 100', () => {
    assert.equal(collectionPercent(17700, 17700), 100);
    assert.equal(collectionPercent(5000, 20000), 25);
  });
  test('is null (shown as "--") when nothing was billed', () => {
    assert.equal(collectionPercent(0, 0), null);
  });
});

describe('mongo filters mirror the JS rules', () => {
  test('overdue filter excludes Paid, needs a past due date and a balance', () => {
    const f = overdueFilter(NOW);
    assert.deepEqual(f.paymentStatus, { $ne: 'Paid' });
    assert.deepEqual(f.dueDate, { $lt: NOW });
    assert.ok(f.$expr);
  });
  test('unpaid-not-overdue filter allows no due date or a future one', () => {
    const f = unpaidNotOverdueFilter(NOW);
    assert.deepEqual(f.$or, [{ dueDate: null }, { dueDate: { $gte: NOW } }]);
  });
});
