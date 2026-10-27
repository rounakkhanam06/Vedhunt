const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { validateAccess, summarize } = require('../services/platformAccess');

const NOW = new Date('2026-10-27T10:00:00');
const row = (status, extra = {}) => ({ status, platform: 'Meta Ads', permissionLevel: 'Partner access', ...extra });

describe('platform access — a record of access, never of credentials', () => {
  test('a new request needs only a platform', () => {
    const { value } = validateAccess({ platform: 'Meta Ads', assetName: 'Acme ad account', accountId: '123456' }, null, NOW);
    assert.equal(value.status, 'Requested');
    assert.ok(value.requestedAt);
    assert.match(validateAccess({ platform: 'TikTok' }, null, NOW).error, /Choose the platform/);
  });
  test('passwords and codes are refused', () => {
    for (const notes of ['password: abc123', 'the pwd = hunter2', 'OTP is 123456', 'api key: sk-xxx']) {
      assert.match(validateAccess({ platform: 'Google Ads', notes }, null, NOW).error, /Do not record passwords/, notes);
    }
    assert.ok(validateAccess({ platform: 'Google Ads', notes: 'Manager account invited by email' }, null, NOW).value);
  });
  test('the order is Requested → Granted → Verified → Revoked', () => {
    assert.equal(validateAccess({ status: 'Granted', permissionLevel: 'Admin' }, row('Requested', { permissionLevel: undefined }), NOW).value.status, 'Granted');
    assert.match(validateAccess({ status: 'Verified' }, row('Requested'), NOW).error, /cannot move to Verified/);
    assert.equal(validateAccess({ status: 'Verified' }, row('Granted'), NOW).value.status, 'Verified');
    assert.match(validateAccess({ status: 'Granted' }, row('Verified'), NOW).error, /cannot move/);
  });
  test('granting needs a permission level; revoking needs a reason; revoked is final', () => {
    assert.match(validateAccess({ status: 'Granted' }, row('Requested', { permissionLevel: undefined }), NOW).error, /permission level/);
    assert.match(validateAccess({ status: 'Revoked' }, row('Granted'), NOW).error, /why the access was revoked/);
    const ok = validateAccess({ status: 'Revoked', revokeReason: 'Contract ended' }, row('Verified'), NOW).value;
    assert.deepEqual([ok.status, ok.revokeReason], ['Revoked', 'Contract ended']);
    assert.match(validateAccess({ status: 'Granted' }, row('Revoked'), NOW).error, /final/);
  });
  test('the date is the real day, never in the future', () => {
    assert.equal(validateAccess({ status: 'Verified', date: '2026-10-20' }, row('Granted'), NOW).value.verifiedAt.getDate(), 20);
    assert.match(validateAccess({ status: 'Verified', date: '2026-11-20' }, row('Granted'), NOW).error, /not in the future/);
    assert.match(validateAccess({ status: 'Verified', date: 'soon' }, row('Granted'), NOW).error, /date/);
  });
  test('summary counts', () => {
    const s = summarize([row('Requested'), row('Granted'), row('Verified'), row('Verified'), row('Revoked')]);
    assert.deepEqual(s, { requested: 1, granted: 1, verified: 2, revoked: 1, live: 3 });
  });
});
