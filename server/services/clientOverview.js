// What a client sees first when they log in: a client-safe summary across
// billing, projects, retainer hours, support and strategy. Everything is read
// for ONE client and limited to fields the client portal already exposes —
// no internal notes, costs, team or authorship.
const Invoice = require('../models/Invoice');
const Project = require('../models/Project');
const Retainer = require('../models/Retainer');
const SupportTicket = require('../models/SupportTicket');
const PaymentProof = require('../models/PaymentProof');
const finance = require('./finance');
const WorkLog = require('../models/WorkLog');
const { attachUsage, usageWindow, monthBounds } = require('./retainerUsage');
const { latestSharedFor } = require('./strategy');
const kycService = require('./kyc');
const Client = require('../models/Client');

const OPEN_TICKET = ['Open', 'In Progress', 'Pending Client'];
const DAY_MS = 24 * 60 * 60 * 1000;

/** The first milestone still to do, earliest target date first (undated ones last). */
function nextMilestone(milestones = []) {
  const todo = milestones.filter((m) => m.status !== 'Completed');
  todo.sort((a, b) => {
    const da = a.targetDate ? new Date(a.targetDate).getTime() : Infinity;
    const db = b.targetDate ? new Date(b.targetDate).getTime() : Infinity;
    return da - db || (a.order || 0) - (b.order || 0);
  });
  const m = todo[0];
  return m ? { title: m.title, status: m.status, targetDate: m.targetDate || null } : null;
}

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const pad = (n) => String(n).padStart(2, '0');
const localDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

/**
 * Billable hours per day for the month so far, with the running total — the
 * pacing line against the included hours. One entry per day from the 1st to
 * `now` (future days are not drawn). Logs are bucketed by the server's local
 * calendar day, the same clock the month window uses.
 * @param logs  [{ date, duration (minutes) }]
 */
function dailyHoursSeries(logs, now = new Date()) {
  const { start, end } = monthBounds(now);
  const perDay = new Map();
  for (const l of logs) {
    const k = localDay(new Date(l.date));
    perDay.set(k, (perDay.get(k) || 0) + (Number(l.duration) || 0));
  }
  const days = [];
  let cumulative = 0;
  for (let d = new Date(start); d <= end && d <= now; d.setDate(d.getDate() + 1)) {
    const hours = r2((perDay.get(localDay(d)) || 0) / 60);
    cumulative = r2(cumulative + hours);
    days.push({ day: d.getDate(), date: localDay(d), hours, cumulative });
  }
  return { days, totalDays: end.getDate() };
}

/**
 * Money per month for the last `count` months (oldest first), summed from
 * `rows` ([{ date, amount }]) into local calendar months. Months with no
 * activity are kept as zero so the axis never skips a month.
 */
function monthlyTotals(rows, count = 6, now = new Date()) {
  const months = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: monthKey(d), label: d.toLocaleString('en-IN', { month: 'short' }), year: d.getFullYear(), total: 0 });
  }
  const byKey = new Map(months.map((m) => [m.key, m]));
  for (const r of rows) {
    const m = r.date && byKey.get(monthKey(new Date(r.date)));
    if (m) m.total += Number(r.amount) || 0;
  }
  return months.map((m) => ({ ...m, total: r2(m.total) }));
}

/**
 * Things that need the client's attention, most urgent first. Pure so the
 * rules can be tested without a database.
 */
function buildActions({ billing, tickets, retainer, kyc, hold }) {
  const actions = [];
  if (hold) {
    actions.push({ key: 'account-hold', tone: 'danger', tab: 'billing', title: 'Your account is on hold', detail: hold.reason || 'Please clear any pending payment or contact us to resume service' });
  }
  if (billing.overdueInvoices > 0) {
    actions.push({ key: 'overdue', tone: 'danger', tab: 'billing', title: `${billing.overdueInvoices} overdue invoice${billing.overdueInvoices > 1 ? 's' : ''}`, detail: `${billing.overdueAmount} overdue — please arrange payment` });
  }
  if (kyc?.status === 'action_needed') {
    const n = kyc.rejected.length;
    actions.push({ key: 'kyc-rejected', tone: 'danger', tab: 'kyc', title: `${n} KYC document${n > 1 ? 's' : ''} need${n > 1 ? '' : 's'} changes`, detail: 'Upload them again to finish verifying your business' });
  }
  if (tickets.awaitingClient > 0) {
    actions.push({ key: 'ticket-reply', tone: 'warn', tab: 'support', title: `${tickets.awaitingClient} support ticket${tickets.awaitingClient > 1 ? 's' : ''} waiting for your reply`, detail: 'Our team needs your input to continue' });
  }
  if (billing.nextDue && billing.nextDue.daysUntilDue <= 7 && !billing.overdueInvoices) {
    actions.push({ key: 'due-soon', tone: 'warn', tab: 'billing', title: `Invoice ${billing.nextDue.invoiceId} due ${billing.nextDue.daysUntilDue <= 0 ? 'today' : `in ${billing.nextDue.daysUntilDue} day${billing.nextDue.daysUntilDue > 1 ? 's' : ''}`}`, detail: `${billing.nextDue.balance} to pay` });
  }
  if (billing.pendingProofs > 0) {
    actions.push({ key: 'proof-pending', tone: 'info', tab: 'billing', title: `${billing.pendingProofs} payment proof${billing.pendingProofs > 1 ? 's' : ''} awaiting verification`, detail: 'We will confirm as soon as it is checked' });
  }
  if (kyc && kyc.status !== 'action_needed' && kyc.missing.length > 0) {
    actions.push({
      key: 'kyc-missing', tone: 'info', tab: 'kyc',
      title: kyc.status === 'not_started' ? 'Complete your KYC' : `${kyc.missing.length} KYC item${kyc.missing.length > 1 ? 's' : ''} still to submit`,
      detail: 'GST, PAN, Aadhaar and a photo are needed to verify your business',
    });
  }
  if (retainer?.hoursOverage > 0) {
    actions.push({ key: 'hours-over', tone: 'warn', tab: 'retainers', title: `${retainer.hoursOverage}h over your included hours this month`, detail: retainer.packageName });
  }
  if (retainer?.isNearingExpiry) {
    actions.push({ key: 'renewal', tone: 'info', tab: 'retainers', title: 'Your retainer is nearing its end date', detail: retainer.packageName });
  }
  return actions;
}

async function buildOverview(clientId, now = new Date()) {
  const [{ perClient }, unpaid, pendingProofs, projects, retainers, tickets, strategy, kycDoc, clientDoc] = await Promise.all([
    finance.portfolioFinance({ clientIds: [clientId], now }),
    Invoice.find({ client_ref: clientId, paymentStatus: { $ne: 'Paid' }, $expr: { $gt: ['$totalAmount', '$paidAmount'] } })
      .select('-notes').sort({ dueDate: 1 }).limit(20).lean(),
    PaymentProof.countDocuments({ client_ref: clientId, status: 'Pending' }),
    Project.find({ client_ref: clientId, status: { $in: ['Active', 'On Hold'] } })
      .select('projectId projectName status overallProgress expectedEndDate milestones.title milestones.status milestones.targetDate milestones.order')
      .sort({ updatedAt: -1 }).limit(4).lean(),
    Retainer.find({ client_ref: clientId, status: 'Active' }).select('-renewalNotes').sort({ createdAt: -1 }).lean({ virtuals: true }),
    SupportTicket.find({ client_ref: clientId, status: { $in: OPEN_TICKET } })
      .select('ticketId subject status priority slaDeadline updatedAt').sort({ updatedAt: -1 }).limit(20).lean(),
    latestSharedFor(clientId),
    kycService.findOrBlank(clientId),
    Client.findById(clientId).select('serviceStatus holdReason holdSince').lean(),
  ]);

  const fin = perClient.get(String(clientId)) || { outstanding: 0, overdueAmount: 0, overdueInvoices: 0, received: 0, billed: 0, collectionPercent: null };
  const next = unpaid.find((i) => !finance.isOverdue(i, now)) || null;
  const billing = {
    outstanding: fin.outstanding,
    overdueAmount: fin.overdueAmount,
    overdueInvoices: fin.overdueInvoices,
    oldestOverdueDays: fin.daysOverdue,
    pendingProofs,
    nextDue: next && next.dueDate ? {
      invoiceId: next.invoiceId,
      dueDate: next.dueDate,
      balance: finance.invoiceBalance(next),
      daysUntilDue: Math.ceil((new Date(next.dueDate).getTime() - now.getTime()) / DAY_MS),
    } : null,
  };

  const [retainerWithUsage] = await attachUsage(retainers.slice(0, 1), now);
  const retainer = retainerWithUsage ? {
    packageName: retainerWithUsage.packageName,
    included: retainerWithUsage.supportHoursPerMonth,
    used: retainerWithUsage.hoursUsedThisMonth,
    remaining: retainerWithUsage.hoursRemaining,
    hoursOverage: retainerWithUsage.hoursOverage,
    contractEndDate: retainerWithUsage.contractEndDate,
    isNearingExpiry: !!retainerWithUsage.isNearingExpiry,
    activeCount: retainers.length,
  } : null;

  const ticketSummary = {
    open: tickets.length,
    awaitingClient: tickets.filter((t) => t.status === 'Pending Client').length,
    recent: tickets.slice(0, 3).map((t) => ({ _id: t._id, ticketId: t.ticketId, subject: t.subject, status: t.status, priority: t.priority })),
  };

  // ── Chart data ───────────────────────────────────────────────────────────
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const window = retainers[0] ? usageWindow(retainers[0], now) : null;
  const [issued, collected, hourLogs] = await Promise.all([
    Invoice.find({ client_ref: clientId, issueDate: { $gte: sixMonthsAgo } }).select('issueDate totalAmount').lean(),
    PaymentProof.find({ client_ref: clientId, status: 'Approved', verifiedAt: { $gte: sixMonthsAgo } }).select('verifiedAt amountPaid').lean(),
    window
      ? WorkLog.find({ client_ref: clientId, isBillable: true, date: { $gte: window.start, $lte: window.end } }).select('date duration').lean()
      : [],
  ]);
  const invoiced = monthlyTotals(issued.map((i) => ({ date: i.issueDate, amount: i.totalAmount })), 6, now);
  const paid = monthlyTotals(collected.map((c) => ({ date: c.verifiedAt, amount: c.amountPaid })), 6, now);
  const charts = {
    billingTrend: invoiced.map((m, i) => ({ key: m.key, label: m.label, year: m.year, invoiced: m.total, paid: paid[i].total })),
    hoursTrend: retainer && retainerWithUsage.hoursSource === 'worklogs'
      ? { included: retainer.included, ...dailyHoursSeries(hourLogs, now) }
      : null,
  };

  const kycSummary = kycService.overall(kycDoc);

  return {
    charts,
    billing,
    projects: projects.map((p) => ({
      _id: p._id, projectId: p.projectId, projectName: p.projectName, status: p.status,
      progress: p.overallProgress || 0, expectedEndDate: p.expectedEndDate || null, nextMilestone: nextMilestone(p.milestones),
      milestonesDone: (p.milestones || []).filter((m) => m.status === 'Completed').length,
      milestonesTotal: (p.milestones || []).length,
    })),
    retainer,
    tickets: ticketSummary,
    strategy: strategy ? { version: strategy.version, sharedAt: strategy.sharedAt || strategy.updatedAt } : null,
    kyc: kycSummary,
    account: { serviceStatus: clientDoc?.serviceStatus || 'Active', holdReason: clientDoc?.serviceStatus === 'Hold' ? clientDoc.holdReason || '' : null, holdSince: clientDoc?.holdSince || null },
    actions: buildActions({ hold: clientDoc?.serviceStatus === 'Hold' ? { reason: clientDoc.holdReason } : null, kyc: kycSummary, billing: { ...billing, overdueAmount: formatInr(billing.overdueAmount), nextDue: billing.nextDue && { ...billing.nextDue, balance: formatInr(billing.nextDue.balance) } }, tickets: ticketSummary, retainer }),
  };
}

const formatInr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

module.exports = { buildOverview, buildActions, nextMilestone, dailyHoursSeries, monthlyTotals };
