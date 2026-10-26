// What the client sees of the team's work (client decision, Oct 2026): which
// activities and projects time went into, and how much — grouped by activity
// (Google Ads, Facebook Ads, Graphic Design …) and by project. Never employee
// names, internal remarks or task notes; an entry's outcome text is shown only
// when staff marked that log client-visible.
const WorkLog = require('../models/WorkLog');
const Project = require('../models/Project');

const DAY_MS = 24 * 60 * 60 * 1000;

/** Date range for a preset (server-local calendar), or explicit from/to. */
function resolveRange({ period = 'this_month', from, to } = {}, now = new Date()) {
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const endOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  if (period === 'custom') {
    const f = new Date(from);
    const t = new Date(to);
    if (Number.isNaN(f.getTime()) || Number.isNaN(t.getTime()) || f > t) return null;
    if (t - f > 366 * DAY_MS) return null; // at most a year at a time
    return { period, from: startOfDay(f), to: endOfDay(t) };
  }
  const y = now.getFullYear();
  const m = now.getMonth();
  if (period === 'this_week') {
    const monday = startOfDay(new Date(now.getTime() - ((now.getDay() + 6) % 7) * DAY_MS));
    return { period, from: monday, to: endOfDay(now), partial: true };
  }
  if (period === 'last_month') return { period, from: new Date(y, m - 1, 1), to: new Date(y, m, 0, 23, 59, 59, 999) };
  if (period === 'last_3_months') return { period, from: new Date(y, m - 2, 1), to: endOfDay(now), partial: true };
  return { period: 'this_month', from: new Date(y, m, 1), to: endOfDay(now), partial: true };
}

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const hours = (minutes) => round2(minutes / 60);

/**
 * Group logs into totals by activity and by project. Pure — logs are
 * [{ date, duration, activityType, projectName, outcome?, visibility }].
 */
function summarise(logs) {
  const byActivity = new Map();
  const byProject = new Map();
  let total = 0;
  for (const l of logs) {
    const min = Number(l.duration) || 0;
    total += min;
    const a = l.activityType || 'Other';
    byActivity.set(a, (byActivity.get(a) || 0) + min);
    const p = l.projectName || 'General';
    byProject.set(p, (byProject.get(p) || 0) + min);
  }
  const sorted = (map) => [...map.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
    .map(([name, minutes]) => ({ name, minutes, hours: hours(minutes), share: total ? round2((minutes / total) * 100) : 0 }));
  return { totalMinutes: total, totalHours: hours(total), byActivity: sorted(byActivity), byProject: sorted(byProject) };
}

async function workSummary(clientId, query = {}, now = new Date()) {
  const range = resolveRange(query, now);
  if (!range) return null;
  const logs = await WorkLog.find({ client_ref: clientId, date: { $gte: range.from, $lte: range.to } })
    .select('date duration activityType project project_ref outcome visibility')
    .sort({ date: -1, startTime: -1 })
    .lean();

  // Prefer the real project name; fall back to the label the person typed
  const refs = [...new Set(logs.map((l) => l.project_ref && String(l.project_ref)).filter(Boolean))];
  const projects = refs.length ? await Project.find({ _id: { $in: refs }, client_ref: clientId }).select('projectName').lean() : [];
  const names = new Map(projects.map((p) => [String(p._id), p.projectName]));
  const shaped = logs.map((l) => ({
    date: l.date,
    duration: l.duration,
    activityType: l.activityType,
    projectName: (l.project_ref && names.get(String(l.project_ref))) || l.project || 'General',
    outcome: l.visibility === 'Client' && l.outcome ? l.outcome : undefined,
  }));

  return {
    range: { period: range.period, from: range.from, to: range.to, partial: !!range.partial },
    ...summarise(shaped),
    entries: shaped.slice(0, 100).map((e) => ({
      date: e.date, activity: e.activityType, project: e.projectName, minutes: e.duration, hours: hours(e.duration), outcome: e.outcome,
    })),
    entryCount: shaped.length,
  };
}

module.exports = { resolveRange, summarise, workSummary };
