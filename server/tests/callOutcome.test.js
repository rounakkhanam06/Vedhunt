const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { callDurationMinutes, callOutcome, callOutcomeLabel } = require('../utils/callOutcome');

const at = (min) => new Date(Date.UTC(2026, 9, 1, 10, min));

describe('call duration — this call\'s own timer only', () => {
  test('end minus start in whole minutes, at least 1', () => {
    assert.equal(callDurationMinutes({ callStartTime: at(0), callEndTime: at(5) }), 5);
    assert.equal(callDurationMinutes({ callStartTime: at(0), callEndTime: new Date(at(0).getTime() + 20000) }), 1);
    assert.equal(callDurationMinutes({ callStartTime: at(0), callEndTime: new Date(at(0).getTime() + 150000) }), 3);
  });

  test('no timer, or an end before the start → no duration', () => {
    assert.equal(callDurationMinutes({}), null);
    assert.equal(callDurationMinutes({ callStartTime: at(0) }), null);
    assert.equal(callDurationMinutes({ callStartTime: at(5), callEndTime: at(0) }), null);
  });

  test('a timer that started before the previous call was logged belongs to that call', () => {
    assert.equal(callDurationMinutes({ callStartTime: at(0), callEndTime: at(5) }, at(6)), null);
    assert.equal(callDurationMinutes({ callStartTime: at(10), callEndTime: at(14) }, at(6)), 4);
  });
});

describe('call outcome', () => {
  test('connected → interest level; not connected → reason', () => {
    assert.deepEqual(callOutcome({ connected: 'Yes', interestLevel: 'Warm' }), { status: 'Connected', detail: 'Warm' });
    assert.deepEqual(callOutcome({ connected: 'No', notConnectedReason: 'Number Busy' }), { status: 'Not connected', detail: 'Number Busy' });
    assert.equal(callOutcomeLabel({ connected: 'Yes', interestLevel: 'Hot Lead' }), 'Connected — Hot Lead');
    assert.equal(callOutcomeLabel({ connected: 'No' }), 'Not connected');
  });
});
