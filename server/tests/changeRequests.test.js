const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { validateRequest, stageOf } = require('../services/changeRequests');

describe('change request input', () => {
  const ok = { title: 'Landing page', description: 'A new landing page for the Diwali sale', quoteAmount: '12000', estimatedDays: '5' };
  test('a valid request', () => {
    const { value } = validateRequest(ok);
    assert.deepEqual([value.title, value.quoteAmount, value.estimatedDays], ['Landing page', 12000, 5]);
  });
  test('needs a title, a real description and a fee', () => {
    assert.match(validateRequest({ ...ok, title: 'x' }).error, /title/);
    assert.match(validateRequest({ ...ok, description: 'short' }).error, /Describe/);
    assert.match(validateRequest({ ...ok, quoteAmount: 0 }).error, /fee quoted/);
    assert.match(validateRequest({ ...ok, estimatedDays: 2.5 }).error, /whole number/);
    assert.equal(validateRequest({ ...ok, estimatedDays: '' }).value.estimatedDays, undefined, 'the timeline is optional');
  });
});

describe('where a change request stands (read from its approval)', () => {
  const cr = (extra = {}) => ({ workStatus: 'Not started', ...extra });
  test('the approval decides until it is approved', () => {
    assert.equal(stageOf(cr(), { status: 'Pending' }), 'Awaiting client approval');
    assert.equal(stageOf(cr(), { status: 'Rejected' }), 'Rejected by client');
    assert.equal(stageOf(cr(), { status: 'Cancelled' }), 'Withdrawn');
  });
  test('once approved, the work and the invoice take over', () => {
    const a = { status: 'Approved' };
    assert.equal(stageOf(cr(), a), 'Approved — ready to start');
    assert.equal(stageOf(cr({ workStatus: 'In progress' }), a), 'In progress');
    assert.equal(stageOf(cr({ workStatus: 'Done' }), a), 'Done — not invoiced yet');
    assert.equal(stageOf(cr({ workStatus: 'Done', invoice_ref: 'x' }), a), 'Done and invoiced');
  });
});
