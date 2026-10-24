const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_LEAD_SCORING_SETTINGS: settings, computeLeadScore } = require('../services/leadScoring');

const qualified = {
  servicesRequired: ['SEO'],
  projectBudget: '₹2L–5L',
  decisionMaker: 'Yes',
  timeline: 'Immediate',
};

describe('lead score — recalculates from the saved qualification inputs', () => {
  test('minimum: nothing filled scores 0', () => {
    assert.equal(computeLeadScore({}, settings), 0);
  });

  test('partial: only the service identified', () => {
    assert.equal(computeLeadScore({ servicesRequired: ['SEO'] }, settings), 15);
  });

  test('complete qualification alone is 70 (15 + 20 + 15 + 20)', () => {
    assert.equal(computeLeadScore(qualified, settings), 70);
  });

  test('changing an answer changes the score (not stuck at 70)', () => {
    assert.equal(computeLeadScore({ ...qualified, timeline: '30 days' }, settings), 50);
    assert.equal(computeLeadScore({ ...qualified, decisionMaker: 'No' }, settings), 55);
    assert.equal(computeLeadScore({ ...qualified, projectBudget: 'Below ₹25K' }, settings), 50);
  });

  test('engagement and proposal push a fully qualified lead past 70', () => {
    assert.equal(computeLeadScore({ ...qualified, connected: 'Yes' }, settings), 80);
    assert.equal(computeLeadScore({ ...qualified, connected: 'Yes', status: 'Proposal Sent' }, settings), 100);
  });

  test('repeated unanswered calls lower the score', () => {
    const callLogs = [{ connected: 'No' }, { connected: 'No' }, { connected: 'No' }];
    assert.equal(computeLeadScore({ ...qualified, callLogs }, settings), 55);
  });

  test('junk leads score 0 regardless of qualification', () => {
    assert.equal(computeLeadScore({ ...qualified, interestLevel: 'Wrong / Junk Lead' }, settings), 0);
  });

  test('scoring disabled returns 0', () => {
    assert.equal(computeLeadScore(qualified, { ...settings, enabled: false }), 0);
  });
});
