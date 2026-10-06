// The approved Vedhunt payslip layout: header (logo · company · PAYSLIP
// month), Employee Information, Salary Details, Earnings vs
// Contributions/Deductions, Net Salary Payable (A − B − C) with the amount in
// words, and the notes footer.
const PDFDocument = require('pdfkit');
const Employee = require('../models/Employee');
const bank = require('./bankDetails');
const { decrypt } = require('../utils/encryption');
const { logo, getCompanyProfile, amount, amountInWords, toBuffer } = require('./pdfBranding');

const C = {
  ink: '#111111', muted: '#595959', line: '#3A3A3A', grid: '#BFBFBF',
  orange: '#ED7D31', peach: '#F8CBAD', peachLight: '#FCE4D6',
  green: '#C6EFCE', greenText: '#1E6B34', greenLight: '#E2EFDA', blueText: '#1F3864',
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const EARNINGS = [
  ['basic', 'Basic', true], ['hra', 'HRA', true], ['conveyance', 'Conveyance Allowance', true],
  ['specialAllowance', 'Special Allowance', true], ['medicalAllowance', 'Medical Allowance'],
  ['otherAllowances', 'Other Allowances'], ['bonus', 'Bonus'], ['incentive', 'Incentive'],
  ['reimbursement', 'Reimbursement'], ['arrears', 'Arrears'],
];
const fmtJoin = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : 'N/A');
const or = (v) => (v === undefined || v === null || v === '' ? 'N/A' : String(v));

/**
 * @param {object} payslip Payslip document (plain or Mongoose)
 * @returns {Promise<Buffer>}
 */
async function buildPayslipPdfBuffer(payslip) {
  const [company, employee] = await Promise.all([
    getCompanyProfile(),
    Employee.findById(payslip.employeeId, {
      bankDetails: 1, panNumber: 1, designation: 1, department: 1, subDepartment: 1, pfNumber: 1,
    }).lean(),
  ]);
  const doc = new PDFDocument({ size: 'A4', margin: 30, info: { Title: `Payslip ${MONTHS[payslip.month - 1]} ${payslip.year}` } });
  const done = toBuffer(doc);
  const L = 30;
  const W = doc.page.width - 60;
  const R = L + W;

  // Single-line text; shrinks the font (down to 6pt) rather than wrapping when it doesn't fit.
  const text = (str, x, y, { size = 9, bold = false, italic = false, color = C.ink, width, align = 'left' } = {}) => {
    doc.font(bold ? 'Helvetica-Bold' : italic ? 'Helvetica-Oblique' : 'Helvetica');
    let fitted = size;
    while (width && fitted > 6 && doc.fontSize(fitted).widthOfString(String(str)) > width) fitted -= 0.25;
    doc.fontSize(fitted).fillColor(color).text(String(str), x, y, { width, align, lineBreak: false });
  };
  const hline = (y, color = C.line, w = 0.8) => doc.moveTo(L, y).lineTo(R, y).lineWidth(w).strokeColor(color).stroke();
  const band = (y, label, fill, color = C.ink) => {
    doc.rect(L, y, W, 18).fill(fill);
    text(label, L + 4, y + 5, { size: 10, bold: true, color });
    return y + 22;
  };
  const grid4 = (y, cells) => {
    const col = W / 4;
    for (let row = 0; row < cells.length; row += 4) {
      cells.slice(row, row + 4).forEach(([label, value], i) => {
        text(label, L + i * col + 2, y, { size: 7.5, color: C.muted, width: col - 6 });
        text(value, L + i * col + 2, y + 10, { size: 9.5, bold: true, width: col - 6 });
      });
      y += 26;
    }
    return y;
  };

  // ── Header ──────────────────────────────────────────────────────────────
  if (logo) doc.image(logo, L, 36, { fit: [160, 24] });
  text(company.name, 205, 30, { size: 13, bold: true, width: 260 });
  company.addressShort.forEach((line, i) => text(line, 205, 50 + i * 12, { size: 7.8, color: C.muted, width: R - 130 - 205 }));
  text('PAYSLIP', R - 120, 30, { size: 14, bold: true, width: 120, align: 'right' });
  text(`${MONTHS[payslip.month - 1]}-${String(payslip.year).slice(-2)}`, R - 120, 52, { size: 11, bold: true, color: C.orange, width: 120, align: 'right' });
  if (payslip.version > 1) text(`Revision ${payslip.version}`, R - 120, 66, { size: 7.5, color: C.muted, width: 120, align: 'right' });
  hline(86);

  // ── Employee information ───────────────────────────────────────────────
  const snap = payslip.employeeSnapshot || {};
  const acct = bank.decrypted(employee?.bankDetails || {});
  let y = band(98, 'EMPLOYEE INFORMATION', C.peach);
  y = grid4(y, [
    ['Employee Name', String(snap.name || '').toUpperCase()],
    ['Employee Number', or(snap.employeeId)],
    ['Date Joined', fmtJoin(snap.joinDate)],
    ['Department', or(employee?.department || snap.department)],
    ['Sub Department', or(employee?.subDepartment)],
    ['Designation', or(employee?.designation || snap.designation)],
    ['Payment Mode', acct.accountNumber ? 'Bank Transfer' : 'N/A'],
    ['Bank', or(acct.bankName)],
    ['Bank IFSC', or(acct.ifscCode)],
    ['Bank Account', or(acct.accountNumber)],
    ['PAN Number', or(decrypt(employee?.panNumber || ''))],
    ['PF Number', or(employee?.pfNumber)],
  ]);
  hline(y + 2);

  // ── Salary details ─────────────────────────────────────────────────────
  const att = payslip.attendanceSummary || {};
  const totalDays = att.totalDaysInMonth || 0;
  const lop = att.lopDays || 0;
  const payable = Math.max(0, totalDays - lop);
  y = band(y + 14, 'SALARY DETAILS', C.peach);
  y = grid4(y, [
    ['Actual Payable Days', String(payable)],
    ['Total Working Days', String(totalDays)],
    ['Loss Of Pay Days', lop.toFixed(1)],
    ['Days Payable', String(payable)],
  ]);
  hline(y + 2);

  // ── Earnings | Contributions & Deductions ──────────────────────────────
  y += 18;
  const colW = (W - 14) / 2;
  const leftX = L;
  const rightX = L + colW + 14;
  const ROW = 20;
  const cellRow = (x, rowY, label, value, { fill, bold = false, color = C.ink } = {}) => {
    if (fill) doc.rect(x, rowY, colW, ROW).fill(fill);
    doc.rect(x, rowY, colW * 0.62, ROW).rect(x + colW * 0.62, rowY, colW * 0.38, ROW).lineWidth(0.5).strokeColor(C.grid).stroke();
    text(label, x + 4, rowY + 6, { size: 9, bold, color, width: colW * 0.62 - 8 });
    if (value !== undefined) text(value, x + colW * 0.62, rowY + 6, { size: 9.5, bold, color, width: colW * 0.38 - 6, align: 'right' });
  };
  const header = (x, rowY, label, fill, color) => {
    doc.rect(x, rowY, colW, ROW).fill(fill);
    text(label, x + 4, rowY + 6, { size: 9.5, bold: false, color, width: colW - 8 });
  };

  // Left: earnings
  let ly = y;
  header(leftX, ly, 'EARNINGS', C.green, C.greenText); ly += ROW;
  EARNINGS.filter(([key, , always]) => always || payslip.earnings?.[key]).forEach(([key, label]) => {
    cellRow(leftX, ly, label, amount(payslip.earnings?.[key])); ly += ROW;
  });
  cellRow(leftX, ly, 'Total Earnings (A)', amount(payslip.grossEarnings), { fill: C.green, bold: true, color: C.greenText }); ly += ROW;

  // Right: contributions (PF) and taxes & deductions
  const d = payslip.deductions || {};
  const contributions = d.pf || 0;
  const deductionRows = [
    ['Professional Tax', d.professionalTax, true],
    ['TDS', d.tds],
    ['Loss of Pay', d.lopDeduction],
    [d.otherDeductionsReason ? `Other (${d.otherDeductionsReason})` : 'Other Deductions', d.otherDeductions],
  ].filter(([, value, always]) => always || value);
  const totalDeductions = Math.max(0, (payslip.totalDeductions || 0) - contributions);

  let ry = y;
  header(rightX, ry, 'CONTRIBUTIONS', C.peach, C.blueText); ry += ROW;
  cellRow(rightX, ry, 'PF Employee', amount(contributions)); ry += ROW;
  cellRow(rightX, ry, 'Total Contributions (B)', amount(contributions), { bold: true }); ry += ROW;
  header(rightX, ry, 'TAXES & DEDUCTIONS', C.peach, C.blueText); ry += ROW;
  deductionRows.forEach(([label, value]) => { cellRow(rightX, ry, label, amount(value)); ry += ROW; });
  cellRow(rightX, ry, 'Total Deductions (C)', amount(totalDeductions), { fill: C.peach, bold: true, color: C.blueText }); ry += ROW;

  // ── Net salary ─────────────────────────────────────────────────────────
  y = Math.max(ly, ry) + 16;
  doc.rect(L, y, W, 22).fill(C.greenLight);
  doc.rect(L, y, W * 0.6, 22).rect(L + W * 0.6, y, W * 0.4, 22).lineWidth(0.5).strokeColor(C.grid).stroke();
  text('Net Salary Payable ( A - B - C )', L + 4, y + 7, { size: 10, bold: true, color: C.greenText });
  text(amount(payslip.netPay, { dashZero: false }), L + W * 0.6, y + 7, { size: 10.5, bold: true, color: C.greenText, width: W * 0.4 - 6, align: 'right' });
  y += 22;
  doc.rect(L, y, W, 18).fill(C.peachLight);
  text(`Net Salary in words: ${amountInWords(payslip.netPay, { hyphen: true })}`, L + 4, y + 5, { size: 8.5, italic: true, color: C.muted, width: W - 8 });

  // ── Notes ──────────────────────────────────────────────────────────────
  y += 34;
  hline(y, C.line, 0.6);
  text('Note: All amounts displayed in this payslip are in INR.', L + 2, y + 6, { size: 8, italic: true, color: C.muted });
  if (payslip.paidAt) {
    const paidOn = new Date(payslip.paidAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    text(`Salary credited on ${paidOn} via Bank Transfer${payslip.paymentReference ? `  ·  UTR: ${payslip.paymentReference}` : ''}`, R - 300, y + 6, { size: 8, bold: true, color: C.greenText, width: 298, align: 'right' });
  }
  text('This is a system-generated salary slip and does not require a signature.', L + 2, y + 22, { size: 8, italic: true, color: C.muted });
  hline(y + 36, C.line, 0.6);

  doc.end();
  return done;
}

module.exports = { buildPayslipPdfBuffer };
