const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const onboarding = require('../services/onboarding');
const { usageWindow, monthBounds } = require('../services/retainerUsage');
const { sanitizeProfile, profileDateErrors } = require('../services/clientProfile');
const { monthlyEquivalent, clientState } = require('../services/portfolio');
const { buildActions, nextMilestone, dailyHoursSeries, monthlyTotals } = require('../services/clientOverview');
const { EVENTS, mergePolicy } = require('../services/clientEmailPolicy');
const policies = require('../services/clientPolicies');
const bs = require('../services/billingSchedule');

const NOW = new Date('2026-10-26T10:00:00Z');
const keys = (scope) => onboarding.applicableTemplate(scope).map((t) => t.key);

describe('onboarding — steps follow the services and platforms', () => {
  test('a Meta-only performance client gets no Google steps', () => {
    const k = keys({ services: ['Performance Marketing'], platforms: ['Meta'] });
    assert.ok(k.includes('meta_access') && k.includes('meta_pixel_capi') && k.includes('test_events_removed'));
    assert.ok(!k.includes('google_ads_access') && !k.includes('google_tracking'));
  });
  test('a Google-only client gets no Meta steps', () => {
    const k = keys({ services: ['Performance Marketing'], platforms: ['Google Ads'] });
    assert.ok(k.includes('google_ads_access') && k.includes('google_tracking'));
    assert.ok(!k.includes('meta_access') && !k.includes('meta_pixel_capi') && !k.includes('test_events_removed'));
  });
  test('a website-only client gets contract, payment and website access but no ad steps', () => {
    const k = keys({ services: ['Website Development'], platforms: [] });
    assert.deepEqual(k, ['contract_signed', 'advance_payment', 'website_access']);
  });
  test('campaign_live is never a prerequisite step', () => {
    assert.ok(!onboarding.TEMPLATE.some((t) => t.key === 'campaign_live'));
  });
  test('syncing adds only missing steps and never touches existing ones', () => {
    const existing = [{ key: 'contract_signed', label: 'x', status: 'Completed' }];
    const add = onboarding.missingItems(existing, { services: ['Website Development'], platforms: [] });
    assert.deepEqual(add.map((i) => i.key), ['advance_payment', 'website_access']);
  });
});

const item = (o) => ({ key: 'k', label: 'Step', launchCritical: true, needsEvidence: false, status: 'Not Started', ...o });

describe('onboarding — go-live gate', () => {
  test('completed and not-applicable steps do not block', () => {
    assert.equal(onboarding.launchBlockers([item({ status: 'Completed' }), item({ status: 'Not Applicable' })]).length, 0);
  });
  test('names exactly which steps block and why', () => {
    const b = onboarding.launchBlockers([
      item({ key: 'a', label: 'A', status: 'Blocked', blocker: 'Client has not shared access' }),
      item({ key: 'b', label: 'B', status: 'In Progress' }),
      item({ key: 'c', label: 'C', status: 'Completed' }),
    ]);
    assert.deepEqual(b.map((x) => [x.key, x.reason]), [['a', 'Client has not shared access'], ['b', 'In progress']]);
  });
  test('goes live when nothing blocks', () => {
    assert.deepEqual(onboarding.evaluateGoLive([item({ status: 'Completed' })]), { allowed: true });
  });
  test('is refused with the blockers listed when steps are open', () => {
    const r = onboarding.evaluateGoLive([item({ key: 'a' })]);
    assert.equal(r.allowed, false);
    assert.equal(r.blockers[0].key, 'a');
  });
  test('an exception needs authority and a written reason', () => {
    const items = [item({ key: 'a' })];
    assert.equal(onboarding.evaluateGoLive(items, { exception: { reason: 'Client asked us to launch early' }, canAuthoriseException: false }).allowed, false);
    assert.equal(onboarding.evaluateGoLive(items, { exception: { reason: 'short' }, canAuthoriseException: true }).allowed, false);
    const ok = onboarding.evaluateGoLive(items, { exception: { reason: 'Client asked us to launch early' }, canAuthoriseException: true });
    assert.equal(ok.allowed, true);
    assert.deepEqual(ok.exception.waivedItems, ['a']);
  });
  test('overdue only counts unfinished steps with a past due date', () => {
    assert.equal(onboarding.isItemOverdue(item({ dueDate: '2026-10-01' }), NOW), true);
    assert.equal(onboarding.isItemOverdue(item({ dueDate: '2026-10-01', status: 'Completed' }), NOW), false);
    assert.equal(onboarding.isItemOverdue(item({ dueDate: '2026-11-01' }), NOW), false);
    assert.equal(onboarding.isItemOverdue(item({}), NOW), false);
  });
});

describe('onboarding — step updates are validated', () => {
  test('Not Applicable needs a reason', () => {
    assert.ok(onboarding.validateItemUpdate(item(), { status: 'Not Applicable' }).errors.length);
    assert.equal(onboarding.validateItemUpdate(item(), { status: 'Not Applicable', naReason: 'Client has no Meta' }).errors.length, 0);
  });
  test('Blocked needs to say what blocks it', () => {
    assert.ok(onboarding.validateItemUpdate(item(), { status: 'Blocked' }).errors.length);
    assert.equal(onboarding.validateItemUpdate(item(), { status: 'Blocked', blocker: 'Waiting for access' }).errors.length, 0);
  });
  test('an evidence step cannot be Completed with no link or remarks', () => {
    const it = item({ needsEvidence: true });
    assert.ok(onboarding.validateItemUpdate(it, { status: 'Completed' }).errors.length);
    assert.equal(onboarding.validateItemUpdate(it, { status: 'Completed', evidenceLink: 'https://x.test/proof' }).errors.length, 0);
    assert.equal(onboarding.validateItemUpdate(it, { status: 'Completed', remarks: 'Verified in Events Manager' }).errors.length, 0);
  });
  test('rejects unknown statuses and bad dates', () => {
    assert.ok(onboarding.validateItemUpdate(item(), { status: 'Done' }).errors.length);
    assert.ok(onboarding.validateItemUpdate(item(), { dueDate: 'not-a-date' }).errors.length);
  });
});

describe('retainer usage window', () => {
  test('a contract covering the month uses the whole month', () => {
    const w = usageWindow({ contractStartDate: '2026-01-01', contractEndDate: '2027-01-01' }, NOW);
    const m = monthBounds(NOW);
    assert.equal(w.start.getTime(), m.start.getTime());
    assert.equal(w.end.getTime(), m.end.getTime());
  });
  test('a contract starting mid-month only counts from its start', () => {
    const w = usageWindow({ contractStartDate: '2026-10-15T00:00:00Z', contractEndDate: '2027-10-14' }, NOW);
    assert.equal(w.start.toISOString(), '2026-10-15T00:00:00.000Z');
  });
  test('a contract that ended before this month has no window', () => {
    assert.equal(usageWindow({ contractStartDate: '2025-01-01', contractEndDate: '2026-09-30' }, NOW), null);
  });
});

describe('client profile validation', () => {
  test('only the sent keys are returned', () => {
    const { value, errors } = sanitizeProfile({ sectors: ' Retail , Fitness,Retail ' });
    assert.deepEqual(value, { sectors: ['Retail', 'Fitness'] });
    assert.equal(errors.length, 0);
  });
  test('domains are normalised and checked', () => {
    assert.deepEqual(sanitizeProfile({ domains: ['https://Mudgarvale.com/'] }).value.domains, ['mudgarvale.com']);
    assert.ok(sanitizeProfile({ domains: ['not a domain'] }).errors.length);
  });
  test('ad account cannot go live before onboarding', () => {
    assert.ok(profileDateErrors({ onboardingDate: '2026-06-04', adAccountLiveDate: '2026-05-26' }).length);
    assert.equal(profileDateErrors({ onboardingDate: '2026-05-26', adAccountLiveDate: '2026-06-04' }).length, 0);
  });
  test('budget must be a non-negative number; empty clears it', () => {
    assert.ok(sanitizeProfile({ monthlyAdBudget: -5 }).errors.length);
    assert.equal(sanitizeProfile({ monthlyAdBudget: '' }).value.monthlyAdBudget, null);
    assert.equal(sanitizeProfile({ monthlyAdBudget: '100000' }).value.monthlyAdBudget, 100000);
  });
  test('team members are de-duplicated and validated', () => {
    const id = '507f1f77bcf86cd799439011';
    const { value, errors } = sanitizeProfile({ dedicatedTeam: [{ employee: id, role: 'Performance Marketer' }, { employee: id }, { employee: 'bad' }] });
    assert.equal(value.dedicatedTeam.length, 1);
    assert.equal(errors.length, 1);
  });
});

describe('portfolio rules', () => {
  test('quarterly and annual fees are compared per month', () => {
    assert.equal(monthlyEquivalent({ monthlyAmount: 15000, billingCycle: 'Monthly' }), 15000);
    assert.equal(monthlyEquivalent({ monthlyAmount: 45000, billingCycle: 'Quarterly' }), 15000);
    assert.equal(monthlyEquivalent({ monthlyAmount: 180000, billingCycle: 'Annual' }), 15000);
  });
  test('client state comes from real flags, not activity', () => {
    assert.equal(clientState({ isActive: true }), 'active');
    assert.equal(clientState({ isActive: false }), 'inactive');
    assert.equal(clientState({ isActive: true, deletedAt: new Date() }), 'archived');
  });
});

describe('client overview — what needs attention', () => {
  const calm = { billing: { overdueInvoices: 0, overdueAmount: '₹0', nextDue: null, pendingProofs: 0 }, tickets: { awaitingClient: 0 }, retainer: null };
  const keys = (o) => buildActions({ ...calm, ...o }).map((a) => a.key);

  test('nothing to do shows no actions', () => assert.deepEqual(keys({}), []));
  test('overdue invoices come first and say how many', () => {
    const a = buildActions({ ...calm, billing: { ...calm.billing, overdueInvoices: 2, overdueAmount: '₹4,000' }, tickets: { awaitingClient: 1 } });
    assert.deepEqual(a.map((x) => x.key), ['overdue', 'ticket-reply']);
    assert.equal(a[0].tone, 'danger');
    assert.match(a[0].title, /2 overdue invoices/);
  });
  test('an invoice due within a week is flagged, but not on top of overdue ones', () => {
    const due = { invoiceId: 'VH-INV-1', daysUntilDue: 3, balance: '₹500' };
    assert.deepEqual(keys({ billing: { ...calm.billing, nextDue: due } }), ['due-soon']);
    assert.deepEqual(keys({ billing: { ...calm.billing, overdueInvoices: 1, overdueAmount: '₹1', nextDue: due } }), ['overdue']);
    assert.deepEqual(keys({ billing: { ...calm.billing, nextDue: { ...due, daysUntilDue: 20 } } }), []);
  });
  test('retainer overage and renewal are surfaced', () => {
    assert.deepEqual(keys({ retainer: { hoursOverage: 3, packageName: 'P', isNearingExpiry: true } }), ['hours-over', 'renewal']);
  });
  test('the next milestone is the earliest unfinished one', () => {
    const m = nextMilestone([
      { title: 'Done', status: 'Completed', targetDate: '2026-01-01' },
      { title: 'Later', status: 'Pending', targetDate: '2026-12-01' },
      { title: 'Soon', status: 'In Progress', targetDate: '2026-11-01' },
      { title: 'Undated', status: 'Pending' },
    ]);
    assert.equal(m.title, 'Soon');
    assert.equal(nextMilestone([{ title: 'x', status: 'Completed' }]), null);
  });
});

describe('client overview — chart data', () => {
  const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h);
  const now = at(2026, 10, 5);

  test('hours run day by day from the 1st to today, with a running total', () => {
    const { days, totalDays } = dailyHoursSeries([
      { date: at(2026, 10, 1), duration: 90 },
      { date: at(2026, 10, 1, 15), duration: 30 },
      { date: at(2026, 10, 3), duration: 60 },
    ], now);
    assert.equal(totalDays, 31);
    assert.deepEqual(days.map((d) => d.day), [1, 2, 3, 4, 5]);
    assert.deepEqual(days.map((d) => d.hours), [2, 0, 1, 0, 0]);
    assert.deepEqual(days.map((d) => d.cumulative), [2, 2, 3, 3, 3]);
  });
  test('a month with no logs is a flat zero line, not an empty chart', () => {
    const { days } = dailyHoursSeries([], now);
    assert.equal(days.length, 5);
    assert.ok(days.every((d) => d.cumulative === 0));
  });
  test('months are oldest first, cross the year end, and keep empty months as zero', () => {
    const jan = at(2026, 1, 20);
    const months = monthlyTotals([
      { date: at(2025, 11, 10), amount: 1000 },
      { date: at(2025, 11, 28), amount: 500 },
      { date: at(2026, 1, 2), amount: 700 },
    ], 4, jan);
    assert.deepEqual(months.map((m) => m.key), ['2025-10', '2025-11', '2025-12', '2026-01']);
    assert.deepEqual(months.map((m) => m.total), [0, 1500, 0, 700]);
  });
  test('activity older than the window is ignored', () => {
    const months = monthlyTotals([{ date: at(2024, 1, 1), amount: 999 }], 6, now);
    assert.equal(months.reduce((s, m) => s + m.total, 0), 0);
  });
});

describe('client email policy — which notifications are also emailed', () => {
  test('by default only action-needed events are emailed', () => {
    const p = mergePolicy(undefined);
    const on = Object.keys(p).filter((k) => p[k]).sort();
    assert.deepEqual(on, ['account_hold', 'agreement_updated', 'invoice_created', 'kyc_rejected', 'onboarding_request', 'payment_rejected', 'ticket_pending_client']);
  });
  test('every event has a switch, a label and a default', () => {
    assert.equal(Object.keys(mergePolicy({})).length, EVENTS.length);
    assert.ok(EVENTS.every((e) => e.label && typeof e.default === 'boolean'));
  });
  test('saved switches override defaults; unknown keys and non-booleans are ignored', () => {
    const p = mergePolicy({ payment_approved: true, invoice_created: false, ticket_reply: 'yes', made_up: true });
    assert.equal(p.payment_approved, true);
    assert.equal(p.invoice_created, false);
    assert.equal(p.ticket_reply, false);
    assert.equal('made_up' in p, false);
  });
});

describe('Super Admin rules — auto-hold and extra-hours billing', () => {
  test('both rules ship switched off / track-only', () => {
    assert.equal(policies.AUTO_HOLD_DEFAULTS.enabled, false);
    assert.equal(policies.EXTRA_DEFAULTS.mode, 'track_only');
  });
  test('auto-hold settings are validated', () => {
    assert.equal(policies.validateAutoHold({ enabled: true, daysOverdue: 15 }).value.daysOverdue, 15);
    for (const bad of [{ daysOverdue: 0 }, { daysOverdue: 1.5 }, { daysOverdue: 400 }, { daysOverdue: 'x' }, { daysOverdue: 10, minOverdueAmount: -1 }]) {
      assert.ok(policies.validateAutoHold(bad).error, JSON.stringify(bad));
    }
    assert.equal(policies.validateAutoHold({ daysOverdue: 10 }).value.autoRelease, true, 'release defaults on');
  });
  test('extra-hours settings are validated; billing needs a rate', () => {
    assert.ok(policies.validateExtraHours({ mode: 'bill', ratePerHour: 0 }).error);
    assert.ok(policies.validateExtraHours({ mode: 'free' }).error);
    assert.ok(policies.validateExtraHours({ mode: 'bill', ratePerHour: 500, roundTo: 0.3 }).error);
    assert.ok(policies.validateExtraHours({ mode: 'bill', ratePerHour: 500, gstPercent: 50 }).error);
    assert.equal(policies.validateExtraHours({ mode: 'track_only' }).value.mode, 'track_only');
  });
  test('the charge takes off free hours, rounds UP to the step, then adds GST', () => {
    const p = { mode: 'bill', ratePerHour: 1000, freeHours: 0.5, roundTo: 0.5, gstPercent: 18 };
    assert.deepEqual(policies.extraCharge(3, p), { billableHours: 2.5, amount: 2500, gst: 450, total: 2950 });
    assert.equal(policies.extraCharge(1.2, { ...p, freeHours: 0 }).billableHours, 1.5, '1.2h bills as 1.5h');
    assert.equal(policies.extraCharge(1, { ...p, roundTo: 1, freeHours: 0 }).billableHours, 1);
  });
  test('nothing is charged when tracking only, within the free hours, or with no extra hours', () => {
    const bill = { mode: 'bill', ratePerHour: 1000, freeHours: 2, roundTo: 0.5, gstPercent: 18 };
    assert.equal(policies.extraCharge(5, { ...bill, mode: 'track_only' }).total, 0);
    assert.equal(policies.extraCharge(2, bill).total, 0);
    assert.equal(policies.extraCharge(0, bill).total, 0);
  });
});

describe('recurring invoices — dates and drafts', () => {
  const sched = (billingDay, startDate, dueDays = 7) => ({ billingDay, startDate, dueDays });
  test('the first invoice is on the start date, then the billing day of each following month', () => {
    assert.deepEqual(bs.invoiceDatesBetween(sched(20, '2026-11-20'), '2026-11-01', '2027-02-28'), ['2026-11-20', '2026-12-20', '2027-01-20', '2027-02-20']);
  });
  test('a start date off the billing day never produces two invoices in its own month', () => {
    assert.deepEqual(bs.invoiceDatesBetween(sched(25, '2026-11-20'), '2026-11-01', '2027-01-31'), ['2026-11-20', '2026-12-25', '2027-01-25']);
  });
  test('a billing day of 29–31 uses the last day of a shorter month', () => {
    assert.deepEqual(bs.invoiceDatesBetween(sched(31, '2026-01-31'), '2026-01-01', '2026-05-31'), ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31']);
    assert.equal(bs.dayInMonth(2028, 1, 30), '2028-02-29', 'leap year');
  });
  test('billed in advance: a period runs from its date to the day before the next invoice', () => {
    assert.deepEqual(bs.periodFor(sched(20, '2026-11-20'), '2026-11-20'), { start: '2026-11-20', end: '2026-12-19' });
    assert.deepEqual(bs.periodFor(sched(20, '2026-11-20'), '2026-12-20'), { start: '2026-12-20', end: '2027-01-19' });
  });
  test('existing clients are suggested onboarding date + 30 days', () => {
    assert.equal(bs.suggestStartDate('2026-10-22T05:00:00Z'), '2026-11-21');
    assert.equal(bs.suggestStartDate(null), null);
  });
  test('upcoming dates start from today, including today', () => {
    assert.deepEqual(bs.upcomingDates(sched(20, '2026-11-20'), '2026-12-20', 2), ['2026-12-20', '2027-01-20']);
  });
  test('totals add GST on the subtotal', () => {
    assert.deepEqual(bs.totals([{ amount: 15000 }], 18), { subtotal: 15000, taxPercent: 18, taxAmount: 2700, totalAmount: 17700 });
  });
  test('line items from staff are validated', () => {
    assert.ok(bs.cleanItems([]).error);
    assert.ok(bs.cleanItems([{ description: ' ', unitPrice: 5 }]).error);
    assert.ok(bs.cleanItems([{ description: 'x', unitPrice: -1 }]).error);
    assert.ok(bs.cleanItems([{ description: 'x', unitPrice: 5, qty: 1.5 }]).error);
    assert.deepEqual(bs.cleanItems([{ description: ' Fee ', unitPrice: '100.505', qty: 2 }]).items, [{ description: 'Fee', qty: 2, unitPrice: 100.51, amount: 201.02 }]);
  });
  test('schedule settings are validated and default the days to pay', () => {
    assert.equal(bs.validateSchedule({ billingDay: 20, startDate: '2026-11-20', active: true }, 7).value.dueDays, 7);
    assert.equal(bs.validateSchedule({ billingDay: 20, startDate: '2026-11-20', dueDays: 10 }, 7).value.dueDays, 10);
    for (const bad of [{ billingDay: 0, startDate: '2026-11-20' }, { billingDay: 32, startDate: '2026-11-20' }, { billingDay: 20, startDate: '2026-02-30' }, { billingDay: 20, startDate: '2026-11-20', dueDays: 90 }]) {
      assert.ok(bs.validateSchedule(bad, 7).error, JSON.stringify(bad));
    }
  });
  test('problems explain why a draft cannot go out', () => {
    assert.equal(bs.problemsFor({ lineItems: [{ amount: 1 }], totalAmount: 1 }, { email: 'a@b.co' }).length, 0);
    assert.match(bs.problemsFor({ lineItems: [], totalAmount: 0 }, { email: 'a@b.co' })[0], /No active monthly retainer/);
    assert.match(bs.problemsFor({ lineItems: [{ amount: 1 }], totalAmount: 1 }, { email: '' })[0], /email/);
  });
});

describe('onboarding — what the client sees', () => {
  const doc = (items, goLive = {}) => ({ items, goLive: { isLive: false, ...goLive } });
  const it = (o) => ({ key: 'k', label: 'Step', status: 'Not Started', ...o });
  const stateOf = (o) => onboarding.clientView(doc([it(o)])).items[0].state;

  test('there is nothing to show before a checklist exists', () => {
    assert.equal(onboarding.clientView(null), null);
    assert.equal(onboarding.clientView(doc([])), null);
  });
  test('internal statuses become plain client-facing states', () => {
    assert.equal(stateOf({}), 'not_started');
    assert.equal(stateOf({ status: 'In Progress' }), 'in_progress');
    assert.equal(stateOf({ status: 'Blocked', blocker: 'client has not replied' }), 'blocked');
    assert.equal(stateOf({ status: 'Completed' }), 'done');
    assert.equal(stateOf({ status: 'Not Applicable', naReason: 'internal reason' }), 'not_needed');
  });
  test('a message for the client makes the step "waiting on you" — until it is done', () => {
    assert.equal(stateOf({ status: 'In Progress', clientMessage: 'Please add us as admin' }), 'waiting_on_you');
    assert.equal(onboarding.clientView(doc([it({ clientMessage: 'Please add us as admin' })])).items[0].message, 'Please add us as admin');
    assert.equal(stateOf({ status: 'Completed', clientMessage: 'Please add us as admin' }), 'done');
    assert.equal(onboarding.clientView(doc([it({ status: 'Completed', clientMessage: 'x' })])).items[0].message, '');
  });
  test('a proof link is shown only when shared AND a plain https link', () => {
    const url = (o) => onboarding.clientView(doc([it({ evidenceLink: 'https://drive.test/signed.pdf', ...o })])).items[0].proofUrl;
    assert.equal(url({}), null, 'not shared by default');
    assert.equal(url({ shareProof: true }), 'https://drive.test/signed.pdf');
    assert.equal(url({ shareProof: true, evidenceLink: 'javascript:alert(1)' }), null);
    assert.equal(url({ shareProof: true, evidenceLink: 'http://insecure.test/x' }), null);
    assert.equal(url({ shareProof: true, evidenceLink: 'signed copy is in the email' }), null);
  });
  test('nothing internal is ever in the client view', () => {
    const view = onboarding.clientView(doc([it({
      status: 'Blocked', remarks: 'SECRET remark', blocker: 'SECRET blocker', naReason: 'SECRET na', evidenceLink: 'https://secret.test/internal', owner: 'ownerid', dueDate: '2026-01-01',
    })], { exception: { reason: 'SECRET exception', waivedItems: ['k'] } }));
    const raw = JSON.stringify(view);
    for (const s of ['SECRET', 'secret.test', 'ownerid', 'dueDate', 'exception', 'owner']) assert.equal(raw.includes(s), false, `leaked ${s}`);
  });
  test('the summary counts done, not-needed and waiting steps', () => {
    const v = onboarding.clientView(doc([it({ status: 'Completed' }), it({ status: 'Not Applicable' }), it({ clientMessage: 'help' }), it({})]));
    assert.deepEqual(v.summary, { total: 4, done: 2, waitingOnYou: 1 });
  });
  test('sharing a proof needs an https link; the message is length-limited', () => {
    assert.ok(onboarding.validateItemUpdate(it({ needsEvidence: true }), { shareProof: true }).errors.length, 'no link');
    assert.ok(onboarding.validateItemUpdate(it(), { shareProof: true, evidenceLink: 'http://x.test' }).errors.length, 'http is not enough');
    assert.equal(onboarding.validateItemUpdate(it(), { shareProof: true, evidenceLink: 'https://x.test/a' }).errors.length, 0);
    assert.ok(onboarding.validateItemUpdate(it(), { clientMessage: 'x'.repeat(301) }).errors.length);
  });
});
