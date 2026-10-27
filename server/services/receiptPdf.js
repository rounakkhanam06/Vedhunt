// Payment receipt and credit note PDFs — one compact A4 page in the same house style as the
// proforma / tax invoice (company header, blue rules, amount in words, authorised signatory).
const PDFDocument = require('pdfkit');
const { logo, getCompanyProfile, amountInWords, toBuffer, fmtDate } = require('./pdfBranding');
const { netTotal, invoiceBalance } = require('./finance');

const BLUE = '#2E75B6';
const BLUE_TINT = '#E9F2FB';
const INK = '#111111';
const MUTED = '#444444';
const money = (n) => `Rs. ${(Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * @param spec.title       'PAYMENT RECEIPT' | 'CREDIT NOTE'
 * @param spec.numberLabel 'Receipt No.' | 'Credit Note No.'
 * @param spec.number      spec.date
 * @param spec.partyLabel  'Received from' | 'Credited to'
 * @param spec.party       { name, gstin?, address? }
 * @param spec.rows        [[label, value]] — the detail lines
 * @param spec.amountLabel spec.amount   the headline amount (also printed in words)
 * @param spec.summary     [[label, value, bold?]] — figures under the amount (invoice total, balance …)
 * @param spec.note        optional footnote
 */
async function buildSimpleDocPdf(spec) {
  const company = await getCompanyProfile();
  const doc = new PDFDocument({ size: 'A4', margin: 30, info: { Title: `${spec.title} ${spec.number}` } });
  const done = toBuffer(doc);
  const L = 30;
  const W = doc.page.width - 60;
  const R = L + W;

  const t = (str, x, y, { size = 9, bold = false, color = INK, width, align = 'left' } = {}) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).fillColor(color).text(String(str ?? ''), x, y, { width, align });
    return doc.y;
  };
  const box = (x, y, w, h, fill) => {
    if (fill) doc.rect(x, y, w, h).fill(fill);
    doc.rect(x, y, w, h).lineWidth(1).strokeColor(BLUE).stroke();
  };

  // Company header
  if (logo) doc.image(logo, L, 52, { fit: [80, 14] });
  t(company.legalName, L + 90, 26, { size: 15, bold: true, width: 280 });
  let y = doc.y + 4;
  company.addressLines.forEach((line) => { y = t(line, L + 90, y, { size: 8, width: 300 }); });
  t(`Phone : ${company.phone}`, L, 34, { size: 8, width: W, align: 'right' });
  t(`Email : ${company.email}`, L, 45, { size: 8, width: W, align: 'right' });

  // Title bar with GSTIN
  y = Math.max(y, 80) + 10;
  box(L, y, W, 24);
  doc.font('Helvetica-Bold').fontSize(11).fillColor(INK).text('GSTIN : ', L + 6, y + 7, { continued: true }).font('Helvetica').text(company.gstin);
  t(spec.title, L, y + 5, { size: 15, bold: true, color: BLUE, width: W, align: 'center' });
  y += 24;

  // Party | number and date
  const half = W * 0.55;
  const partyRows = [[spec.partyLabel, spec.party.name], ['GSTIN', spec.party.gstin], ['Address', spec.party.address]].filter(([, v]) => v);
  let py = y + 8;
  partyRows.forEach(([k, v]) => {
    t(k, L + 6, py, { size: 8.5, bold: true, width: 70 });
    py = Math.max(t(v, L + 80, py, { size: 8.5, width: half - 90 }), py + 11) + 3;
  });
  t(spec.numberLabel, L + half + 8, y + 8, { size: 8.5 });
  t(String(spec.number), L + half + 100, y + 8, { size: 9.5, bold: true });
  t('Date', L + half + 8, y + 24, { size: 8.5 });
  t(fmtDate(spec.date), L + half + 100, y + 24, { size: 9, bold: true });
  const partyH = Math.max(py - y + 4, 60);
  box(L, y, half, partyH);
  box(L + half, y, W - half, partyH);
  y += partyH + 14;

  // Details
  spec.rows.forEach(([k, v], i) => {
    if (i % 2 === 0) doc.rect(L, y, W, 20).fill(BLUE_TINT);
    box(L, y, W, 20);
    t(k, L + 8, y + 6, { size: 8.5, bold: true, width: 160 });
    t(v || '—', L + 180, y + 6, { size: 8.5, width: W - 190 });
    y += 20;
  });

  // Amount
  y += 14;
  box(L, y, W, 34, BLUE_TINT);
  t(spec.amountLabel, L + 8, y + 12, { size: 10, bold: true, width: W / 2 });
  t(money(spec.amount), L + W / 2, y + 9, { size: 14, bold: true, width: W / 2 - 8, align: 'right' });
  y += 34;
  box(L, y, W, 22);
  t(amountInWords(spec.amount, { upper: true }), L, y + 7, { size: 8.5, width: W, align: 'center' });
  y += 36;

  if (spec.summary?.length) {
    const sw = W * 0.5;
    spec.summary.forEach(([k, v, bold]) => {
      box(R - sw, y, sw, 18);
      t(k, R - sw + 6, y + 5, { size: 8.5, bold: true, width: sw / 2 });
      t(v, R - sw / 2, y + 5, { size: 8.5, bold: !!bold, width: sw / 2 - 6, align: 'right' });
      y += 18;
    });
    y += 8;
  }
  if (spec.note) y = t(spec.note, L, y + 6, { size: 8, color: MUTED, width: W }) + 6;

  // Signatory
  const signY = Math.max(y + 30, 600);
  t(`For ${company.legalName}`, R - 230, signY, { size: 9.5, bold: true, width: 230, align: 'center' });
  box(R - 230, signY + 14, 230, 70);
  t('Authorised Signatory', R - 230, signY + 90, { size: 8, bold: true, width: 230, align: 'center' });
  t('This is a computer-generated document.', L, signY + 90, { size: 7.5, color: MUTED });

  doc.end();
  return done;
}

const partyOf = (client, invoice) => ({
  name: invoice.billing?.name || client.businessName,
  gstin: invoice.billing?.gstin,
  address: invoice.billing?.address,
});

/** Receipt for one accepted payment, with where the invoice stands. */
function buildReceiptPdf(payment, invoice, client) {
  const balance = invoiceBalance(invoice);
  return buildSimpleDocPdf({
    title: 'PAYMENT RECEIPT',
    numberLabel: 'Receipt No.',
    number: payment.receiptNumber,
    date: payment.paymentDate,
    partyLabel: 'Received from',
    party: partyOf(client, invoice),
    rows: [
      ['Against invoice', invoice.invoiceId],
      ['Payment method', payment.method || '—'],
      ['Reference (UTR / cheque no.)', payment.utrNumber || '—'],
      ['Payment date', fmtDate(payment.paymentDate)],
    ],
    amountLabel: 'Amount received',
    amount: payment.amountPaid,
    summary: [
      ['Invoice total', money(invoice.totalAmount)],
      ...(invoice.creditedAmount > 0 ? [['Credit notes', `- ${money(invoice.creditedAmount)}`]] : []),
      ['Paid so far', money(invoice.paidAmount)],
      [balance > 0 ? 'Balance due' : 'Balance', money(balance), true],
    ],
    note: `Figures show the invoice as on ${fmtDate(new Date())}.`,
  });
}

/** Credit note against one invoice. */
function buildCreditNotePdf(note, invoice, client) {
  return buildSimpleDocPdf({
    title: 'CREDIT NOTE',
    numberLabel: 'Credit Note No.',
    number: note.number,
    date: note.date,
    partyLabel: 'Credited to',
    party: partyOf(client, invoice),
    rows: [
      ['Against invoice', invoice.invoiceId],
      ['Reason', note.reason],
      ['Taxable value credited', money(note.amount)],
      [`GST @ ${note.taxPercent}%`, money(note.taxAmount)],
    ],
    amountLabel: 'Total credited (incl. GST)',
    amount: note.totalAmount,
    summary: [
      ['Invoice total', money(invoice.totalAmount)],
      ['Credit notes (all)', `- ${money(invoice.creditedAmount)}`],
      ['Now payable', money(netTotal(invoice)), true],
    ],
    note: 'This credit note reduces the amount payable on the invoice named above.',
  });
}

module.exports = { buildReceiptPdf, buildCreditNotePdf };
