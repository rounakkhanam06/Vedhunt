/**
 * Sales Lifecycle State Machine — the single source of truth for what a lead
 * update is allowed to do. Supersedes the old utils/followUpRules.js (its
 * follow-up-date rule is folded in here as one rule among several).
 *
 * Shared by every lead-update path (admin's leadController.updateLead and the
 * Employee Portal's PUT /ess/leads/:id) via services/leadLifecycle.js, so the
 * rules are enforced identically regardless of who edits the lead.
 *
 * Both write paths go through the raw MongoDB driver (see utils/leadLookup.js)
 * and bypass Mongoose schema validation entirely, so this module — not the
 * schema-level enums on the Lead model — is the real enforcement point.
 */

const NOT_CONNECTED_REASONS = [
  'Ringing / No Answer',
  'Number Busy',
  'Switched Off',
  'Not Reachable',
  'Invalid Number',
  'Call Disconnected',
  'Asked to Call Later'
];

const INTEREST_LEVELS = ['Hot Lead', 'Warm', 'Cold', 'Interested', 'Not Interested', 'Wrong / Junk Lead'];

const PAYMENT_STATUS_OPTIONS = ['Not Applicable', 'Pending', 'Partially Paid', 'Paid'];

// Final-outcome reasons only — a lead only reaches this list once it's
// actually Lost/Dropped (see the `nextStatus === 'Lost' || 'Dropped'` check
// below, and the frontend only renders/enables this field for those two
// statuses). Never add a live pipeline stage here (e.g. "In Negotiation")
// — Negotiation is an active stage, not a final outcome.
const LOST_DROPPED_REASONS = [
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

// Outcomes that mean the lead is still live and needs a scheduled touchpoint.
const FOLLOWUP_TRIGGER_INTEREST_LEVELS = ['Hot Lead', 'Warm', 'Interested'];
const FOLLOWUP_TRIGGER_STATUSES = ['Proposal Sent', 'Negotiation'];
const FOLLOWUP_TRIGGER_NOT_CONNECTED_REASONS = ['Asked to Call Later'];

// A closed lead never needs another follow-up, regardless of a stale
// interestLevel left over from before it closed (e.g. still "Hot Lead" when won).
const TERMINAL_STATUSES = ['Won', 'Lost', 'Dropped'];

// Statuses a lead must already be in before it can be marked Won — you can't
// close a deal that never had a proposal.
const WON_REQUIRES_PRIOR_STATUS = ['Qualified', 'Proposal Sent', 'Negotiation'];

// current status -> allowed next statuses. Hold is reachable from, and
// returns to, any active (non-terminal) status; terminal statuses are
// dead ends (reopening a closed lead is a deliberate reassignment, not an
// in-place edit, and isn't supported by this update path).
const ALLOWED_TRANSITIONS = {
  New: ['New', 'Contacted', 'Hold', 'Lost', 'Dropped'],
  Contacted: ['Contacted', 'Qualified', 'Hold', 'Lost', 'Dropped'],
  Qualified: ['Qualified', 'Proposal Sent', 'Hold', 'Won', 'Lost', 'Dropped'],
  'Proposal Sent': ['Proposal Sent', 'Negotiation', 'Hold', 'Won', 'Lost', 'Dropped'],
  Negotiation: ['Negotiation', 'Proposal Sent', 'Hold', 'Won', 'Lost', 'Dropped'],
  Hold: ['Hold', 'New', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation', 'Lost', 'Dropped'],
  Won: ['Won'],
  Lost: ['Lost'],
  Dropped: ['Dropped']
};

// Fields a lead update may touch, across both portals. The admin controller
// additionally allows a handful of core-identity fields for Super Admins only
// (see leadController.js) — this list is the pipeline/state-machine surface
// common to both.
const LEAD_UPDATE_FIELDS = [
  'status', 'city', 'country', 'callStartTime', 'callEndTime', 'callDuration',
  'callDate', 'connected', 'notConnectedReason', 'interestLevel',
  'notConvertedReason', 'remark', 'nextFollowUpDate', 'leadAgeAtCall', 'touchNumber',
  'dealValue', 'proposalValue', 'proposalSentDate', 'proposalReference', 'holdReason', 'holdUntil',
  'dealCloseValue', 'expectedCloseDate', 'paymentStatus', 'amountPaid',
  'budget', 'timeline', 'decisionMaker', 'currentVendor', 'requirementSummary',
  'businessName', 'website', 'servicesRequired', 'businessType', 'projectBudget', 'monthlyMarketingBudget'
];

/**
 * @param {object} existingLead current lead document (plain object)
 * @param {object} updates      proposed field changes, already filtered to allowed fields
 * @returns {string|null} an error message, or null if the update is valid
 */
function validateLeadTransition(existingLead, updates) {
  if ('interestLevel' in updates && updates.interestLevel && !INTEREST_LEVELS.includes(updates.interestLevel)) {
    return `Invalid interest level: ${updates.interestLevel}`;
  }
  if ('notConnectedReason' in updates && updates.notConnectedReason && !NOT_CONNECTED_REASONS.includes(updates.notConnectedReason)) {
    return `Invalid not-connected reason: ${updates.notConnectedReason}`;
  }

  const nextStatus = 'status' in updates ? updates.status : existingLead.status;
  const nextInterestLevel = 'interestLevel' in updates ? updates.interestLevel : existingLead.interestLevel;
  const nextConnected = 'connected' in updates ? updates.connected : existingLead.connected;
  const nextNotConnectedReason = 'notConnectedReason' in updates ? updates.notConnectedReason : existingLead.notConnectedReason;
  const nextFollowUpDate = 'nextFollowUpDate' in updates ? updates.nextFollowUpDate : existingLead.nextFollowUpDate;
  const nextNotConvertedReason = 'notConvertedReason' in updates ? updates.notConvertedReason : existingLead.notConvertedReason;
  const nextDealCloseValue = 'dealCloseValue' in updates ? updates.dealCloseValue : existingLead.dealCloseValue;
  const nextProposalValue = 'proposalValue' in updates ? updates.proposalValue : existingLead.proposalValue;
  const nextProposalSentDate = 'proposalSentDate' in updates ? updates.proposalSentDate : existingLead.proposalSentDate;
  const nextProposalReference = 'proposalReference' in updates ? updates.proposalReference : existingLead.proposalReference;
  const nextExpectedCloseDate = 'expectedCloseDate' in updates ? updates.expectedCloseDate : existingLead.expectedCloseDate;
  const nextHoldReason = 'holdReason' in updates ? updates.holdReason : existingLead.holdReason;
  const nextHoldUntil = 'holdUntil' in updates ? updates.holdUntil : existingLead.holdUntil;
  const nextAmountPaid = 'amountPaid' in updates ? updates.amountPaid : existingLead.amountPaid;

  // ── Stage sequencing ──────────────────────────────────────────────────
  if ('status' in updates && updates.status !== existingLead.status) {
    const allowedNext = ALLOWED_TRANSITIONS[existingLead.status] || [];
    if (!allowedNext.includes(updates.status)) {
      return `Cannot move a lead from "${existingLead.status}" directly to "${updates.status}". Leads must progress through each stage in order.`;
    }
  }

  // ── Call outcome rules ────────────────────────────────────────────────
  if (nextConnected === 'No') {
    if (!nextNotConnectedReason) {
      return 'A not-connected reason is required when a call is marked Not Connected.';
    }
    if (FOLLOWUP_TRIGGER_NOT_CONNECTED_REASONS.includes(nextNotConnectedReason) && !nextFollowUpDate) {
      return 'Follow-up Date & Time is required when the reason is "Asked to Call Later".';
    }
  }

  if (nextConnected === 'Yes' && !nextInterestLevel) {
    return 'An interest level is required when a call is marked Connected.';
  }

  // ── Stage-specific mandatory data ────────────────────────────────────
  if (nextStatus === 'Qualified') {
    if (nextConnected !== 'Yes' || !FOLLOWUP_TRIGGER_INTEREST_LEVELS.includes(nextInterestLevel)) {
      return 'A lead can only be Qualified after a connected call with interest level Hot Lead, Warm, or Interested.';
    }
  }

  if (nextStatus === 'Proposal Sent') {
    if (!(Number(nextProposalValue) > 0)) {
      return 'Proposal value is required to move a lead to Proposal Sent.';
    }
    if (!nextProposalSentDate) {
      return 'Proposal sent date is required to move a lead to Proposal Sent.';
    }
    if (!nextProposalReference) {
      return 'Proposal reference is required to move a lead to Proposal Sent.';
    }
  }

  if (nextStatus === 'Negotiation' && !nextExpectedCloseDate) {
    return 'Expected close date is required to move a lead to Negotiation.';
  }

  if (nextStatus === 'Won') {
    if (!WON_REQUIRES_PRIOR_STATUS.includes(existingLead.status) && existingLead.status !== 'Won') {
      return 'A lead can only be marked Won from Qualified, Proposal Sent, or Negotiation.';
    }
    if (!(Number(nextDealCloseValue) > 0)) {
      return 'Deal close value is required to mark a lead Won.';
    }
  }

  // ── Payment tracking ──────────────────────────────────────────────────
  if ('amountPaid' in updates && Number(nextAmountPaid) > Number(nextDealCloseValue || 0)) {
    return 'Amount paid cannot exceed the deal close value.';
  }

  if (nextStatus === 'Lost' || nextStatus === 'Dropped') {
    if (!nextNotConvertedReason || !LOST_DROPPED_REASONS.includes(nextNotConvertedReason)) {
      return `A reason is required to mark a lead ${nextStatus}.`;
    }
  }

  if (nextStatus === 'Hold') {
    if (!nextHoldReason) {
      return 'A hold reason is required to put a lead on Hold.';
    }
    if (!nextHoldUntil) {
      return 'A review date is required to put a lead on Hold.';
    }
  }

  // ── Follow-up requirement ────────────────────────────────────────────
  const requiresFollowUp =
    !TERMINAL_STATUSES.includes(nextStatus) &&
    (FOLLOWUP_TRIGGER_INTEREST_LEVELS.includes(nextInterestLevel) || FOLLOWUP_TRIGGER_STATUSES.includes(nextStatus));

  if (requiresFollowUp && !nextFollowUpDate) {
    return 'Next follow-up date & time is required when marking a lead Hot Lead/Warm/Interested, or moving it to Proposal Sent/Negotiation.';
  }

  // A lead has at most one active follow-up (nextFollowUpDate is a scalar,
  // not a list) — clearing it is only allowed alongside a real outcome, so
  // a follow-up can never be dismissed silently.
  const clearingFollowUp = 'nextFollowUpDate' in updates && !updates.nextFollowUpDate && existingLead.nextFollowUpDate;
  if (clearingFollowUp) {
    const loggedOutcome = ['status', 'connected', 'interestLevel'].some(
      (field) => field in updates && updates[field] !== existingLead[field]
    );
    if (!loggedOutcome) {
      return 'Cannot clear a follow-up without logging a call outcome (status, connected, or interest level).';
    }
  }

  // Same idea for pushing an existing follow-up to a new date — a BD
  // "completing" a due follow-up must say what happened on it, not silently
  // reschedule. Satisfied either by a logged call outcome (`connected`
  // merely present counts — the admin/employee call-outcome widget always
  // resends it, even unchanged, and leadLifecycle.js appends a fresh
  // callLogs entry whenever it's present) or by an actual stage change
  // (moving to Proposal Sent/Negotiation is itself the "next action"). Only
  // fires on a genuine reschedule of an existing follow-up, not the first
  // time one is being set.
  const reschedulingFollowUp =
    'nextFollowUpDate' in updates && updates.nextFollowUpDate && existingLead.nextFollowUpDate &&
    String(updates.nextFollowUpDate) !== String(existingLead.nextFollowUpDate);
  if (reschedulingFollowUp) {
    const loggedTouch = ('connected' in updates && updates.connected) || ('status' in updates && updates.status !== existingLead.status);
    if (!loggedTouch) {
      return 'Rescheduling a follow-up requires logging what happened first (a call outcome or a stage change).';
    }
  }

  return null;
}

module.exports = {
  NOT_CONNECTED_REASONS,
  INTEREST_LEVELS,
  LOST_DROPPED_REASONS,
  PAYMENT_STATUS_OPTIONS,
  FOLLOWUP_TRIGGER_INTEREST_LEVELS,
  FOLLOWUP_TRIGGER_STATUSES,
  FOLLOWUP_TRIGGER_NOT_CONNECTED_REASONS,
  TERMINAL_STATUSES,
  WON_REQUIRES_PRIOR_STATUS,
  ALLOWED_TRANSITIONS,
  LEAD_UPDATE_FIELDS,
  validateLeadTransition
};
