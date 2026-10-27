// Financial Overview (Admin → Financial Overview): revenue, collections, clients, ad spend and
// operations on one page. Every figure is derived from the records; definitions agreed with the
// client (Oct 2026):
//   Total client revenue  taxable value (excl. GST) of invoices sent in the period
//   Revenue by service    the same, split by each invoice line's service; lines without one = "Unassigned"
//   Revenue collected     verified payments dated in the period (incl. GST)
//   Outstanding           unpaid balance of sent invoices today
//   MRR                   active clients' active recurring retainers (monthly equivalent)
//   New clients           onboarding date in the period (clients without one are listed apart)
//   Ad spend managed      actual spend in the ad data; the planned budget is shown apart
//                         (KPI setup budget history per platform, else the profile's monthly ad budget)
//   Campaigns live        campaigns the team marked Active (services/campaigns.js)
//   Clients at risk       services/clientRisk.js — overdue > 7 days, KPI off target 2 months, or flagged
//   Clients by status     each client in one group: At Risk, else Onboarding (a launch stage), else
//                         Active, else Inactive (inactive / on hold / suspended / offboarded)
const Invoice = require('../models/Invoice');
const PaymentProof = require('../models/PaymentProof');
const AdPerformance = require('../models/AdPerformance');
const KpiSetup = require('../models/KpiSetup');
const Employee = require('../models/Employee');
const { buildPortfolio } = require('./portfolio');
const { riskReasons } = require('./clientRisk');
const { campaignCounts } = require('./campaigns');
const { plannedBudget, budgetForMonth } = require('./kpi');
const { getServiceList, UNASSIGNED } = require('./serviceCatalog');

const ONBOARDING_STAGES = [
  'Pending Onboarding', 'Awaiting Payment', 'Awaiting Agreement', 'KYC Pending', 'Access / Setup Pending',
  'Strategy / Approval Pending', 'Ready to Launch',
];
const STATUS_GROUPS = ['Active', 'Onboarding', 'Inactive', 'At Risk'];
const MAX_DAYS = 366;

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseDay(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v || ''));
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getMonth() === Number(m[2]) - 1 ? d : null;
}
const endOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

/**
 * The period before [from, to] to compare with. A range starting on the 1st compares with the same
 * days of the month(s) before (1–27 Oct ↔ 1–27 Sep; a whole quarter ↔ the quarter before);
 * any other range with the same number of days just before it.
 */
function previousPeriod(from, to) {
  if (from.getDate() === 1) {
    const months = (to.getFullYear() - from.getFullYear()) * 12 + to.getMonth() - from.getMonth() + 1;
    const pFrom = new Date(from.getFullYear(), from.getMonth() - months, 1);
    const lastOfPrevTo = new Date(to.getFullYear(), to.getMonth() - months + 1, 0);
    const pTo = new Date(lastOfPrevTo.getFullYear(), lastOfPrevTo.getMonth(), Math.min(to.getDate(), lastOfPrevTo.getDate()));
    return { from: pFrom, to: pTo };
  }
  const span = Math.round((to - from) / 86400000) + 1;
  return { from: new Date(from.getFullYear(), from.getMonth(), from.getDate() - span), to: new Date(from.getFullYear(), from.getMonth(), from.getDate() - 1) };
}

const change = (now, before) => (before > 0 ? r2(((now - before) / before) * 100) : null);

/** Revenue (excl. GST) of sent invoices in a period, per service and per client. */
async function revenueIn(clientIds, from, to, service) {
  const invoices = await Invoice.find({ client_ref: { $in: clientIds }, unsent: { $ne: true }, issueDate: { $gte: from, $lte: endOf(to) } })
    .select('client_ref lineItems').lean();
  const byService = new Map();
  const byClient = new Map();
  let total = 0;
  let unassignedLines = 0;
  for (const inv of invoices) {
    for (const li of inv.lineItems || []) {
      const name = li.service || UNASSIGNED;
      if (service && name !== service) continue;
      const amount = Number(li.amount) || 0;
      byService.set(name, r2((byService.get(name) || 0) + amount));
      byClient.set(String(inv.client_ref), r2((byClient.get(String(inv.client_ref)) || 0) + amount));
      if (!li.service) unassignedLines += 1;
      total += amount;
    }
  }
  return { total: r2(total), byService, byClient, unassignedLines };
}

async function collectedIn(clientIds, from, to) {
  const rows = await PaymentProof.aggregate([
    { $match: { client_ref: { $in: clientIds }, status: 'Approved', paymentDate: { $gte: from, $lte: endOf(to) } } },
    { $group: { _id: '$client_ref', amount: { $sum: '$amountPaid' } } },
  ]);
  const byClient = new Map(rows.map((r) => [String(r._id), r2(r.amount)]));
  return { total: r2(rows.reduce((s, r) => s + r.amount, 0)), byClient };
}

async function adSpendIn(clientIds, from, to) {
  const rows = await AdPerformance.aggregate([
    { $match: { client_ref: { $in: clientIds }, day: { $gte: ymd(from), $lte: ymd(to) } } },
    { $group: { _id: '$platform', spend: { $sum: '$spend' } } },
  ]);
  const byPlatform = rows.map((r) => ({ platform: r._id, spend: r2(r.spend) })).sort((a, b) => b.spend - a.spend);
  return { total: r2(byPlatform.reduce((s, r) => s + r.spend, 0)), byPlatform };
}

/** Planned ad budget for the period: each KPI setup's budget history; clients without one use the profile budget. */
async function plannedAdBudget(rows, from, to) {
  const ids = rows.map((r) => r._id);
  const setups = await KpiSetup.find({ client_ref: { $in: ids } }).select('client_ref monthlyBudget budgetHistory').lean();
  const withSetup = new Set(setups.map((s) => String(s.client_ref)));
  let fromSetups = 0;
  for (const s of setups) fromSetups += plannedBudget((month) => budgetForMonth(s, month), ymd(from), ymd(to));
  let fromProfiles = 0;
  let profileClients = 0;
  for (const r of rows) {
    if (withSetup.has(String(r._id))) continue;
    const budget = Number(r.profile?.monthlyAdBudget) || 0;
    if (budget > 0) { fromProfiles += plannedBudget(budget, ymd(from), ymd(to)); profileClients += 1; }
  }
  return { total: r2(fromSetups + fromProfiles), fromKpiSetups: r2(fromSetups), fromProfiles: r2(fromProfiles), clientsUsingProfileBudget: profileClients };
}

/** Status group of one portfolio row (see the header). */
function groupOf(row, atRisk) {
  if (atRisk) return 'At Risk';
  if (row.state === 'active' && ONBOARDING_STAGES.includes(row.stage)) return 'Onboarding';
  if (row.state === 'active') return 'Active';
  return 'Inactive';
}

const invoiceStatus = (inv, now) => {
  const owed = (inv.totalAmount || 0) - (inv.creditedAmount || 0);
  if (inv.paymentStatus === 'Paid' || (inv.paidAmount || 0) >= owed) return 'Paid';
  if ((inv.paidAmount || 0) > 0) return 'Partial';
  return new Date(inv.dueDate) < now ? 'Overdue' : 'Unpaid';
};

/**
 * @param opts { from, to: 'YYYY-MM-DD', clientIds (scope), status ('all'|'active'|'onboarding'|'inactive'|'at-risk'),
 *               service, client }
 */
async function buildOverview(opts = {}, now = new Date()) {
  const from = parseDay(opts.from);
  const to = parseDay(opts.to);
  if (!from || !to || to < from) return { error: 'Choose a valid date range.' };
  if ((to - from) / 86400000 + 1 > MAX_DAYS) return { error: `A range can cover up to ${MAX_DAYS} days.` };

  const portfolio = await buildPortfolio({ clientIds: opts.clientIds, status: 'all' }, now);
  const all = portfolio.rows.filter((r) => r.state !== 'archived');
  const finance = new Map(all.map((r) => [String(r._id), r.finance]));
  const risk = await riskReasons(all.map((r) => r._id), { finance, now });
  for (const r of all) {
    r.riskReasons = risk.get(String(r._id)) || [];
    r.group = groupOf(r, r.riskReasons.length > 0);
  }

  // Filters: status group, a service on the client's profile, one client
  const service = opts.service && opts.service !== 'all' ? String(opts.service) : null;
  const statusKey = { active: 'Active', onboarding: 'Onboarding', inactive: 'Inactive', 'at-risk': 'At Risk' }[opts.status];
  let rows = all;
  if (statusKey) rows = rows.filter((r) => r.group === statusKey);
  if (service && service !== UNASSIGNED) rows = rows.filter((r) => (r.profile?.services || []).includes(service));
  if (opts.client && opts.client !== 'all') rows = rows.filter((r) => String(r._id) === String(opts.client));
  const ids = rows.map((r) => r._id);
  const prev = previousPeriod(from, to);

  const [rev, revPrev, col, colPrev, ads, adsPrev, planned, campaigns, services] = await Promise.all([
    revenueIn(ids, from, to, service),
    revenueIn(ids, prev.from, prev.to, service),
    collectedIn(ids, from, to),
    collectedIn(ids, prev.from, prev.to),
    adSpendIn(ids, from, to),
    adSpendIn(ids, prev.from, prev.to),
    plannedAdBudget(rows, from, to),
    campaignCounts(ids),
    getServiceList(),
  ]);

  const inRange = (d, a, b) => d && new Date(d) >= a && new Date(d) <= endOf(b);
  const newClients = rows.filter((r) => inRange(r.profile?.onboardingDate, from, to));
  const newPrev = rows.filter((r) => inRange(r.profile?.onboardingDate, prev.from, prev.to)).length;
  const missingOnboardingDate = rows.filter((r) => !r.profile?.onboardingDate)
    .map((r) => ({ _id: r._id, clientId: r.clientId, businessName: r.businessName }));

  const overdueTasks = await Employee.aggregate([
    { $unwind: '$tasks' },
    { $match: { 'tasks.dueDate': { $lt: now }, 'tasks.status': { $nin: ['Completed', 'Cancelled'] } } },
    { $count: 'n' },
  ]);

  // Trend: the 6 months ending with the selected period's last month
  const trend = [];
  for (let i = 5; i >= 0; i -= 1) {
    const mFrom = new Date(to.getFullYear(), to.getMonth() - i, 1);
    const mTo = new Date(to.getFullYear(), to.getMonth() - i + 1, 0);
    trend.push({ month: `${mFrom.getFullYear()}-${pad(mFrom.getMonth() + 1)}`, label: `${MONTH[mFrom.getMonth()]} ${mFrom.getFullYear()}`, from: mFrom, to: mTo });
  }
  const trendRows = await Promise.all(trend.map(async (m) => {
    const [r, c, inv] = await Promise.all([
      revenueIn(ids, m.from, m.to, service),
      collectedIn(ids, m.from, m.to),
      Invoice.find({ client_ref: { $in: ids }, unsent: { $ne: true }, issueDate: { $gte: m.from, $lte: endOf(m.to) } })
        .select('totalAmount creditedAmount paidAmount').lean(),
    ]);
    // Still unpaid today on the invoices issued that month (incl. GST)
    const outstanding = inv.reduce((s, x) => s + Math.max(0, (x.totalAmount || 0) - (x.creditedAmount || 0) - (x.paidAmount || 0)), 0);
    return { month: m.month, label: m.label, invoiced: r.total, collected: c.total, outstanding: r2(outstanding) };
  }));

  const recent = await Invoice.find({ client_ref: { $in: ids }, unsent: { $ne: true } })
    .sort({ issueDate: -1, createdAt: -1 }).limit(5)
    .select('invoiceId client_ref totalAmount creditedAmount paidAmount paymentStatus dueDate issueDate').lean();
  const nameOf = new Map(rows.map((r) => [String(r._id), r]));

  const counts = Object.fromEntries(STATUS_GROUPS.map((g) => [g, rows.filter((r) => r.group === g).length]));
  const total = rows.length;

  return {
    period: { from: ymd(from), to: ymd(to), previousFrom: ymd(prev.from), previousTo: ymd(prev.to) },
    generatedAt: now,
    cards: {
      totalClients: total,
      activeClients: counts.Active,
      newClients: { value: newClients.length, change: change(newClients.length, newPrev), previous: newPrev },
      totalRevenue: { value: rev.total, change: change(rev.total, revPrev.total), previous: revPrev.total },
      mrr: r2(rows.filter((r) => r.state === 'active').reduce((s, r) => s + (r.monthlyRecurringFee || 0), 0)),
      collected: { value: col.total, change: change(col.total, colPrev.total), previous: colPrev.total },
      outstanding: r2(rows.reduce((s, r) => s + (r.finance?.outstanding || 0), 0)),
      overdue: r2(rows.reduce((s, r) => s + (r.finance?.overdueAmount || 0), 0)),
      adSpend: { value: ads.total, change: change(ads.total, adsPrev.total), previous: adsPrev.total },
      plannedAdBudget: planned,
      campaigns,
      pendingOnboarding: counts.Onboarding,
      tasksOverdue: overdueTasks[0]?.n || 0,
      atRisk: counts['At Risk'],
    },
    trend: trendRows,
    revenueByService: [...rev.byService.entries()].map(([name, amount]) => ({ service: name, amount }))
      .sort((a, b) => (a.service === UNASSIGNED) - (b.service === UNASSIGNED) || b.amount - a.amount),
    unassigned: { amount: rev.byService.get(UNASSIGNED) || 0, lines: rev.unassignedLines },
    adSpendByPlatform: ads.byPlatform,
    topClients: [...rev.byClient.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, revenue]) => {
      const r = nameOf.get(id);
      return { _id: id, clientId: r?.clientId, businessName: r?.businessName, revenue, collected: col.byClient.get(id) || 0, outstanding: r?.finance?.outstanding || 0, group: r?.group };
    }),
    recentInvoices: recent.map((inv) => ({
      _id: inv._id, invoiceId: inv.invoiceId, client: nameOf.get(String(inv.client_ref))?.businessName || '',
      amount: inv.totalAmount, status: invoiceStatus(inv, now), dueDate: inv.dueDate, issueDate: inv.issueDate,
    })),
    clientsByStatus: STATUS_GROUPS.map((g) => ({ status: g, count: counts[g], percent: total ? r2((counts[g] / total) * 100) : 0 })),
    atRiskClients: rows.filter((r) => r.group === 'At Risk').map((r) => ({ _id: r._id, clientId: r.clientId, businessName: r.businessName, reasons: r.riskReasons })),
    newClientList: newClients.map((r) => ({ _id: r._id, clientId: r.clientId, businessName: r.businessName, onboardingDate: r.profile.onboardingDate })),
    missingOnboardingDate,
    filterOptions: {
      services: [...services, UNASSIGNED],
      clients: all.map((r) => ({ _id: r._id, clientId: r.clientId, businessName: r.businessName })).sort((a, b) => a.businessName.localeCompare(b.businessName)),
      statuses: ['all', 'active', 'onboarding', 'inactive', 'at-risk'],
    },
  };
}

module.exports = { buildOverview, previousPeriod, groupOf, ONBOARDING_STAGES };
