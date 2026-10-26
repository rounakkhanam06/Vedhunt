// Manual ad performance tracking (client decision, Oct 2026: manual entry; view
// by day, week and month). Rules from the spec (§5–7):
//   • ratios are recomputed from summed numerators/denominators, never averaged
//   • a zero denominator gives null ("--"), never Infinity or 0
//   • comparisons use the previous period of the same length; a zero baseline
//     is "new", not a percentage
//   • cost metrics improve when they go down, volume metrics when they go up
//   • weeks run Monday–Sunday; the current day/week/month is marked partial
const AdPerformance = require('../models/AdPerformance');
const { PLATFORMS } = require('../models/AdPerformance');

const DAY_MS = 24 * 60 * 60 * 1000;
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const pad = (n) => String(n).padStart(2, '0');

// ── Days as 'YYYY-MM-DD' strings (calendar days, no timezone drift) ──────────
const dayOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDay = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseDay(s); d.setDate(d.getDate() + n); return dayOf(d); };
const daysBetween = (a, b) => Math.round((parseDay(b) - parseDay(a)) / DAY_MS) + 1; // inclusive
const isDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && dayOf(parseDay(s)) === s;
const mondayOf = (s) => { const d = parseDay(s); return addDays(s, -((d.getDay() + 6) % 7)); };

// ── Metrics ─────────────────────────────────────────────────────────────────
const SUM_FIELDS = ['spend', 'impressions', 'clicks', 'results', 'revenue'];
// Cost metrics: lower is better
const LOWER_IS_BETTER = new Set(['cpc', 'cpm', 'costPerResult']);

const emptySums = () => ({ spend: 0, impressions: 0, clicks: 0, results: 0, revenue: 0, revenueRows: 0, rows: 0 });

function addRow(sums, row) {
  for (const f of SUM_FIELDS) sums[f] += Number(row[f]) || 0;
  if (row.revenue != null) sums.revenueRows += 1;
  sums.rows += 1;
  return sums;
}

/** Totals + ratios recomputed from the sums. */
function metrics(sums) {
  const div = (a, b, k = 1) => (b > 0 ? r2((a / b) * k) : null);
  return {
    spend: r2(sums.spend),
    impressions: sums.impressions,
    clicks: sums.clicks,
    results: sums.results,
    // Revenue is optional per row: unknown (null) when no row reported it
    revenue: sums.revenueRows ? r2(sums.revenue) : null,
    ctr: div(sums.clicks, sums.impressions, 100),
    cpc: div(sums.spend, sums.clicks),
    cpm: div(sums.spend, sums.impressions, 1000),
    costPerResult: div(sums.spend, sums.results),
    roas: sums.revenueRows ? div(sums.revenue, sums.spend) : null,
  };
}

/** Current vs comparison for one metric: absolute change, % change and whether it is good. */
function compare(key, cur, prev) {
  if (cur == null || prev == null) return { current: cur, previous: prev, change: null, pct: null, isNew: false, good: null };
  const change = r2(cur - prev);
  if (prev === 0) return { current: cur, previous: prev, change, pct: null, isNew: cur !== 0, good: null };
  const pct = r2(((cur - prev) / Math.abs(prev)) * 100);
  const good = change === 0 ? null : LOWER_IS_BETTER.has(key) ? change < 0 : change > 0;
  return { current: cur, previous: prev, change, pct, isNew: false, good };
}

// ── Periods ─────────────────────────────────────────────────────────────────
const PRESETS = ['today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month', 'last_30_days', 'custom'];

/**
 * { from, to, partial, label } for the selected period, plus the comparison
 * period of the same length that ends the day before it starts. For the
 * current week/month (partial) the comparison covers the same number of days
 * at the start of the previous week/month, so a half-finished month is never
 * judged against a whole one.
 */
function resolvePeriod({ period = 'this_month', from, to } = {}, now = new Date()) {
  const today = dayOf(now);
  let cur;
  let prev;
  switch (period) {
    case 'today': cur = { from: today, to: today, partial: true }; break;
    case 'yesterday': { const y = addDays(today, -1); cur = { from: y, to: y }; break; }
    case 'this_week': {
      const mon = mondayOf(today);
      cur = { from: mon, to: today, partial: true };
      const lastMon = addDays(mon, -7);
      prev = { from: lastMon, to: addDays(lastMon, daysBetween(mon, today) - 1) };
      break;
    }
    case 'last_week': { const mon = addDays(mondayOf(today), -7); cur = { from: mon, to: addDays(mon, 6) }; break; }
    case 'last_month': {
      const first = dayOf(new Date(now.getFullYear(), now.getMonth() - 1, 1));
      const last = dayOf(new Date(now.getFullYear(), now.getMonth(), 0));
      cur = { from: first, to: last };
      prev = { from: dayOf(new Date(now.getFullYear(), now.getMonth() - 2, 1)), to: dayOf(new Date(now.getFullYear(), now.getMonth() - 1, 0)) };
      break;
    }
    case 'last_30_days': cur = { from: addDays(today, -29), to: today, partial: true }; break;
    case 'custom': {
      if (!isDay(from) || !isDay(to) || from > to || daysBetween(from, to) > 366) return null;
      cur = { from, to, partial: to >= today };
      break;
    }
    case 'this_month':
    default: {
      const first = dayOf(new Date(now.getFullYear(), now.getMonth(), 1));
      cur = { from: first, to: today, partial: true };
      // Month-to-date vs the same days of last month (clamped to last month's length)
      const prevFirst = dayOf(new Date(now.getFullYear(), now.getMonth() - 1, 1));
      const prevLast = dayOf(new Date(now.getFullYear(), now.getMonth(), 0));
      const candidate = addDays(prevFirst, daysBetween(first, today) - 1);
      prev = { from: prevFirst, to: candidate > prevLast ? prevLast : candidate };
      period = 'this_month';
    }
  }
  if (!prev) {
    const len = daysBetween(cur.from, cur.to);
    prev = { from: addDays(cur.from, -len), to: addDays(cur.from, -1) };
  }
  return { period, current: { ...cur, partial: !!cur.partial, days: daysBetween(cur.from, cur.to) }, previous: { ...prev, days: daysBetween(prev.from, prev.to) } };
}

/** Bucket key for a day: the day itself, the Monday of its week, or its month. */
function bucketOf(day, group) {
  if (group === 'week') return mondayOf(day);
  if (group === 'month') return day.slice(0, 7);
  return day;
}

/** Every bucket in [from, to] in order, so empty days/weeks/months show as zero. */
function bucketsBetween(from, to, group) {
  const out = [];
  let d = group === 'week' ? mondayOf(from) : group === 'month' ? `${from.slice(0, 7)}-01` : from;
  while (d <= to) {
    out.push(bucketOf(d, group));
    if (group === 'week') d = addDays(d, 7);
    else if (group === 'month') { const p = parseDay(d); d = dayOf(new Date(p.getFullYear(), p.getMonth() + 1, 1)); }
    else d = addDays(d, 1);
  }
  return out;
}

const labelOf = (key, group) => {
  if (group === 'month') { const [y, m] = key.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleString('en-IN', { month: 'short', year: 'numeric' }); }
  const d = parseDay(key).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  return group === 'week' ? `Week of ${d}` : d;
};

// ── Input ───────────────────────────────────────────────────────────────────
const num = (v, { required = false, integer = false } = {}) => {
  if (v === undefined || v === null || v === '') return required ? NaN : undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return NaN;
  return integer ? Math.round(n) : r2(n);
};

/**
 * Validate a row from staff. Partial updates validate only the sent fields,
 * merged over `existing`.
 * @returns { value } | { error }
 */
function validateRow(input = {}, existing = null, now = new Date()) {
  const has = (k) => Object.prototype.hasOwnProperty.call(input, k);
  const merged = { ...(existing || {}) };
  const errors = [];

  if (!existing || has('day')) {
    if (!isDay(input.day)) errors.push('Choose a valid date.');
    else if (input.day > dayOf(now)) errors.push('The date cannot be in the future.');
    else merged.day = input.day;
  }
  if (!existing || has('platform')) {
    if (!PLATFORMS.includes(input.platform)) errors.push(`Platform must be one of ${PLATFORMS.join(', ')}.`);
    else merged.platform = input.platform;
  }
  if (!existing || has('campaignName')) {
    const name = String(input.campaignName || '').trim();
    if (!name) errors.push('Enter the campaign name.');
    else { merged.campaignName = name.slice(0, 200); merged.campaignKey = name.toLowerCase().replace(/\s+/g, ' ').slice(0, 200); }
  }
  for (const f of ['campaignId', 'objective', 'creativeType', 'creativeName', 'resultType', 'notes']) {
    if (has(f)) merged[f] = String(input[f] || '').trim() || undefined;
  }
  if (has('creativeName') || !existing) merged.creativeKey = String(merged.creativeName || '').toLowerCase().replace(/\s+/g, ' ');
  if (has('budgetType')) {
    if (!['Daily', 'Lifetime'].includes(input.budgetType)) errors.push('Budget type must be Daily or Lifetime.');
    else merged.budgetType = input.budgetType;
  }
  if (has('hidden')) merged.hidden = !!input.hidden;

  const numbers = { spend: { required: !existing }, budget: {}, revenue: {}, impressions: { integer: true }, clicks: { integer: true }, results: { integer: true } };
  for (const [f, opts] of Object.entries(numbers)) {
    if (!has(f) && !(opts.required)) continue;
    const n = num(input[f], opts);
    if (Number.isNaN(n)) errors.push(`${f === 'spend' ? 'Spend' : f[0].toUpperCase() + f.slice(1)} must be a number of zero or more.`);
    else merged[f] = n;
  }
  if (merged.impressions == null) merged.impressions = 0;
  if (merged.clicks == null) merged.clicks = 0;
  if (merged.results == null) merged.results = 0;
  if (!errors.length && merged.clicks > merged.impressions && merged.impressions > 0) errors.push('Clicks cannot be more than impressions.');
  if (has('currency') && input.currency && input.currency !== 'INR') errors.push('Only INR is supported for now.');

  return errors.length ? { error: errors.join(' ') } : { value: merged };
}

// ── Report ──────────────────────────────────────────────────────────────────
/**
 * Everything a performance view needs for one client and period.
 * @param opts.forClient  hide rows marked hidden, and internal fields
 */
async function report(clientId, { period, from, to, group = 'day', platform, forClient = false, monthlyAdBudget } = {}, now = new Date()) {
  const p = resolvePeriod({ period, from, to }, now);
  if (!p) return null;
  const g = ['day', 'week', 'month'].includes(group) ? group : 'day';
  const base = { client_ref: clientId };
  if (forClient) base.hidden = { $ne: true };
  if (platform && PLATFORMS.includes(platform)) base.platform = platform;

  const monthStart = dayOf(new Date(now.getFullYear(), now.getMonth(), 1));
  const [rows, prevRows, monthRows, latest] = await Promise.all([
    AdPerformance.find({ ...base, day: { $gte: p.current.from, $lte: p.current.to } }).sort({ day: -1, platform: 1, campaignName: 1 }).lean(),
    AdPerformance.find({ ...base, day: { $gte: p.previous.from, $lte: p.previous.to } }).select(SUM_FIELDS.join(' ')).lean(),
    AdPerformance.find({ ...base, day: { $gte: monthStart, $lte: dayOf(now) } }).select('spend').lean(),
    AdPerformance.findOne(base).sort({ updatedAt: -1 }).select('updatedAt').lean(),
  ]);

  const cur = metrics(rows.reduce(addRow, emptySums()));
  const prev = metrics(prevRows.reduce(addRow, emptySums()));
  const comparison = Object.fromEntries(['spend', 'impressions', 'clicks', 'ctr', 'cpc', 'cpm', 'results', 'costPerResult', 'revenue', 'roas']
    .map((k) => [k, compare(k, cur[k], prev[k])]));

  // Series by day / week / month (empty buckets as zero)
  const bucketSums = new Map(bucketsBetween(p.current.from, p.current.to, g).map((k) => [k, emptySums()]));
  for (const r of rows) {
    const k = bucketOf(r.day, g);
    if (bucketSums.has(k)) addRow(bucketSums.get(k), r);
  }
  const lastKey = bucketOf(dayOf(now), g);
  const series = [...bucketSums.entries()].map(([key, sums]) => ({ key, label: labelOf(key, g), partial: key === lastKey && p.current.to >= dayOf(now), ...metrics(sums) }));

  // By campaign and by platform
  const groupBy = (keyFn) => {
    const m = new Map();
    for (const r of rows) {
      const k = keyFn(r);
      if (!m.has(k.id)) m.set(k.id, { ...k, sums: emptySums() });
      addRow(m.get(k.id).sums, r);
    }
    return [...m.values()].map(({ sums, ...k }) => ({ ...k, ...metrics(sums) })).sort((a, b) => b.spend - a.spend);
  };
  const byCampaign = groupBy((r) => ({ id: `${r.platform}|${r.campaignKey}`, platform: r.platform, campaignName: r.campaignName, objective: r.objective || '', resultType: r.resultType || '' }));
  const byPlatform = groupBy((r) => ({ id: r.platform, platform: r.platform }));

  // Budget pacing for the current calendar month
  const spentThisMonth = r2(monthRows.reduce((s, r) => s + (Number(r.spend) || 0), 0));
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const budget = monthlyAdBudget > 0 ? {
    monthlyBudget: monthlyAdBudget,
    spentThisMonth,
    utilisation: r2((spentThisMonth / monthlyAdBudget) * 100),
    remaining: r2(Math.max(0, monthlyAdBudget - spentThisMonth)),
    expectedByToday: r2((monthlyAdBudget * now.getDate()) / daysInMonth),
    pacing: spentThisMonth > (monthlyAdBudget * now.getDate()) / daysInMonth * 1.1 ? 'over' : spentThisMonth < (monthlyAdBudget * now.getDate()) / daysInMonth * 0.9 ? 'under' : 'on_track',
  } : null;

  const strip = (r) => {
    const out = { _id: r._id, day: r.day, platform: r.platform, campaignName: r.campaignName, objective: r.objective || '', creativeType: r.creativeType || '', creativeName: r.creativeName || '', resultType: r.resultType || '', budget: r.budget ?? null, budgetType: r.budgetType, spend: r.spend, impressions: r.impressions, clicks: r.clicks, results: r.results, revenue: r.revenue ?? null };
    const m = metrics(addRow(emptySums(), r));
    Object.assign(out, { ctr: m.ctr, cpc: m.cpc, cpm: m.cpm, costPerResult: m.costPerResult, roas: m.roas });
    if (!forClient) Object.assign(out, { campaignId: r.campaignId || '', notes: r.notes || '', hidden: !!r.hidden, enteredByName: r.enteredByName || '', updatedAt: r.updatedAt });
    return out;
  };

  return {
    period: p.period, group: g, current: p.current, previous: p.previous,
    totals: cur, comparison, series, byCampaign, byPlatform, budget,
    rows: rows.slice(0, 500).map(strip), rowCount: rows.length,
    lastUpdated: latest?.updatedAt || null,
    platforms: PLATFORMS,
  };
}

/** CSV of the rows in a report (same fields the table shows). */
function toCsv(rows, { internal = false } = {}) {
  const cols = ['day', 'platform', 'campaignName', 'objective', 'creativeName', 'resultType', 'budget', 'spend', 'impressions', 'clicks', 'ctr', 'cpc', 'cpm', 'results', 'costPerResult', 'revenue', 'roas'];
  if (internal) cols.push('hidden', 'notes', 'enteredByName');
  const esc = (v) => {
    if (v == null) return '';
    let s = String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // never let a spreadsheet run a typed-in formula
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}

module.exports = {
  PRESETS, PLATFORMS, metrics, compare, resolvePeriod, bucketOf, bucketsBetween, validateRow, report, toCsv,
  dayOf, addDays, mondayOf, emptySums, addRow,
};
