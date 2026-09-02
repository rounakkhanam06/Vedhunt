const express = require('express');
const SalaryRevision = require('../models/SalaryRevision');
const PayrollRun = require('../models/PayrollRun');
const Payslip = require('../models/Payslip');
const Settings = require('../models/Settings');
const AuditLog = require('../models/AuditLog');
const authMiddleware = require('../middleware/authMiddleware');
const requirePermission = require('../middleware/requirePermission');
const logger = require('../utils/logger');
const {
  addSalaryRevision,
  getSalaryRevisionHistory,
  generateDraftRunsForMonth,
  recomputeTotals,
  getPayrollSettings
} = require('../services/payrollEngine');
const { finalizeAndSendPayslip, resendPayslip } = require('../services/payslipGenerator');

const router = express.Router();

router.use(authMiddleware);
router.use(requirePermission('payroll.manage'));

// ── Salary Revisions ─────────────────────────────────────────────────────
router.post('/salary-revisions', async (req, res) => {
  try {
    const { employeeId, ctc, components, effectiveFrom, reason } = req.body;
    if (!employeeId || !ctc || !effectiveFrom || !reason?.trim()) {
      return res.status(400).json({ success: false, message: 'employeeId, ctc, effectiveFrom, and reason are required.' });
    }
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

router.get('/salary-revisions/:employeeId', async (req, res) => {
  try {
    const revisions = await getSalaryRevisionHistory(req.params.employeeId);
    res.json({ success: true, revisions });
  } catch (error) {
    logger.error('Error fetching salary revisions:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── Payroll Runs ──────────────────────────────────────────────────────────
router.get('/runs', async (req, res) => {
  try {
    const { month, year, status, employeeId } = req.query;
    const query = {};
    if (month) query.month = Number(month);
    if (year) query.year = Number(year);
    if (status && status !== 'All') query.status = status;
    if (employeeId && employeeId !== 'All') query.employeeId = employeeId;

    const runs = await PayrollRun.find(query)
      .populate('employeeId', 'firstName lastName employeeId roleDept email')
      .populate('payslipId', 'pdfUrl emailStatus sentAt')
      .sort({ createdAt: -1 });
    res.json({ success: true, runs });
  } catch (error) {
    logger.error('Error fetching payroll runs:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/runs/:id', async (req, res) => {
  try {
    const run = await PayrollRun.findById(req.params.id)
      .populate('employeeId', 'firstName lastName employeeId roleDept email')
      .populate('salaryBreakup.revisionId', 'ctc reason effectiveFrom');
    if (!run) return res.status(404).json({ success: false, message: 'Payroll run not found' });
    res.json({ success: true, run });
  } catch (error) {
    logger.error('Error fetching payroll run:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/runs/generate', async (req, res) => {
  try {
    const { month, year, employeeIds } = req.body;
    if (!month || !year) return res.status(400).json({ success: false, message: 'month and year are required.' });
    const results = await generateDraftRunsForMonth(Number(month), Number(year), employeeIds || null);
    res.json({ success: true, results });
  } catch (error) {
    logger.error('Error generating payroll runs:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
});

router.put('/runs/:id', async (req, res) => {
  try {
    const run = await PayrollRun.findById(req.params.id);
    if (!run) return res.status(404).json({ success: false, message: 'Payroll run not found' });
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

router.post('/runs/:id/approve', async (req, res) => {
  try {
    const run = await PayrollRun.findById(req.params.id);
    if (!run) return res.status(404).json({ success: false, message: 'Payroll run not found' });
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

router.post('/runs/:id/hold', async (req, res) => {
  try {
    const run = await PayrollRun.findByIdAndUpdate(req.params.id, { status: 'OnHold' }, { new: true });
    if (!run) return res.status(404).json({ success: false, message: 'Payroll run not found' });
    res.json({ success: true, run });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/runs/:id/resume', async (req, res) => {
  try {
    const run = await PayrollRun.findById(req.params.id);
    if (!run) return res.status(404).json({ success: false, message: 'Payroll run not found' });
    if (run.status !== 'OnHold') return res.status(400).json({ success: false, message: 'Run is not on hold.' });
    run.status = 'Draft';
    await run.save();
    res.json({ success: true, run });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/runs/:id/resend', async (req, res) => {
  try {
    const run = await PayrollRun.findById(req.params.id);
    if (!run || !run.payslipId) return res.status(400).json({ success: false, message: 'No payslip has been generated for this run yet.' });
    const payslip = await resendPayslip(run.payslipId);
    res.json({ success: true, payslip });
  } catch (error) {
    logger.error('Error resending payslip:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
});

// ── Payslips ──────────────────────────────────────────────────────────────
router.get('/payslips', async (req, res) => {
  try {
    const { employeeId, year } = req.query;
    const query = { status: 'Active' };
    if (employeeId) query.employeeId = employeeId;
    if (year) query.year = Number(year);
    const payslips = await Payslip.find(query).populate('employeeId', 'firstName lastName employeeId').sort({ year: -1, month: -1 });
    res.json({ success: true, payslips });
  } catch (error) {
    logger.error('Error fetching payslips:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/payslips/:id', async (req, res) => {
  try {
    const payslip = await Payslip.findById(req.params.id).populate('employeeId', 'firstName lastName employeeId email');
    if (!payslip) return res.status(404).json({ success: false, message: 'Payslip not found' });
    res.json({ success: true, payslip });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── Payroll Settings — this is where the admin-configurable generation day lives ──
router.get('/settings', async (req, res) => {
  try {
    const settings = await getPayrollSettings();
    res.json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/settings', async (req, res) => {
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

module.exports = router;
