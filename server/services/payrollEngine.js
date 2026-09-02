const Employee = require('../models/Employee');
const SalaryRevision = require('../models/SalaryRevision');
const PayrollRun = require('../models/PayrollRun');
const Settings = require('../models/Settings');
const logger = require('../utils/logger');
const { computeMonthlyAttendance } = require('./attendanceEngine');

const DEFAULT_PAYROLL_SETTINGS = {
  generationDay: 11,
  autoApproveOnGenerationDay: true,
  pf: { enabled: true, employeePercent: 12, employerPercent: 12, wageCeiling: 15000 },
  professionalTax: { enabled: false, amount: 0 }
};

async function getPayrollSettings() {
  const doc = await Settings.findOne({ key: 'payroll_settings' });
  return { ...DEFAULT_PAYROLL_SETTINGS, ...(doc?.value || {}) };
}

/** A simple, editable-later starting split — admin can refine via a salary revision at any time. */
function defaultComponentSplit(ctc) {
  const monthly = ctc / 12;
  return {
    basic: Math.round(monthly * 0.5),
    hra: Math.round(monthly * 0.2),
    specialAllowance: Math.round(monthly * 0.3),
    conveyance: 0,
    medicalAllowance: 0,
    otherAllowances: 0,
    employerPFPercent: 12,
    employeePFPercent: 12,
    professionalTax: 0
  };
}

/**
 * Called once at employee onboarding (POST /employees) so every employee
 * always has at least one SalaryRevision to calculate payroll against —
 * the payroll engine never falls back to the raw Employee.salaryCTC field.
 */
async function createInitialSalaryRevision(employee, adminId) {
  return SalaryRevision.create({
    employeeId: employee._id,
    effectiveFrom: employee.joinDate,
    ctc: employee.salaryCTC,
    components: defaultComponentSplit(employee.salaryCTC),
    previousCTC: null,
    reason: 'Initial salary on joining',
    revisedBy: adminId,
    status: 'Active'
  });
}

/**
 * Adds a new salary revision, closing out whichever revision was Active.
 * Never mutates the closed revision's earnings figures — only stamps its
 * effectiveTo so future payroll calculations know where it stops applying.
 */
async function addSalaryRevision({ employeeId, ctc, components, effectiveFrom, reason, revisedBy }) {
  const effectiveFromDate = new Date(effectiveFrom);
  const current = await SalaryRevision.findOne({ employeeId, status: 'Active' });

  if (current) {
    if (effectiveFromDate <= current.effectiveFrom) {
      throw new Error('Effective date must be after the current salary revision\'s effective date.');
    }
    current.effectiveTo = effectiveFromDate;
    current.status = 'Superseded';
    await current.save();
  }

  return SalaryRevision.create({
    employeeId,
    effectiveFrom: effectiveFromDate,
    ctc,
    components: { ...defaultComponentSplit(ctc), ...components },
    previousCTC: current ? current.ctc : null,
    reason,
    revisedBy,
    status: 'Active'
  });
}

async function getSalaryRevisionHistory(employeeId) {
  return SalaryRevision.find({ employeeId }).sort({ effectiveFrom: -1 });
}

const EARNING_COMPONENT_KEYS = ['basic', 'hra', 'specialAllowance', 'conveyance', 'medicalAllowance', 'otherAllowances'];

/**
 * Splits the target month into segments by whichever SalaryRevision(s)
 * applied during it, prorating each earning component by the fraction of
 * the month that revision covered. This is what makes a mid-month raise
 * (e.g. ₹30k → ₹35k effective the 15th) split correctly across the days
 * before/after the change.
 */
async function getSalaryBreakupForMonth(employeeId, month, year) {
  const monthStart = new Date(year, month - 1, 1);
  const monthEndExclusive = new Date(year, month, 1); // first day of next month — exclusive upper bound
  const totalDaysInMonth = new Date(year, month, 0).getDate();

  const revisions = await SalaryRevision.find({
    employeeId,
    effectiveFrom: { $lt: monthEndExclusive },
    $or: [{ effectiveTo: null }, { effectiveTo: { $gt: monthStart } }]
  }).sort({ effectiveFrom: 1 });

  const segments = [];
  const earnings = Object.fromEntries(EARNING_COMPONENT_KEYS.map((k) => [k, 0]));
  let pfBasis = 0; // basic, prorated — used for PF calculation

  for (const revision of revisions) {
    const segStart = revision.effectiveFrom > monthStart ? revision.effectiveFrom : monthStart;
    const segEndExclusive = revision.effectiveTo && revision.effectiveTo < monthEndExclusive ? revision.effectiveTo : monthEndExclusive;
    const daysApplicable = Math.max(0, Math.round((segEndExclusive - segStart) / 86400000));
    if (daysApplicable === 0) continue;

    const fraction = daysApplicable / totalDaysInMonth;
    let segmentTotal = 0;
    EARNING_COMPONENT_KEYS.forEach((key) => {
      const monthlyComponent = revision.components?.[key] || 0;
      const prorated = monthlyComponent * fraction;
      earnings[key] += prorated;
      segmentTotal += prorated;
    });
    pfBasis += (revision.components?.basic || 0) * fraction;

    segments.push({
      revisionId: revision._id,
      fromDate: segStart,
      toDate: new Date(segEndExclusive.getTime() - 86400000), // inclusive last day, for display
      daysApplicable,
      proratedAmount: Math.round(segmentTotal)
    });
  }

  EARNING_COMPONENT_KEYS.forEach((key) => { earnings[key] = Math.round(earnings[key]); });

  // Use the revision active at month-end (or the last segment) for PF%/professional tax settings.
  const governingRevision = revisions[revisions.length - 1] || null;

  return { totalDaysInMonth, segments, earnings, pfBasis, governingRevision };
}

/**
 * Computes a full payroll figure set for one employee/month — attendance,
 * prorated earnings, LOP, PF, professional tax. Does NOT set bonus/
 * incentive/reimbursement/tds/otherDeductions — those default to 0 and are
 * left for HR to fill in during review (see plan: no automated TDS engine).
 */
async function computePayrollRunData(employee, month, year, payrollSettings) {
  const [{ totalDaysInMonth, segments, earnings, pfBasis, governingRevision }, attendance] = await Promise.all([
    getSalaryBreakupForMonth(employee._id, month, year),
    computeMonthlyAttendance(employee, month, year)
  ]);

  const grossBeforeLOP = EARNING_COMPONENT_KEYS.reduce((sum, k) => sum + earnings[k], 0);
  const perDayRate = totalDaysInMonth > 0 ? grossBeforeLOP / totalDaysInMonth : 0;
  const lopDeduction = Math.round(perDayRate * attendance.lopDays);

  const pf = payrollSettings.pf?.enabled
    ? Math.round(Math.min(pfBasis, payrollSettings.pf.wageCeiling) * (payrollSettings.pf.employeePercent / 100))
    : 0;
  const professionalTax = governingRevision?.components?.professionalTax
    ?? (payrollSettings.professionalTax?.enabled ? payrollSettings.professionalTax.amount : 0);

  return {
    totalDaysInMonth,
    presentDays: attendance.presentDays,
    paidLeaveDays: attendance.paidLeaveDays,
    lopDays: attendance.lopDays,
    earnings: { ...earnings, bonus: 0, incentive: 0, reimbursement: 0, arrears: 0 },
    deductions: { lopDeduction, pf, professionalTax, tds: 0, otherDeductions: 0, otherDeductionsReason: '' },
    salaryBreakup: segments
  };
}

function recomputeTotals(run) {
  const grossEarnings = EARNING_COMPONENT_KEYS.reduce((s, k) => s + (run.earnings[k] || 0), 0)
    + (run.earnings.bonus || 0) + (run.earnings.incentive || 0) + (run.earnings.reimbursement || 0) + (run.earnings.arrears || 0);
  const totalDeductions = (run.deductions.lopDeduction || 0) + (run.deductions.pf || 0) + (run.deductions.professionalTax || 0)
    + (run.deductions.tds || 0) + (run.deductions.otherDeductions || 0);
  run.grossEarnings = Math.round(grossEarnings);
  run.totalDeductions = Math.round(totalDeductions);
  run.netPay = run.grossEarnings - run.totalDeductions;
  return run;
}

/**
 * Creates (or, if still Draft, refreshes) PayrollRuns for every active
 * employee for the given month — the calculation half of the pipeline.
 * Never touches a run that's UnderReview/OnHold/Approved/Generated/Sent —
 * HR's edits and approvals are never silently overwritten.
 */
async function generateDraftRunsForMonth(month, year, employeeIds = null) {
  const payrollSettings = await getPayrollSettings();
  const query = { adminId: { $exists: true } };
  if (employeeIds?.length) query._id = { $in: employeeIds };
  const employees = await Employee.find(query);

  const results = [];
  for (const employee of employees) {
    try {
      const data = await computePayrollRunData(employee, month, year, payrollSettings);
      const existing = await PayrollRun.findOne({ employeeId: employee._id, month, year });

      if (existing && existing.status !== 'Draft') {
        results.push({ employeeId: employee._id, skipped: true, reason: `Already ${existing.status}` });
        continue;
      }

      const run = existing || new PayrollRun({ employeeId: employee._id, month, year });
      run.totalDaysInMonth = data.totalDaysInMonth;
      run.presentDays = data.presentDays;
      run.paidLeaveDays = data.paidLeaveDays;
      run.lopDays = data.lopDays;
      run.salaryBreakup = data.salaryBreakup;
      // Preserve any HR-entered bonus/incentive/reimbursement/arrears/tds/otherDeductions
      // if this is a refresh of an existing Draft; otherwise start at the computed base.
      run.earnings = { ...data.earnings, ...(existing ? {
        bonus: existing.earnings.bonus, incentive: existing.earnings.incentive,
        reimbursement: existing.earnings.reimbursement, arrears: existing.earnings.arrears
      } : {}) };
      run.deductions = { ...data.deductions, ...(existing ? {
        tds: existing.deductions.tds, otherDeductions: existing.deductions.otherDeductions,
        otherDeductionsReason: existing.deductions.otherDeductionsReason
      } : {}) };
      recomputeTotals(run);
      await run.save();
      results.push({ employeeId: employee._id, runId: run._id, created: !existing });
    } catch (error) {
      logger.error(`Payroll draft generation failed for employee ${employee._id}:`, error);
      results.push({ employeeId: employee._id, error: error.message });
    }
  }
  return results;
}

module.exports = {
  DEFAULT_PAYROLL_SETTINGS,
  getPayrollSettings,
  defaultComponentSplit,
  createInitialSalaryRevision,
  addSalaryRevision,
  getSalaryRevisionHistory,
  getSalaryBreakupForMonth,
  computePayrollRunData,
  recomputeTotals,
  generateDraftRunsForMonth
};
