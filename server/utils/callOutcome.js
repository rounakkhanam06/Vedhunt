// One definition of a call's duration and outcome, used when a call is logged
// (services/leadLifecycle.js) and when calls are listed (services/callActivity.js).
//
//   Duration: this call's own timer — end minus start, in whole minutes
//             (minimum 1). A call is timed only when its timer started after
//             the previous call was logged; otherwise there is no duration
//             (null), never the previous call's number.
//   Outcome:  "Connected — <interest level>" or "Not connected — <reason>".

const toTime = (d) => (d ? new Date(d).getTime() : NaN);

/** Minutes for `log`, or null when this call wasn't timed. `prevLoggedAt` = when the call before it was logged. */
function callDurationMinutes({ callStartTime, callEndTime }, prevLoggedAt) {
  const start = toTime(callStartTime);
  const end = toTime(callEndTime);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  if (prevLoggedAt && start <= toTime(prevLoggedAt)) return null; // the previous call's timer
  return Math.max(1, Math.round((end - start) / 60000));
}

/** { status: 'Connected' | 'Not connected', detail } for a call log entry. */
function callOutcome(log) {
  if (log.connected === 'Yes') return { status: 'Connected', detail: log.interestLevel || '' };
  return { status: 'Not connected', detail: log.notConnectedReason || '' };
}

/** "Connected — Warm" / "Not connected — Number Busy" */
const callOutcomeLabel = (log) => {
  const { status, detail } = callOutcome(log);
  return detail ? `${status} — ${detail}` : status;
};

// The same duration rule as an aggregation expression over an unwound log
// that carries `prevAt` (see services/callActivity.js).
const DURATION_EXPR = {
  $let: {
    vars: { s: '$callLogs.callStartTime', e: '$callLogs.callEndTime', p: '$callLogs.prevAt' },
    in: {
      $cond: [
        { $and: [
          { $ne: [{ $type: '$$s' }, 'missing'] }, { $ne: ['$$s', null] },
          { $ne: [{ $type: '$$e' }, 'missing'] }, { $ne: ['$$e', null] },
          { $gte: [{ $toDate: '$$e' }, { $toDate: '$$s' }] },
          { $or: [{ $eq: ['$$p', null] }, { $gt: [{ $toDate: '$$s' }, { $toDate: '$$p' }] }] },
        ] },
        { $max: [1, { $round: [{ $divide: [{ $subtract: [{ $toDate: '$$e' }, { $toDate: '$$s' }] }, 60000] }, 0] }] },
        null,
      ],
    },
  },
};

module.exports = { callDurationMinutes, callOutcome, callOutcomeLabel, DURATION_EXPR };
