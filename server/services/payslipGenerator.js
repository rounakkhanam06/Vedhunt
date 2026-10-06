const Payslip = require('../models/Payslip');
const PayrollRun = require('../models/PayrollRun');
const Employee = require('../models/Employee');
const { uploadBuffer } = require('../utils/cloudinary');
const { sendEmail } = require('../utils/sendEmail');
const logger = require('../utils/logger');
const { recomputeTotals } = require('./payrollEngine');
const { buildPayslipPdfBuffer } = require('./payslipPdf');
const { inr } = require('./pdfBranding');

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Payment state as employees see it — Paid > Sent > Processed. */
function payslipPaymentStatus(payslip) {
  if (payslip.paidAt) return 'Paid';
  if (payslip.emailStatus === 'Sent') return 'Sent';
  return 'Processed';
}

/**
 * Finalizes a PayrollRun into an immutable Payslip: recomputes totals from
 * the run's current (possibly HR-edited) figures, generates the PDF,
 * uploads it, and emails it. Never mutates a previously-generated Payslip —
 * if this employee/month already has an Active payslip (a re-approval
 * after correction), that one is flipped to Superseded and a new, higher
 * `version` is created instead.
 */
async function finalizeAndSendPayslip(run, { approvedBy = null } = {}) {
  recomputeTotals(run);
  const employee = await Employee.findById(run.employeeId);
  if (!employee) throw new Error('Employee not found for payroll run');

  const previousActive = await Payslip.findOne({ employeeId: run.employeeId, month: run.month, year: run.year, status: 'Active' });
  if (previousActive) {
    previousActive.status = 'Superseded';
    await previousActive.save();
  }

  const payslip = await Payslip.create({
    employeeId: run.employeeId,
    payrollRunId: run._id,
    month: run.month,
    year: run.year,
    version: previousActive ? previousActive.version + 1 : 1,
    status: 'Active',
    employeeSnapshot: {
      name: `${employee.firstName} ${employee.lastName}`,
      employeeId: employee.employeeId,
      designation: employee.roleDept,
      department: employee.roleDept,
      joinDate: employee.joinDate
    },
    earnings: run.earnings,
    deductions: run.deductions,
    attendanceSummary: {
      totalDaysInMonth: run.totalDaysInMonth,
      presentDays: run.presentDays,
      paidLeaveDays: run.paidLeaveDays,
      lopDays: run.lopDays
    },
    grossEarnings: run.grossEarnings,
    totalDeductions: run.totalDeductions,
    netPay: run.netPay,
    generatedBy: approvedBy
  });

  run.status = 'Approved';
  run.approvedBy = run.approvedBy || approvedBy;
  run.approvedAt = run.approvedAt || new Date();
  run.payslipId = payslip._id;
  await run.save();

  let pdfBuffer;
  try {
    pdfBuffer = await buildPayslipPdfBuffer(payslip);
    const publicId = `${employee.employeeId}_${run.year}_${String(run.month).padStart(2, '0')}_v${payslip.version}`;
    const uploaded = await uploadBuffer(pdfBuffer, { folder: 'vedhunt-payslips', public_id: publicId, resource_type: 'raw' });
    payslip.pdfUrl = uploaded.secure_url;
    await payslip.save();
  } catch (error) {
    logger.error(`Payslip PDF generation/upload failed for run ${run._id}:`, error);
  }

  run.status = 'Generated';
  await run.save();

  await sendPayslipEmail(payslip, employee, pdfBuffer);

  run.status = payslip.emailStatus === 'Sent' ? 'Sent' : 'Generated';
  await run.save();

  return payslip;
}

async function sendPayslipEmail(payslip, employee, pdfBuffer) {
  try {
    await sendEmail({
      email: employee.email,
      subject: `Your Payslip for ${MONTH_NAMES[payslip.month - 1]} ${payslip.year}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; color: #333;">
          <h2 style="color: #FF6B35;">Payslip — ${MONTH_NAMES[payslip.month - 1]} ${payslip.year}</h2>
          <p>Hi ${employee.firstName},</p>
          <p>Your payslip for ${MONTH_NAMES[payslip.month - 1]} ${payslip.year} is ready. Net pay: <strong>${inr(payslip.netPay)}</strong>.</p>
          <p>It's attached as a PDF${payslip.pdfUrl ? `, and always available in your Employee Portal under "My Payslips".` : '.'}</p>
        </div>
      `,
      ...(pdfBuffer ? {
        attachments: [{
          filename: `Payslip_${MONTH_NAMES[payslip.month - 1]}_${payslip.year}.pdf`,
          content: pdfBuffer.toString('base64')
        }]
      } : {})
    });
    payslip.emailStatus = 'Sent';
    payslip.sentAt = new Date();
    await payslip.save();
  } catch (error) {
    logger.error(`Payslip email failed for payslip ${payslip._id}:`, error.message);
    payslip.emailStatus = 'Failed';
    await payslip.save();
  }
}

async function resendPayslip(payslipId) {
  const payslip = await Payslip.findById(payslipId);
  if (!payslip) throw new Error('Payslip not found');
  const employee = await Employee.findById(payslip.employeeId);
  const pdfBuffer = await buildPayslipPdfBuffer(payslip);
  await sendPayslipEmail(payslip, employee, pdfBuffer);
  return payslip;
}

module.exports = { buildPayslipPdfBuffer, payslipPaymentStatus, finalizeAndSendPayslip, resendPayslip };
