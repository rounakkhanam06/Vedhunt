// Client portfolio (Client Portal CRM §2): one row per client with fee,
// collection and defaulter figures derived from the linked retainers and
// invoices — never from a hand-maintained summary — plus the KPI cards.
const Client = require('../models/Client');
const Retainer = require('../models/Retainer');
const PaymentProof = require('../models/PaymentProof');
const { portfolioFinance, round2 } = require('./finance');

// Monthly-equivalent of a retainer's amount, so quarterly/annual plans rank
// fairly against monthly ones.
const CYCLE_MONTHS = { Monthly: 1, Quarterly: 3, Annual: 12 };
const monthlyEquivalent = (r) => (Number(r.monthlyAmount) || 0) / (CYCLE_MONTHS[r.billingCycle] || 1);

/** 'active' | 'inactive' | 'archived' from the client's real flags (never inferred from ad spend). */
const clientState = (c) => {
  if (c.deletedAt) return 'archived';
  if (!c.isActive) return 'inactive';
  return c.serviceStatus === 'Hold' ? 'hold' : 'active';
};

async function recurringFees(clientIds) {
  const retainers = await Retainer.find({ client_ref: { $in: clientIds }, status: 'Active' }, 'client_ref monthlyAmount billingCycle').lean();
  const fees = new Map();
  for (const r of retainers) {
    const k = String(r.client_ref);
    fees.set(k, round2((fees.get(k) || 0) + monthlyEquivalent(r)));
  }
  return fees;
}

/** Collected revenue per client from verified payments inside [from, to]. */
async function collectedRevenue(clientIds, from, to) {
  const rows = await PaymentProof.aggregate([
    { $match: { client_ref: { $in: clientIds }, status: 'Approved', verifiedAt: { $gte: from, $lte: to } } },
    { $group: { _id: '$client_ref', collected: { $sum: '$amountPaid' } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), round2(r.collected)]));
}

const SORTS = {
  // Highest recurring fee first; clients with no active plan sort last
  fee: (a, b) => (b.monthlyRecurringFee ?? -1) - (a.monthlyRecurringFee ?? -1),
  name: (a, b) => a.businessName.localeCompare(b.businessName),
  outstanding: (a, b) => b.finance.outstanding - a.finance.outstanding,
  overdue: (a, b) => b.finance.daysOverdue - a.finance.daysOverdue,
  newest: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
};

/**
 * @param opts.clientIds   restrict to these clients (person-wise grants); undefined = all
 * @param opts.status      'all' | 'active' | 'inactive' | 'archived' (default: every non-archived client)
 * @param opts.sector / opts.service / opts.accountManager / opts.billing ('overdue'|'outstanding'|'clear')
 * @param opts.sort        key of SORTS (default 'fee')
 * @param opts.search      business / contact name, email or client ID substring
 * @param opts.revenueFrom / opts.revenueTo   period for "top clients by revenue" (default: this month, partial)
 */
async function buildPortfolio(opts = {}, now = new Date()) {
  const base = {};
  if (opts.clientIds) base._id = { $in: opts.clientIds };

  const allClients = await Client.find(base,
    'clientId businessName contactName email phone isActive deletedAt createdAt profile serviceStatus holdReason holdSince')
    .populate('profile.accountManager', 'firstName lastName')
    .lean();

  const ids = allClients.map((c) => c._id);
  const [fees, { perClient, totals }] = await Promise.all([recurringFees(ids), portfolioFinance({ clientIds: ids, now })]);

  const emptyFin = { billed: 0, received: 0, outstanding: 0, overdueAmount: 0, overdueInvoices: 0, oldestOverdueDue: null, daysOverdue: 0, collectionPercent: null };
  const rows = allClients.map((c) => {
    const k = String(c._id);
    const fin = perClient.get(k) || emptyFin;
    const manager = c.profile?.accountManager;
    return {
      _id: c._id,
      clientId: c.clientId,
      businessName: c.businessName,
      contactName: c.contactName,
      email: c.email,
      phone: c.phone,
      createdAt: c.createdAt,
      state: clientState(c),
      holdReason: c.serviceStatus === 'Hold' ? c.holdReason || '' : undefined,
      holdSince: c.serviceStatus === 'Hold' ? c.holdSince : undefined,
      profile: { ...(c.profile || {}), accountManager: manager?._id || null },
      accountManagerName: manager ? [manager.firstName, manager.lastName].filter(Boolean).join(' ') : null,
      teamSize: (c.profile?.dedicatedTeam || []).length,
      monthlyRecurringFee: fees.has(k) ? fees.get(k) : null, // null = no active recurring plan ("--")
      finance: fin,
      isDefaulter: fin.overdueInvoices > 0,
    };
  });

  // KPI cards cover the whole (scoped) portfolio regardless of the table filters
  const kpis = {
    totalClients: rows.filter((r) => r.state !== 'archived').length,
    activeClients: rows.filter((r) => r.state === 'active').length,
    inactiveClients: rows.filter((r) => r.state === 'inactive').length,
    holdClients: rows.filter((r) => r.state === 'hold').length,
    archivedClients: rows.filter((r) => r.state === 'archived').length,
    // Active clients' active recurring plans only; one-time fees are excluded
    monthlyRecurringRevenue: round2(rows.filter((r) => r.state === 'active').reduce((s, r) => s + (r.monthlyRecurringFee || 0), 0)),
    outstandingReceivables: totals.outstanding,
    overdueReceivables: totals.overdueAmount,
    paymentDefaulters: rows.filter((r) => r.isDefaulter && r.state !== 'archived').length,
    collectionPercent: totals.collectionPercent,
  };

  // Top clients by revenue actually collected in the period (not invoice value)
  const revenueTo = opts.revenueTo || now;
  const revenueFrom = opts.revenueFrom || new Date(now.getFullYear(), now.getMonth(), 1);
  const collected = await collectedRevenue(ids, revenueFrom, revenueTo);
  const byId = new Map(rows.map((r) => [String(r._id), r]));
  const topByRevenue = [...collected.entries()]
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([id, amount]) => ({ _id: id, clientId: byId.get(id)?.clientId, businessName: byId.get(id)?.businessName, collected: amount }));

  // Table filters
  let list = rows;
  const status = opts.status || 'default';
  if (status === 'default') list = list.filter((r) => r.state !== 'archived');
  else if (status !== 'all') list = list.filter((r) => r.state === status);
  if (opts.sector) list = list.filter((r) => (r.profile.sectors || []).includes(opts.sector));
  if (opts.service) list = list.filter((r) => (r.profile.services || []).includes(opts.service));
  if (opts.accountManager) list = list.filter((r) => String(r.profile.accountManager || '') === String(opts.accountManager));
  if (opts.billing === 'overdue') list = list.filter((r) => r.isDefaulter);
  else if (opts.billing === 'outstanding') list = list.filter((r) => r.finance.outstanding > 0);
  else if (opts.billing === 'clear') list = list.filter((r) => r.finance.outstanding === 0);
  if (opts.search) {
    const q = String(opts.search).toLowerCase();
    list = list.filter((r) => [r.businessName, r.contactName, r.email, r.clientId].some((v) => String(v || '').toLowerCase().includes(q)));
  }

  // Ties broken by name so the order is stable between requests
  const cmp = SORTS[opts.sort] || SORTS.fee;
  list = [...list].sort((a, b) => cmp(a, b) || a.businessName.localeCompare(b.businessName));

  return { kpis, topByRevenue, revenuePeriod: { from: revenueFrom, to: revenueTo }, rows: list };
}

module.exports = { buildPortfolio, monthlyEquivalent, clientState, SORTS };
