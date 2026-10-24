// Lead classification helpers shared by the dashboard widgets and the lead
// lists, so a count on a tile always matches the list it opens.
import { NON_ACTIVE_FOLLOWUP_STATUSES } from '../../shared/leadConstants';
import { isThisMonth } from './datetime';

// A raw/New lead is "Call Pending" once it's sat assigned-but-uncalled past
// this SLA — distinguishes the urgent subset from the full New Leads pool.
const CALL_PENDING_SLA_HOURS = 4;

export const isActiveLead = (lead) => !NON_ACTIVE_FOLLOWUP_STATUSES.includes(lead.status);

export function isCallPending(lead) {
  if (!lead.isRaw || !lead.assignedAt) return false;
  return (Date.now() - new Date(lead.assignedAt).getTime()) / 3600000 >= CALL_PENDING_SLA_HOURS;
}

/** overdue / today / upcoming for an active lead's next follow-up; null when none. */
export function followUpBucket(lead) {
  if (!isActiveLead(lead) || !lead.nextFollowUpDate) return null;
  const due = new Date(lead.nextFollowUpDate);
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
  if (due < todayStart) return 'overdue';
  if (due <= todayEnd) return 'today';
  return 'upcoming';
}

/** Active lead with nothing scheduled — the "Next Action" gap. */
export const needsNextAction = (lead) => isActiveLead(lead) && !lead.nextFollowUpDate;

export const isPaymentPending = (lead) => ['Pending', 'Partially Paid'].includes(lead.paymentStatus);
export const isWonThisMonth = (lead) => lead.status === 'Won' && isThisMonth(lead.closedDate || lead.updatedAt);

/** Pipeline funnel stages for the BD dashboard. Each `match` is also the list filter. */
export const PIPELINE_STAGES = [
  { key: 'Qualified', label: 'Qualified', match: (l) => l.status === 'Qualified' },
  { key: 'Proposal Sent', label: 'Proposal Sent', match: (l) => l.status === 'Proposal Sent' },
  { key: 'Negotiation', label: 'Negotiation', match: (l) => l.status === 'Negotiation' },
  { key: 'payment', label: 'Payment Pending', match: (l) => l.status === 'Won' && isPaymentPending(l), param: 'payment=pending' },
  { key: 'Won', label: 'Won', match: (l) => l.status === 'Won' && !isPaymentPending(l), param: 'status=Won&payment=cleared' },
];

// Mirrors server/utils/leadActivity.js — keep the two in step.
export const CLOSED_OR_HOLD = ['Won', 'Lost', 'Dropped', 'Hold'];
export const DROPPED_OR_HOLD = ['Dropped', 'Hold'];

// Each portal list, defined once: the lists, the dashboard tiles and the
// sidebar badges all count with these, so a number always matches its list.
export const isWorkingLead = (lead) => !lead.isRaw && !CLOSED_OR_HOLD.includes(lead.status);
export const isDroppedHoldLead = (lead) => DROPPED_OR_HOLD.includes(lead.status);
export const hasFollowUp = (lead) => followUpBucket(lead) !== null;

/** Size of every list for one BD: Raw, Working, Dropped & Hold, Follow-ups (and its buckets). */
export function leadListCounts(leads = []) {
  const counts = { raw: 0, working: 0, droppedHold: 0, followups: 0, overdue: 0, today: 0, upcoming: 0 };
  for (const lead of leads) {
    if (lead.isRaw) counts.raw += 1;
    if (isWorkingLead(lead)) counts.working += 1;
    if (isDroppedHoldLead(lead)) counts.droppedHold += 1;
    const bucket = followUpBucket(lead);
    if (bucket) { counts.followups += 1; counts[bucket] += 1; }
  }
  return counts;
}
const POST_CONTACT_STATUSES = ['Qualified', 'Proposal Sent', 'Negotiation'];

/**
 * Raw = assigned, still open, no action taken yet (needs the full lead). Mirrors
 * server/utils/leadActivity.js: a logged call (answered or not), WhatsApp
 * message, shared proposal or note takes a lead out of Raw; a stage or interest
 * change alone does not.
 */
export function isRawLead(lead) {
  if (!lead?.assignedTo || CLOSED_OR_HOLD.includes(lead.status)) return false;
  const actioned = Boolean(lead.firstContactAt)
    || (lead.callLogs || []).length > 0
    || Boolean(lead.firstCallAt || lead.lastCallAt || lead.callDate)
    || Boolean(lead.connected)
    || POST_CONTACT_STATUSES.includes(lead.status)
    || (lead.pipelineHistory || []).some((h) => h.status === 'Call connected' || h.status === 'WhatsApp initiated' || /^Proposal shared via /.test(h.status || ''));
  return !actioned;
}

/** Merges a full lead returned by an update into the light, list-shaped cached lead. */
export function mergeLead(listLead, updated) {
  // eslint-disable-next-line no-unused-vars
  const { pipelineHistory, callLogs, documents, rawPayload, ...fields } = updated;
  return {
    ...listLead,
    ...fields,
    // The update returns the full lead, so the same Raw rule applies directly
    isRaw: isRawLead(updated),
    lastActivity: pipelineHistory?.length ? pipelineHistory[pipelineHistory.length - 1] : listLead.lastActivity,
  };
}
