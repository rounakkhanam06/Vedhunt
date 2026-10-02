const Settings = require('../models/Settings');
const logger = require('../utils/logger');

// Terms & Privacy documents for the Client Portal and the Employee Portal —
// separate from the public website's policies. Same shape as the website
// Terms page ({ hero, policyData }) so the admin editor works the same way.
// Starter text below is a template for the Super Admin to review and edit.

const p = (text) => `<p>${text}</p>`;
const ul = (items) => `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;

const DEFAULTS = {
  'client-terms': {
    hero: {
      heading: 'Client Portal Terms & Conditions',
      lastUpdated: '',
      introParagraphs: [
        'These terms apply to your use of the Vedhunt Client Portal. By logging in, you agree to them.',
        'Your project scope, fees and deliverables are governed by your Service Agreement. If anything here conflicts with that agreement, the Service Agreement prevails.',
      ],
    },
    policyData: [
      { id: 'ct-1', title: '1. Your Account', content: ul(['Keep your login details confidential and do not share your account.', 'You are responsible for activity carried out using your account.', 'Tell us immediately if you suspect unauthorised access.']) },
      { id: 'ct-2', title: '2. Using the Portal', content: p('Use the portal only to view your projects, invoices and retainers, make payments, and raise support requests. Do not attempt to access data that does not belong to your business.') },
      { id: 'ct-3', title: '3. Invoices & Payments', content: ul(['Invoices are payable by their due date.', 'Payment proofs you upload are verified by our team before an invoice is marked as paid.', 'Overdue accounts may be suspended until payment is received.']) },
      { id: 'ct-4', title: '4. Support Tickets & Files', content: p('Only upload files that you have the right to share and that are needed to resolve your request. Response times shown in the portal are targets, not guarantees.') },
      { id: 'ct-5', title: '5. Suspension & Closure', content: p('We may suspend or close portal access for misuse, non-payment, or at the end of the engagement. Your invoices and records remain available to us as required by law.') },
      { id: 'ct-6', title: '6. Changes', content: p('We may update these terms from time to time. The latest version is always available in the portal under My Account.') },
    ],
  },
  'client-privacy': {
    hero: {
      heading: 'Client Portal Privacy Policy',
      lastUpdated: '',
      introParagraphs: ['This policy explains how Vedhunt InfoTech handles your information when you use the Client Portal.'],
    },
    policyData: [
      { id: 'cp-1', title: '1. Information We Collect', content: ul(['Account details: business name, contact name, email and phone.', 'Activity in the portal: tickets, messages, uploaded files and payment proofs.', 'Technical data such as login times, used to keep your account secure.']) },
      { id: 'cp-2', title: '2. How We Use It', content: ul(['To deliver the services in your agreement and manage billing.', 'To respond to support requests and send you account notifications.', 'To protect the portal against fraud and unauthorised access.']) },
      { id: 'cp-3', title: '3. Sharing', content: p('We do not sell your data. It is shared only with service providers who help us run the portal (for example hosting, email and file storage), and where required by law.') },
      { id: 'cp-4', title: '4. Retention', content: p('We keep your information for as long as your account is active and afterwards as required for accounting, tax and legal purposes.') },
      { id: 'cp-5', title: '5. Your Rights', content: p('You can view and update your contact details under My Account, and contact us to ask about, correct or delete your personal data, subject to legal retention requirements.') },
    ],
  },
  'employee-terms': {
    hero: {
      heading: 'Employee Portal Terms & Conditions',
      lastUpdated: '',
      introParagraphs: [
        'These terms apply to your use of the Vedhunt Employee Portal. By logging in, you agree to them.',
        'They supplement, and do not replace, your employment contract and company policies.',
      ],
    },
    policyData: [
      { id: 'et-1', title: '1. Account & Access', content: ul(['Your login is personal — never share it or use another person\'s account.', 'Log out of shared devices and report any suspected unauthorised access.']) },
      { id: 'et-2', title: '2. Accurate Records', content: p('Attendance, timesheets, leave requests and work logs must be accurate and submitted honestly. Falsifying records is a disciplinary matter.') },
      { id: 'et-3', title: '3. Confidentiality', content: p('Client, lead and company information you see in the portal is confidential. Use it only for your work and do not copy, export or share it outside the company.') },
      { id: 'et-4', title: '4. Acceptable Use', content: ul(['Use the portal only for work purposes.', 'Do not attempt to access data or functions you have not been given.', 'Communicate with clients professionally in tickets and messages.']) },
      { id: 'et-5', title: '5. Monitoring', content: p('Activity in the portal (for example logins, timers and record changes) is logged for security, payroll and audit purposes.') },
      { id: 'et-6', title: '6. Changes', content: p('These terms may be updated. The latest version is always available under My Profile.') },
    ],
  },
  'employee-privacy': {
    hero: {
      heading: 'Employee Privacy Policy',
      lastUpdated: '',
      introParagraphs: ['This policy explains how Vedhunt InfoTech handles employee information in the Employee Portal.'],
    },
    policyData: [
      { id: 'ep-1', title: '1. Information We Hold', content: ul(['Personal and contact details, job role and department.', 'Attendance, leave, timesheets, performance and payroll records.', 'Bank and statutory details needed to pay salaries.']) },
      { id: 'ep-2', title: '2. How We Use It', content: ul(['To manage employment, payroll and statutory compliance.', 'To track attendance, productivity and performance reviews.', 'To keep company systems secure.']) },
      { id: 'ep-3', title: '3. Access & Sharing', content: p('Your information is available only to authorised HR, payroll and management staff, and to service providers who help us run payroll and our systems, or where required by law.') },
      { id: 'ep-4', title: '4. Security & Retention', content: p('Sensitive fields are encrypted. Records are kept for the duration of employment and afterwards as required by labour, tax and legal obligations.') },
      { id: 'ep-5', title: '5. Your Rights', content: p('You can review your details under My Profile and ask HR to correct anything that is inaccurate.') },
    ],
  },
};

const DOC_KEYS = Object.keys(DEFAULTS);
const settingsKey = (doc) => `portalLegal_${doc}`;

const isValidDoc = (doc, res) => {
  if (DOC_KEYS.includes(doc)) return true;
  res.status(404).json({ message: 'Unknown document' });
  return false;
};

// @route   GET /api/settings/portal-legal/:doc   (public — linked from the login pages)
exports.getPortalLegal = async (req, res) => {
  const { doc } = req.params;
  if (!isValidDoc(doc, res)) return;
  try {
    const saved = await Settings.findOne({ key: settingsKey(doc) }).lean();
    res.status(200).json(saved?.value || DEFAULTS[doc]);
  } catch (error) {
    logger.error('Error fetching portal legal document:', error);
    res.status(500).json({ message: 'Server error while fetching the document' });
  }
};

// @route   PUT /api/admin/settings/portal-legal/:doc
exports.updatePortalLegal = async (req, res) => {
  const { doc } = req.params;
  if (!isValidDoc(doc, res)) return;
  try {
    const { hero, policyData } = req.body || {};
    if (!hero || typeof hero.heading !== 'string' || !hero.heading.trim()) {
      return res.status(400).json({ message: 'A heading is required' });
    }
    if (!Array.isArray(policyData)) {
      return res.status(400).json({ message: 'Sections must be a list' });
    }

    const value = {
      hero: {
        heading: hero.heading.trim(),
        lastUpdated: `Last Updated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
        introParagraphs: (Array.isArray(hero.introParagraphs) ? hero.introParagraphs : [])
          .map((t) => String(t ?? '').trim())
          .filter(Boolean),
      },
      policyData: policyData
        .map((s, i) => ({
          id: String(s?.id || `s-${Date.now()}-${i}`),
          title: String(s?.title ?? '').trim(),
          content: String(s?.content ?? ''),
        }))
        .filter((s) => s.title || s.content.replace(/<[^>]*>/g, '').trim()),
    };

    const saved = await Settings.findOneAndUpdate(
      { key: settingsKey(doc) },
      { $set: { value } },
      { new: true, upsert: true }
    );
    res.status(200).json({ message: 'Document saved', document: saved.value });
  } catch (error) {
    logger.error('Error saving portal legal document:', error);
    res.status(500).json({ message: 'Server error while saving the document' });
  }
};

exports.PORTAL_LEGAL_DOCS = DOC_KEYS;
