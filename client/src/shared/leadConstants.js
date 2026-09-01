/**
 * Controlled vocabularies for the Sales Lifecycle State Machine. Mirrors
 * server/utils/leadStateMachine.js — the backend is the real enforcement
 * point (both lead-update endpoints validate through it), this copy exists
 * purely so the UI can render matching dropdowns and required-field hints
 * without a shared client/server package.
 */

export const NOT_CONNECTED_REASONS = [
  'Ringing/No Answer',
  'Number Busy',
  'Switched Off',
  'Not Reachable',
  'Invalid Number',
  'Call Disconnected',
  'Asked to Call Later'
];

export const INTEREST_LEVELS = ['Hot Lead', 'Warm', 'Cold', 'Interested', 'Not Interested', 'Wrong/Junk Lead'];

export const LOST_DROPPED_REASONS = [
  'Too Expensive',
  'Went with Competitor',
  'No Longer Needs Service',
  'Unresponsive',
  'Not a Fit',
  'Timing Not Right',
  'Other'
];

// Levels that require a mandatory future follow-up date (unless the lead is
// closing terminal in the same update).
export const FOLLOWUP_TRIGGER_INTEREST_LEVELS = ['Hot Lead', 'Warm', 'Interested'];
export const FOLLOWUP_TRIGGER_STATUSES = ['Proposal Sent', 'Negotiation'];
export const TERMINAL_STATUSES = ['Won', 'Lost', 'Dropped'];
