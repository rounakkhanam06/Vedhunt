const PDFDocument = require('pdfkit');
const Settings = require('../models/Settings');
const { DEFAULT_CONTACT_INFO } = require('../controllers/settingsController');

// Legal entity name as it appears on the Service Agreement
const COMPANY_LEGAL_NAME = 'Vedhunt InfoTech Pvt. Ltd.';
const ACCENT = '#FF6B35';

// Standard PDF fonts have no ₹ glyph — same "Rs." convention as payslips
const money = (n) =>
  `Rs. ${(Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const date = (d) =>
  (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');

// Letterhead + payment details from the same Settings the website/portal use
async function loadInvoiceContext() {
  const [contactDoc, paymentDoc] = await Promise.all([
    Settings.findOne({ key: 'contactInfo' }).lean(),
    Settings.findOne({ key: 'paymentSettings' }).lean(),
  ]);
  const contact = { ...DEFAULT_CONTACT_INFO, ...(contactDoc?.value || {}) };
  return {
    company: {
      name: COMPANY_LEGAL_NAME,
      address: contact.address,
      email: contact.email,
      phone: contact.phoneDisplay || contact.phone,
      cin: contact.cin,
    },
    paymentInfo: paymentDoc?.value
      ? { upiId: paymentDoc.value.upiId || null, bankDetails: paymentDoc.value.bankDetails || null }
      : null,
  };
}

const humanize = (key) => key
  .replace(/([A-Z])/g, ' $1')
  .replace(/^./, (c) => c.toUpperCase())
  .replace(/(Ifsc|Upi|Swift|Iban|Gst|Pan)/gi, (w) => w.toUpperCase());

/**
 * Renders an invoice to a PDF Buffer.
 * @param {object} invoice      lean Invoice (paymentStatus already Overdue-adjusted)
 * @param {object} client       { businessName, contactName, email, phone, clientId }
 * @param {object} context      from loadInvoiceContext()
 */
function buildInvoicePdfBuffer(invoice, client, { company, paymentInfo }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4', info: { Title: `Invoice ${invoice.invoiceId || ''}`, Author: company.name } });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const width = right - left;
    const bottomLimit = doc.page.height - doc.page.margins.bottom - 40;

    // ── Header ──────────────────────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 6).fill(ACCENT);
    doc.fillColor('#111').font('Helvetica-Bold').fontSize(16).text(company.name, left, 40, { width: width * 0.6 });
    doc.font('Helvetica').fontSize(9).fillColor('#555');
    [company.address, [company.email, company.phone].filter(Boolean).join('  |  '), company.cin]
      .filter(Boolean)
      .forEach((line) => doc.text(line, { width: width * 0.6 }));

    doc.font('Helvetica-Bold').fontSize(22).fillColor(ACCENT).text('INVOICE', left, 40, { width, align: 'right' });
    doc.font('Helvetica').fontSize(10).fillColor('#111');
    doc.text(invoice.invoiceId || '', left, 68, { width, align: 'right' });
    doc.fillColor('#555').text(`Issue date: ${date(invoice.issueDate)}`, { width, align: 'right' });
    doc.text(`Due date: ${date(invoice.dueDate)}`, { width, align: 'right' });

    const statusColor = invoice.paymentStatus === 'Paid' ? '#16A34A' : invoice.paymentStatus === 'Overdue' ? '#DC2626' : '#D97706';
    doc.font('Helvetica-Bold').fillColor(statusColor).text(String(invoice.paymentStatus || '').toUpperCase(), { width, align: 'right' });

    // ── Bill to ─────────────────────────────────────────────────────────────
    let y = Math.max(doc.y, 130) + 15;
    doc.moveTo(left, y).lineTo(right, y).strokeColor('#E5E7EB').lineWidth(1).stroke();
    y += 12;
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#888').text('BILL TO', left, y);
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#111').text(client.businessName || '-', left, y + 13);
    doc.font('Helvetica').fontSize(9).fillColor('#555');
    [client.contactName, client.email, client.phone, client.clientId && `Client ID: ${client.clientId}`]
      .filter(Boolean)
      .forEach((line) => doc.text(line));

    // ── Line items ──────────────────────────────────────────────────────────
    const cols = { no: left, desc: left + 28, qty: left + width - 230, unit: left + width - 170, amt: left + width - 85 };
    const header = (atY) => {
      doc.rect(left, atY, width, 22).fill('#F3F4F6');
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#374151');
      doc.text('#', cols.no + 6, atY + 7);
      doc.text('Description', cols.desc, atY + 7);
      doc.text('Qty', cols.qty, atY + 7, { width: 50, align: 'right' });
      doc.text('Unit Price', cols.unit, atY + 7, { width: 80, align: 'right' });
      doc.text('Amount', cols.amt, atY + 7, { width: 85, align: 'right' });
      return atY + 28;
    };

    y = header(doc.y + 18);
    doc.font('Helvetica').fontSize(9.5).fillColor('#111');
    (invoice.lineItems || []).forEach((item, i) => {
      const descWidth = cols.qty - cols.desc - 10;
      const h = Math.max(doc.heightOfString(item.description || '', { width: descWidth }), 12);
      if (y + h > bottomLimit) {
        doc.addPage();
        y = header(doc.page.margins.top);
        doc.font('Helvetica').fontSize(9.5).fillColor('#111');
      }
      doc.text(String(i + 1), cols.no + 6, y);
      doc.text(item.description || '', cols.desc, y, { width: descWidth });
      doc.text(String(item.qty ?? ''), cols.qty, y, { width: 50, align: 'right' });
      doc.text(money(item.unitPrice), cols.unit, y, { width: 80, align: 'right' });
      doc.text(money(item.amount), cols.amt, y, { width: 85, align: 'right' });
      y += h + 8;
      doc.moveTo(left, y - 4).lineTo(right, y - 4).strokeColor('#F3F4F6').stroke();
    });

    // ── Totals ──────────────────────────────────────────────────────────────
    if (y + 120 > bottomLimit) { doc.addPage(); y = doc.page.margins.top; }
    const paid = Number(invoice.paidAmount) || 0;
    const balance = Math.max(0, (Number(invoice.totalAmount) || 0) - paid);
    const rows = [['Subtotal', money(invoice.subtotal)]];
    if (invoice.taxPercent > 0) rows.push([`Tax (${invoice.taxPercent}%)`, money(invoice.taxAmount)]);
    const labelX = left + width - 250;
    y += 6;
    doc.font('Helvetica').fontSize(10).fillColor('#374151');
    rows.forEach(([label, value]) => {
      doc.text(label, labelX, y, { width: 150 });
      doc.text(value, labelX + 150, y, { width: 100, align: 'right' });
      y += 16;
    });
    doc.rect(labelX - 8, y - 2, 258, 22).fill('#FFF2EB');
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#111');
    doc.text('Total', labelX, y + 4, { width: 150 });
    doc.text(money(invoice.totalAmount), labelX + 150, y + 4, { width: 100, align: 'right' });
    y += 28;
    if (paid > 0) {
      doc.font('Helvetica').fontSize(10).fillColor('#16A34A');
      doc.text('Paid', labelX, y, { width: 150 });
      doc.text(money(paid), labelX + 150, y, { width: 100, align: 'right' });
      y += 16;
    }
    if (invoice.paymentStatus !== 'Paid') {
      doc.font('Helvetica-Bold').fontSize(10).fillColor(ACCENT);
      doc.text('Balance Due', labelX, y, { width: 150 });
      doc.text(money(balance), labelX + 150, y, { width: 100, align: 'right' });
      y += 16;
    }

    // ── Payment ─────────────────────────────────────────────────────────────
    y += 14;
    if (y + 110 > bottomLimit) { doc.addPage(); y = doc.page.margins.top; }
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#111').text(invoice.paymentStatus === 'Paid' ? 'Payment' : 'How to pay', left, y);
    doc.font('Helvetica').fontSize(9.5).fillColor('#374151');
    if (invoice.paymentStatus === 'Paid') {
      doc.text(`Paid in full${invoice.paidOn ? ` on ${date(invoice.paidOn)}` : ''}${invoice.paymentMethod ? ` via ${invoice.paymentMethod}` : ''}. Thank you!`);
    } else if (paymentInfo?.upiId || paymentInfo?.bankDetails) {
      if (paymentInfo.upiId) doc.text(`UPI: ${paymentInfo.upiId}`);
      Object.entries(paymentInfo.bankDetails || {})
        .filter(([, v]) => v)
        .forEach(([k, v]) => doc.text(`${humanize(k)}: ${v}`));
      doc.moveDown(0.3).fillColor('#6B7280').text(`Please mention ${invoice.invoiceId || 'the invoice number'} as the payment reference and submit the payment proof in your Client Portal.`, { width });
    } else {
      doc.text('Payment details are available in your Client Portal.');
    }

    doc.font('Helvetica').fontSize(8).fillColor('#9CA3AF')
      .text('This is a computer-generated invoice and does not require a signature.', left, doc.page.height - doc.page.margins.bottom - 20, { width, align: 'center', lineBreak: false });

    doc.end();
  });
}

module.exports = { buildInvoicePdfBuffer, loadInvoiceContext };
