const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  validateLeadTransition,
  normalizeDateFields,
  isSameInstant,
  ALLOWED_TRANSITIONS
} = require('../utils/leadStateMachine');

// Pure-function tests for the lead state machine — the single enforcement
// point both the admin panel and the Employee Portal update through
// (services/leadLifecycle.js). Run: npm test

const FUTURE = '2030-01-01T10:00:00.000Z';

const ok = (lead, updates) => assert.equal(validateLeadTransition(lead, updates), null);
const fails = (lead, updates, pattern) => {
  const err = validateLeadTransition(lead, updates);
  assert.ok(err, `expected an error for ${JSON.stringify(updates)}`);
  if (pattern) assert.match(err, pattern);
};

// A lead that has everything every stage could ask for, so a test can
// isolate one rule by removing a single field.
const qualifiedLead = {
  status: 'Qualified',
  connected: 'Yes',
  interestLevel: 'Hot Lead',
  nextFollowUpDate: FUTURE
};

describe('stage sequencing', () => {
  test('New -> Contacted is allowed', () => ok({ status: 'New' }, { status: 'Contacted' }));

  test('New cannot skip straight to Qualified/Won/Proposal Sent', () => {
    for (const status of ['Qualified', 'Proposal Sent', 'Negotiation', 'Won']) {
      fails({ status: 'New' }, { status }, /directly to/);
    }
  });

  test('terminal statuses are dead ends', () => {
    for (const from of ['Won', 'Lost', 'Dropped']) {
      assert.deepEqual(ALLOWED_TRANSITIONS[from], [from]);
      fails({ status: from }, { status: 'Contacted' }, /Only a Super Admin/);
    }
  });

  test('Hold can return to any active stage', () => {
    for (const status of ['New', 'Contacted']) ok({ status: 'Hold' }, { status });
  });

  test('every status has a transition entry', () => {
    for (const status of ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation', 'Hold', 'Won', 'Lost', 'Dropped']) {
      assert.ok(ALLOWED_TRANSITIONS[status], status);
    }
  });
});

describe('super admin reopening a closed lead', () => {
  const asSuperAdmin = (lead, updates) => validateLeadTransition(lead, updates, { isSuperAdmin: true });

  test('non-super-admins cannot reopen', () => {
    fails({ status: 'Won' }, { status: 'Contacted' }, /Only a Super Admin/);
  });

  test('super admin can reopen Won/Lost/Dropped to an active stage', () => {
    for (const from of ['Won', 'Lost', 'Dropped']) {
      assert.equal(asSuperAdmin({ status: from }, { status: 'Contacted' }), null, from);
    }
  });

  test('reopen target is limited — not New, not another closed status', () => {
    for (const to of ['New', 'Lost', 'Dropped']) {
      assert.match(asSuperAdmin({ status: 'Won', dealCloseValue: 1 }, { status: to }) || '', /can only be reopened to/, to);
    }
    assert.match(asSuperAdmin({ status: 'Lost' }, { status: 'Won', dealCloseValue: 1 }) || '', /can only be reopened to/);
  });

  test('stage data rules still apply when reopening', () => {
    assert.match(asSuperAdmin({ status: 'Lost' }, { status: 'Qualified' }), /Qualified/);
    assert.match(asSuperAdmin({ status: 'Lost' }, { status: 'Hold' }), /hold reason/);
    assert.equal(asSuperAdmin({ status: 'Lost' }, { status: 'Hold', holdReason: 'Revisit', holdUntil: FUTURE }), null);
  });
});

describe('call outcome', () => {
  test('Not Connected needs a reason', () => {
    fails({ status: 'New' }, { connected: 'No' }, /not-connected reason/);
    ok({ status: 'New' }, { connected: 'No', notConnectedReason: 'Number Busy' });
  });

  test('"Asked to Call Later" needs a follow-up date', () => {
    fails({ status: 'New' }, { connected: 'No', notConnectedReason: 'Asked to Call Later' }, /Follow-up/);
    ok({ status: 'New' }, { connected: 'No', notConnectedReason: 'Asked to Call Later', nextFollowUpDate: FUTURE });
  });

  test('Connected needs an interest level', () => {
    fails({ status: 'New' }, { connected: 'Yes' }, /interest level/);
    ok({ status: 'New' }, { connected: 'Yes', interestLevel: 'Cold' });
  });

  test('Hot/Warm/Interested need a follow-up date', () => {
    for (const interestLevel of ['Hot Lead', 'Warm', 'Interested']) {
      fails({ status: 'Contacted' }, { connected: 'Yes', interestLevel }, /follow-up/i);
      ok({ status: 'Contacted' }, { connected: 'Yes', interestLevel, nextFollowUpDate: FUTURE });
    }
  });

  test('rejects unknown interest level / reason', () => {
    fails({ status: 'New' }, { connected: 'Yes', interestLevel: 'Maybe' }, /Invalid interest level/);
    fails({ status: 'New' }, { connected: 'No', notConnectedReason: 'Aliens' }, /Invalid not-connected reason/);
  });
});

describe('stage mandatory data', () => {
  test('Qualified needs a connected, interested call', () => {
    fails({ status: 'Contacted' }, { status: 'Qualified' }, /Qualified/);
    fails({ status: 'Contacted', connected: 'Yes', interestLevel: 'Cold' }, { status: 'Qualified' }, /Qualified/);
    ok({ status: 'Contacted', connected: 'Yes', interestLevel: 'Warm', nextFollowUpDate: FUTURE }, { status: 'Qualified' });
  });

  test('Proposal Sent needs value, date and reference', () => {
    const full = { status: 'Proposal Sent', proposalValue: 50000, proposalSentDate: FUTURE, proposalReference: 'P-1' };
    ok(qualifiedLead, full);
    fails(qualifiedLead, { ...full, proposalValue: 0 }, /Proposal value/);
    fails(qualifiedLead, { ...full, proposalSentDate: '' }, /sent date/);
    fails(qualifiedLead, { ...full, proposalReference: '' }, /reference/);
  });

  test('Negotiation needs an expected close date', () => {
    const lead = { ...qualifiedLead, status: 'Proposal Sent', proposalValue: 1, proposalSentDate: FUTURE, proposalReference: 'P' };
    fails(lead, { status: 'Negotiation' }, /Expected close date/);
    ok(lead, { status: 'Negotiation', expectedCloseDate: FUTURE });
  });

  test('Won needs a deal close value', () => {
    fails(qualifiedLead, { status: 'Won' }, /Deal close value/);
    ok(qualifiedLead, { status: 'Won', dealCloseValue: 100000 });
  });

  test('amount paid cannot exceed deal close value', () => {
    fails({ ...qualifiedLead, status: 'Won', dealCloseValue: 100 }, { amountPaid: 200 }, /cannot exceed/);
  });

  test('Lost/Dropped need a listed reason', () => {
    for (const status of ['Lost', 'Dropped']) {
      fails({ status: 'Contacted' }, { status }, /reason is required/);
      fails({ status: 'Contacted' }, { status, notConvertedReason: 'Whatever' }, /reason is required/);
      ok({ status: 'Contacted' }, { status, notConvertedReason: 'Budget Constraint' });
    }
  });

  test('Hold needs a reason and review date', () => {
    fails({ status: 'Contacted' }, { status: 'Hold', holdUntil: FUTURE }, /hold reason/);
    fails({ status: 'Contacted' }, { status: 'Hold', holdReason: 'Busy' }, /review date/);
    ok({ status: 'Contacted' }, { status: 'Hold', holdReason: 'Busy', holdUntil: FUTURE });
  });
});

describe('follow-up rescheduling', () => {
  const lead = { status: 'Contacted', connected: 'Yes', interestLevel: 'Warm', nextFollowUpDate: new Date(FUTURE) };

  test('first-time follow-up needs no outcome', () => ok({ status: 'New' }, { nextFollowUpDate: FUTURE }));

  test('moving an existing follow-up needs a logged outcome', () => {
    fails(lead, { nextFollowUpDate: '2030-02-01T10:00:00.000Z' }, /Rescheduling/);
    ok(lead, { nextFollowUpDate: '2030-02-01T10:00:00.000Z', connected: 'Yes', interestLevel: 'Warm' });
  });

  test('resending the same instant (Date vs ISO string) is not a reschedule', () => {
    ok(lead, { nextFollowUpDate: FUTURE });
  });

  test('clearing a follow-up needs an outcome', () => {
    fails({ ...lead, interestLevel: 'Cold' }, { nextFollowUpDate: null }, /Cannot clear/);
  });
});

describe('date normalization', () => {
  test('casts ISO strings to Date and blanks to null', () => {
    const updates = { nextFollowUpDate: FUTURE, holdUntil: '', remark: 'x' };
    assert.equal(normalizeDateFields(updates), null);
    assert.ok(updates.nextFollowUpDate instanceof Date);
    assert.equal(updates.nextFollowUpDate.toISOString(), FUTURE);
    assert.equal(updates.holdUntil, null);
    assert.equal(updates.remark, 'x');
  });

  test('rejects an unparseable date', () => {
    assert.match(normalizeDateFields({ expectedCloseDate: 'not a date' }), /Invalid date/);
  });

  test('isSameInstant compares across Date/string', () => {
    assert.ok(isSameInstant(new Date(FUTURE), FUTURE));
    assert.ok(isSameInstant(null, ''));
    assert.ok(!isSameInstant(FUTURE, null));
    assert.ok(!isSameInstant(FUTURE, '2030-01-01T10:00:01.000Z'));
  });
});
