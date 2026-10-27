// Why a client is "at risk" (Financial Overview). A client is at risk when any of these hold,
// and every reason that applies is listed:
//   overdue  — an invoice is unpaid more than 7 days after its due date
//   kpi      — a platform with a KPI setup was off target (CPA or ROAS) in each of the last two
//              complete months (services/kpi.js decides on / off target per month)
//   manual   — the team flagged the client, with a reason (Client.riskFlag)
const Client = require('../models/Client');
const KpiSetup = require('../models/KpiSetup');
const { kpiReport } = require('./kpi');
const { portfolioFinance } = require('./finance');

const OVERDUE_DAYS = 7;
const KPI_MONTHS = 2;

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const inr = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;

/** The last two complete months before `now`: { from, to } as 'YYYY-MM-DD'. */
function kpiWindow(now = new Date()) {
  const from = new Date(now.getFullYear(), now.getMonth() - KPI_MONTHS, 1);
  const to = new Date(now.getFullYear(), now.getMonth(), 0);
  return { from: ymd(from), to: ymd(to) };
}

/** Platforms off target in every one of the window's months, e.g. [{ platform, months: ['Aug 2026', 'Sep 2026'] }]. */
async function kpiMisses(clientId, now = new Date()) {
  const { from, to } = kpiWindow(now);
  const report = await kpiReport(clientId, { frequency: 'Monthly', from, to }, now);
  const misses = [];
  for (const table of report?.tables || []) {
    const months = table.rows.filter((r) => !r.partial);
    if (months.length < KPI_MONTHS) continue;
    const off = (r) => r.cpaStatus === 'off_target' || r.roasStatus === 'off_target';
    if (months.every(off)) misses.push({ platform: table.platform, months: months.map((r) => r.label) });
  }
  return misses;
}

/**
 * @param clientIds  the clients to check
 * @param opts.finance  Map clientId → { overdueAmount, daysOverdue } (portfolioFinance), if already loaded
 * @returns Map<clientId, [{ type, text, ... }]> — only clients with at least one reason
 */
async function riskReasons(clientIds, { finance, now = new Date() } = {}) {
  const fin = finance || (await portfolioFinance({ clientIds, now })).perClient;
  const [flagged, kpiClients] = await Promise.all([
    Client.find({ _id: { $in: clientIds }, 'riskFlag.flagged': true }).select('riskFlag').lean(),
    KpiSetup.distinct('client_ref', { client_ref: { $in: clientIds } }),
  ]);
  const out = new Map();
  const add = (id, reason) => {
    const k = String(id);
    out.set(k, [...(out.get(k) || []), reason]);
  };

  for (const id of clientIds) {
    const f = fin.get(String(id));
    if (f && f.daysOverdue > OVERDUE_DAYS && f.overdueAmount > 0) {
      add(id, { type: 'overdue', days: f.daysOverdue, amount: f.overdueAmount, text: `Payment overdue ${f.daysOverdue} days (${inr(f.overdueAmount)})` });
    }
  }
  for (const id of kpiClients) {
    for (const m of await kpiMisses(id, now)) {
      add(id, { type: 'kpi', platform: m.platform, months: m.months, text: `${m.platform} KPI off target ${m.months.join(' & ')}` });
    }
  }
  for (const c of flagged) {
    add(c._id, {
      type: 'manual', text: `Flagged: ${c.riskFlag.reason || 'no reason given'}`, reason: c.riskFlag.reason || '',
      by: c.riskFlag.flaggedByName || '', at: c.riskFlag.flaggedAt || null,
    });
  }
  return out;
}

module.exports = { riskReasons, kpiMisses, kpiWindow, OVERDUE_DAYS, KPI_MONTHS };
