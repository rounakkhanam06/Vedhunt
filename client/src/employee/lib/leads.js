// Lead classification helpers shared by the dashboard widgets and the lead
// lists, so a count on a tile always matches the list it opens.
import { NON_ACTIVE_FOLLOWUP_STATUSES } from '../../shared/leadConstants';
import { isThisMonth } from './datetime';

// A raw/New lead is "Call Pending" once it's sat assigned-but-uncalled past
// this SLA — distinguishes the urgent subset from the full New Leads pool.
const CALL_PENDING_SLA_HOURS = 4;

export const isActiveLead = (lead) => !NON_ACTIVE_FOLLOWUP_STATUSES.includes(lead.status);

export function isCallPending(lead) {
  if (lead.status !== 'New' || !lead.assignedAt) return false;
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

/** Merges a full lead returned by an update into the light, list-shaped cached lead. */
export function mergeLead(listLead, updated) {
  // eslint-disable-next-line no-unused-vars
  const { pipelineHistory, callLogs, documents, rawPayload, ...fields } = updated;
  return {
    ...listLead,
    ...fields,
    lastActivity: pipelineHistory?.length ? pipelineHistory[pipelineHistory.length - 1] : listLead.lastActivity,
  };
}
