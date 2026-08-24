/**
 * Follow-Up Engine rules — shared by every lead-update path (admin's
 * leadController.updateLead and the Employee Portal's PUT /ess/leads/:id)
 * so the rules are enforced identically regardless of who edits the lead.
 *
 * Both of those endpoints write through the raw MongoDB driver (see
 * utils/leadLookup.js) and bypass Mongoose schema validation entirely, so
 * this is the real enforcement point — the schema-level enum on
 * Lead.interestLevel is documentation, not protection.
 */

const INTEREST_LEVELS = ['Hot', 'Warm', 'Cold', 'Interested', 'Not Interested', 'Asked to Call Later'];

// These outcomes mean the lead is still live and needs a scheduled touchpoint.
const FOLLOWUP_TRIGGER_INTEREST_LEVELS = ['Hot', 'Warm', 'Interested', 'Asked to Call Later'];
const FOLLOWUP_TRIGGER_STATUSES = ['Proposal Sent', 'Negotiation'];
// A closed lead never needs another follow-up, regardless of a stale
// interestLevel left over from before it closed (e.g. still "Hot" when won).
const TERMINAL_STATUSES = ['Won', 'Lost', 'Dropped'];

/**
 * @param {object} existingLead current lead (status/interestLevel/connected/nextFollowUpDate)
 * @param {object} updates      proposed field changes, already filtered to allowed fields
 * @returns {string|null} an error message, or null if the update is valid
 */
function validateFollowUpRules(existingLead, updates) {
  if ('interestLevel' in updates && updates.interestLevel && !INTEREST_LEVELS.includes(updates.interestLevel)) {
    return `Invalid interest level: ${updates.interestLevel}`;
  }

  const nextStatus = 'status' in updates ? updates.status : existingLead.status;
  const nextInterestLevel = 'interestLevel' in updates ? updates.interestLevel : existingLead.interestLevel;
  const nextFollowUpDate = 'nextFollowUpDate' in updates ? updates.nextFollowUpDate : existingLead.nextFollowUpDate;

  const requiresFollowUp =
    !TERMINAL_STATUSES.includes(nextStatus) &&
    (FOLLOWUP_TRIGGER_INTEREST_LEVELS.includes(nextInterestLevel) || FOLLOWUP_TRIGGER_STATUSES.includes(nextStatus));

  if (requiresFollowUp && !nextFollowUpDate) {
    return 'Next follow-up date & time is required when marking a lead Asked to Call Later, Hot/Warm/Interested, or moving it to Proposal Sent/Negotiation.';
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

  return null;
}

module.exports = { INTEREST_LEVELS, FOLLOWUP_TRIGGER_INTEREST_LEVELS, FOLLOWUP_TRIGGER_STATUSES, validateFollowUpRules };
