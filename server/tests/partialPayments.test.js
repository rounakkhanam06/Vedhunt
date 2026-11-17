const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Part payments: an invoice reads "Partially Paid" with its balance, and a
// project shows what is left against its value. In-memory MongoDB only.

const finance = require('../services/finance');

describe('partly paid invoices', () => {
  test('flags a part-paid invoice and its balance', () => {
    const inv = finance.withDerived({ totalAmount: 100000, paidAmount: 50000, paymentStatus: 'Unpaid', dueDate: new Date(Date.now() + 864e5) });
    assert.equal(inv.isPartiallyPaid, true);
    assert.equal(inv.balance, 50000);
    assert.equal(inv.paymentStatus, 'Unpaid');
  });

  test('nothing paid, or fully paid, is not partial', () => {
    assert.equal(finance.withDerived({ totalAmount: 1000, paidAmount: 0, paymentStatus: 'Unpaid' }).isPartiallyPaid, false);
    assert.equal(finance.withDerived({ totalAmount: 1000, paidAmount: 1000, paymentStatus: 'Paid' }).isPartiallyPaid, false);
  });

  test('credit notes count: paid the reduced total is not partial', () => {
    assert.equal(finance.withDerived({ totalAmount: 1000, creditedAmount: 200, paidAmount: 800, paymentStatus: 'Unpaid' }).isPartiallyPaid, false);
  });
});

describe('project balance', () => {
  let mongo;
  before(async () => { mongo = await MongoMemoryServer.create(); await mongoose.connect(mongo.getUri()); });
  after(async () => { await mongoose.disconnect(); await mongo.stop(); });

  test('value, invoiced, received and balance', async () => {
    const p1 = new mongoose.Types.ObjectId();
    const p2 = new mongoose.Types.ObjectId();
    await mongoose.connection.db.collection('invoices').insertMany([
      { project_ref: p1, totalAmount: 50000, paidAmount: 50000 },
      { project_ref: p1, totalAmount: 30000, paidAmount: 10000, creditedAmount: 0 },
      { project_ref: p2, totalAmount: 20000, paidAmount: 5000 },
    ]);
    const m = await finance.projectFinancials([{ _id: p1, totalPrice: 100000 }, { _id: p2, totalPrice: 0 }]);
    const a = m.get(String(p1));
    assert.equal(a.value, 100000);
    assert.equal(a.invoiced, 80000);
    assert.equal(a.received, 60000);
    assert.equal(a.balance, 40000);
    assert.equal(a.dueOnInvoices, 20000);
    assert.equal(a.notYetInvoiced, 20000);
    assert.equal(a.receivedPercent, 60);
    // No project value: balance falls back to what the invoices still owe
    assert.equal(m.get(String(p2)).balance, 15000);
  });
});
