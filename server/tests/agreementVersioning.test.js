const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  isAgreementConfigured,
  requiredAgreementVersion,
  needsAgreementAcceptance,
  nextAgreementVersion,
  agreementDetailsChanged,
} = require('../services/agreementVersioning');

// Pure-function tests for the client Service Agreement versioning rules
// (one common template + per-client details). Run: npm test

// What a new client looks like: ONLY the schema defaults from models/Client.js
// (fees included — they default to non-zero amounts), nothing admin-entered
const freshDetails = { domain: '', serviceName: 'Performance Marketing management', platforms: ['Meta'], deliverables: ['x'], exclusions: ['y'], monthlyFee: 15000, gstAmount: 2700, totalPayable: 17700 };
const filledDetails = { ...freshDetails, domain: 'acme.com', agreementDate: new Date('2026-10-01'), monthlyFee: 50000 };

describe('isAgreementConfigured', () => {
  test('schema defaults alone are not a prepared agreement', () => {
    assert.equal(isAgreementConfigured({ agreementDetails: freshDetails }), false);
  });
  test('admin-entered domain or date counts as prepared', () => {
    assert.equal(isAgreementConfigured({ agreementDetails: { ...freshDetails, domain: 'a.com' } }), true);
    assert.equal(isAgreementConfigured({ agreementDetails: { ...freshDetails, effectiveDate: new Date() } }), true);
  });
  test('default (non-zero) fees alone do NOT count as prepared', () => {
    assert.equal(isAgreementConfigured({ agreementDetails: { ...freshDetails, monthlyFee: 15000 } }), false);
  });
  test('a client who already signed (pre-versioning) still has an agreement', () => {
    assert.equal(isAgreementConfigured({ acceptedAgreementVersion: 1, agreementDetails: freshDetails }), true);
  });
  test('a bumped agreementVersion counts as prepared', () => {
    assert.equal(isAgreementConfigured({ agreementVersion: 1, agreementDetails: freshDetails }), true);
  });
});

describe('requiredAgreementVersion / needsAgreementAcceptance', () => {
  test('nothing to sign until the admin fills the details — even if a global Agreement doc exists', () => {
    const c = { agreementDetails: freshDetails, acceptedAgreementVersion: 0 };
    assert.equal(requiredAgreementVersion(c, 3), 0);
    assert.equal(needsAgreementAcceptance(c, 3), false);
  });
  test('prepared but never signed → must sign (no global doc needed)', () => {
    const c = { agreementVersion: 1, agreementDetails: filledDetails, acceptedAgreementVersion: 0 };
    assert.equal(requiredAgreementVersion(c, 0), 1);
    assert.equal(needsAgreementAcceptance(c, 0), true);
  });
  test('legacy client: details filled before versioning, already accepted global v1 → not re-prompted', () => {
    const c = { agreementVersion: 0, agreementDetails: filledDetails, acceptedAgreementVersion: 1 };
    assert.equal(needsAgreementAcceptance(c, 1), false);
  });
  test('legacy client: details filled, never accepted → prompted', () => {
    const c = { agreementVersion: 0, agreementDetails: filledDetails, acceptedAgreementVersion: 0 };
    assert.equal(needsAgreementAcceptance(c, 0), true);
  });
  test('a re-issued global template (higher version) re-prompts a prepared client', () => {
    const c = { agreementVersion: 2, agreementDetails: filledDetails, acceptedAgreementVersion: 2 };
    assert.equal(needsAgreementAcceptance(c, 2), false);
    assert.equal(needsAgreementAcceptance(c, 3), true);
  });
});

describe('nextAgreementVersion', () => {
  test('first preparation → 1', () => {
    assert.equal(nextAgreementVersion({ agreementVersion: 0, acceptedAgreementVersion: 0 }), 1);
  });
  test('always above what the client accepted, so an edit after signing re-prompts', () => {
    const c = { agreementVersion: 0, acceptedAgreementVersion: 1, agreementDetails: filledDetails };
    const v = nextAgreementVersion(c);
    assert.equal(v, 2);
    assert.equal(needsAgreementAcceptance({ ...c, agreementVersion: v }, 1), true);
  });
  test('after accepting a re-issued global v5, an edit still re-prompts', () => {
    const c = { agreementVersion: 1, acceptedAgreementVersion: 5, agreementDetails: filledDetails };
    const v = nextAgreementVersion(c);
    assert.equal(v, 6);
    assert.equal(needsAgreementAcceptance({ ...c, agreementVersion: v }, 5), true);
  });
});

describe('agreementDetailsChanged', () => {
  test('identical details (dates as Date vs same instant) → unchanged', () => {
    const a = { ...filledDetails, agreementDate: new Date('2026-10-01T00:00:00.000Z') };
    const b = { ...filledDetails, agreementDate: new Date('2026-10-01T00:00:00.000Z') };
    assert.equal(agreementDetailsChanged(a, b), false);
  });
  test('empty strings / missing keys are treated the same', () => {
    assert.equal(agreementDetailsChanged({ domain: '' }, {}), false);
  });
  test('a changed fee, date or list item → changed', () => {
    assert.equal(agreementDetailsChanged(filledDetails, { ...filledDetails, monthlyFee: 60000 }), true);
    assert.equal(agreementDetailsChanged(filledDetails, { ...filledDetails, agreementDate: new Date('2026-11-01') }), true);
    assert.equal(agreementDetailsChanged(filledDetails, { ...filledDetails, deliverables: ['y'] }), true);
  });
});
