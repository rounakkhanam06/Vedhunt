const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { formatHHmm, parseClock, lateByMinutes, formatDuration } = require('../utils/clockTime');
const { amountInWords } = require('../services/pdfBranding');
const { resolveSegment } = require('../utils/employeeSegments');
const { validateLeadTransition } = require('../utils/leadStateMachine');

// Pure-function tests for the Employee Portal additions. Run: npm test

describe('attendance clock strings', () => {
  test('formats 24h input in the stored "hh:mm AM" style', () => {
    assert.equal(formatHHmm('10:05'), '10:05 AM');
    assert.equal(formatHHmm('19:10'), '07:10 PM');
    assert.equal(formatHHmm('25:00'), null);
    assert.equal(formatHHmm(''), null);
  });

  test('parses both stored and 24h forms to minutes', () => {
    assert.equal(parseClock('10:05 AM'), 605);
    assert.equal(parseClock('07:10 pm'), 19 * 60 + 10);
    assert.equal(parseClock('12:00 AM'), 0);
    assert.equal(parseClock('12:30 PM'), 750);
    assert.equal(parseClock('22:05'), 1325);
    assert.equal(parseClock('nope'), null);
  });

  test('late time reads as hours and minutes', () => {
    assert.equal(formatDuration(355), '5 hrs 55 mins');
    assert.equal(formatDuration(60), '1 hr');
    assert.equal(formatDuration(61), '1 hr 1 min');
    assert.equal(formatDuration(45), '45 mins');
  });

  test('late minutes are measured from the office start', () => {
    assert.equal(lateByMinutes(parseClock('09:20 AM'), '09:00'), 20);
    assert.equal(lateByMinutes(parseClock('08:50 AM'), '09:00'), 0);
    assert.equal(lateByMinutes(parseClock('09:20 AM'), undefined), 0);
  });
});

describe('amount in words (Indian grouping)', () => {
  test('lakhs and crores', () => {
    assert.equal(amountInWords(30500), 'Thirty Thousand Five Hundred Rupees Only');
    assert.equal(amountInWords(147500), 'One Lakh Forty Seven Thousand Five Hundred Rupees Only');
    assert.equal(amountInWords(12000000), 'One Crore Twenty Lakh Rupees Only');
    assert.equal(amountInWords(0), 'Zero Rupees Only');
  });
});

describe('employee segment resolution', () => {
  test('explicit role segment wins', () => {
    assert.equal(resolveSegment([{ name: 'BDE', segment: 'Management' }]), 'Management');
  });
  test('a specific role beats the generic EMPLOYEE role, whatever the order', () => {
    assert.equal(resolveSegment([{ name: 'EMPLOYEE', segment: 'General' }, { name: 'BDE', segment: 'BD' }]), 'BD');
    assert.equal(resolveSegment([{ name: 'EMPLOYEE', segment: 'General' }, { name: 'BDE' }]), 'BD');
    assert.equal(resolveSegment([{ name: 'EMPLOYEE', segment: 'General' }]), 'General');
  });
  test('falls back to the default role mapping, then to leads.view', () => {
    assert.equal(resolveSegment([{ name: 'DEVELOPER' }]), 'Technology');
    assert.equal(resolveSegment([{ name: 'CUSTOM_SALES', permissions: ['ess.access', 'leads.view'] }]), 'BD');
    assert.equal(resolveSegment([{ name: 'CUSTOM', permissions: ['ess.access'] }]), 'General');
    assert.equal(resolveSegment([]), 'General');
  });
});

describe('next action type', () => {
  const lead = { status: 'Contacted' };
  test('accepts a listed action type', () => {
    assert.equal(validateLeadTransition(lead, { nextActionType: 'Meeting', nextFollowUpDate: new Date() }), null);
  });
  test('rejects an unknown action type', () => {
    assert.match(validateLeadTransition(lead, { nextActionType: 'Carrier pigeon' }), /Invalid next action type/);
  });
});

describe('document formats', () => {
  test('payslip words are hyphenated; proforma words are upper-case', () => {
    assert.equal(amountInWords(49800, { hyphen: true }), 'Forty-Nine Thousand Eight Hundred Rupees Only');
    assert.equal(amountInWords(17700, { upper: true }), 'SEVENTEEN THOUSAND SEVEN HUNDRED RUPEES ONLY');
  });

  test('proposal totals are computed from line items', async () => {
    const Proposal = require('../models/Proposal');
    const p = new Proposal({
      proposalNumber: 'VH-PROP-260906-221', lead: '64b000000000000000000000', createdBy: '64b000000000000000000000',
      items: [
        { service: 'Meta Ads Management', qty: 1, rate: 15000, gstPercent: 18 },
        { service: 'Logo Design', qty: 2, rate: 2500, gstPercent: 18 },
      ],
    });
    await p.validate();
    assert.equal(p.projectValue, 20000);
    assert.equal(p.gstAmount, 3600);
    assert.equal(p.totalAmount, 23600);
    assert.equal(p.items[1].total, 5900);
  });
});

describe('role-managed portal modules', () => {
  const { resolvePortalModules } = require('../utils/employeeSegments');
  test('no role restricts modules → portal defaults (null)', () => {
    assert.equal(resolvePortalModules([{ name: 'BDE' }, { name: 'X', portalModules: [] }]), null);
  });
  test('union of configured roles, unknown keys dropped', () => {
    assert.deepEqual(
      resolvePortalModules([{ portalModules: ['tasks', 'payslips'] }, { portalModules: ['tasks', 'tickets', 'bogus'] }]).sort(),
      ['payslips', 'tasks', 'tickets']
    );
  });
});

describe('KPI achievement', () => {
  const { achievementPct } = require('../models/KPITarget');
  test('higher-is-better scores actual ÷ target', () => {
    assert.equal(achievementPct('CampaignROAS', 3, 3.6), 120);
  });
  test('CPA (lower is better) scores target ÷ actual, 0 without data', () => {
    assert.equal(achievementPct('CPA', 400, 500), 80);
    assert.equal(achievementPct('CPA', 400, 0), 0);
  });
});

describe('project delivery KPIs', () => {
  const { computeDeliveryGroup } = require('../services/projectDelivery');
  const from = new Date('2026-10-01');
  const to = new Date('2026-10-31T23:59:59');
  const now = new Date('2026-10-20T12:00:00');
  const projects = [
    // completed on time, one milestone on time and one late
    { status: 'Completed', expectedEndDate: new Date('2026-10-15'), completedAt: new Date('2026-10-14'),
      milestones: [{ completedOn: new Date('2026-10-05'), targetDate: new Date('2026-10-06') }, { completedOn: new Date('2026-10-12'), targetDate: new Date('2026-10-10') }],
      escalations: [{ status: 'Resolved', raisedAt: new Date('2026-10-02T10:00'), resolvedAt: new Date('2026-10-03T10:00') }] },
    // completed late
    { status: 'Completed', expectedEndDate: new Date('2026-10-05'), completedAt: new Date('2026-10-09'), milestones: [], escalations: [] },
    // active and overdue, with an open escalation
    { status: 'Active', expectedEndDate: new Date('2026-10-18'), milestones: [], escalations: [{ status: 'Open', raisedAt: new Date('2026-10-19') }] },
  ];
  const kpi = Object.fromEntries(computeDeliveryGroup(projects, from, to, 'T', now).items.map((i) => [i.key, i.value]));

  test('on-time, overdue and milestone rates', () => {
    assert.equal(kpi.projectsCompleted, 2);
    assert.equal(kpi.projectsOnTime, 50);
    assert.equal(kpi.overdueProjects, 1);
    assert.equal(kpi.milestonesOnTime, 50);
    assert.equal(kpi.activeProjects, 1);
  });
  test('escalations raised, open and average resolution', () => {
    assert.equal(kpi.escalationsRaised, 2);
    assert.equal(kpi.openEscalations, 1);
    assert.equal(kpi.escalationResolution, 24);
  });
});

describe('financial overview', () => {
  const { invoiceMoney } = require('../controllers/analyticsController');
  test('an invoice marked Paid counts in full even without paidAmount', () => {
    assert.deepEqual(invoiceMoney({ totalAmount: 10500, paymentStatus: 'Paid' }), { earned: 10500, pending: 0 });
  });
  test('unpaid and part-paid invoices split into earned and pending', () => {
    assert.deepEqual(invoiceMoney({ totalAmount: 66000, paymentStatus: 'Unpaid' }), { earned: 0, pending: 66000 });
    assert.deepEqual(invoiceMoney({ totalAmount: 66000, paidAmount: 20000, paymentStatus: 'Overdue' }), { earned: 20000, pending: 46000 });
  });
});
