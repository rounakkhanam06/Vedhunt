// KPI setup and report ("KPI Metric for Client Reports", client sample, Oct 2026).
//
// Decisions (client, Oct 2026):
//   • the report is built from the daily ad entries (services/adPerformance.js) — one source,
//     so daily, weekly and monthly rows can never double-count or disagree
//   • the budget plan uses the real calendar days of each month: a day's plan is the platform's
//     monthly budget ÷ the days in that month, so a month's plan always equals the approved budget
//   • Qualified Leads, Verified Orders and the Optimization Action are entered by employees;
//     the client can only see them
//   • the client sees budget vs spend, targets vs actual and the actions — never the gross
//     margin or internal notes
//
// Weeks run Monday–Sunday (as in the ad report). A period still running is planned up to today
// and marked partial, so spend is compared with what should have been spent so far.
const AdPerformance = require('../models/AdPerformance');
const KpiSetup = require('../models/KpiSetup');
const KpiPeriodEntry = require('../models/KpiPeriodEntry');
const { FREQUENCIES, GOALS } = require('../models/KpiSetup');
const { PLATFORMS, metrics, emptySums, addRow, dayOf, addDays, mondayOf } = require('./adPerformance');

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const isDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && dayOf(new Date(`${s}T12:00:00`)) === s;
const daysInMonthOf = (day) => { const [y, m] = day.split('-').map(Number); return new Date(y, m, 0).getDate(); };
const firstOfMonth = (day) => `${day.slice(0, 7)}-01`;
const lastOfMonth = (day) => `${day.slice(0, 7)}-${String(daysInMonthOf(day)).padStart(2, '0')}`;
const nextMonth = (day) => { const [y, m] = day.split('-').map(Number); return dayOf(new Date(y, m, 1)); };
// Range limits per frequency, so a report stays a readable table
const MAX_DAYS = { Daily: 92, Weekly: 371, Monthly: 731 };

// ── Setup ───────────────────────────────────────────────────────────────────
/** @returns {{ value } | { error }} */
function validateSetup(input = {}) {
  const errors = [];
  const optNum = (v, label, { max } = {}) => {
    if (v === undefined || v === null || v === '') return undefined;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || (max != null && n > max)) { errors.push(`${label} must be a number from 0${max != null ? ` to ${max}` : ''}.`); return undefined; }
    return r2(n);
  };
  const budget = Number(input.monthlyBudget);
  if (!Number.isFinite(budget) || budget <= 0) errors.push('Enter the approved monthly budget for this platform.');
  const effectiveFrom = input.budgetEffectiveFrom ? String(input.budgetEffectiveFrom) : undefined;
  if (effectiveFrom && !/^\d{4}-(0[1-9]|1[0-2])$/.test(effectiveFrom)) errors.push('Choose the month the budget applies from.');
  if (!FREQUENCIES.includes(input.reportingFrequency)) errors.push('Choose Daily, Weekly or Monthly reporting.');
  if (!GOALS.includes(input.primaryGoal)) errors.push(`Primary goal must be one of ${GOALS.join(', ')}.`);
  const value = {
    businessType: String(input.businessType || '').trim().slice(0, 80) || undefined,
    reportingFrequency: input.reportingFrequency,
    monthlyBudget: r2(budget),
    primaryGoal: input.primaryGoal,
    targetCpa: optNum(input.targetCpa, 'Target CPA / CPL'),
    targetRoas: optNum(input.targetRoas, 'Target ROAS', { max: 100 }),
    grossMarginPercent: optNum(input.grossMarginPercent, 'Gross margin %', { max: 100 }),
    accountOwner: String(input.accountOwner || '').trim().slice(0, 120) || undefined,
    notes: String(input.notes || '').trim().slice(0, 1000) || undefined,
  };
  return errors.length ? { error: errors.join(' ') } : { value, effectiveFrom };
}

// ── Budget history ──────────────────────────────────────────────────────────
/**
 * The budget history after setting `monthlyBudget` from `month` ('YYYY-MM'): that month's
 * entry is replaced, earlier and later changes are kept. A setup made before history existed
 * starts with its old budget as the earliest entry, so its past is not rewritten.
 */
function withBudget(existing, monthlyBudget, month) {
  let history = [...(existing?.budgetHistory || [])];
  if (!history.length && existing?.monthlyBudget != null && existing.monthlyBudget !== monthlyBudget) {
    history.push({ month: '2000-01', monthlyBudget: existing.monthlyBudget });
  }
  history = history.filter((h) => h.month !== month);
  history.push({ month, monthlyBudget });
  return history.sort((a, b) => a.month.localeCompare(b.month));
}

/** The approved budget for a month ('YYYY-MM') under a setup. */
function budgetForMonth(setup, month) {
  const history = setup.budgetHistory || [];
  if (!history.length) return setup.monthlyBudget;
  let found = history[0].monthlyBudget;
  for (const h of history) if (h.month <= month) found = h.monthlyBudget;
  return found;
}

// ── Primary conversions: only the campaigns whose result matches the goal ────
// (client decision, Oct 2026 — the KPI guide: "purchase OR lead, not mixed")
const GOAL_RESULT = { Purchases: /purchas/i, Leads: /lead/i, 'Qualified Leads': /lead/i };
const countsForGoal = (goal, resultType) => {
  const re = GOAL_RESULT[goal];
  return !re || re.test(String(resultType || ''));
};

const setupForClient = (s) => {
  const { grossMarginPercent, notes, updatedBy, updatedByName, ...rest } = s;
  return rest;
};

// ── Period entries (qualified leads, verified orders, action) ────────────────
function validateEntry(input = {}) {
  const errors = [];
  if (!PLATFORMS.includes(input.platform)) errors.push('Choose the platform.');
  if (!FREQUENCIES.includes(input.frequency)) errors.push('Choose Daily, Weekly or Monthly.');
  if (!isDay(input.periodStart)) errors.push('Choose the period.');
  else if (input.frequency === 'Weekly' && mondayOf(input.periodStart) !== input.periodStart) errors.push('A week starts on a Monday.');
  else if (input.frequency === 'Monthly' && firstOfMonth(input.periodStart) !== input.periodStart) errors.push('A month starts on the 1st.');
  const count = (v, label) => {
    if (v === undefined || v === null || v === '') return null; // blank = not known yet
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0) { errors.push(`${label} must be a whole number of zero or more.`); return null; }
    return n;
  };
  const value = {
    platform: input.platform,
    frequency: input.frequency,
    periodStart: input.periodStart,
    qualifiedLeads: count(input.qualifiedLeads, 'Qualified leads'),
    verifiedOrders: count(input.verifiedOrders, 'Verified orders'),
    action: String(input.action || '').trim().slice(0, 2000) || null,
  };
  return errors.length ? { error: errors.join(' ') } : { value };
}

// ── Periods and budget plan ─────────────────────────────────────────────────
/** The periods covering [from, to]: { key, start, end } with start/end clipped to the range. */
function periodsBetween(from, to, frequency) {
  const out = [];
  let start = frequency === 'Weekly' ? mondayOf(from) : frequency === 'Monthly' ? firstOfMonth(from) : from;
  while (start <= to) {
    const end = frequency === 'Weekly' ? addDays(start, 6) : frequency === 'Monthly' ? lastOfMonth(start) : start;
    out.push({ key: start, start: start < from ? from : start, end: end > to ? to : end });
    start = frequency === 'Weekly' ? addDays(start, 7) : frequency === 'Monthly' ? nextMonth(start) : addDays(start, 1);
  }
  return out;
}

/**
 * Budget planned for [start, end]: each day gets its month's budget ÷ the days in that month.
 * `monthlyBudget` is a number, or a function month ('YYYY-MM') → budget (budget history).
 */
function plannedBudget(monthlyBudget, start, end) {
  const budgetOf = typeof monthlyBudget === 'function' ? monthlyBudget : () => monthlyBudget;
  let total = 0;
  let day = start;
  while (day <= end) {
    // Whole months at once, so a full month is exactly the monthly budget
    const monthEnd = lastOfMonth(day);
    const until = monthEnd < end ? monthEnd : end;
    const days = Math.round((new Date(`${until}T12:00:00`) - new Date(`${day}T12:00:00`)) / 864e5) + 1;
    total += (budgetOf(day.slice(0, 7)) * days) / daysInMonthOf(day);
    day = addDays(until, 1);
  }
  return r2(total);
}

const labelOf = (p, frequency) => {
  const d = (s) => new Date(`${s}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  if (frequency === 'Monthly') return new Date(`${p.key}T12:00:00`).toLocaleString('en-IN', { month: 'short', year: 'numeric' });
  if (frequency === 'Weekly') return `${d(p.start)} – ${d(p.end)}`;
  return d(p.start);
};

/** Default range: this month for daily / weekly, the last 6 months for monthly. */
function defaultRange(frequency, today) {
  if (frequency === 'Monthly') {
    const [y, m] = today.split('-').map(Number);
    return { from: dayOf(new Date(y, m - 6, 1)), to: today };
  }
  return { from: firstOfMonth(today), to: today };
}

// ── Report ──────────────────────────────────────────────────────────────────
/**
 * KPI report for one client: one table per platform that has a KPI setup.
 * @param opts.frequency  Daily | Weekly | Monthly (default: each platform's reporting frequency)
 * @param opts.from/to    'YYYY-MM-DD' (default: see defaultRange); periods after today are left out
 * @param opts.platform   one platform only
 * @param opts.forClient  hide internal fields (gross margin, notes, who entered what) and hidden ad rows
 * @returns null for an invalid range
 */
async function kpiReport(clientId, { frequency, from, to, platform, forClient = false } = {}, now = new Date()) {
  const today = dayOf(now);
  const setupQuery = { client_ref: clientId, ...(platform && PLATFORMS.includes(platform) ? { platform } : {}) };
  const setups = await KpiSetup.find(setupQuery).sort({ platform: 1 }).lean();

  const tables = [];
  for (const setup of setups) {
    const freq = FREQUENCIES.includes(frequency) ? frequency : setup.reportingFrequency;
    const range = from || to ? { from, to } : defaultRange(freq, today);
    if (!isDay(range.from) || !isDay(range.to) || range.from > range.to) return null;
    const last = range.to > today ? today : range.to;
    if (range.from > last) { tables.push({ platform: setup.platform, frequency: freq, from: range.from, to: range.to, setup: forClient ? setupForClient(setup) : setup, rows: [], totals: null }); continue; }
    const span = Math.round((new Date(`${last}T12:00:00`) - new Date(`${range.from}T12:00:00`)) / 864e5) + 1;
    if (span > MAX_DAYS[freq]) return null;

    const periods = periodsBetween(range.from, last, freq);
    const [ads, entries] = await Promise.all([
      AdPerformance.find({ client_ref: clientId, platform: setup.platform, day: { $gte: range.from, $lte: last }, ...(forClient ? { hidden: { $ne: true } } : {}) })
        .select('day spend impressions clicks results revenue resultType').lean(),
      KpiPeriodEntry.find({ client_ref: clientId, platform: setup.platform, frequency: freq, periodStart: { $in: periods.map((p) => p.key) } }).lean(),
    ]);
    const entryOf = new Map(entries.map((e) => [e.periodStart, e]));

    // Budget, delivery and clicks count every campaign on the platform; conversions, their cost,
    // value and ROAS count only the campaigns whose result matches the primary goal
    const sumsOf = new Map(periods.map((p) => [p.key, { all: emptySums(), goal: emptySums() }]));
    const keyOf = (day) => (freq === 'Weekly' ? mondayOf(day) : freq === 'Monthly' ? firstOfMonth(day) : day);
    const allTotal = { all: emptySums(), goal: emptySums() };
    for (const a of ads) {
      const bucket = sumsOf.get(keyOf(a.day));
      if (!bucket) continue;
      addRow(bucket.all, a);
      addRow(allTotal.all, a);
      if (countsForGoal(setup.primaryGoal, a.resultType)) { addRow(bucket.goal, a); addRow(allTotal.goal, a); }
    }
    const budgetOf = (month) => budgetForMonth(setup, month);

    const status = (actual, target, lowerIsBetter) => {
      if (actual == null || !(target > 0)) return null;
      return (lowerIsBetter ? actual <= target : actual >= target) ? 'on_target' : 'off_target';
    };
    const rowOf = (key, start, end, { all, goal }, entry, label) => {
      const m = metrics(all);
      const g = metrics(goal);
      const planned = plannedBudget(budgetOf, start, end);
      const row = {
        key, label, start, end,
        partial: end >= today,
        // The approved budget of the period's month (a month row) — the plan for longer ranges is the sum of the months
        monthlyBudget: budgetOf(start.slice(0, 7)),
        plannedBudget: planned,
        spend: m.spend,
        remaining: r2(planned - m.spend),
        utilization: planned > 0 ? r2((m.spend / planned) * 100) : null,
        spendVsPlan: r2(m.spend - planned),
        impressions: m.impressions,
        clicks: m.clicks,
        ctr: m.ctr,
        cpc: m.cpc,
        cpm: m.cpm,
        conversions: g.results,
        costPerConversion: g.costPerResult,
        conversionValue: g.revenue,
        roas: g.roas,
        // Results of campaigns with a different result type (not counted as conversions)
        otherResults: m.results - g.results,
        qualifiedLeads: entry?.qualifiedLeads ?? null,
        verifiedOrders: entry?.verifiedOrders ?? null,
        action: entry?.action || '',
        cpaStatus: status(g.costPerResult, setup.targetCpa, true),
        roasStatus: status(g.roas, setup.targetRoas, false),
      };
      if (!forClient && entry) Object.assign(row, { entryUpdatedByName: entry.updatedByName || '', entryUpdatedAt: entry.updatedAt });
      return row;
    };

    const rows = periods.map((p) => rowOf(p.key, p.start, p.end, sumsOf.get(p.key), entryOf.get(p.key), labelOf(p, freq)));
    // Totals for the whole range, recomputed from the sums (ratios are never averaged)
    const sumOrNull = (k) => (rows.some((r) => r[k] != null) ? rows.reduce((s, r) => s + (r[k] || 0), 0) : null);
    const totals = { ...rowOf('total', range.from, last, allTotal, null, 'Total'), monthlyBudget: null, qualifiedLeads: sumOrNull('qualifiedLeads'), verifiedOrders: sumOrNull('verifiedOrders'), action: '' };

    tables.push({ platform: setup.platform, frequency: freq, from: range.from, to: last, setup: forClient ? setupForClient(setup) : setup, rows, totals });
  }
  return { today, platforms: PLATFORMS, frequencies: FREQUENCIES, goals: GOALS, tables };
}

/** CSV of one platform table — the columns of the "Performance Entry" sheet. */
function toCsv(table, clientName = '') {
  const cols = [
    ['start', 'Period Start'], ['end', 'Period End'], ['client', 'Client'], ['platform', 'Platform'], ['frequency', 'Reporting Frequency'],
    ['monthlyBudget', 'Monthly Approved Budget (₹)'], ['plannedBudget', 'Planned Budget for Period (₹)'], ['spend', 'Actual Spend (₹)'],
    ['remaining', 'Budget Remaining (₹)'], ['utilization', 'Budget Utilization %'], ['spendVsPlan', 'Spend vs Plan (₹)'],
    ['impressions', 'Impressions'], ['clicks', 'Clicks'], ['ctr', 'CTR %'], ['cpc', 'CPC (₹)'], ['cpm', 'CPM (₹)'],
    ['conversions', 'Primary Conversions'], ['costPerConversion', 'Cost per Conversion (₹)'], ['conversionValue', 'Conversion Value (₹)'],
    ['roas', 'ROAS (x)'], ['qualifiedLeads', 'Qualified Leads'], ['verifiedOrders', 'Verified Orders / Customers'], ['action', 'Result / Optimization Action'],
  ];
  const esc = (v) => {
    if (v == null) return '';
    let s = String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // never let a spreadsheet run a typed-in formula
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // The monthly budget is each row's own month's budget (budget history)
  const extra = { client: clientName, platform: table.platform, frequency: table.frequency };
  return [cols.map(([, h]) => esc(h)).join(','), ...table.rows.map((r) => cols.map(([k]) => esc(k in extra ? extra[k] : r[k])).join(','))].join('\n');
}

module.exports = {
  validateSetup, validateEntry, periodsBetween, plannedBudget, kpiReport, toCsv, setupForClient, MAX_DAYS,
  withBudget, budgetForMonth, countsForGoal,
};
