// Run with: node --import ./client/src/employee/lib/test-setup.mjs --test client/src/employee/lib/leads.test.js
// (the client has no test runner; this file only uses node:test)
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { leadListCounts, isWorkingLead, isDroppedHoldLead } from './leads.js';

const day = 864e5;
const at = (offsetDays) => new Date(Date.now() + offsetDays * day).toISOString();
const lead = (fields) => ({ status: 'New', isRaw: false, ...fields });

const leads = [
  lead({ isRaw: true }),
  lead({ isRaw: true }),
  lead({ isRaw: true, nextFollowUpDate: at(2) }),
  lead({ status: 'Contacted', nextFollowUpDate: at(-2) }),
  lead({ status: 'Qualified', nextFollowUpDate: at(3) }),
  lead({ status: 'Negotiation' }),
  lead({ status: 'Hold', nextFollowUpDate: at(-1) }),
  lead({ status: 'Dropped' }),
  lead({ status: 'Won' }),
  lead({ status: 'Lost' }),
];

describe('portal lead list counts', () => {
  const counts = leadListCounts(leads);

  test('Raw counts the leads flagged raw', () => {
    assert.equal(counts.raw, 3);
  });

  test('Working is open and not raw — Won, Lost, Dropped and Hold leave it', () => {
    assert.equal(counts.working, 3);
    assert.equal(leads.filter(isWorkingLead).length, counts.working);
  });

  test('Dropped & Hold counts exactly those two statuses', () => {
    assert.equal(counts.droppedHold, 2);
    assert.equal(leads.filter(isDroppedHoldLead).length, counts.droppedHold);
  });

  test('a lead is never both Raw and Working', () => {
    assert.equal(leads.filter((l) => l.isRaw && isWorkingLead(l)).length, 0);
  });

  test('Follow-ups count active leads with a date, split into buckets that add up', () => {
    // the Hold lead has a date but is not active, so it is not a follow-up
    assert.equal(counts.followups, 3);
    assert.equal(counts.overdue, 1);
    assert.equal(counts.upcoming, 2);
    assert.equal(counts.today, 0);
    assert.equal(counts.overdue + counts.today + counts.upcoming, counts.followups);
  });

  test('no leads, or leads not loaded yet, count as zero', () => {
    for (const input of [[], undefined]) {
      assert.deepEqual(leadListCounts(input), { raw: 0, working: 0, droppedHold: 0, followups: 0, overdue: 0, today: 0, upcoming: 0 });
    }
  });
});
