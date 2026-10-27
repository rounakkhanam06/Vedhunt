const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { parseDay, documentItems, sendProblem, MAX_ITEMS } = require('../services/invoiceDocument');

const invoice = (extra = {}) => ({
  lineItems: [
    { description: 'Performance marketing\nMeta Ads Management\nGoogle Ads', qty: 1, unitPrice: 5932.5, amount: 5932.5, sac: '998361' },
    { description: 'Creative support', qty: 2, unitPrice: 1000, amount: 2000 },
  ],
  taxPercent: 18, taxAmount: 1427.85, subtotal: 7932.5, totalAmount: 9360.35,
  billing: { address: 'Noida', placeOfSupply: 'Uttar Pradesh' },
  ...extra,
});

describe('invoice document — the date typed by staff', () => {
  test('accepts a real day and keeps it on that day', () => {
    const d = parseDay('2026-07-03');
    assert.deepEqual([d.getFullYear(), d.getMonth(), d.getDate()], [2026, 6, 3]);
  });
  test('rejects anything that is not a real calendar day', () => {
    for (const bad of ['', undefined, '03-07-2026', '2026-7-3', '2026-02-31', '2026-13-01']) assert.equal(parseDay(bad), null, String(bad));
  });
});

describe('invoice document — line items', () => {
  test('the first line of a description is the service, the rest its description', () => {
    const [a, b] = documentItems(invoice());
    assert.equal(a.service, 'Performance marketing');
    assert.equal(a.description, 'Meta Ads Management\nGoogle Ads');
    assert.equal(a.sac, '998361');
    assert.equal(b.description, '');
  });
  test('tax per line adds up exactly to the invoice tax, whatever the rounding', () => {
    const items = documentItems(invoice());
    assert.equal(Math.round(items.reduce((s, i) => s + i.gstAmount, 0) * 100) / 100, 1427.85);
    assert.equal(Math.round(items.reduce((s, i) => s + i.total, 0) * 100) / 100, 9360.35);
    assert.equal(items[0].gstAmount, 1067.85);
    assert.equal(items[0].gstPercent, 18);
  });
  test('no tax stays no tax', () => {
    const items = documentItems(invoice({ taxPercent: 0, taxAmount: 0 }));
    assert.deepEqual(items.map((i) => i.gstAmount), [0, 0]);
  });
});

describe('invoice document — what must be filled before sending', () => {
  test('a complete invoice can go out as either type', () => {
    assert.equal(sendProblem(invoice(), 'Tax Invoice'), null);
    assert.equal(sendProblem(invoice(), 'Proforma Invoice'), null);
  });
  test('the type must be one of the two', () => assert.match(sendProblem(invoice(), 'Receipt'), /Choose/));
  test('billing address and place of supply are required', () => {
    assert.match(sendProblem(invoice({ billing: { placeOfSupply: 'Goa' } }), 'Tax Invoice'), /billing address/i);
    assert.match(sendProblem(invoice({ billing: { address: 'x' } }), 'Tax Invoice'), /place of supply/i);
    assert.match(sendProblem(invoice({ billing: { address: 'x', placeOfSupply: 'Atlantis' } }), 'Tax Invoice'), /place of supply/i);
    assert.match(sendProblem(invoice({ billing: undefined }), 'Tax Invoice'), /billing address/i);
  });
  test('the item table holds a limited number of lines', () => {
    const lines = Array.from({ length: MAX_ITEMS + 1 }, () => ({ description: 'x', qty: 1, unitPrice: 1, amount: 1 }));
    assert.match(sendProblem(invoice({ lineItems: lines }), 'Tax Invoice'), /up to/);
    assert.match(sendProblem(invoice({ lineItems: [] }), 'Tax Invoice'), /no line items/);
  });
});
