const PDFDocument = require('pdfkit');
const Payslip = require('../models/Payslip');
const PayrollRun = require('../models/PayrollRun');
const Employee = require('../models/Employee');
const { uploadBuffer } = require('../utils/cloudinary');
const { sendEmail } = require('../utils/sendEmail');
const logger = require('../utils/logger');
const { recomputeTotals } = require('./payrollEngine');

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const EARNING_LABELS = {
  basic: 'Basic', hra: 'HRA', specialAllowance: 'Special Allowance', conveyance: 'Conveyance',
  medicalAllowance: 'Medical Allowance', otherAllowances: 'Other Allowances',
  bonus: 'Bonus', incentive: 'Incentive', reimbursement: 'Reimbursement', arrears: 'Arrears'
};
const DEDUCTION_LABELS = {
  lopDeduction: 'Loss of Pay', pf: 'Provident Fund (PF)', professionalTax: 'Professional Tax',
  tds: 'TDS', otherDeductions: 'Other Deductions'
};

const inr = (n) => `Rs. ${Math.round(n || 0).toLocaleString('en-IN')}`;

function buildPayslipPdfBuffer(payslip) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).font('Helvetica-Bold').text('Vedhunt', { align: 'left' });
    doc.fontSize(11).font('Helvetica').fillColor('#555').text('Payslip', { align: 'left' });
    doc.moveDown(0.3);
    doc.fontSize(13).fillColor('#000').font('Helvetica-Bold')
      .text(`${MONTH_NAMES[payslip.month - 1]} ${payslip.year}`);
    doc.moveDown(1);

    doc.fontSize(10).font('Helvetica');
    const info = [
      ['Employee Name', payslip.employeeSnapshot.name],
      ['Employee ID', payslip.employeeSnapshot.employeeId],
      ['Department / Designation', payslip.employeeSnapshot.department || '-'],
      ['Date of Joining', payslip.employeeSnapshot.joinDate ? new Date(payslip.employeeSnapshot.joinDate).toLocaleDateString('en-IN') : '-']
    ];
    info.forEach(([label, value]) => {
      doc.font('Helvetica-Bold').text(`${label}: `, { continued: true }).font('Helvetica').text(String(value));
    });
    doc.moveDown(0.5);

    const att = payslip.attendanceSummary || {};
    doc.font('Helvetica-Bold').text('Attendance: ', { continued: true }).font('Helvetica')
      .text(`${att.totalDaysInMonth || 0} days in month | ${att.presentDays || 0} present | ${att.paidLeaveDays || 0} paid leave | ${att.lopDays || 0} LOP`);
    doc.moveDown(1);

    // Earnings / Deductions two-column table
    const colWidth = 245;
    const leftX = doc.x;
    const rightX = leftX + colWidth + 20;
    let y = doc.y;

    doc.font('Helvetica-Bold').fontSize(11);
    doc.text('Earnings', leftX, y);
    doc.text('Deductions', rightX, y);
    y += 18;
    doc.moveTo(leftX, y).lineTo(leftX + colWidth, y).strokeColor('#ddd').stroke();
    doc.moveTo(rightX, y).lineTo(rightX + colWidth, y).stroke();
    y += 8;

    doc.font('Helvetica').fontSize(10);
    const earningRows = Object.entries(EARNING_LABELS)
      .filter(([key]) => payslip.earnings[key])
      .map(([key, label]) => [label, inr(payslip.earnings[key])]);
    const deductionRows = Object.entries(DEDUCTION_LABELS)
      .filter(([key]) => payslip.deductions[key])
      .map(([key, label]) => [label, inr(payslip.deductions[key])]);

    const rowCount = Math.max(earningRows.length, deductionRows.length, 1);
    for (let i = 0; i < rowCount; i++) {
      const rowY = y + i * 18;
      if (earningRows[i]) {
        doc.text(earningRows[i][0], leftX, rowY, { width: colWidth - 70, continued: false });
        doc.text(earningRows[i][1], leftX + colWidth - 70, rowY, { width: 70, align: 'right' });
      }
      if (deductionRows[i]) {
        doc.text(deductionRows[i][0], rightX, rowY, { width: colWidth - 70, continued: false });
        doc.text(deductionRows[i][1], rightX + colWidth - 70, rowY, { width: 70, align: 'right' });
      }
    }

    y += rowCount * 18 + 10;
    doc.moveTo(leftX, y).lineTo(leftX + colWidth, y).stroke();
    doc.moveTo(rightX, y).lineTo(rightX + colWidth, y).stroke();
    y += 6;
    doc.font('Helvetica-Bold');
    doc.text('Gross Earnings', leftX, y, { width: colWidth - 70 });
    doc.text(inr(payslip.grossEarnings), leftX + colWidth - 70, y, { width: 70, align: 'right' });
    doc.text('Total Deductions', rightX, y, { width: colWidth - 70 });
    doc.text(inr(payslip.totalDeductions), rightX + colWidth - 70, y, { width: 70, align: 'right' });

    y += 40;
    doc.rect(leftX, y, rightX + colWidth - leftX, 34).fillAndStroke('#FFF2EB', '#FF6B35');
    doc.fillColor('#111').fontSize(13).text('Net Pay', leftX + 15, y + 10, { continued: true })
      .text(`   ${inr(payslip.netPay)}`, { align: 'left' });

    doc.fontSize(8).fillColor('#888').font('Helvetica')
      .text('This is a system-generated payslip.', leftX, y + 60);

    doc.end();
  });
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

module.exports = { buildPayslipPdfBuffer, finalizeAndSendPayslip, resendPayslip };
