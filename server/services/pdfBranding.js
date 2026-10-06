// Shared building blocks for generated PDFs (payslips, proposals, proforma
// invoices): the logo, company details, number/amount formatting and buffering.
const fs = require('fs');
const path = require('path');
const { getCompanyProfile } = require('../config/company');

// Light-background logo (orange + black) — PDFs are always white paper.
const LOGO_PATH = path.join(__dirname, '..', 'assets', 'brand', 'vedhunt-logo-light.png');
const logo = fs.existsSync(LOGO_PATH) ? fs.readFileSync(LOGO_PATH) : null;

// Helvetica has no ₹ glyph, so currency prints as "Rs.".
const inr = (n) => `Rs. ${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
/** 25000 → "25,000"; zero → "-" (the approved templates leave empty amounts as a dash). */
const amount = (n, { decimals = 0, dashZero = true } = {}) => {
  const v = Number(n) || 0;
  if (!v && dashZero) return '-';
  return v.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
  'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
function belowThousand(n, joiner) {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const restWords = rest < 20 ? ONES[rest] : [TENS[Math.floor(rest / 10)], ONES[rest % 10]].filter(Boolean).join(joiner);
  return [hundreds ? `${ONES[hundreds]} Hundred` : '', restWords].filter(Boolean).join(' ');
}
/**
 * 123456 → "One Lakh Twenty Three Thousand Four Hundred Fifty Six Rupees Only" (Indian grouping).
 * `hyphen` writes compound tens as "Forty-Nine"; `upper` upper-cases the result.
 */
function amountInWords(value, { hyphen = false, upper = false } = {}) {
  let n = Math.round(Number(value) || 0);
  const joiner = hyphen ? '-' : ' ';
  let words;
  if (n === 0) {
    words = 'Zero Rupees Only';
  } else {
    const parts = [];
    for (const [size, unit] of [[10000000, 'Crore'], [100000, 'Lakh'], [1000, 'Thousand']]) {
      if (n >= size) {
        parts.push(`${belowThousand(Math.floor(n / size), joiner)} ${unit}`);
        n %= size;
      }
    }
    if (n) parts.push(belowThousand(n, joiner));
    words = `${parts.join(' ')} Rupees Only`;
  }
  return upper ? words.toUpperCase() : words;
}

/** Collects a PDFKit document into a Buffer. */
function toBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "06-Sep-2026", the date style used on the approved templates. */
const fmtDate = (value) => {
  if (!value) return '-';
  const d = new Date(value);
  return `${String(d.getDate()).padStart(2, '0')}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
};

module.exports = { logo, getCompanyProfile, inr, amount, amountInWords, toBuffer, fmtDate };
