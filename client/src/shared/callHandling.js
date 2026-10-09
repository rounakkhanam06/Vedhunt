/**
 * Call state for the Call Handling / Call Outcome sections of both Lead
 * Workspaces (admin and Employee Portal). The lead's callStartTime /
 * callEndTime hold only the most recent call; callLogs holds every logged one.
 */

const sameInstant = (a, b) => (!a || !b ? !a && !b : new Date(a).getTime() === new Date(b).getTime());

/** Started with Start Call and not yet ended. */
export function isCallInProgress(lead) {
  if (!lead?.callStartTime) return false;
  return !lead.callEndTime || new Date(lead.callEndTime) < new Date(lead.callStartTime);
}

export const lastCallLog = (lead) => lead?.callLogs?.[lead.callLogs.length - 1] || null;

/** A Start Call happened after the last logged outcome — the next outcome is a new touch. */
export function startedNewCall(lead) {
  const last = lastCallLog(lead);
  return Boolean(lead?.callStartTime) && (!last || !sameInstant(last.callStartTime, lead.callStartTime));
}

/** The call outcome currently saved on the lead. */
export const savedOutcome = (lead) => ({
  connected: lead?.connected || '',
  notConnectedReason: lead?.notConnectedReason || '',
  interestLevel: lead?.interestLevel || '',
  nextFollowUpDate: lead?.nextFollowUpDate || '',
});

/** True when `outcome` says nothing the lead doesn't already have saved. */
export function isSameOutcome(outcome, lead) {
  const saved = savedOutcome(lead);
  return outcome.connected === saved.connected &&
    (outcome.connected === 'Yes'
      ? (outcome.interestLevel || '') === saved.interestLevel
      : (outcome.notConnectedReason || '') === saved.notConnectedReason) &&
    sameInstant(outcome.nextFollowUpDate, saved.nextFollowUpDate);
}

export const fmtClock = (d) => (d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '');
