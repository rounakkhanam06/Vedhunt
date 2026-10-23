// Which list a lead belongs on, defined once for every list (Admin panel,
// grants, Employee Portal):
//
//   Raw           = assigned + not connected with the prospect yet + still open
//                   (unanswered / not-connected calls keep it here)
//   Working       = connected with the prospect + still open
//   Dropped & Hold = status Dropped or Hold
//   Won / Lost    = on none of the three; still in Lead Manager with full history
//   (unassigned leads are monitored on the Unassigned Leads page instead)
//
// "Connected" means a call was logged as connected, or the lead has moved to
// a stage that only follows a real conversation (Qualified onwards). A status
// change, note, WhatsApp message or unanswered call alone does not count.
// Moving a lead between lists never touches its call logs, notes, follow-ups
// or history.
//
// Activity of any kind (calls, messages, notes, follow-ups, stage changes)
// still stamps firstActionAt / lastActivityAt (actionStamp below) for the
// "Last activity" column and the audit trail.

const CLOSED_OR_HOLD = ['Won', 'Lost', 'Dropped', 'Hold'];
const DROPPED_OR_HOLD = ['Dropped', 'Hold'];
// Stages a lead only reaches after speaking with the prospect
const POST_CONTACT_STATUSES = ['Qualified', 'Proposal Sent', 'Negotiation'];

// Leads from before callLogs existed still carry the "Call connected" entry
const CONNECTED_EVIDENCE = [
  { connected: 'Yes' },
  { callLogs: { $elemMatch: { connected: 'Yes' } } },
  { status: { $in: POST_CONTACT_STATUSES } },
  { pipelineHistory: { $elemMatch: { status: 'Call connected' } } },
];

/** Raw Leads: assigned, open, never connected. */
const rawLeadFilter = () => ({ assignedTo: { $ne: null }, status: { $nin: CLOSED_OR_HOLD }, $nor: CONNECTED_EVIDENCE });

/** Working Leads: connected, open. */
const workingLeadFilter = () => ({ status: { $nin: CLOSED_OR_HOLD }, $or: CONNECTED_EVIDENCE });

/** Dropped & Hold view. */
const droppedHoldLeadFilter = () => ({ status: { $in: DROPPED_OR_HOLD } });

/** Same "connected" rule as CONNECTED_EVIDENCE, for one lead already loaded. */
function hasConnected(lead) {
  return lead.connected === 'Yes'
    || (lead.callLogs || []).some((c) => c.connected === 'Yes')
    || POST_CONTACT_STATUSES.includes(lead.status)
    || (lead.pipelineHistory || []).some((h) => h.status === 'Call connected');
}

/** Same rule as rawLeadFilter, for one lead already loaded. */
const isRawLead = (lead) => Boolean(lead?.assignedTo) && !CLOSED_OR_HOLD.includes(lead.status) && !hasConnected(lead);

/**
 * $set fields recording an action now: firstActionAt (+ who, what) the first
 * time only, lastActivityAt every time.
 */
function actionStamp(lead, actorId, type, now = new Date()) {
  const set = { lastActivityAt: now, lastActivityType: type };
  if (!lead.firstActionAt) Object.assign(set, { firstActionAt: now, firstActionBy: actorId || null, firstActionType: type });
  return set;
}

module.exports = {
  CLOSED_OR_HOLD, DROPPED_OR_HOLD, POST_CONTACT_STATUSES,
  rawLeadFilter, workingLeadFilter, droppedHoldLeadFilter, hasConnected, isRawLead, actionStamp,
};
