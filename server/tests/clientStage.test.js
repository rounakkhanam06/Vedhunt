const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { stageOf, STAGES } = require('../services/clientStage');

const ok = { isTemporaryPassword: false, agreementVersion: 1, acceptedAgreementVersion: 1, isActive: true };
const items = (...open) => open.map((key) => ({ key, label: key, launchCritical: true, status: 'Not Started' }));
const ctx = (over = {}) => ({
  client: { ...ok }, finance: { received: 5000, outstanding: 0 }, isDefaulter: false, kycStatus: 'verified',
  onboarding: { items: [], live: false }, ...over,
});
const stage = (over) => stageOf(ctx(over)).stage;

describe('client stage — account conditions override the journey', () => {
  test('offboarded, archived, suspended and on hold come first, in that order', () => {
    assert.equal(stage({ client: { ...ok, offboardedAt: new Date(), deletedAt: new Date() } }), 'Offboarded');
    assert.equal(stage({ client: { ...ok, deletedAt: new Date(), isActive: false } }), 'Archived');
    assert.equal(stage({ client: { ...ok, isActive: false, serviceStatus: 'Hold' } }), 'Suspended');
    assert.equal(stage({ client: { ...ok, serviceStatus: 'Hold' }, isDefaulter: true }), 'Paused');
  });
  test('an overdue invoice is Payment Overdue, even for a live client', () => {
    assert.equal(stage({ isDefaulter: true, onboarding: { items: [], live: true } }), 'Payment Overdue');
  });
});

describe('client stage — the onboarding journey in the SOP order', () => {
  test('not activated → Pending Onboarding', () => assert.equal(stage({ client: { ...ok, isTemporaryPassword: true } }), 'Pending Onboarding'));
  test('billed but nothing paid → Awaiting Payment; any payment moves on', () => {
    assert.equal(stage({ finance: { received: 0, outstanding: 7000 } }), 'Awaiting Payment');
    assert.notEqual(stage({ finance: { received: 1000, outstanding: 6000 } }), 'Awaiting Payment');
    assert.notEqual(stage({ finance: null }), 'Awaiting Payment', 'no invoice access or nothing billed');
  });
  test('agreement not prepared, or not signed → Awaiting Agreement', () => {
    assert.equal(stage({ client: { ...ok, agreementVersion: 0, acceptedAgreementVersion: 0 } }), 'Awaiting Agreement');
    assert.equal(stage({ client: { ...ok, agreementVersion: 2, acceptedAgreementVersion: 1 } }), 'Awaiting Agreement');
    assert.equal(stage({ globalAgreementVersion: 3 }), 'Awaiting Agreement', 'a newer template must be signed again');
  });
  test('KYC not verified → KYC Pending', () => assert.equal(stage({ kycStatus: 'in_review' }), 'KYC Pending'));
  test('open access / tracking steps → Access / Setup Pending; only approvals left → Strategy / Approval Pending', () => {
    assert.equal(stage({ onboarding: { items: items('meta_access', 'creative_approved'), live: false } }), 'Access / Setup Pending');
    assert.equal(stage({ onboarding: { items: items('creative_approved', 'strategy_shared'), live: false } }), 'Strategy / Approval Pending');
  });
  test('payment and contract steps are covered by their own stages, so they never hold the setup stage', () => {
    assert.equal(stage({ onboarding: { items: items('advance_payment', 'contract_signed'), live: false } }), 'Ready to Launch');
  });
  test('every step done → Ready to Launch; campaign live → Active – In Delivery', () => {
    assert.equal(stage({ onboarding: { items: [{ key: 'meta_access', status: 'Completed', launchCritical: true }], live: false } }), 'Ready to Launch');
    assert.equal(stage({ onboarding: { items: items('meta_access'), live: true } }), 'Active – In Delivery');
  });
  test('every stage it can return is a listed stage, with a reason', () => {
    const r = stageOf(ctx({ kycStatus: 'not_started' }));
    assert.ok(STAGES.includes(r.stage));
    assert.ok(r.reason.length > 0);
  });
});
