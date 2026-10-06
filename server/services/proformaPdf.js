// Proforma invoice in the approved Vedhunt format: company header, blue-ruled
// GSTIN/Proforma box, customer detail, line items with HSN/SAC and GST, then
// totals, amount in words, bank details, payment terms and signatory.
// Inter-state supply → IGST; within the company's state → CGST + SGST.
const PDFDocument = require('pdfkit');
const { logo, getCompanyProfile, amountInWords, toBuffer, fmtDate } = require('./pdfBranding');
const { GST_STATE_CODES } = require('../config/gstStates');

const BLUE = '#2E75B6';
const BLUE_TINT = '#E9F2FB';
const INK = '#111111';
const MUTED = '#444444';

const PAYMENT_TERMS = [
  ['Advance Payment', 'Applicable advance payment must be received before commencement of the project/service.'],
  ['Balance Payment', 'The remaining amount shall be payable as per the agreed payment schedule or before final delivery/handover, as specified in the quotation/proposal.'],
  ['Payment Due Date', 'All payments must be made within the agreed payment period mentioned in the quotation, invoice, or agreement.'],
  ['Late Payment', 'Delay in payment may result in suspension of ongoing work, services, access, or deliverables until the outstanding amount is cleared.'],
  ['Timeline Impact', 'Any delay in payment, approvals, content, credentials, or required information from the client may result in a corresponding extension of the project timeline.'],
  ['Additional Work', 'Any work, feature, revision, integration, or service outside the approved scope shall be charged separately after client approval.'],
  ['Third-Party Charges', 'Domain, hosting, plugins, APIs, software, advertising platforms, payment gateway charges, licenses, and other third-party costs shall be payable separately unless specifically included in the quotation.'],
  ['Taxes', 'GST and other applicable statutory taxes/charges shall be charged as applicable.'],
  ['Refund Policy', 'Payments made against completed work, delivered services, approved milestones, or non-recoverable third-party costs shall generally be non-refundable, unless otherwise agreed in writing.'],
  ['Final Handover', 'Final files, credentials, source code, website/app deployment, or other handover items may be released subject to clearance of all outstanding payments.'],
];

// Unit abbreviations printed after the quantity ("1.00 MO")
const UOM_SHORT = { Month: 'MO', Year: 'YR', Project: 'PRJ', Session: 'SES', Video: 'VID', Package: 'PKG' };
const uomShort = (uom) => UOM_SHORT[uom] || String(uom || '').slice(0, 3).toUpperCase();
const money = (n) => (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function buildProformaPdfBuffer(proposal) {
  const company = await getCompanyProfile();
  const doc = new PDFDocument({ size: 'A4', margin: 30, info: { Title: `Proforma ${proposal.proformaNumber}` } });
  const done = toBuffer(doc);
  const L = 30;
  const W = doc.page.width - 60;
  const R = L + W;
  const d = proposal.details || {};
  const items = proposal.items || [];

  const placeOfSupply = d.placeOfSupply || company.state;
  const stateCode = GST_STATE_CODES[placeOfSupply];
  const intraState = placeOfSupply === company.state;

  const t = (str, x, y, { size = 8.5, bold = false, italic = false, color = INK, width, align = 'left', lineBreak = true } = {}) => {
    doc.font(bold ? (italic ? 'Helvetica-BoldOblique' : 'Helvetica-Bold') : italic ? 'Helvetica-Oblique' : 'Helvetica')
      .fontSize(size).fillColor(color).text(String(str ?? ''), x, y, { width, align, lineBreak });
    return doc.y;
  };
  const box = (x, y, w, h, fill) => {
    if (fill) doc.rect(x, y, w, h).fill(fill);
    doc.rect(x, y, w, h).lineWidth(1).strokeColor(BLUE).stroke();
  };

  // ── Company header ─────────────────────────────────────────────────────
  if (logo) doc.image(logo, L, 52, { fit: [80, 14] });
  t(company.legalName, L + 90, 26, { size: 15, bold: true, width: 280 });
  let hy = doc.y + 4;
  company.addressLines.forEach((line) => { hy = t(line, L + 90, hy, { size: 8, width: 300 }); });
  // Right-aligned "Label : value" lines (bold label), as on the template
  [['Phone', company.phone], ['Email', company.email], ['Website', `https://${company.website.replace(/^www\./, '')}/`]].forEach(([k, v], i) => {
    const valueW = doc.font('Helvetica').fontSize(8).widthOfString(v);
    const labelW = doc.font('Helvetica-Bold').fontSize(8).widthOfString(`${k} : `);
    t(`${k} : `, R - valueW - labelW, 34 + i * 11, { size: 8, bold: true, lineBreak: false });
    t(v, R - valueW, 34 + i * 11, { size: 8, lineBreak: false });
  });

  // ── GSTIN / Proforma title ─────────────────────────────────────────────
  let y = Math.max(hy, 80) + 10;
  box(L, y, W, 22);
  doc.font('Helvetica-Bold').fontSize(11).fillColor(INK).text('GSTIN : ', L + 6, y + 6, { continued: true }).font('Helvetica').text(company.gstin);
  t('Proforma', L, y + 4, { size: 15, bold: true, color: BLUE, width: W, align: 'center' });
  y += 22;

  // ── Customer detail | proforma number/date ─────────────────────────────
  const half = W * 0.4;
  const customerRows = [
    ['M/S', d.clientName],
    ['Address', d.address],
    ['Phone', d.phone],
    ['GSTIN', d.gstin],
    ['PAN', d.pan],
    ['Place of Supply', `${placeOfSupply}${stateCode ? ` ( ${stateCode} )` : ''}`],
  ].filter(([, v]) => v);
  t('Customer Detail', L, y + 4, { size: 8, bold: true, width: half, align: 'center' });
  let cy = y + 18;
  doc.moveTo(L, y + 15).lineTo(L + half, y + 15).lineWidth(1).strokeColor(BLUE).stroke();
  customerRows.forEach(([k, v]) => {
    t(k, L + 6, cy, { size: 8, bold: true, width: 60 });
    const end = t(v, L + 70, cy, { size: 8, width: half - 76 });
    cy = Math.max(end, cy + 11) + 2;
  });
  t('Proforma No.', L + half + 6, y + 6, { size: 8.5 });
  t(String(proposal.proformaNumber), L + half + 110, y + 6, { size: 9, bold: true });
  t('Proforma Date', L + half + 200, y + 6, { size: 8.5 });
  t(fmtDate(proposal.proformaDate || new Date()), R - 70, y + 6, { size: 8.5, width: 64, align: 'right' });
  if (proposal.proposalNumber) t(`Ref: ${proposal.proposalNumber} v${proposal.version}`, L + half + 6, y + 22, { size: 7.5, color: MUTED });
  const custH = Math.max(cy - y + 4, 70);
  box(L, y, half, custH);
  box(L + half, y, W - half, custH);
  y += custH + 10;

  // ── Items table ────────────────────────────────────────────────────────
  // [label, width, align, taxCol]
  const taxCols = intraState ? [['CGST'], ['SGST']] : [['IGST']];
  // Intra-state needs two tax groups, so the other columns narrow to fit.
  const w = intraState
    ? { name: 110, sac: 44, qty: 46, rate: 50, taxable: 58, pct: 24, amt: 44 }
    : { name: 170, sac: 50, qty: 52, rate: 55, taxable: 62, pct: 26, amt: 52 };
  const cols = [
    { key: 'sr', label: 'Sr.\nNo.', w: 24, align: 'center' },
    { key: 'name', label: 'Name of Product / Service', w: w.name, align: 'left' },
    { key: 'sac', label: 'HSN / SAC', w: w.sac, align: 'center' },
    { key: 'qty', label: 'Qty', w: w.qty, align: 'center' },
    { key: 'rate', label: 'Rate', w: w.rate, align: 'right' },
    { key: 'taxable', label: 'Taxable Value', w: w.taxable, align: 'right', tint: true },
  ];
  taxCols.forEach(([name]) => {
    cols.push({ key: `${name}pct`, label: '%', group: name, w: w.pct, align: 'center' });
    cols.push({ key: `${name}amt`, label: 'Amount', group: name, w: w.amt, align: 'right', tint: true });
  });
  const fixed = cols.reduce((s, c) => s + c.w, 0);
  cols.push({ key: 'total', label: 'Total', w: W - fixed, align: 'right', tint: true });
  let x = L;
  cols.forEach((c) => { c.x = x; x += c.w; });

  const headH = 30;
  const drawHeader = (top) => {
    box(L, top, W, headH, BLUE_TINT);
    cols.forEach((c) => {
      if (c.group) {
        if (c.label === '%') {
          const span = c.w + cols.find((o) => o.group === c.group && o.label === 'Amount').w;
          t(c.group, c.x, top + 4, { size: 7.5, bold: true, width: span, align: 'center' });
          doc.moveTo(c.x, top + 15).lineTo(c.x + span, top + 15).strokeColor(BLUE).stroke();
        }
        t(c.label, c.x, top + 19, { size: 7, bold: true, width: c.w, align: 'center' });
      } else {
        t(c.label, c.x + 2, top + (c.label.includes('\n') ? 6 : 11), { size: 7.5, bold: true, width: c.w - 4, align: 'center' });
      }
    });
  };
  // In the header, the %/Amount divider starts below the group label.
  const columnLines = (top, bottom, { header = false } = {}) => cols.slice(1).forEach((c) => {
    const splitsGroup = header && c.group && c.label === 'Amount';
    doc.moveTo(c.x, splitsGroup ? top + 15 : top).lineTo(c.x, bottom).lineWidth(1).strokeColor(BLUE).stroke();
  });

  drawHeader(y);
  const headerTop = y;
  y += headH;
  const bodyTop = y;
  const rowTax = (item) => (intraState
    ? { CGSTpct: item.gstPercent / 2, CGSTamt: item.gstAmount / 2, SGSTpct: item.gstPercent / 2, SGSTamt: item.gstAmount / 2 }
    : { IGSTpct: item.gstPercent, IGSTamt: item.gstAmount });

  // Tint the value columns for the whole body, as on the template.
  const bodyBottom = doc.page.height - 70;
  cols.filter((c) => c.tint).forEach((c) => doc.rect(c.x, bodyTop, c.w, bodyBottom - bodyTop).fill(BLUE_TINT));
  items.forEach((item, i) => {
    const nameCol = cols[1];
    t(item.service, nameCol.x + 3, y + 4, { size: 8.5, bold: true, width: nameCol.w - 6 });
    const descEnd = item.description ? t(item.description, nameCol.x + 3, doc.y, { size: 8, italic: true, width: nameCol.w - 6 }) : doc.y;
    const tax = rowTax(item);
    const values = {
      sr: String(i + 1), sac: item.sac, qty: `${Number(item.qty).toFixed(2)} ${uomShort(item.uom)}`,
      rate: money(item.rate), taxable: money(item.taxable), total: money(item.total),
      ...Object.fromEntries(Object.entries(tax).map(([k, v]) => [k, k.endsWith('pct') ? Number(v).toFixed(2) : money(v)])),
    };
    cols.forEach((c) => { if (c.key !== 'name') t(values[c.key], c.x + 2, y + 4, { size: 8.5, width: c.w - 4, align: c.align }); });
    y = Math.max(descEnd, y + 16) + 8;
  });

  // Total row pinned to the bottom of the body, like the template
  const totalY = bodyBottom;
  box(L, headerTop, W, totalY + 18 - headerTop);
  columnLines(headerTop, headerTop + headH, { header: true });
  columnLines(headerTop + headH, totalY + 18);
  doc.moveTo(L, totalY).lineTo(R, totalY).strokeColor(BLUE).stroke();
  doc.rect(L, totalY, W, 18).fill(BLUE_TINT);
  box(L, totalY, W, 18);
  columnLines(totalY, totalY + 18);
  const uoms = [...new Set(items.map((i) => uomShort(i.uom)))];
  const sumQty = items.reduce((s, i) => s + Number(i.qty), 0);
  const totals = {
    name: 'Total',
    qty: uoms.length === 1 ? `${sumQty.toFixed(2)} ${uoms[0]}` : '',
    taxable: money(proposal.projectValue),
    total: money(proposal.totalAmount),
    ...(intraState
      ? { CGSTamt: money(proposal.gstAmount / 2), SGSTamt: money(proposal.gstAmount / 2) }
      : { IGSTamt: money(proposal.gstAmount) }),
  };
  cols.forEach((c) => {
    if (totals[c.key]) t(totals[c.key], c.x + 2, totalY + 5, { size: 8.5, bold: true, width: c.w - 6, align: c.key === 'name' ? 'right' : c.align });
  });

  // ── Page 2: totals, words, bank, terms, signatory ─────────────────────
  doc.addPage();
  y = 30;
  const leftW = W * 0.6;
  const rightX = L + leftW;
  const rightW = W - leftW;
  const sectionHead = (label, top, wx = L, ww = leftW) => {
    box(wx, top, ww, 16);
    t(label, wx, top + 4, { size: 8.5, bold: true, width: ww, align: 'center' });
    return top + 16;
  };

  // Left column
  let ly = sectionHead('Total in words', y);
  t(amountInWords(proposal.totalAmount, { upper: true }), L, ly + 10, { size: 8.5, width: leftW, align: 'center' });
  ly += 34; box(L, y + 16, leftW, 34);
  ly = sectionHead('Bank Details', ly);
  const bankRows = [['Name', company.bank.bankName], ['Branch', company.bank.branch], ['Acc. Name', company.bank.accountName], ['Acc. Number', company.bank.accountNumber], ['IFSC', company.bank.ifsc]];
  const bankTop = ly;
  bankRows.forEach(([k, v], i) => {
    t(k, L + 10, ly + 6 + i * 15, { size: 8.5 });
    t(v, L + 140, ly + 6 + i * 15, { size: 8.5 });
  });
  ly += bankRows.length * 15 + 10;
  box(L, bankTop, leftW, ly - bankTop);
  ly = sectionHead('Payment Terms', ly);
  const termsTop = ly;
  ly += 4;
  PAYMENT_TERMS.forEach(([k, v]) => {
    doc.font('Helvetica-Bold').fontSize(8).fillColor(INK).text(`${k}: `, L + 6, ly, { width: leftW - 12, continued: true }).font('Helvetica').text(v);
    ly = doc.y + 1;
  });
  if (d.paymentTerms) {
    doc.font('Helvetica-Bold').fontSize(8).text('Agreed Terms: ', L + 6, ly, { width: leftW - 12, continued: true }).font('Helvetica').text(d.paymentTerms);
    ly = doc.y + 1;
  }
  ly += 4;
  box(L, termsTop, leftW, ly - termsTop);

  // Right column
  let ry = y;
  const sumRow = (label, value, { bold = false, size = 8.5, fill } = {}) => {
    if (fill) doc.rect(rightX, ry, rightW, 18).fill(fill);
    box(rightX, ry, rightW, 18);
    t(label, rightX + 6, ry + 5, { size: 8.5, bold: true, width: rightW / 2 });
    t(value, rightX + rightW / 2, ry + (size > 9 ? 3 : 5), { size, bold, width: rightW / 2 - 6, align: 'right' });
    ry += 18;
  };
  sumRow('Taxable Amount', money(proposal.projectValue), { bold: true });
  if (intraState) {
    sumRow('Add : CGST', money(proposal.gstAmount / 2), { bold: true });
    sumRow('Add : SGST', money(proposal.gstAmount / 2), { bold: true });
  } else {
    sumRow('Add : IGST', money(proposal.gstAmount), { bold: true });
  }
  sumRow('Total Tax', money(proposal.gstAmount), { bold: true });
  sumRow('Total Amount After Tax', `Rs. ${money(proposal.totalAmount)}`, { bold: true, size: 11, fill: BLUE_TINT });
  box(rightX, ry, rightW, 16); t('(E & O.E.)', rightX, ry + 4, { size: 8, bold: true, width: rightW - 6, align: 'right' }); ry += 16;
  const certTop = ry;
  t('Certified that the particulars given above are true and correct.', rightX, ry + 6, { size: 7, bold: true, width: rightW, align: 'center' });
  t(`For ${company.legalName}`, rightX, ry + 20, { size: 9.5, bold: true, width: rightW, align: 'center' });
  ry += 38;
  box(rightX, certTop, rightW, 38);
  const signBottom = Math.max(ly, ry + 120) - 16;
  box(rightX, ry, rightW, signBottom - ry);
  box(rightX, signBottom, rightW, 16);
  t('Authorised Signatory', rightX, signBottom + 4, { size: 8, bold: true, width: rightW, align: 'center' });

  doc.end();
  return done;
}

module.exports = { buildProformaPdfBuffer };
