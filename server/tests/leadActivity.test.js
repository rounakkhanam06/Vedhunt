const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  isActionType, actionStamp, hasActionTaken, isRawLead, hasConnected, ACTION_EVIDENCE,
  rawLeadFilter, workingLeadFilter, pendingCallFilter,
} = require('../utils/leadActivity');

const assigned = { assignedTo: 'bd1', status: 'New' };
const NOW = new Date('2026-10-24T05:00:00Z');

describe('what counts as taking action', () => {
  test('calls, notes, WhatsApp and shared proposals count', () => {
    for (const t of ['Call logged', 'Note', 'WhatsApp initiated', 'Proposal shared via Email']) {
      assert.equal(isActionType(t), true, t);
    }
  });

  test('stage changes, interest changes and follow-up completion alone do not', () => {
    // 'Remark' is the retired lead-level remark: older leads may still carry it as an activity label
    for (const t of ['Stage changed', 'Interest set', 'Follow-up completed', 'Proposal generated', 'Remark', 'Note imported', '', undefined]) {
      assert.equal(isActionType(t), false, String(t));
    }
  });

  test('actionStamp sets firstContactAt only for a qualifying action, and only once', () => {
    const stage = actionStamp({}, 'u1', 'Stage changed', NOW);
    assert.equal(stage.firstActionAt, NOW);
    assert.equal('firstContactAt' in stage, false);

    const call = actionStamp({ firstActionAt: NOW }, 'u1', 'Call logged', NOW);
    assert.equal(call.firstContactAt, NOW);
    assert.equal(call.firstContactType, 'Call logged');
    assert.equal('firstActionAt' in call, false, 'first-action fields are not overwritten');

    const again = actionStamp({ firstActionAt: NOW, firstContactAt: NOW }, 'u1', 'Note', NOW);
    assert.equal('firstContactAt' in again, false);
  });
});

describe('Raw vs Working', () => {
  test('an assigned lead with no action is Raw', () => {
    assert.equal(isRawLead(assigned), true);
  });

  test('a not-connected call takes it out of Raw', () => {
    const lead = { ...assigned, callLogs: [{ connected: 'No' }], connected: 'No' };
    assert.equal(hasActionTaken(lead), true);
    assert.equal(hasConnected(lead), false);
    assert.equal(isRawLead(lead), false);
  });

  test('a note, WhatsApp message or proposal (firstContactAt) takes it out of Raw', () => {
    assert.equal(isRawLead({ ...assigned, firstContactAt: NOW }), false);
  });

  test('a stage change or interest change alone leaves it in Raw', () => {
    assert.equal(isRawLead({ ...assigned, status: 'Contacted', firstActionAt: NOW, firstActionType: 'Stage changed' }), true);
  });

  test('legacy leads: Qualified+ stage or a "Call connected" history entry count as actioned', () => {
    assert.equal(isRawLead({ ...assigned, status: 'Qualified' }), false);
    assert.equal(isRawLead({ ...assigned, pipelineHistory: [{ status: 'Call connected' }] }), false);
  });

  test('unassigned and closed/hold leads are never Raw', () => {
    assert.equal(isRawLead({ status: 'New' }), false);
    for (const status of ['Won', 'Lost', 'Dropped', 'Hold']) assert.equal(isRawLead({ ...assigned, status }), false);
  });

  test('Raw, Working and Pending Call use the same evidence, so they never overlap', () => {
    assert.deepEqual(rawLeadFilter().$nor, ACTION_EVIDENCE);
    assert.deepEqual(workingLeadFilter().$or, ACTION_EVIDENCE);
    assert.deepEqual(pendingCallFilter().$nor, ACTION_EVIDENCE);
    assert.deepEqual(rawLeadFilter().status, pendingCallFilter().status);
  });
});
