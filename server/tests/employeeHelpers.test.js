const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { sessionBounds, MAX_SESSION_MINUTES } = require('../services/workTimer');
const bank = require('../services/bankDetails');
const { mustResetPassword } = require('../utils/tempPasswordGate');

// Pure-function tests for the Employee Portal helpers. Run: npm test

describe('work timer session bounds', () => {
  test('normal session is untouched', () => {
    const start = new Date('2026-10-02T10:00:00');
    const r = sessionBounds(start, new Date('2026-10-02T12:30:00'));
    assert.equal(r.duration, 150);
    assert.equal(r.capped, false);
  });
  test('left running overnight → capped at the end of the start day', () => {
    const start = new Date('2026-10-01T20:00:00');
    const r = sessionBounds(start, new Date('2026-10-02T09:00:00'));
    assert.equal(r.capped, true);
    assert.equal(r.end.getDate(), 1);
    assert.equal(r.duration, 239); // 20:00 → 23:59:59
  });
  test('never more than 12 hours', () => {
    const start = new Date('2026-10-02T00:30:00');
    const r = sessionBounds(start, new Date('2026-10-02T23:00:00'));
    assert.equal(r.duration, MAX_SESSION_MINUTES);
    assert.equal(r.capped, true);
  });
});

describe('bank details', () => {
  test('validation: all fields, digits-only account, IFSC format; normalises input', () => {
    assert.ok(bank.validateBankDetails({ bankName: 'HDFC Bank' }).error);
    assert.ok(bank.validateBankDetails({ bankName: 'HDFC', accountName: 'A B', accountNumber: '12ab', ifscCode: 'HDFC0001234' }).error);
    assert.ok(bank.validateBankDetails({ bankName: 'HDFC', accountName: 'A B', accountNumber: '123456789', ifscCode: 'BAD' }).error);
    const { details } = bank.validateBankDetails({ bankName: ' HDFC Bank ', accountName: 'Asha Rao', accountNumber: '5010 0123 4567', ifscCode: 'hdfc0001234' });
    assert.deepEqual(details, { bankName: 'HDFC Bank', accountName: 'Asha Rao', accountNumber: '501001234567', ifscCode: 'HDFC0001234' });
  });
  test('encrypted at rest, decrypted/masked on the way out; legacy plain text still works', () => {
    const stored = bank.forStorage({ bankName: 'X', accountName: 'Y', accountNumber: '501001234567', ifscCode: 'HDFC0001234' });
    assert.match(stored.accountNumber, /^[0-9a-f]{32}:[0-9a-f]+$/i);
    assert.equal(bank.decryptAccount(stored.accountNumber), '501001234567');
    assert.equal(bank.maskAccount(stored.accountNumber), '••••••••4567');
    assert.equal(bank.decryptAccount('123456789012'), '123456789012', 'legacy plain value unchanged');
    assert.equal(bank.maskAccount('123456789012'), '••••••••9012');
    assert.equal(bank.encryptAccount(stored.accountNumber), stored.accountNumber, 'never double-encrypts');
  });
  test('sameDetails compares the real number, case-insensitive names', () => {
    const a = bank.forStorage({ bankName: 'HDFC', accountName: 'Asha', accountNumber: '501001234567', ifscCode: 'HDFC0001234' });
    assert.equal(bank.sameDetails({ bankName: 'hdfc', accountName: 'ASHA', accountNumber: '501001234567', ifscCode: 'HDFC0001234' }, a), true);
    assert.equal(bank.sameDetails({ bankName: 'HDFC', accountName: 'Asha', accountNumber: '501001234568', ifscCode: 'HDFC0001234' }, a), false);
  });
});

describe('temporary password gate', () => {
  const reqFor = (baseUrl, path) => ({ baseUrl, path });
  const allowed = ['/api/auth/me', '/api/auth/reset-temp-password'];
  test('blocks everything except the allowed paths while on a temp password', () => {
    assert.equal(mustResetPassword(reqFor('/api/admin', '/clients'), true, allowed), true);
    assert.equal(mustResetPassword(reqFor('/api/auth', '/me'), true, allowed), false);
    assert.equal(mustResetPassword(reqFor('/api/auth', '/me/'), true, allowed), false, 'trailing slash');
  });
  test('never blocks a normal account', () => {
    assert.equal(mustResetPassword(reqFor('/api/admin', '/clients'), false, allowed), false);
  });
});
