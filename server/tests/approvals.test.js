const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { validateRequest, clientView } = require('../services/approvals');

describe('approval requests', () => {
  test('a request needs a kind and a title; a budget needs an amount', () => {
    assert.ok(validateRequest({ kind: 'Strategy', title: 'Strategy v2' }).value);
    assert.match(validateRequest({ kind: 'Nonsense', title: 'x' }).error, /what is being approved/);
    assert.match(validateRequest({ kind: 'Creative', title: 'ab' }).error, /title/);
    assert.match(validateRequest({ kind: 'Budget', title: 'Meta budget' }).error, /budget amount/);
    assert.equal(validateRequest({ kind: 'Budget', title: 'Meta budget', amount: '30000' }).value.amount, 30000);
    assert.match(validateRequest({ kind: 'Budget', title: 'Meta budget', amount: -5 }).error, /zero or more/);
  });
  test('a link must be a web address', () => {
    assert.match(validateRequest({ kind: 'Creative', title: 'Creatives', linkUrl: 'javascript:alert(1)' }).error, /http/);
    assert.equal(validateRequest({ kind: 'Creative', title: 'Creatives', linkUrl: 'https://drive.example/x' }).value.linkUrl, 'https://drive.example/x');
  });
});

describe('what the client sees of an approval', () => {
  test('the decision and comment, never who on staff asked for it', () => {
    const view = clientView({ _id: '1', kind: 'Strategy', title: 'Strategy v2', status: 'Approved', requestedByName: 'Asha Admin', requestedBy: 'x', decisionBy: 'staff', decidedByName: 'Asha Admin', channel: 'WhatsApp', note: 'ok' });
    assert.equal(JSON.stringify(view).includes('Asha'), false);
    assert.deepEqual([view.status, view.channel, view.decidedByClient], ['Approved', 'WhatsApp', false]);
  });
});
