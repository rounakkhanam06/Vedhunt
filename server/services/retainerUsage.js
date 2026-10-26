// Retainer hours come from the work logs, not from a typed number. A log counts
// toward a retainer when it is for that client, flagged billable, and falls in
// the current billing month and inside the contract dates. The same WorkLog
// rows also feed project actual-hours and ticket time, so nothing is counted
// twice. Which activity types are billable is the Activity Master's
// `billable` flag (Settings → activity master).
const mongoose = require('mongoose');
const WorkLog = require('../models/WorkLog');

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Calendar-month bounds containing `now` (server timezone). */
function monthBounds(now = new Date()) {
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
  };
}

/** The part of this month that lies inside the contract; null when they don't overlap. */
function usageWindow(retainer, now = new Date()) {
  const month = monthBounds(now);
  const start = retainer.contractStartDate && new Date(retainer.contractStartDate) > month.start
    ? new Date(retainer.contractStartDate) : month.start;
  const end = retainer.contractEndDate && new Date(retainer.contractEndDate) < month.end
    ? new Date(retainer.contractEndDate) : month.end;
  return start <= end ? { start, end } : null;
}

/**
 * Logged billable hours this month for each retainer, as a Map keyed by
 * retainer _id → { hoursUsedLogged, hoursRemainingLogged, hoursOverage, periodStart, periodEnd }.
 */
async function usageForRetainers(retainers, now = new Date()) {
  const month = monthBounds(now);
  const entries = await Promise.all(retainers.map(async (ret) => {
    const included = Number(ret.supportHoursPerMonth) || 0;
    const window = usageWindow(ret, now);
    let minutes = 0;
    if (window) {
      const [row] = await WorkLog.aggregate([
        {
          $match: {
            client_ref: new mongoose.Types.ObjectId(String(ret.client_ref?._id || ret.client_ref)),
            isBillable: true,
            date: { $gte: window.start, $lte: window.end },
          },
        },
        { $group: { _id: null, minutes: { $sum: '$duration' } } },
      ]);
      minutes = row?.minutes || 0;
    }
    const used = round2(minutes / 60);
    return [String(ret._id), {
      hoursUsedLogged: used,
      hoursRemainingLogged: round2(Math.max(0, included - used)),
      hoursOverage: round2(Math.max(0, used - included)),
      periodStart: month.start,
      periodEnd: month.end,
    }];
  }));
  return new Map(entries);
}

/**
 * Attach usage to plain retainer objects. `hoursUsedThisMonth` / `hoursRemaining`
 * carry the effective figure so existing screens keep working: the work-log
 * total once any billable time is logged for the client this month, otherwise
 * the hand-typed value (until staff start linking their timers to clients).
 * `hoursSource` says which one was used.
 */
async function attachUsage(retainers, now) {
  const usage = await usageForRetainers(retainers, now);
  return retainers.map((r) => {
    const u = usage.get(String(r._id));
    if (!u) return r;
    const included = Number(r.supportHoursPerMonth) || 0;
    const fromLogs = u.hoursUsedLogged > 0;
    const used = fromLogs ? u.hoursUsedLogged : Number(r.hoursUsedThisMonth) || 0;
    return {
      ...r,
      ...u,
      hoursManual: Number(r.hoursUsedThisMonth) || 0,
      hoursUsedThisMonth: used,
      hoursRemaining: round2(Math.max(0, included - used)),
      hoursOverage: round2(Math.max(0, used - included)),
      hoursSource: fromLogs ? 'worklogs' : 'manual',
    };
  });
}

module.exports = { monthBounds, usageWindow, usageForRetainers, attachUsage };
