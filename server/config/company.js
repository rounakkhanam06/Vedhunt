// Vedhunt's legal/letterhead details, used by every generated document
// (payslips, proposals, proforma invoices). Defaults come from the approved
// templates; Settings key 'company_profile' can override any field without a
// code change.
const Settings = require('../models/Settings');

const COMPANY_DEFAULTS = {
  name: 'VEDHUNT INFOTECH PVT. LTD.',
  legalName: 'VEDHUNT INFOTECH PRIVATE LIMITED',
  tagline: 'Digital Growth. Delivered With Accountability.',
  // As printed on the proforma invoice
  addressLines: [
    'Office No. A-702, Everest Nivara Infotech Park',
    'Plot No. D/3 TTC Indira Nagar, Turbhe MIDC',
    'Navi Mumbai, Maharashtra - 400705',
  ],
  // The payslip header's two-line form
  addressShort: [
    'Office No, 7th Floor, A-702, Everest Nivara Infotech Park',
    'Indira Nagar, Turbhe, Navi Mumbai, Maharashtra 400705',
  ],
  // As printed in the proposal's registered-details block
  registeredAddress: 'Office No. 7, 7th Floor, Everest Nivara Infotech Park, A-702, Indira Nagar, MIDC Industrial Area, Turbhe, Navi Mumbai, Maharashtra 400705',
  state: 'Maharashtra',
  stateCode: '27',
  phone: '8652410289',
  email: 'info@vedhunt.in',
  website: 'www.vedhunt.in',
  gstin: '27AALCV0172E1ZD',
  pan: 'AALCV0172E',
  // Document numbering continues from the last numbers issued outside the
  // portal (proposal VH-PROP-…-220, proforma 32); raise them via Settings if needed.
  proposalSequenceStart: 221,
  proformaNumberStart: 33,
  bank: {
    bankName: 'Kotak Mahindra Bank',
    branch: 'Kalyan West',
    accountName: 'Vedhunt InfoTech Private Limited',
    accountNumber: '8051393966',
    ifsc: 'KKBK0000627',
  },
};

// Standard opening of every proposal ("Who We Are"), from the approved template.
const PROPOSAL_INTRO = {
  whoWeAre: [
    "Vedhunt InfoTech wasn't started by ex-agency people. Our management team has run analytics, BI, and finance functions across different companies — e-commerce, education, services, healthcare, and shipping/BPO-KPO — before ever touching an ad account, and each of us brings real hands-on Meta and Google Ads experience from those companies, not a course certificate. That mix is why we know how a business actually runs before we plan how to advertise it.",
    "We don't stop at ROAS. Anyone can read a dashboard. We use it to understand your business first — margins, repeat rate, return rate, sales cycle, seasonality — and set a profit target from there, not just a number that looks good in a screenshot.",
  ],
  mission: 'To make ad spend show up as a number on your bank statement — not as reach, impressions, or a slide full of engagement metrics.',
  vision: 'To be the one team a growing business calls for its ads, its website, and its numbers — run by people who understand how your specific industry actually makes money, not a generic plan applied to every client the same way.',
  whyDifferent: [
    'One team, one accountability chain — media buying, tracking, creative, and finance sit under the same roof, so nothing gets lost in a vendor handoff.',
    'We price and plan around your unit economics, not a generic template — the figures in this proposal are built around your actual numbers.',
    'We show our work — reporting is tied to the KPIs agreed in this document, not vanity metrics.',
  ],
};

async function getCompanyProfile() {
  const override = (await Settings.findOne({ key: 'company_profile' }).lean())?.value || {};
  return { ...COMPANY_DEFAULTS, ...override, bank: { ...COMPANY_DEFAULTS.bank, ...(override.bank || {}) } };
}

module.exports = { COMPANY_DEFAULTS, PROPOSAL_INTRO, getCompanyProfile };
