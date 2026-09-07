/**
 * Controlled vocabularies for the Sales Lifecycle State Machine. Mirrors
 * server/utils/leadStateMachine.js — the backend is the real enforcement
 * point (both lead-update endpoints validate through it), this copy exists
 * purely so the UI can render matching dropdowns and required-field hints
 * without a shared client/server package.
 */

export const NOT_CONNECTED_REASONS = [
  'Ringing / No Answer',
  'Number Busy',
  'Switched Off',
  'Not Reachable',
  'Invalid Number',
  'Call Disconnected',
  'Asked to Call Later'
];

export const INTEREST_LEVELS = ['Hot Lead', 'Warm', 'Cold', 'Interested', 'Not Interested', 'Wrong / Junk Lead'];

// Final-outcome reasons only — only selectable once a lead is actually
// Lost/Dropped. Never add a live pipeline stage here (e.g. "In Negotiation").
export const LOST_DROPPED_REASONS = [
  'Budget Constraint',
  'Decision Pending',
  'Comparing Vendors',
  'Awaiting Approval',
  'Timeline Not Now',
  'Unresponsive',
  'Price Too High',
  'Chose Competitor',
  'Project Cancelled',
  'Not Right Fit',
  'Duplicate / Junk'
];

// Levels that require a mandatory future follow-up date (unless the lead is
// closing terminal in the same update).
export const FOLLOWUP_TRIGGER_INTEREST_LEVELS = ['Hot Lead', 'Warm', 'Interested'];
export const FOLLOWUP_TRIGGER_STATUSES = ['Proposal Sent', 'Negotiation'];
export const TERMINAL_STATUSES = ['Won', 'Lost', 'Dropped'];

export const PAYMENT_STATUS_OPTIONS = ['Not Applicable', 'Pending', 'Partially Paid', 'Paid'];
