// Which list a lead belongs on, defined once for every list (Admin panel,
// grants, Employee Portal, Calling Performance boards):
//
//   Raw           = assigned + still open + no action taken yet
//   Working       = still open + an action has been taken
//   Dropped & Hold = status Dropped or Hold
//   Won / Lost    = on none of the three; still in Lead Manager with full history
//   (unassigned leads are monitored on the Unassigned Leads page instead)
//
// "Action taken" is the first of: a logged call (connected or not), a
// WhatsApp message, a shared proposal, or a note — or, on leads from
// before this was tracked, a call field, a connected outcome or a stage only
// reached after speaking with the prospect (Qualified onwards), or a WhatsApp /
// shared-proposal entry in its timeline. Only notes on such old leads need the
// backfill script (scripts/maintenance/backfillFirstContact.js). Opening or
// assigning a lead, changing its stage or interest level, scheduling a
// follow-up, and call-timer / qualification / contact-detail saves alone do
// not count. The first qualifying action stamps firstContactAt.
//
// Whether the prospect actually picked up is a separate question ("connected":
// the call outcome shown on the row), not a list rule. Moving a lead between
// lists never touches its call logs, notes, follow-ups or history.
//
// Activity of any kind (calls, messages, notes, follow-ups, stage changes)
// still stamps firstActionAt / lastActivityAt (actionStamp below) for the
// "Last activity" column and the audit trail.

const CLOSED_OR_HOLD = ['Won', 'Lost', 'Dropped', 'Hold'];
const DROPPED_OR_HOLD = ['Dropped', 'Hold'];
// Stages a lead only reaches after speaking with the prospect
const POST_CONTACT_STATUSES = ['Qualified', 'Proposal Sent', 'Negotiation'];

// Activity labels (lastActivityType / firstContactType) that count as taking
// action. Anything else (stage change, interest set, follow-up completed) does
// not on its own — a follow-up outcome is a call, which is logged as one.
const ACTION_TYPES = ['Call logged', 'Note', 'WhatsApp initiated'];
const ACTION_TYPE_PREFIXES = ['Proposal shared via '];

/** Whether an activity label counts as taking action on a lead. */
const isActionType = (type) =>
  ACTION_TYPES.includes(type) || ACTION_TYPE_PREFIXES.some((p) => String(type || '').startsWith(p));

// Timeline entries older leads carry as their only trace of an action
const LEGACY_HISTORY_ACTIONS = ['Call connected', 'WhatsApp initiated', /^Proposal shared via /];
const isLegacyHistoryAction = (h) => LEGACY_HISTORY_ACTIONS.some((a) => (a instanceof RegExp ? a.test(h.status || '') : a === h.status));

// Query form of "an action has been taken". The legacy clauses keep leads that
// predate firstContactAt in the right list without a data migration.
const ACTION_EVIDENCE = [
  { firstContactAt: { $ne: null } },
  { 'callLogs.0': { $exists: true } },
  { firstCallAt: { $ne: null } },
  { lastCallAt: { $ne: null } },
  { callDate: { $ne: null } },
  { connected: { $nin: [null, ''] } },
  { status: { $in: POST_CONTACT_STATUSES } },
  { pipelineHistory: { $elemMatch: { status: { $in: LEGACY_HISTORY_ACTIONS } } } },
];

/** Raw Leads: assigned, open, no action taken. */
const rawLeadFilter = () => ({ assignedTo: { $ne: null }, status: { $nin: CLOSED_OR_HOLD }, $nor: ACTION_EVIDENCE });

/** Working Leads: open, action taken. */
const workingLeadFilter = () => ({ status: { $nin: CLOSED_OR_HOLD }, $or: ACTION_EVIDENCE });

/** Pending Call board: same population as Raw Leads, so the two always reconcile. */
const pendingCallFilter = () => ({ status: { $nin: CLOSED_OR_HOLD }, $nor: ACTION_EVIDENCE });

/** Dropped & Hold view. */
const droppedHoldLeadFilter = () => ({ status: { $in: DROPPED_OR_HOLD } });

/** Same "connected" rule as before, for one lead already loaded (call outcome, not list membership). */
function hasConnected(lead) {
  return lead.connected === 'Yes'
    || (lead.callLogs || []).some((c) => c.connected === 'Yes')
    || POST_CONTACT_STATUSES.includes(lead.status)
    || (lead.pipelineHistory || []).some((h) => h.status === 'Call connected');
}

/** Same rule as ACTION_EVIDENCE, for one lead already loaded. */
function hasActionTaken(lead) {
  return Boolean(lead.firstContactAt)
    || (lead.callLogs || []).length > 0
    || Boolean(lead.firstCallAt || lead.lastCallAt || lead.callDate)
    || Boolean(lead.connected)
    || POST_CONTACT_STATUSES.includes(lead.status)
    || (lead.pipelineHistory || []).some(isLegacyHistoryAction);
}

/** Same rule as rawLeadFilter, for one lead already loaded. */
const isRawLead = (lead) => Boolean(lead?.assignedTo) && !CLOSED_OR_HOLD.includes(lead.status) && !hasActionTaken(lead);

/**
 * $set fields recording an action now: firstActionAt (+ who, what) the first
 * time only, lastActivityAt every time, and firstContactAt the first time the
 * activity is one that counts as taking action (isActionType).
 */
function actionStamp(lead, actorId, type, now = new Date()) {
  const set = { lastActivityAt: now, lastActivityType: type };
  if (!lead.firstActionAt) Object.assign(set, { firstActionAt: now, firstActionBy: actorId || null, firstActionType: type });
  if (!lead.firstContactAt && isActionType(type)) Object.assign(set, { firstContactAt: now, firstContactBy: actorId || null, firstContactType: type });
  return set;
}

module.exports = {
  CLOSED_OR_HOLD, DROPPED_OR_HOLD, POST_CONTACT_STATUSES, ACTION_EVIDENCE,
  rawLeadFilter, workingLeadFilter, pendingCallFilter, droppedHoldLeadFilter,
  hasConnected, hasActionTaken, isRawLead, isActionType, actionStamp,
};
