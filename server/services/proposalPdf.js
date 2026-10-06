// Branded proposal in the approved Vedhunt template style: green/orange page
// bands, logo + contacts header, navy tables with zebra rows, numbered
// sections with an orange rule, faint logo watermark, and the acceptance +
// registered-details blocks at the end. Empty sections are skipped and the
// remaining ones are numbered in order.
const PDFDocument = require('pdfkit');
const { logo, getCompanyProfile, amount, amountInWords, toBuffer, fmtDate } = require('./pdfBranding');
const { PROPOSAL_INTRO } = require('../config/company');

const C = {
  navy: '#1F2D4D', green: '#1E4620', orange: '#F7820F', rule: '#C27C0E', accent: '#C55A11',
  ink: '#1A1A1A', muted: '#555555', zebra: '#F2F2F2', border: '#BFBFBF',
};
const M = 36;            // side margin
const TOP = 132;         // content start below the header
const BOTTOM_GAP = 60;   // keep clear of the footer band

const lines = (text) => String(text || '').split('\n').map((l) => l.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);
const rs = (n) => `Rs. ${amount(n, { dashZero: false, decimals: Number(n) % 1 ? 2 : 0 })}`;

async function buildProposalPdfBuffer(proposal, preparedBy = {}) {
  const company = await getCompanyProfile();
  const doc = new PDFDocument({ size: 'A4', margins: { top: TOP, bottom: BOTTOM_GAP, left: M, right: M }, bufferPages: true, info: { Title: `Proposal ${proposal.proposalNumber}` } });
  const done = toBuffer(doc);
  const W = doc.page.width - 2 * M;
  const pageBottom = () => doc.page.height - BOTTOM_GAP;
  const d = proposal.details || {};
  const issued = proposal.finalizedAt || proposal.updatedAt || new Date();
  const validUntil = new Date(new Date(issued).getTime() + (proposal.validityDays || 15) * 86400000);
  const clientLabel = d.clientName || 'the client';

  const ensure = (needed) => { if (doc.y + needed > pageBottom()) doc.addPage(); };
  const para = (text, opts = {}) => {
    doc.font(opts.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(opts.size || 9.5).fillColor(opts.color || C.ink)
      .text(text, M, doc.y, { width: W, lineGap: 2, align: opts.align || 'left' });
    doc.moveDown(opts.gap ?? 0.5);
  };
  const bullets = (items) => items.forEach((item) => {
    ensure(16);
    doc.font('Helvetica').fontSize(9.5).fillColor(C.ink).text(`•   ${item}`, M + 8, doc.y, { width: W - 8, lineGap: 2, indent: 0 });
    doc.moveDown(0.2);
  });

  let sectionNo = 0;
  // `keepWith`: room needed for what follows (e.g. a table), so a heading never ends a page alone.
  const section = (title, keepWith = 60) => {
    ensure(keepWith);
    sectionNo += 1;
    doc.moveDown(0.6);
    doc.font('Helvetica-Bold').fontSize(13).fillColor(C.navy).text(`${sectionNo}.  ${title}`, M, doc.y);
    const y = doc.y + 3;
    doc.moveTo(M, y).lineTo(M + W, y).lineWidth(1).strokeColor(C.rule).stroke();
    doc.y = y + 8;
  };
  const sub = (title) => { ensure(30); doc.font('Helvetica-Bold').fontSize(11).fillColor(C.navy).text(title, M, doc.y); doc.moveDown(0.25); };

  /** Navy-header table with zebra rows; repeats the header across page breaks. */
  const table = (headers, rows, widths, { boldLast = 0, alignRight = [] } = {}) => {
    const colW = widths.map((w) => w * W);
    const pad = 6;
    const cellHeight = (row, bold) => Math.max(...row.map((cell, i) => doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9)
      .heightOfString(String(cell ?? ''), { width: colW[i] - 2 * pad, lineGap: 1 }))) + 2 * pad;
    const drawRow = (row, y, { header = false, zebra = false, bold = false } = {}) => {
      const h = cellHeight(row, header || bold);
      doc.rect(M, y, W, h).fill(header ? C.navy : zebra ? C.zebra : '#FFFFFF');
      let x = M;
      row.forEach((cell, i) => {
        doc.font(header || bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).fillColor(header ? '#FFFFFF' : C.ink)
          .text(String(cell ?? ''), x + pad, y + pad, { width: colW[i] - 2 * pad, lineGap: 1, align: !header && alignRight.includes(i) ? 'right' : 'left' });
        doc.rect(x, y, colW[i], h).lineWidth(0.5).strokeColor(C.border).stroke();
        x += colW[i];
      });
      return y + h;
    };
    let y = doc.y;
    if (y + cellHeight(headers, true) + 24 > pageBottom()) { doc.addPage(); y = doc.y; }
    y = drawRow(headers, y, { header: true });
    rows.forEach((row, i) => {
      const bold = i >= rows.length - boldLast;
      if (y + cellHeight(row, bold) > pageBottom()) {
        doc.addPage();
        y = drawRow(headers, doc.y, { header: true });
      }
      y = drawRow(row, y, { zebra: i % 2 === 1, bold });
    });
    doc.y = y + 10;
    doc.x = M;
  };

  // ── Cover ──────────────────────────────────────────────────────────────
  doc.font('Helvetica-Bold').fontSize(14).fillColor(C.navy).text(company.name, M, TOP - 6, { width: W, align: 'right' });
  doc.font('Helvetica-Oblique').fontSize(9).fillColor(C.accent).text(company.tagline, M, doc.y + 1, { width: W, align: 'right' });
  doc.moveDown(1.2);
  doc.font('Helvetica-Bold').fontSize(20).fillColor(C.navy).text(String(proposal.title || 'Business Proposal').toUpperCase(), M, doc.y, { width: W, align: 'center' });
  doc.moveDown(0.3);
  doc.font('Helvetica-Bold').fontSize(10.5).fillColor(C.ink).text([d.clientName, d.website].filter(Boolean).join('  '), M, doc.y, { width: W, align: 'center' });
  doc.moveDown(0.6);
  table(['Field', 'Detail'], [
    ['Prepared For', [d.contactPerson, d.contactDesignation].filter(Boolean).join('  |  ') || d.clientName],
    ['Client Company', [d.clientName, d.website].filter(Boolean).join(' — ')],
    ['Proposal Reference No.', `${proposal.proposalNumber}${proposal.version > 1 ? ` (v${proposal.version})` : ''}`],
    ['Proposal Date', fmtDate(issued)],
    ['Valid Until', fmtDate(validUntil)],
    ['Prepared By', `${company.name.replace(/\.$/, '')}. — ${[preparedBy.name, preparedBy.designation].filter(Boolean).join(', ')}`],
  ], [0.35, 0.65]);

  // ── 1. Who we are ──────────────────────────────────────────────────────
  section('Who We Are');
  PROPOSAL_INTRO.whoWeAre.forEach((p) => para(p));
  sub('Our Mission'); para(PROPOSAL_INTRO.mission);
  sub('Our Vision'); para(PROPOSAL_INTRO.vision);
  sub("Why We're Different"); bullets(PROPOSAL_INTRO.whyDifferent);

  // ── 2. What we understand about you ────────────────────────────────────
  const understanding = [
    ['Business / Brand Name', d.clientName],
    ['Website', d.website],
    ['Industry / Category', d.industry],
    ['Business Model', d.businessModel],
    ['Requirement', d.requirement],
    ['Target Customer / Geography', d.targetAudience],
    ['Current Status', d.currentStatus],
    ['Key Pain Point(s)', d.painPoints],
    ['Business Goal for This Engagement', d.goal],
  ].filter(([, v]) => v);
  if (understanding.length) {
    section('What We Understand About You', 150);
    para('This reflects your enquiry and our conversations with you. Please flag any correction before we proceed.', { color: C.muted });
    table(['Parameter', 'Details'], understanding, [0.36, 0.64]);
  }

  // ── 3. Scope of work ───────────────────────────────────────────────────
  section('What We Will Do — Scope of Work');
  if (d.scope) para(d.scope);
  if (lines(d.deliverables).length) { sub('Deliverables'); bullets(lines(d.deliverables)); }

  // ── 4. Commercials ─────────────────────────────────────────────────────
  section('Commercials', 170);
  table(
    ['#', 'Service', 'HSN/SAC', 'Qty', 'Rate', 'GST', 'Amount'],
    [
      ...(proposal.items || []).map((item, i) => [
        String(i + 1),
        item.description ? `${item.service}\n${item.description}` : item.service,
        item.sac || '-',
        `${item.qty} ${item.uom || ''}`.trim(),
        amount(item.rate, { dashZero: false }),
        `${item.gstPercent}%`,
        amount(item.taxable, { dashZero: false }),
      ]),
      ['', 'Subtotal', '', '', '', '', amount(proposal.projectValue, { dashZero: false })],
      ['', 'GST', '', '', '', '', amount(proposal.gstAmount, { dashZero: false })],
      ['', 'Total Investment (incl. GST)', '', '', '', '', rs(proposal.totalAmount)],
    ],
    [0.05, 0.43, 0.1, 0.1, 0.11, 0.07, 0.14],
    { boldLast: 3, alignRight: [4, 6] }
  );
  para(`Amount in words: ${amountInWords(proposal.totalAmount)}`, { color: C.muted, size: 9 });

  // ── Engagement / timeline & payment ────────────────────────────────────
  if (d.timeline || d.paymentTerms) {
    section('Engagement Process, Payment & Timeline');
    if (d.timeline) { lines(d.timeline).length > 1 ? bullets(lines(d.timeline)) : para(d.timeline); }
    if (d.paymentTerms) { sub('Payment Terms'); para(d.paymentTerms); }
  }

  if (lines(d.clientRequirements).length) {
    section('What We Need From You');
    para('Go-live depends on these. A delay here shifts the timeline by the same number of days.', { color: C.muted });
    bullets(lines(d.clientRequirements));
  }

  if (d.assumptions || d.exclusions) {
    section('Assumptions & Exclusions');
    if (lines(d.assumptions).length) { sub('Assumptions'); bullets(lines(d.assumptions)); }
    if (lines(d.exclusions).length) { sub('Exclusions'); bullets(lines(d.exclusions)); }
  }

  if (d.notes) { section('Special Notes'); para(d.notes); }

  // ── Terms & conditions ─────────────────────────────────────────────────
  section('Terms & Conditions');
  [
    ['Validity', `This proposal is valid until ${fmtDate(validUntil)} (${proposal.validityDays || 15} days from the Proposal Date), unless extended in writing by ${company.name}`],
    ['GST & Invoicing', 'GST is charged extra at the rate applicable under Indian law at the time of invoicing (currently 18% on agency services) and will reflect on a GST-compliant tax invoice. Third-party charges (advertising platforms, domains, hosting, licences) are billed separately unless specifically included above.'],
    ['Performance Disclaimer', 'Any projections in this proposal are planning estimates. Actual results depend on factors outside our control, including offer and pricing competitiveness, website conversion, market seasonality, competitor activity and platform changes.'],
    ['Client Responsibilities', `${clientLabel} agrees to provide the requirements listed above on time, designate a single point of contact, and respond to approvals within 2 working days. Client-side delays extend the timeline proportionately.`],
    ['Confidentiality', 'Both parties keep confidential all business, financial and strategic information shared during this engagement, for its duration and 12 months thereafter.'],
    ['Intellectual Property', `Deliverables produced specifically for ${clientLabel} become its property upon full payment of the corresponding invoice. Vedhunt may showcase the work in anonymized form unless asked otherwise in writing.`],
    ['Term & Termination', 'Either party may terminate with 30 days\' written notice. Fees already paid for the notice-period month are non-refundable; work in progress is handed over in a mutually agreed format.'],
    ['Limitation of Liability', 'Vedhunt\'s total liability is limited to the fees paid by the client in the month in which the claim arises, and excludes indirect or consequential loss.'],
    ['Dispute Resolution & Jurisdiction', 'Disputes are first addressed through good-faith discussion; if unresolved within 15 days they are referred to arbitration under the Arbitration and Conciliation Act, 1996, seated in Navi Mumbai, Maharashtra. Governed by the laws of India.'],
    ['Amendments', 'Any change to scope, budget, deliverables or timeline is valid only if confirmed in writing (email or signed addendum) by both parties.'],
  ].forEach(([title, body], i) => {
    ensure(40);
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(C.navy).text(`${sectionNo}.${i + 1} ${title}`, M, doc.y);
    doc.moveDown(0.15);
    para(body, { gap: 0.4 });
  });

  // ── Acceptance + registered details ────────────────────────────────────
  section('Acceptance', 200);
  para('By signing below, both parties confirm agreement to the scope, fees, timeline, and Terms & Conditions stated in this proposal.');
  table(['', `For ${company.name}`, `For ${d.clientName || 'Client'}`], [
    ['Name', preparedBy.name || '', d.contactPerson || ''],
    ['Designation', preparedBy.designation || '', d.contactDesignation || ''],
    ['Signature', '', ''],
    ['Date', fmtDate(issued), ''],
  ], [0.22, 0.39, 0.39]);
  table([`${company.name} — Registered Details`, ''], [
    ['GSTIN', company.gstin],
    ['Registered Address', company.registeredAddress],
    ['PAN', company.pan],
    ['Bank Details (for advance payment)', `A/c Name: ${company.bank.accountName}\nA/c No.: ${company.bank.accountNumber}\nIFSC: ${company.bank.ifsc}\nBranch: ${company.bank.branch}`],
  ], [0.4, 0.6]);

  // ── Page furniture on every page ───────────────────────────────────────
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    doc.page.margins.bottom = 0; // footer text sits in the margin; don't let it spill onto a new page
    const pw = doc.page.width;
    const ph = doc.page.height;
    // top band: green with an orange slant on the right
    doc.rect(0, 0, pw, 14).fill(C.green);
    doc.polygon([pw * 0.62, 0], [pw, 0], [pw, 14], [pw * 0.64, 14]).fill(C.orange);
    // header: logo left, contacts right, split orange/green rule
    if (logo) doc.image(logo, M - 12, 52, { fit: [150, 22] });
    [company.phone, company.website, company.email].forEach((line, n) => {
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#666666').text(line, M, 40 + n * 13, { width: W, align: 'right', lineBreak: false });
    });
    doc.rect(M - 30, 92, (W + 30) * 0.45, 4).fill(C.orange);
    doc.rect(M - 30 + (W + 30) * 0.45, 92, (W + 30) * 0.55, 4).fill(C.green);
    // faint logo watermark
    if (logo) doc.save().opacity(0.12).image(logo, (pw - 380) / 2, ph / 2 - 30, { width: 380 }).restore();
    if (proposal.status === 'Draft') {
      doc.save().rotate(-30, { origin: [pw / 2, ph / 2] }).opacity(0.06).font('Helvetica-Bold').fontSize(100).fillColor('#000000')
        .text('DRAFT', 0, ph / 2 - 50, { width: pw, align: 'center', lineBreak: false }).restore();
    }
    // bottom band: orange slant on the left, green rest
    doc.rect(0, ph - 20, pw, 20).fill(C.green);
    doc.polygon([0, ph - 20], [pw * 0.3, ph - 20], [pw * 0.33, ph], [0, ph]).fill(C.orange);
    doc.font('Helvetica').fontSize(7.5).fillColor('#888888')
      .text(`${proposal.proposalNumber} v${proposal.version}  ·  Page ${i - range.start + 1} of ${range.count}`, M, ph - 34, { width: W, align: 'right', lineBreak: false });
    doc.opacity(1);
  }

  doc.end();
  return done;
}

module.exports = { buildProposalPdfBuffer };
