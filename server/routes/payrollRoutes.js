const express = require('express');
const SalaryRevision = require('../models/SalaryRevision');
const PayrollRun = require('../models/PayrollRun');
const Payslip = require('../models/Payslip');
const Settings = require('../models/Settings');
const AuditLog = require('../models/AuditLog');
const Employee = require('../models/Employee');
const authMiddleware = require('../middleware/authMiddleware');
const requirePermission = require('../middleware/requirePermission');
const requirePageAccess = require('../middleware/requirePageAccess');
const { pageScope } = require('../config/pageAccess');
const { scopedEmployeeIds, employeeInScope, isValidId } = require('../utils/employeeScope');
const logger = require('../utils/logger');
const {
  addSalaryRevision,
  getSalaryRevisionHistory,
  generateDraftRunsForMonth,
  recomputeTotals,
  getPayrollSettings
} = require('../services/payrollEngine');
const { finalizeAndSendPayslip, resendPayslip } = require('../services/payslipGenerator');
const { notifyStaff } = require('../services/staffNotify');

// No auth here — mounted twice at the bottom of this file: behind the Admin
// auth at /api/payroll, and behind the Employee Portal auth for person-wise
// grants. Role holders (payroll.manage) keep full access, as before. A grant
// has three separate actions (config/pageAccess.js):
//   view      — the payroll screen, every amount removed by the server
//   sensitive — salary figures, salary history, payslip PDFs
//   process   — generate, adjust, approve, hold, resend, mark paid, revise salary
// and every record is limited to the grant's employees (utils/employeeScope.js).
const router = express.Router();
const pay = (action) => requirePageAccess('payroll', action);

// ── Scope + masking helpers ───────────────────────────────────────────────────
const notFound = (res, what) => res.status(404).json({ success: false, message: `${what} not found` });
const canSeeAmounts = (req) => pageScope(req.user, 'payroll', 'sensitive') !== false;

// Everything that reveals pay: amounts, salary segments, remarks, the PDF and the bank transfer reference
const RUN_SENSITIVE = ['earnings', 'deductions', 'grossEarnings', 'totalDeductions', 'netPay', 'salaryBreakup', 'remarks'];
const SLIP_SENSITIVE = ['earnings', 'deductions', 'grossEarnings', 'totalDeductions', 'netPay', 'pdfUrl', 'paymentReference'];

const strip = (doc, fields) => {
  const out = typeof doc?.toObject === 'function' ? doc.toObject() : { ...doc };
  for (const f of fields) delete out[f];
  return out;
};
const maskRun = (run) => {
  const out = strip(run, RUN_SENSITIVE);
  if (out.payslipId && typeof out.payslipId === 'object') out.payslipId = strip(out.payslipId, SLIP_SENSITIVE);
  out.masked = true;
  return out;
};
const maskSlip = (slip) => ({ ...strip(slip, SLIP_SENSITIVE), masked: true });
const forViewer = (req, mask) => (doc) => (canSeeAmounts(req) ? doc : mask(doc));

// The employee query filter for a list: the requested employee if in scope, else the whole scope
async function employeeFilter(req, requested) {
  const ids = await scopedEmployeeIds(req);
  const wanted = requested && requested !== 'All' && isValidId(requested) ? String(requested) : null;
  if (!ids) return wanted ? { employeeId: wanted } : {};
  if (wanted) return { employeeId: employeeInScope(ids, wanted) ? wanted : { $in: [] } };
  return { employeeId: { $in: ids } };
}

// Loads a run (or payslip) and confirms its employee is in scope; null answers "not found"
async function inScopeDoc(req, Model, id, populate) {
  if (!isValidId(id)) return null;
  let q = Model.findById(id);
  if (populate) for (const p of populate) q = q.populate(...p);
  const doc = await q;
  if (!doc) return null;
  const ids = await scopedEmployeeIds(req);
  return employeeInScope(ids, doc.employeeId) ? doc : null;
}

// ── Employees in scope (the portal's picker) ─────────────────────────────────
router.get('/employees', pay('view'), async (req, res) => {
  try {
    const ids = await scopedEmployeeIds(req);
    const employees = await Employee.find(ids ? { _id: { $in: ids } } : {}, 'firstName lastName employeeId roleDept department')
      .sort({ firstName: 1 }).lean();
    res.json({ success: true, employees });
  } catch (error) {
    logger.error('Error fetching payroll employees:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── Salary Revisions ─────────────────────────────────────────────────────────────────
router.post('/salary-revisions', pay('process'), async (req, res) => {
  try {
    const { employeeId, ctc, components, effectiveFrom, reason } = req.body;
    if (!employeeId || !ctc || !effectiveFrom || !reason?.trim()) {
      return res.status(400).json({ success: false, message: 'employeeId, ctc, effectiveFrom, and reason are required.' });
    }
    if (!employeeInScope(await scopedEmployeeIds(req), employeeId)) return notFound(res, 'Employee');

    // ── Probation Guard ─────────────────────────────────────────────────────────────
    // Employees on probation are not eligible for salary revisions or appraisals.
    // This is enforced here (API) and in the UI (form is disabled with a tooltip).
    const empCheck = await Employee.findById(employeeId).select('employmentStatus firstName lastName employeeId');
    if (empCheck && empCheck.employmentStatus === 'Probation') {
      return res.status(403).json({
        success: false,
        message: `Salary revision not allowed: ${empCheck.firstName} ${empCheck.lastName} (${empCheck.employeeId}) is currently on probation.`
      });
    }
    // ────────────────────────────────────────────────────────────────────────────

    const revision = await addSalaryRevision({
      employeeId, ctc: Number(ctc), components: components || {}, effectiveFrom, reason: reason.trim(), revisedBy: req.user._id
    });
    await AuditLog.create({
      adminId: req.user._id, action: 'SALARY_REVISION_CREATE', resource: 'Payroll',
      afterSnapshot: revision.toObject()
    });
    res.status(201).json({ success: true, revision });
  } catch (error) {
    logger.error('Error creating salary revision:', error);
    res.status(400).json({ success: false, message: error.message || 'Server error' });
  }
});

router.get('/salary-revisions/:employeeId', pay('sensitive'), async (req, res) => {
  try {
    if (!employeeInScope(await scopedEmployeeIds(req), req.params.employeeId)) return notFound(res, 'Employee');
    const revisions = await getSalaryRevisionHistory(req.params.employeeId);
    res.json({ success: true, revisions });
  } catch (error) {
    logger.error('Error fetching salary revisions:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── Payroll Runs ──────────────────────────────────────────────────────────
router.get('/runs', pay('view'), async (req, res) => {
  try {
    const { month, year, status, employeeId } = req.query;
    const query = await employeeFilter(req, employeeId);
    if (month) query.month = Number(month);
    if (year) query.year = Number(year);
    if (status && status !== 'All') query.status = status;

    const runs = await PayrollRun.find(query)
      .populate('employeeId', 'firstName lastName employeeId roleDept email')
      .populate('payslipId', 'pdfUrl emailStatus sentAt paidAt paymentReference')
      .sort({ createdAt: -1 });
    res.json({ success: true, runs: runs.map(forViewer(req, maskRun)) });
  } catch (error) {
    logger.error('Error fetching payroll runs:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/runs/:id', pay('view'), async (req, res) => {
  try {
    const run = await inScopeDoc(req, PayrollRun, req.params.id, [
      ['employeeId', 'firstName lastName employeeId roleDept email'],
      ['salaryBreakup.revisionId', 'ctc reason effectiveFrom'],
    ]);
    if (!run) return notFound(res, 'Payroll run');
    res.json({ success: true, run: forViewer(req, maskRun)(run) });
  } catch (error) {
    logger.error('Error fetching payroll run:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/runs/generate', pay('process'), async (req, res) => {
  try {
    const { month, year, employeeIds } = req.body;
    if (!month || !year) return res.status(400).json({ success: false, message: 'month and year are required.' });
    // A grant generates only for its own employees
    const ids = await scopedEmployeeIds(req);
    let target = employeeIds || null;
    if (ids) {
      if (target && !target.every((id) => employeeInScope(ids, id))) {
        return res.status(403).json({ success: false, message: 'You can only run payroll for employees in your scope.' });
      }
      target = target || ids.map(String);
      if (!target.length) return res.json({ success: true, results: [] });
    }
    const results = await generateDraftRunsForMonth(Number(month), Number(year), target);
    res.json({ success: true, results });
  } catch (error) {
    logger.error('Error generating payroll runs:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
});

router.put('/runs/:id', pay('process'), async (req, res) => {
  try {
    const run = await inScopeDoc(req, PayrollRun, req.params.id);
    if (!run) return notFound(res, 'Payroll run');
    if (!['Draft', 'UnderReview', 'OnHold'].includes(run.status)) {
      return res.status(400).json({ success: false, message: `Cannot edit a run that is already ${run.status}.` });
    }

    const { bonus, incentive, reimbursement, arrears, tds, otherDeductions, otherDeductionsReason, remarks } = req.body;
    if (bonus !== undefined) run.earnings.bonus = Number(bonus) || 0;
    if (incentive !== undefined) run.earnings.incentive = Number(incentive) || 0;
    if (reimbursement !== undefined) run.earnings.reimbursement = Number(reimbursement) || 0;
    if (arrears !== undefined) run.earnings.arrears = Number(arrears) || 0;
    if (tds !== undefined) run.deductions.tds = Number(tds) || 0;
    if (otherDeductions !== undefined) run.deductions.otherDeductions = Number(otherDeductions) || 0;
    if (otherDeductionsReason !== undefined) run.deductions.otherDeductionsReason = otherDeductionsReason;
    if (remarks !== undefined) run.remarks = remarks;

    recomputeTotals(run);
    run.status = 'UnderReview';
    run.reviewedBy = req.user._id;
    run.reviewedAt = new Date();
    await run.save();

    res.json({ success: true, run });
  } catch (error) {
    logger.error('Error updating payroll run:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/runs/:id/approve', pay('process'), async (req, res) => {
  try {
    const run = await inScopeDoc(req, PayrollRun, req.params.id);
    if (!run) return notFound(res, 'Payroll run');
    if (!['Draft', 'UnderReview', 'OnHold'].includes(run.status)) {
      return res.status(400).json({ success: false, message: `This run is already ${run.status}.` });
    }

    const payslip = await finalizeAndSendPayslip(run, { approvedBy: req.user._id });
    await AuditLog.create({
      adminId: req.user._id, action: 'PAYROLL_RUN_APPROVE', resource: 'Payroll',
      afterSnapshot: { runId: run._id, payslipId: payslip._id, netPay: payslip.netPay }
    });
    res.json({ success: true, run, payslip });
  } catch (error) {
    logger.error('Error approving payroll run:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
});

router.post('/runs/:id/hold', pay('process'), async (req, res) => {
  try {
    const run = await inScopeDoc(req, PayrollRun, req.params.id);
    if (!run) return notFound(res, 'Payroll run');
    run.status = 'OnHold';
    await run.save();
    res.json({ success: true, run });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/runs/:id/resume', pay('process'), async (req, res) => {
  try {
    const run = await inScopeDoc(req, PayrollRun, req.params.id);
    if (!run) return notFound(res, 'Payroll run');
    if (run.status !== 'OnHold') return res.status(400).json({ success: false, message: 'Run is not on hold.' });
    run.status = 'Draft';
    await run.save();
    res.json({ success: true, run });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/runs/:id/resend', pay('process'), async (req, res) => {
  try {
    const run = await inScopeDoc(req, PayrollRun, req.params.id);
    if (!run) return notFound(res, 'Payroll run');
    if (!run.payslipId) return res.status(400).json({ success: false, message: 'No payslip has been generated for this run yet.' });
    const payslip = await resendPayslip(run.payslipId);
    res.json({ success: true, payslip });
  } catch (error) {
    logger.error('Error resending payslip:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
});

// ── Payslips ──────────────────────────────────────────────────────────────
router.get('/payslips', pay('view'), async (req, res) => {
  try {
    const { employeeId, year } = req.query;
    const query = { status: 'Active', ...(await employeeFilter(req, employeeId)) };
    if (year) query.year = Number(year);
    const payslips = await Payslip.find(query).populate('employeeId', 'firstName lastName employeeId').sort({ year: -1, month: -1 });
    res.json({ success: true, payslips: payslips.map(forViewer(req, maskSlip)) });
  } catch (error) {
    logger.error('Error fetching payslips:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/payslips/:id', pay('view'), async (req, res) => {
  try {
    const payslip = await inScopeDoc(req, Payslip, req.params.id, [['employeeId', 'firstName lastName employeeId email']]);
    if (!payslip) return notFound(res, 'Payslip');
    res.json({ success: true, payslip: forViewer(req, maskSlip)(payslip) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Mark a payslip's salary as credited — drives the "Paid" status employees see.
router.post('/payslips/:id/mark-paid', pay('process'), async (req, res) => {
  if (!(await inScopeDoc(req, Payslip, req.params.id))) return notFound(res, 'Payslip');
  const paymentReference = String(req.body.paymentReference || '').trim().slice(0, 100);
  const paidAt = req.body.paidAt ? new Date(req.body.paidAt) : new Date();
  if (Number.isNaN(paidAt.getTime()) || paidAt > new Date()) {
    return res.status(400).json({ success: false, message: 'Payment date must be a valid date, not in the future.' });
  }
  const payslip = await Payslip.findOneAndUpdate(
    { _id: req.params.id, status: 'Active', paidAt: null },
    { $set: { paidAt, paidBy: req.user._id, paymentReference } },
    { returnDocument: 'after' }
  ).populate('employeeId', 'adminId');
  if (!payslip) return res.status(400).json({ success: false, message: 'Payslip not found or already marked paid.' });

  await AuditLog.create({
    adminId: req.user._id, action: 'PAYSLIP_MARKED_PAID', resource: 'Payslip',
    afterSnapshot: { payslipId: payslip._id, month: payslip.month, year: payslip.year, paidAt, paymentReference },
    ipAddress: req.ip,
  }).catch((e) => logger.error('Audit log failed (PAYSLIP_MARKED_PAID):', e.message));
  if (payslip.employeeId?.adminId) {
    await notifyStaff(payslip.employeeId.adminId, {
      type: 'payslip_paid',
      title: 'Salary credited',
      message: `Your salary for ${payslip.month}/${payslip.year} has been credited${paymentReference ? ` (UTR: ${paymentReference})` : ''}.`,
      link: '/employee/dashboard?tab=payslips',
    });
  }
  res.json({ success: true, payslip });
});

// ── Payroll Settings — this is where the admin-configurable generation day lives ──
// Reading them shows the schedule on the payroll screen; changing them stays with the role.
router.get('/settings', pay('view'), async (req, res) => {
  try {
    const settings = await getPayrollSettings();
    res.json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/settings', requirePermission('payroll.manage'), async (req, res) => {
  try {
    const { generationDay, autoApproveOnGenerationDay, pf, professionalTax } = req.body;
    if (generationDay !== undefined && (generationDay < 1 || generationDay > 28)) {
      return res.status(400).json({ success: false, message: 'Generation day must be between 1 and 28.' });
    }
    const current = await getPayrollSettings();
    const updated = {
      ...current,
      ...(generationDay !== undefined ? { generationDay: Number(generationDay) } : {}),
      ...(autoApproveOnGenerationDay !== undefined ? { autoApproveOnGenerationDay: !!autoApproveOnGenerationDay } : {}),
      ...(pf ? { pf: { ...current.pf, ...pf } } : {}),
      ...(professionalTax ? { professionalTax: { ...current.professionalTax, ...professionalTax } } : {})
    };
    await Settings.findOneAndUpdate({ key: 'payroll_settings' }, { key: 'payroll_settings', value: updated }, { upsert: true });
    res.json({ success: true, settings: updated });
  } catch (error) {
    logger.error('Error updating payroll settings:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Admin panel: /api/payroll/* behind the Admin auth, as before
const adminRouter = express.Router();
adminRouter.use(authMiddleware, router);

module.exports = adminRouter;
// Auth-less payroll router — the Employee Portal mounts it behind its own auth
module.exports.scopedPayrollRouter = router;
