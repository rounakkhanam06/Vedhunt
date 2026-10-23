const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const Subscriber = require('../models/Subscriber');
const { PERMISSIONS, grantsAdminPanel, hasPermission } = require('../config/permissions');

describe('Newsletter Subscriber schema & required fields', () => {
  test('requires a valid email address and unsubscribeToken', () => {
    const invalidSub = new Subscriber({});
    const err = invalidSub.validateSync();
    assert.ok(err.errors.email, 'email should be required');
    assert.ok(err.errors.unsubscribeToken, 'unsubscribeToken should be required');
  });

  test('validates email regex format', () => {
    const badEmailSub = new Subscriber({ email: 'not-an-email', unsubscribeToken: 'tok123' });
    const err = badEmailSub.validateSync();
    assert.ok(err.errors.email, 'bad email format should fail validation');
  });

  test('status is strictly newsletter subscription status and rejects sales pipeline stages', () => {
    // Valid subscription statuses
    const activeSub = new Subscriber({
      email: 'user@example.com',
      unsubscribeToken: 'token123',
      status: 'Subscribed'
    });
    assert.equal(activeSub.validateSync(), undefined);

    const unsub = new Subscriber({
      email: 'user2@example.com',
      unsubscribeToken: 'token456',
      status: 'Unsubscribed'
    });
    assert.equal(unsub.validateSync(), undefined);

    // Sales pipeline stages must NOT be allowed as subscription status
    const salesStages = ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation', 'Won', 'Lost', 'Dropped', 'Hold'];
    for (const stage of salesStages) {
      const invalid = new Subscriber({
        email: 'stage@example.com',
        unsubscribeToken: 'token789',
        status: stage
      });
      const err = invalid.validateSync();
      assert.ok(err && err.errors.status, `Sales stage '${stage}' must not be allowed as newsletter subscriber status`);
    }
  });

  test('supports subscriber-specific fields and defaults', () => {
    const sub = new Subscriber({
      email: 'community@vedhunt.in',
      name: 'Priya Sharma',
      source: 'Website',
      tags: ['Product Updates', 'Monthly Digest'],
      unsubscribeToken: 'abc123hex'
    });

    assert.equal(sub.email, 'community@vedhunt.in');
    assert.equal(sub.name, 'Priya Sharma');
    assert.equal(sub.source, 'Website');
    assert.deepEqual(sub.tags, ['Product Updates', 'Monthly Digest']);
    assert.equal(sub.status, 'Subscribed');
    assert.equal(sub.active, true);
    assert.ok(sub.subscribedAt instanceof Date);
  });
});

describe('Newsletter permissions', () => {
  test('newsletter.manage is registered and recognized in system permissions', () => {
    assert.ok(PERMISSIONS.includes('newsletter.manage'));
    assert.ok(grantsAdminPanel(['newsletter.manage']));
    assert.ok(hasPermission(['newsletter.manage'], 'newsletter.manage'));
    assert.ok(hasPermission(['*'], 'newsletter.manage'));
  });
});
