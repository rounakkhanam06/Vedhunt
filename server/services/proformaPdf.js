// Proforma / tax invoice in the approved Vedhunt format: company header, blue-ruled
// GSTIN/title box, customer detail, line items with HSN/SAC and GST, then
// totals, amount in words, bank details, terms and signatory.
// Inter-state supply → IGST; within the company's state → CGST + SGST.
//
// One renderer for every bill-like document:
//   • buildProformaPdfBuffer(proposal)   — the proforma raised from a final proposal
//   • buildBillDocPdfBuffer(spec)        — Invoice Manager's proforma / tax invoice
//                                           (services/invoiceDocument.js)
// A document whose terms are short fits on one page; long terms (the proposal
// proforma's payment terms) continue on a second page.
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

/**
 * @param {object} spec
 * @param {string} spec.title        printed in blue in the title box ("Proforma", "TAX INVOICE")
 * @param {string} spec.pdfTitle     PDF metadata title
 * @param {string} spec.noLabel      "Proforma No." / "Invoice No."
 * @param {string|number} spec.number
 * @param {string} spec.dateLabel    "Proforma Date" / "Invoice Date"
 * @param {Date}   spec.date
 * @param {string} [spec.ref]        small reference under the number
 * @param {boolean} [spec.original]  prints "ORIGINAL FOR RECIPIENT" in the title box
 * @param {object} spec.customer     { nameLabel, name, address, phone, gstin, pan, placeOfSupply, dashEmptyGstin }
 * @param {object[]} spec.items      { service, description, sac, qty, uom, rate, taxable, gstPercent, gstAmount, total }
 * @param {number} spec.taxable      spec.gstAmount  spec.totalAmount
 * @param {object} spec.terms        { title, rows: [[label, text]] } or { title, lines: [text] }
 * @param {string} [spec.agreedTerms]
 * @param {boolean} [spec.fitOnePage] put the totals, bank and terms under the table when they fit
 *                                    (otherwise they go on a second page)
 */
async function buildBillDocPdfBuffer(spec) {
  const company = await getCompanyProfile();
  const doc = new PDFDocument({ size: 'A4', margin: 30, info: { Title: spec.pdfTitle } });
  const done = toBuffer(doc);
  const L = 30;
  const W = doc.page.width - 60;
  const R = L + W;
  const c = spec.customer || {};
  const items = spec.items || [];

  const placeOfSupply = c.placeOfSupply || company.state;
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

  // ── GSTIN / title ──────────────────────────────────────────────────────
  let y = Math.max(hy, 80) + 10;
  box(L, y, W, 22);
  doc.font('Helvetica-Bold').fontSize(11).fillColor(INK).text('GSTIN : ', L + 6, y + 6, { continued: true }).font('Helvetica').text(company.gstin);
  t(spec.title, L, y + 4, { size: 15, bold: true, color: BLUE, width: W, align: 'center' });
  if (spec.original) t('ORIGINAL FOR RECIPIENT', R - 156, y + 8, { size: 7.5, bold: true, width: 150, align: 'right', lineBreak: false });
  y += 22;

  // ── Customer detail | number/date ──────────────────────────────────────
  const half = W * 0.4;
  const customerRows = [
    [c.nameLabel || 'M/S', c.name],
    ['Address', c.address],
    ['Phone', c.phone],
    ['GSTIN', c.gstin || (c.dashEmptyGstin ? '-' : '')],
    ['PAN', c.pan],
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
  t(spec.noLabel, L + half + 6, y + 6, { size: 8.5 });
  t(String(spec.number), L + half + 110, y + 6, { size: 9, bold: true });
  t(spec.dateLabel, L + half + 200, y + 6, { size: 8.5 });
  t(fmtDate(spec.date || new Date()), R - 70, y + 6, { size: 8.5, width: 64, align: 'right' });
  if (spec.ref) t(spec.ref, L + half + 6, y + 22, { size: 7.5, color: MUTED });
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
  const fixed = cols.reduce((s, col) => s + col.w, 0);
  cols.push({ key: 'total', label: 'Total', w: W - fixed, align: 'right', tint: true });
  let x = L;
  cols.forEach((col) => { col.x = x; x += col.w; });

  const headH = 30;
  const drawHeader = (top) => {
    box(L, top, W, headH, BLUE_TINT);
    cols.forEach((col) => {
      if (col.group) {
        if (col.label === '%') {
          const span = col.w + cols.find((o) => o.group === col.group && o.label === 'Amount').w;
          t(col.group, col.x, top + 4, { size: 7.5, bold: true, width: span, align: 'center' });
          doc.moveTo(col.x, top + 15).lineTo(col.x + span, top + 15).strokeColor(BLUE).stroke();
        }
        t(col.label, col.x, top + 19, { size: 7, bold: true, width: col.w, align: 'center' });
      } else {
        t(col.label, col.x + 2, top + (col.label.includes('\n') ? 6 : 11), { size: 7.5, bold: true, width: col.w - 4, align: 'center' });
      }
    });
  };
  // In the header, the %/Amount divider starts below the group label.
  const columnLines = (top, bottom, { header = false } = {}) => cols.slice(1).forEach((col) => {
    const splitsGroup = header && col.group && col.label === 'Amount';
    doc.moveTo(col.x, splitsGroup ? top + 15 : top).lineTo(col.x, bottom).lineWidth(1).strokeColor(BLUE).stroke();
  });

  // Right column of the lower block is the taller of the two with short terms
  const leftW = W * 0.6;
  const rightX = L + leftW;
  const rightW = W - leftW;
  const terms = spec.terms || { title: 'Terms and Conditions', lines: [] };
  const termsHeight = () => {
    let h = 4;
    if (terms.rows) {
      terms.rows.forEach(([k, v]) => { h += doc.font('Helvetica').fontSize(8).heightOfString(`${k}: ${v}`, { width: leftW - 12 }) + 1; });
    } else {
      (terms.lines || []).forEach((line) => { h += doc.font('Helvetica').fontSize(8).heightOfString(line, { width: leftW - 12 }) + 1; });
    }
    if (spec.agreedTerms) h += doc.font('Helvetica').fontSize(8).heightOfString(`Agreed Terms: ${spec.agreedTerms}`, { width: leftW - 12 }) + 1;
    return h + 4;
  };
  const bankRows = [['Name', company.bank.bankName], ['Branch', company.bank.branch], ['Acc. Name', company.bank.accountName], ['Acc. Number', company.bank.accountNumber], ['IFSC', company.bank.ifsc]];
  const leftH = 50 + 16 + bankRows.length * 15 + 10 + 16 + termsHeight();
  const lowerH = Math.max(leftH, 90 + 16 + 38 + 120 + 16);

  drawHeader(y);
  const headerTop = y;
  y += headH;
  const bodyTop = y;
  const rowTax = (item) => (intraState
    ? { CGSTpct: item.gstPercent / 2, CGSTamt: item.gstAmount / 2, SGSTpct: item.gstPercent / 2, SGSTamt: item.gstAmount / 2 }
    : { IGSTpct: item.gstPercent, IGSTamt: item.gstAmount });

  // Lay the rows out first (off-page) to learn how tall the body needs to be,
  // then decide between one page and two.
  const rowTop = bodyTop;
  let rowsEnd = rowTop;
  const nameCol = cols[1];
  const rowHeights = items.map((item) => {
    const serviceH = doc.font('Helvetica-Bold').fontSize(8.5).heightOfString(String(item.service || ''), { width: nameCol.w - 6 });
    const descH = item.description ? doc.font('Helvetica-Oblique').fontSize(8).heightOfString(item.description, { width: nameCol.w - 6 }) : 0;
    return Math.max(4 + serviceH + descH, 16) + 8;
  });
  rowHeights.forEach((h) => { rowsEnd += h; });

  const pageBottom = doc.page.height - 30;
  const MIN_BODY = 150;
  const onePage = Boolean(spec.fitOnePage) && rowsEnd + 6 + 18 + lowerH <= pageBottom && bodyTop + MIN_BODY + 18 + lowerH <= pageBottom;
  // One page: the Total row sits just under the items (at least MIN_BODY tall) and the
  // lower block follows it. Two pages: the Total row is pinned to the page bottom.
  const bodyBottom = onePage
    ? Math.min(Math.max(rowsEnd + 6, bodyTop + MIN_BODY), pageBottom - 18 - lowerH)
    : doc.page.height - 70;

  // Tint the value columns for the whole body, as on the template.
  cols.filter((col) => col.tint).forEach((col) => doc.rect(col.x, bodyTop, col.w, bodyBottom - bodyTop).fill(BLUE_TINT));
  items.forEach((item, i) => {
    t(item.service, nameCol.x + 3, y + 4, { size: 8.5, bold: true, width: nameCol.w - 6 });
    const descEnd = item.description ? t(item.description, nameCol.x + 3, doc.y, { size: 8, italic: true, width: nameCol.w - 6 }) : doc.y;
    const tax = rowTax(item);
    const qty = `${Number(item.qty).toFixed(2)}${item.uom ? ` ${uomShort(item.uom)}` : ''}`;
    const values = {
      sr: String(i + 1), sac: item.sac, qty,
      rate: money(item.rate), taxable: money(item.taxable), total: money(item.total),
      ...Object.fromEntries(Object.entries(tax).map(([k, v]) => [k, k.endsWith('pct') ? Number(v).toFixed(2) : money(v)])),
    };
    cols.forEach((col) => { if (col.key !== 'name') t(values[col.key], col.x + 2, y + 4, { size: 8.5, width: col.w - 4, align: col.align }); });
    y = Math.max(descEnd, y + 16) + 8;
  });

  // Total row
  const totalY = bodyBottom;
  box(L, headerTop, W, totalY + 18 - headerTop);
  columnLines(headerTop, headerTop + headH, { header: true });
  columnLines(headerTop + headH, totalY + 18);
  doc.moveTo(L, totalY).lineTo(R, totalY).strokeColor(BLUE).stroke();
  doc.rect(L, totalY, W, 18).fill(BLUE_TINT);
  box(L, totalY, W, 18);
  columnLines(totalY, totalY + 18);
  const uoms = [...new Set(items.map((i) => i.uom ? uomShort(i.uom) : ''))];
  const sumQty = items.reduce((s, i) => s + Number(i.qty), 0);
  const totals = {
    name: 'Total',
    qty: uoms.length === 1 ? `${sumQty.toFixed(2)}${uoms[0] ? ` ${uoms[0]}` : ''}` : '',
    taxable: money(spec.taxable),
    total: money(spec.totalAmount),
    ...(intraState
      ? { CGSTamt: money(spec.gstAmount / 2), SGSTamt: money(spec.gstAmount / 2) }
      : { IGSTamt: money(spec.gstAmount) }),
  };
  cols.forEach((col) => {
    if (totals[col.key]) t(totals[col.key], col.x + 2, totalY + 5, { size: 8.5, bold: true, width: col.w - 6, align: col.key === 'name' ? 'right' : col.align });
  });

  // ── Lower block: totals, words, bank, terms, signatory ─────────────────
  if (onePage) {
    y = totalY + 18;
  } else {
    doc.addPage();
    y = 30;
  }
  const sectionHead = (label, top, wx = L, ww = leftW) => {
    box(wx, top, ww, 16);
    t(label, wx, top + 4, { size: 8.5, bold: true, width: ww, align: 'center' });
    return top + 16;
  };

  // Left column
  let ly = sectionHead('Total in words', y);
  t(amountInWords(spec.totalAmount, { upper: true }), L, ly + 10, { size: 8.5, width: leftW, align: 'center' });
  ly += 34; box(L, y + 16, leftW, 34);
  ly = sectionHead('Bank Details', ly);
  const bankTop = ly;
  bankRows.forEach(([k, v], i) => {
    t(k, L + 10, ly + 6 + i * 15, { size: 8.5 });
    t(v, L + 140, ly + 6 + i * 15, { size: 8.5 });
  });
  ly += bankRows.length * 15 + 10;
  box(L, bankTop, leftW, ly - bankTop);
  ly = sectionHead(terms.title || 'Terms and Conditions', ly);
  const termsTop = ly;
  ly += 4;
  if (terms.rows) {
    terms.rows.forEach(([k, v]) => {
      doc.font('Helvetica-Bold').fontSize(8).fillColor(INK).text(`${k}: `, L + 6, ly, { width: leftW - 12, continued: true }).font('Helvetica').text(v);
      ly = doc.y + 1;
    });
  } else {
    (terms.lines || []).forEach((line) => { ly = t(line, L + 6, ly, { size: 8, width: leftW - 12 }) + 1; });
  }
  if (spec.agreedTerms) {
    doc.font('Helvetica-Bold').fontSize(8).fillColor(INK).text('Agreed Terms: ', L + 6, ly, { width: leftW - 12, continued: true }).font('Helvetica').text(spec.agreedTerms);
    ly = doc.y + 1;
  }
  ly += 4;

  // Right column
  let ry = y;
  const sumRow = (label, value, { bold = false, size = 8.5, fill } = {}) => {
    if (fill) doc.rect(rightX, ry, rightW, 18).fill(fill);
    box(rightX, ry, rightW, 18);
    t(label, rightX + 6, ry + 5, { size: 8.5, bold: true, width: rightW / 2 });
    t(value, rightX + rightW / 2, ry + (size > 9 ? 3 : 5), { size, bold, width: rightW / 2 - 6, align: 'right' });
    ry += 18;
  };
  sumRow('Taxable Amount', money(spec.taxable), { bold: true });
  if (intraState) {
    sumRow('Add : CGST', money(spec.gstAmount / 2), { bold: true });
    sumRow('Add : SGST', money(spec.gstAmount / 2), { bold: true });
  } else {
    sumRow('Add : IGST', money(spec.gstAmount), { bold: true });
  }
  sumRow('Total Tax', money(spec.gstAmount), { bold: true });
  sumRow('Total Amount After Tax', `Rs. ${money(spec.totalAmount)}`, { bold: true, size: 11, fill: BLUE_TINT });
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
  // Terms box runs down to the same bottom line as the signatory, so both columns end level
  box(L, termsTop, leftW, signBottom + 16 - termsTop);

  doc.end();
  return done;
}

/** The proforma raised from a final proposal (the lead's Proposal workflow). */
function buildProformaPdfBuffer(proposal) {
  const d = proposal.details || {};
  return buildBillDocPdfBuffer({
    title: 'Proforma',
    pdfTitle: `Proforma ${proposal.proformaNumber}`,
    noLabel: 'Proforma No.',
    number: proposal.proformaNumber,
    dateLabel: 'Proforma Date',
    date: proposal.proformaDate,
    ref: proposal.proposalNumber ? `Ref: ${proposal.proposalNumber} v${proposal.version}` : '',
    customer: { name: d.clientName, address: d.address, phone: d.phone, gstin: d.gstin, pan: d.pan, placeOfSupply: d.placeOfSupply },
    items: (proposal.items || []).map((i) => ({
      service: i.service, description: i.description, sac: i.sac, qty: i.qty, uom: i.uom, rate: i.rate,
      taxable: i.taxable, gstPercent: i.gstPercent, gstAmount: i.gstAmount, total: i.total,
    })),
    taxable: proposal.projectValue,
    gstAmount: proposal.gstAmount,
    totalAmount: proposal.totalAmount,
    terms: { title: 'Payment Terms', rows: PAYMENT_TERMS },
    agreedTerms: d.paymentTerms,
  });
}

module.exports = { buildProformaPdfBuffer, buildBillDocPdfBuffer };
