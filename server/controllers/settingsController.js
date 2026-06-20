const Settings = require('../models/Settings');

// Fallback default info if not found in DB
const DEFAULT_CONTACT_INFO = {
  phone: '+91 86524 10289',
  phoneDisplay: '+91 86524 10289',
  email: 'info@vedhunt.in',
  whatsappNumber: '917049380550',
  whatsappMessage: 'Hi Vedhunt InfoTech! I want to know more about your services.',
  hours: 'Mon – Fri: 8:00am – 7:00pm',
  address: 'Vedhunt InfoTech, Pune, Maharashtra, India',
  cin: 'CIN - U62099MH2025PTC447275',
  registration: 'Company Registration: CIN - U62099MH2025PTC447275',
  copyright: '© 2026 Vedhunt InfoTech. All Rights Reserved.',
  socialLinks: [
    { id: '1', platform: 'Facebook', url: 'https://www.facebook.com/Vedhunt6' },
    { id: '2', platform: 'Instagram', url: 'https://www.instagram.com/vedhunt/' },
    { id: '3', platform: 'LinkedIn', url: 'https://www.linkedin.com/company/vedhunt-infotech' },
    { id: '4', platform: 'YouTube', url: 'https://www.youtube.com/@vedhuntinfotech1326' }
  ]
};

// Fallback default info for Privacy Policy if not found in DB
const DEFAULT_PRIVACY_POLICY = {
  hero: {
    heading: 'Privacy Policy',
    lastUpdated: 'May 2026',
    introParagraphs: [
      "Your privacy is important to us. It is Vedhunt InfoTech's policy to respect your privacy regarding any information we may collect from you across our website, and other sites we own and operate.",
      "We only collect information about you if we have a reason to do so — for example, to provide our Services, to communicate with you, or to make our Services better."
    ]
  },
  policyData: [
    {
      id: "1",
      title: "1. Scope of This Policy",
      content: "<p><strong>This policy applies to:</strong></p><ul><li>Visitors to our website (<a href='https://www.vedhunt.in'>www.vedhunt.in</a>)</li><li>Registered users of the Vedhunt Client Portal</li><li>Clients and partners using our services, including website and app development, digital marketing, automation, analytics, accounting, and reporting solutions.</li></ul>"
    },
    {
      id: "2",
      title: "2. Information We Collect",
      content: "<h4><strong>Personal Information</strong></h4><p>We collect personal information that you provide to us when you use our Services, such as your name, email address, and any other contact information you provide.</p><br/><h4><strong>Usage Data</strong></h4><p>We collect information about your interactions with our Services, such as the pages you visit, the links you click, and the search terms you use.</p>"
    },
    {
      id: "3",
      title: "3. Purpose of Data Collection",
      content: "<p>We use the information we collect in various ways, including to:</p><ul><li>Provide, operate, and maintain our website.</li><li>Improve, personalize, and expand our website.</li><li>Understand and analyze how you use our website.</li><li>Develop new products, services, features, and functionality.</li><li>Communicate with you, either directly or through one of our partners, for customer service, updates, and marketing.</li></ul>"
    },
    { id: "4", title: "4. Legal Basis for Processing", content: "<p>Content for this section goes here.</p>" },
    { 
      id: "5",
      title: "5. Data Storage and Retention", 
      content: "<p>Your information is stored securely on encrypted servers and trusted cloud platforms. We employ enterprise-grade security systems including SSL encryption, multi-factor authentication, and regular audits to ensure your data remains protected.</p>" 
    },
    { id: "6", title: "6. Data Security", content: "<p>Content for this section goes here.</p>" },
    { id: "7", title: "7. Data Sharing and Disclosure", content: "<p>Content for this section goes here.</p>" },
    { id: "8", title: "8. Cookies and Tracking Technologies", content: "<p>Content for this section goes here.</p>" },
    { id: "9", title: "9. International Data Transfers", content: "<p>Content for this section goes here.</p>" },
    { id: "10", title: "10. Your Rights and Choices", content: "<p>Content for this section goes here.</p>" },
    { id: "11", title: "11. Children's Privacy", content: "<p>Content for this section goes here.</p>" },
    { id: "12", title: "12. Third-Party Links and Integrations", content: "<p>Content for this section goes here.</p>" },
    { id: "13", title: "13. Updates to This Policy", content: "<p>Content for this section goes here.</p>" },
    { 
      id: "14",
      title: "14. Contact Us", 
      content: "<p>If you have any questions or concerns regarding this Privacy Policy, please reach out to our team:</p><br/><p><strong>Email:</strong> <a href='mailto:info@vedhunt.in'>info@vedhunt.in</a></p><p><strong>Phone:</strong> +91 86524 10289</p>" 
    }
  ]
};

// Fallback default info for Terms & Conditions if not found in DB
const DEFAULT_TERMS_CONDITIONS = {
  hero: {
    heading: 'Terms & Conditions',
    lastUpdated: 'May 2026',
    introParagraphs: [
      "Welcome to Vedhunt InfoTech (“Company,” “we,” “our,” or “us”). By accessing our website www.vedhunt.in, using our services, or accessing the Vedhunt Client Portal, you agree to comply with and be bound by these Terms & Conditions.",
      "Please read them carefully before using any of our services. If you do not agree to these Terms, you may not access or use our website or services."
    ]
  },
  policyData: [
    {
      id: "1",
      title: "1. Legal Entity & Applicability",
      content: `<p class="mb-4 font-semibold text-app-text">Vedhunt InfoTech is an Information Technology and Business Process Solutions provider operating under Indian law. These Terms govern:</p><ul class="space-y-4 pl-2 mb-4"><li class="flex items-start"><span class="text-primary mr-3 mt-1 font-bold">•</span><span>The use of our website and digital platforms.</span></li><li class="flex items-start"><span class="text-primary mr-3 mt-1 font-bold">•</span><span>The engagement of our services, including website/app development, digital marketing, automation, analytics, MIS reporting, and accounting-related solutions.</span></li><li class="flex items-start"><span class="text-primary mr-3 mt-1 font-bold">•</span><span>Access to the Vedhunt Client Portal and any associated systems.</span></li></ul><p class="mt-4">These Terms apply to all users — clients, visitors, employees, contractors, and partners — who access or use Vedhunt InfoTech's resources.</p>`
    },
    {
      id: "2",
      title: "2. Acceptance of Terms",
      content: `<p class="mb-4">By using this website, registering for services, or signing a project agreement, you acknowledge that:</p><ul class="space-y-4 pl-2"><li class="flex items-start"><span class="text-primary mr-3 mt-1 font-bold">•</span><span>You have read, understood, and agreed to these Terms.</span></li><li class="flex items-start"><span class="text-primary mr-3 mt-1 font-bold">•</span><span>You are authorized to act on behalf of the entity you represent (if applicable).</span></li><li class="flex items-start"><span class="text-primary mr-3 mt-1 font-bold">•</span><span>You consent to the collection and processing of data as per our Privacy Policy.</span></li></ul>`
    },
    {
      id: "3",
      title: "3. Services Overview",
      content: `<p class="mb-4">Vedhunt InfoTech provides:</p><div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-2 mb-4"><div class="flex items-start"><span class="text-primary mr-3 mt-1 font-bold">•</span><span>Website & App Development</span></div><div class="flex items-start"><span class="text-primary mr-3 mt-1 font-bold">•</span><span>Digital Marketing and Social Media Management</span></div><div class="flex items-start"><span class="text-primary mr-3 mt-1 font-bold">•</span><span>Automation (SQL, Power BI, Python) and Data Analytics</span></div><div class="flex items-start"><span class="text-primary mr-3 mt-1 font-bold">•</span><span>MIS & Reporting Services</span></div><div class="flex items-start"><span class="text-primary mr-3 mt-1 font-bold">•</span><span>Accounting & Financial Analytics</span></div><div class="flex items-start"><span class="text-primary mr-3 mt-1 font-bold">•</span><span>Business Process Optimization and Consultation</span></div></div><p class="mt-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700/50 text-sm italic">Each service may have its own scope, deliverables, timelines, and payment terms defined in a separate agreement or proposal.</p>`
    },
    {
      id: "4",
      title: "4. Client Responsibilities",
      content: `<p class="mb-4">To ensure successful project delivery, the client agrees to:</p><ul class="space-y-4 pl-2"><li class="flex items-start"><span class="text-primary mr-3 mt-1 font-bold">•</span><span>Provide timely, accurate, and complete information, materials, and approvals necessary for the project.</span></li><li class="flex items-start"><span class="text-primary mr-3 mt-1 font-bold">•</span><span>Assign a dedicated point of contact to collaborate with Vedhunt InfoTech.</span></li><li class="flex items-start"><span class="text-primary mr-3 mt-1 font-bold">•</span><span>Adhere to mutually agreed project timelines and milestones. Delay in client feedback may impact the final delivery date.</span></li></ul>`
    },
    {
      id: "5",
      title: "5. Intellectual Property Rights",
      content: `<div class="space-y-6"><div class="bg-slate-50 dark:bg-slate-800/30 p-6 rounded-xl border border-slate-100 dark:border-slate-700/50"><h3 class="font-bold text-app-text mb-2 text-primary">Ownership of Work</h3><p class="text-sm">All source code, designs, documents, dashboards, and related deliverables created by Vedhunt InfoTech remain the company’s intellectual property until full payment is received. Upon payment completion, ownership of final deliverables transfers to the client, excluding pre-existing code, frameworks, or proprietary tools.</p></div><div class="bg-slate-50 dark:bg-slate-800/30 p-6 rounded-xl border border-slate-100 dark:border-slate-700/50"><h3 class="font-bold text-app-text mb-2 text-primary">Trademarks and Branding</h3><p class="text-sm">Vedhunt InfoTech trademarks, logos, and brand assets cannot be used without prior written consent.</p></div><div class="bg-slate-50 dark:bg-slate-800/30 p-6 rounded-xl border border-slate-100 dark:border-slate-700/50"><h3 class="font-bold text-app-text mb-2 text-primary">Client Data</h3><p class="text-sm">Client-provided content and data remain the property of the client. Vedhunt only uses such data to deliver services or as legally required.</p></div></div>`
    },
    {
      id: "6",
      title: "6. Confidentiality",
      content: `<p class="mb-4">Both Vedhunt InfoTech and the Client agree to:</p><ul class="space-y-4 pl-2"><li class="flex items-start"><span class="text-primary mr-3 mt-1 font-bold">•</span><span>Maintain strict confidentiality of all proprietary, personal, and business data shared during the engagement.</span></li><li class="flex items-start"><span class="text-primary mr-3 mt-1 font-bold">•</span><span>Use such information solely for the purpose of project execution.</span></li><li class="flex items-start"><span class="text-primary mr-3 mt-1 font-bold">•</span><span>Prevent unauthorized access, duplication, or disclosure to any third party without explicit written consent.</span></li></ul>`
    },
    {
      id: "7",
      title: "7. Data Protection & Compliance",
      content: `<p class="mb-4">Vedhunt InfoTech is committed to data security and privacy:</p><ul class="space-y-4 pl-2"><li class="flex items-start"><span class="text-primary mr-3 mt-1 font-bold">•</span><span>We comply with applicable data protection laws in India (including the Digital Personal Data Protection Act, where applicable).</span></li><li class="flex items-start"><span class="text-primary mr-3 mt-1 font-bold">•</span><span>We implement industry-standard technical and organizational measures to safeguard your data.</span></li><li class="flex items-start"><span class="text-primary mr-3 mt-1 font-bold">•</span><span>In the event of a suspected data breach, we will notify affected parties within the legally required timeframes.</span></li></ul>`
    },
    {
      id: "8",
      title: "8. Payments and Billing",
      content: `<p class="mb-4">Our financial terms are structured to ensure transparency and accountability:</p><ul class="space-y-4 pl-2"><li class="flex items-start"><span class="text-primary mr-3 mt-1 font-bold">•</span><span>All invoices are due and payable within the period specified on the invoice (typically 15 days from the date of issue).</span></li><li class="flex items-start"><span class="text-primary mr-3 mt-1 font-bold">•</span><span>Services may be suspended if payments are overdue by more than 30 days.</span></li><li class="flex items-start"><span class="text-primary mr-3 mt-1 font-bold">•</span><span>Taxes, such as GST or other applicable levies, will be charged in addition to the base service fees as per Indian taxation laws.</span></li></ul>`
    },
    {
      id: "9",
      title: "9. Warranties and Limitations",
      content: `<p class="mb-4">Vedhunt InfoTech provides services on a best-effort and professional basis, without guaranteeing outcomes beyond the defined scope.</p><ul class="space-y-4 pl-2 mb-6"><li class="flex items-start"><span class="text-red-500 mr-3 mt-1 font-bold">✗</span><span>We do not warrant uninterrupted, error-free, or 100% bug-free services.</span></li><li class="flex items-start"><span class="text-red-500 mr-3 mt-1 font-bold">✗</span><span>We are not responsible for issues caused by third-party tools, hosting providers, APIs, or client-side data errors.</span></li></ul><div class="bg-primary/10 p-6 sm:p-8 rounded-2xl border border-primary/20 relative overflow-hidden shadow-sm"><div class="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl -mr-16 -mt-16"></div><h3 class="font-bold text-app-text text-xl mb-4 relative z-10 flex items-center gap-2"><span class="text-xl">⚠️</span> Limitation of Liability</h3><p class="relative z-10 text-sm text-app-text">To the fullest extent permitted by law, Vedhunt InfoTech’s liability for any damages (direct, indirect, incidental, or consequential) shall not exceed the total fees paid by the client for the specific service within the last 6 months.</p></div>`
    },
    {
      id: "10",
      title: "10. Prohibited Activities",
      content: `<p class="mb-4">While using our services, platforms, or tools, you are strictly prohibited from:</p><ul class="space-y-4 pl-2"><li class="flex items-start"><span class="text-primary mr-3 mt-1 font-bold">•</span><span>Engaging in illegal, fraudulent, or malicious activities.</span></li><li class="flex items-start"><span class="text-primary mr-3 mt-1 font-bold">•</span><span>Attempting to breach, reverse-engineer, or compromise the security of our systems, servers, or networks.</span></li><li class="flex items-start"><span class="text-primary mr-3 mt-1 font-bold">•</span><span>Distributing malware, viruses, or any harmful code through our hosted solutions.</span></li></ul>`
    },
    {
      id: "11",
      title: "11. Termination of Services",
      content: `<p class="mb-4">Conditions for ending an engagement:</p><ul class="space-y-4 pl-2"><li class="flex items-start"><span class="text-primary mr-3 mt-1 font-bold">•</span><span>Either party may terminate the agreement with a 30-day prior written notice unless stated otherwise in the specific project contract.</span></li><li class="flex items-start"><span class="text-primary mr-3 mt-1 font-bold">•</span><span>Vedhunt InfoTech reserves the right to immediately terminate or suspend services if the client breaches these Terms (e.g., non-payment or prohibited activities).</span></li><li class="flex items-start"><span class="text-primary mr-3 mt-1 font-bold">•</span><span>Upon termination, all outstanding payments must be cleared before the handover of any final deliverables or data.</span></li></ul>`
    },
    {
      id: "12",
      title: "12. Third-Party Services",
      content: `<p class="mb-4">Our solutions may integrate with or rely upon third-party tools (e.g., payment gateways, cloud hosting, APIs).</p><ul class="space-y-4 pl-2"><li class="flex items-start"><span class="text-primary mr-3 mt-1 font-bold">•</span><span>Your use of third-party services is subject to their respective terms of service and privacy policies.</span></li><li class="flex items-start"><span class="text-primary mr-3 mt-1 font-bold">•</span><span>Vedhunt InfoTech is not liable for downtimes, data loss, or breaches occurring due to third-party vendor failures.</span></li></ul>`
    },
    {
      id: "13",
      title: "13. Indemnification",
      content: `<p class="mb-4">The client agrees to indemnify, defend, and hold harmless Vedhunt InfoTech, its directors, employees, and affiliates from any claims, damages, losses, or expenses (including legal fees) arising out of:</p><ul class="space-y-4 pl-2"><li class="flex items-start"><span class="text-primary mr-3 mt-1 font-bold">•</span><span>Your use of our services in violation of these Terms.</span></li><li class="flex items-start"><span class="text-primary mr-3 mt-1 font-bold">•</span><span>Any intellectual property infringement caused by materials or data provided by the client.</span></li></ul>`
    },
    {
      id: "14",
      title: "14. Governing Law & Jurisdiction",
      content: `<p class="mb-4">These Terms & Conditions, and any disputes arising out of or in connection with them, shall be governed by and construed in accordance with the laws of India.</p><p class="mt-2">Both parties irrevocably agree that the courts of <strong>Pune, Maharashtra, India</strong> shall have exclusive jurisdiction to settle any dispute or claim that arises out of or in connection with this agreement.</p>`
    },
    {
      id: "15",
      title: "15. Force Majeure",
      content: `<p class="mb-4">Neither party shall be held liable for any failure or delay in fulfilling its obligations if such failure or delay is caused by circumstances beyond their reasonable control.</p><p class="mt-2 text-sm text-slate-500 dark:text-slate-400">This includes, but is not limited to, acts of God, natural disasters, pandemics, government actions, war, terrorism, strikes, or major internet and telecommunications outages.</p>`
    },
    {
      id: "16",
      title: "16. Updates to Terms",
      content: `<p class="mb-4">Vedhunt InfoTech reserves the right to update, modify, or replace these Terms & Conditions at any time.</p><ul class="space-y-4 pl-2"><li class="flex items-start"><span class="text-primary mr-3 mt-1 font-bold">•</span><span>Changes will become effective immediately upon posting on our website.</span></li><li class="flex items-start"><span class="text-primary mr-3 mt-1 font-bold">•</span><span>Continued use of our services after such modifications constitutes your formal acceptance of the new Terms.</span></li></ul>`
    },
    {
      id: "17",
      title: "17. Contact Information",
      content: `<div class="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2"><div class="flex items-center gap-4 bg-slate-50 dark:bg-slate-800/30 p-5 rounded-xl border border-slate-100 dark:border-slate-700/50"><div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">@</div><div><p class="text-sm text-slate-500 dark:text-slate-400">Email Address</p><a href="mailto:info@vedhunt.in" class="text-app-text font-semibold hover:text-primary transition-colors">info@vedhunt.in</a></div></div><div class="flex items-center gap-4 bg-slate-50 dark:bg-slate-800/30 p-5 rounded-xl border border-slate-100 dark:border-slate-700/50"><div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">#</div><div><p class="text-sm text-slate-500 dark:text-slate-400">Phone Number</p><p class="text-app-text font-semibold">+91 86524 10289</p></div></div><div class="flex items-center gap-4 bg-slate-50 dark:bg-slate-800/30 p-5 rounded-xl border border-slate-100 dark:border-slate-700/50"><div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">📍</div><div><p class="text-sm text-slate-500 dark:text-slate-400">Address</p><p class="text-app-text font-semibold">Vedhunt InfoTech, Pune, Maharashtra, India</p></div></div></div>`
    }
  ]
};

// Fallback default info for Cookie Policy if not found in DB
const DEFAULT_COOKIE_POLICY = {
  hero: {
    heading: 'Cookie Policy',
    lastUpdated: 'May 2026',
    introParagraphs: [
      'How we use cookies to improve your experience on our platform.',
      'Vedhunt InfoTech ("we", "us", or "our") uses cookies and similar tracking technologies to track activity on our service and hold certain information. This Cookie Policy explains what cookies are, how we use them, and your choices regarding their use.'
    ]
  },
  policyData: [
    {
      id: "1",
      title: "1. What Are Cookies?",
      content: "<p>Cookies are small files that are placed on your computer, mobile device, or any other device by a website, containing the details of your browsing history on that website among its many uses. They are widely used in order to make websites work, or work more efficiently, as well as to provide reporting information.</p>"
    },
    {
      id: "2",
      title: "2. How We Use Cookies",
      content: "<p>We use cookies for a variety of reasons detailed below:</p><ul><li><strong>To provide functionality:</strong> Certain cookies are essential for our website to function properly and for you to use its features securely.</li><li><strong>For analytics and performance:</strong> We use cookies to analyze how visitors interact with our website, which pages are visited most often, and to identify any errors or issues.</li><li><strong>For marketing:</strong> These cookies are used to track visitors across websites to display ads that are relevant and engaging for the individual user.</li></ul>"
    },
    {
      id: "3",
      title: "3. Types of Cookies We Use",
      content: "<h4><strong>Essential Cookies</strong></h4><p>These cookies are strictly necessary to provide you with services available through our website. Because these cookies are strictly necessary to deliver the website, refusing them will have an impact on how our site functions.</p><br/><h4><strong>Analytics & Customization Cookies</strong></h4><p>These cookies collect information that is used either in aggregate form to help us understand how our website is being used or how effective our marketing campaigns are, or to help us customize our website for you.</p><br/><h4><strong>Advertising Cookies</strong></h4><p>These cookies are used to make advertising messages more relevant to you. They perform functions like preventing the same ad from continuously reappearing, ensuring that ads are properly displayed for advertisers, and in some cases selecting advertisements that are based on your interests.</p>"
    },
    {
      id: "4",
      title: "4. Your Choices Regarding Cookies",
      content: "<p>If you prefer to avoid the use of cookies on the website, you must first disable the use of cookies in your browser and then delete the cookies saved in your browser associated with this website. You may use this option for preventing the use of cookies at any time.</p><br/><p>Please note that if you do not accept our cookies, you may experience some inconvenience in your use of the website and some features may not function properly.</p><br/><h4><strong>Browser Settings</strong></h4><p>You can usually change your browser settings to decline cookies. To find out how to manage cookies on popular browsers, please visit:</p><ul><li><a href='https://support.google.com/chrome/answer/95647' target='_blank'>Google Chrome</a></li><li><a href='https://support.apple.com/guide/safari/manage-cookies-and-website-data-sfri11471/mac' target='_blank'>Apple Safari</a></li><li><a href='https://support.mozilla.org/en-US/kb/enhanced-tracking-protection-firefox-desktop' target='_blank'>Mozilla Firefox</a></li><li><a href='https://support.microsoft.com/en-us/windows/microsoft-edge-browsing-data-and-privacy-bb8174ba-9d73-dcf2-9b4a-c582b4e640dd' target='_blank'>Microsoft Edge</a></li></ul>"
    }
  ]
};

/**
 * @desc    Get Contact Info
 * @route   GET /api/settings/contact
 * @access  Public
 */
exports.getContactInfo = async (req, res) => {
  try {
    const contactSettings = await Settings.findOne({ key: 'contactInfo' });
    
    if (!contactSettings) {
      // If it doesn't exist, return default
      return res.status(200).json(DEFAULT_CONTACT_INFO);
    }

    res.status(200).json(contactSettings.value);
  } catch (error) {
    console.error('Error fetching contact info:', error);
    res.status(500).json({ message: 'Server error while fetching contact info' });
  }
};

/**
 * @desc    Update Contact Info
 * @route   PUT /api/admin/settings/contact
 * @access  Private/Admin
 */
exports.updateContactInfo = async (req, res) => {
  try {
    const data = req.body;

    // Validate if data is provided
    if (!data || Object.keys(data).length === 0) {
      return res.status(400).json({ message: 'No contact data provided' });
    }

    // Find and update, or create if not exists
    const contactSettings = await Settings.findOneAndUpdate(
      { key: 'contactInfo' },
      { $set: { value: data } },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(200).json({
      message: 'Contact info updated successfully',
      contactInfo: contactSettings.value
    });
  } catch (error) {
    console.error('Error updating contact info:', error);
    res.status(500).json({ message: 'Server error while updating contact info' });
  }
};

/**
 * @desc    Get Privacy Policy
 * @route   GET /api/settings/privacy-policy
 * @access  Public
 */
exports.getPrivacyPolicy = async (req, res) => {
  try {
    const policySettings = await Settings.findOne({ key: 'privacyPolicy' });
    
    if (!policySettings) {
      return res.status(200).json(DEFAULT_PRIVACY_POLICY);
    }

    res.status(200).json(policySettings.value);
  } catch (error) {
    console.error('Error fetching privacy policy:', error);
    res.status(500).json({ message: 'Server error while fetching privacy policy' });
  }
};

/**
 * @desc    Update Privacy Policy
 * @route   PUT /api/admin/settings/privacy-policy
 * @access  Private/Admin
 */
exports.updatePrivacyPolicy = async (req, res) => {
  try {
    const data = req.body;

    if (!data || Object.keys(data).length === 0) {
      return res.status(400).json({ message: 'No privacy policy data provided' });
    }

    // Auto-generate the last updated date
    const date = new Date();
    const formattedDate = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if (data.hero) {
      data.hero.lastUpdated = `Last Updated: ${formattedDate}`;
    }

    const policySettings = await Settings.findOneAndUpdate(
      { key: 'privacyPolicy' },
      { $set: { value: data } },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(200).json({
      message: 'Privacy policy updated successfully',
      privacyPolicy: policySettings.value
    });
  } catch (error) {
    console.error('Error updating privacy policy:', error);
    res.status(500).json({ message: 'Server error while updating privacy policy' });
  }
};

/**
 * @desc    Get Terms & Conditions
 * @route   GET /api/settings/terms-conditions
 * @access  Public
 */
exports.getTermsConditions = async (req, res) => {
  try {
    const termsSettings = await Settings.findOne({ key: 'termsConditions' });
    
    if (!termsSettings) {
      return res.status(200).json(DEFAULT_TERMS_CONDITIONS);
    }

    res.status(200).json(termsSettings.value);
  } catch (error) {
    console.error('Error fetching terms conditions:', error);
    res.status(500).json({ message: 'Server error while fetching terms and conditions' });
  }
};

/**
 * @desc    Update Terms & Conditions
 * @route   PUT /api/admin/settings/terms-conditions
 * @access  Private/Admin
 */
exports.updateTermsConditions = async (req, res) => {
  try {
    const data = req.body;

    if (!data || Object.keys(data).length === 0) {
      return res.status(400).json({ message: 'No terms conditions data provided' });
    }

    // Auto-generate the last updated date
    const date = new Date();
    const formattedDate = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if (data.hero) {
      data.hero.lastUpdated = `Last Updated: ${formattedDate}`;
    }

    const termsSettings = await Settings.findOneAndUpdate(
      { key: 'termsConditions' },
      { $set: { value: data } },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(200).json({
      message: 'Terms and conditions updated successfully',
      termsConditions: termsSettings.value
    });
  } catch (error) {
    console.error('Error updating terms conditions:', error);
    res.status(500).json({ message: 'Server error while updating terms and conditions' });
  }
};

/**
 * @desc    Get Cookie Policy
 * @route   GET /api/settings/cookie-policy
 * @access  Public
 */
exports.getCookiePolicy = async (req, res) => {
  try {
    const cookieSettings = await Settings.findOne({ key: 'cookiePolicy' });
    
    if (!cookieSettings) {
      return res.status(200).json(DEFAULT_COOKIE_POLICY);
    }

    res.status(200).json(cookieSettings.value);
  } catch (error) {
    console.error('Error fetching cookie policy:', error);
    res.status(500).json({ message: 'Server error while fetching cookie policy' });
  }
};

/**
 * @desc    Update Cookie Policy
 * @route   PUT /api/admin/settings/cookie-policy
 * @access  Private/Admin
 */
exports.updateCookiePolicy = async (req, res) => {
  try {
    const data = req.body;

    if (!data || Object.keys(data).length === 0) {
      return res.status(400).json({ message: 'No cookie policy data provided' });
    }

    // Auto-generate the last updated date
    const date = new Date();
    const formattedDate = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if (data.hero) {
      data.hero.lastUpdated = `Last Updated: ${formattedDate}`;
    }

    const cookieSettings = await Settings.findOneAndUpdate(
      { key: 'cookiePolicy' },
      { $set: { value: data } },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(200).json({
      message: 'Cookie policy updated successfully',
      cookiePolicy: cookieSettings.value
    });
  } catch (error) {
    console.error('Error updating cookie policy:', error);
    res.status(500).json({ message: 'Server error while updating cookie policy' });
  }
};

// Fallback default info for DPA if not found in DB
const DEFAULT_DPA_POLICY = {
  hero: {
    badgeText: 'GDPR & IT Act Compliant',
    heading: 'Data Processing',
    subheading: 'Agreement',
    description: 'This Data Processing Agreement (“Agreement” or “DPA”) forms an integral part of the Service Agreement, Statement of Work (SOW), or Master Services Agreement executed between Vedhunt InfoTech and our Clients.'
  },
  policyData: [
    {
      id: "1",
      title: "1. Purpose",
      content: "<p>The purpose of this DPA is to ensure that any personal or sensitive data processed by Vedhunt InfoTech on behalf of the Client is handled in compliance with applicable data protection laws, including but not limited to the Information Technology Act, 2000, GDPR, and other international regulations.</p>"
    },
    {
      id: "2",
      title: "2. Scope of Processing",
      content: "<p>Vedhunt InfoTech may process data solely for the following business purposes:</p><ul><li>Website & App development services</li><li>Automation, Analytics, and Reporting (SQL, Power BI, Python, BI tools)</li><li>Digital Marketing and Lead Management (Google, Meta, LinkedIn, etc.)</li><li>Accounting & Financial MIS Automation</li><li>Healthcare and Insurance Vendor Analytics (non-clinical data)</li><li>Any additional service explicitly defined in the client’s project scope</li></ul><p>Vedhunt shall not process or use the Client’s data for any purpose other than what is contractually agreed.</p>"
    },
    {
      id: "3",
      title: "3. Roles and Responsibilities",
      content: "<p><strong>3.1 Client (Data Controller)</strong><br/>The Client determines:</p><ul><li>The categories of data processed.</li><li>The lawful basis for processing.</li><li>Instructions provided to Vedhunt InfoTech.</li></ul><p>The Client ensures data shared is obtained lawfully and does not violate any third-party rights.</p><p><strong>3.2 Vedhunt InfoTech (Data Processor)</strong><br/>Vedhunt agrees to:</p><ul><li>Process data only on documented instructions from the Client.</li><li>Implement technical and organizational measures to protect data.</li><li>Ensure confidentiality of all personnel with access to data.</li><li>Not engage any sub-processor without written consent.</li><li>Assist the Client in ensuring compliance with applicable laws.</li></ul>"
    },
    {
      id: "4",
      title: "4. Categories of Data Processed",
      content: "<p>Depending on the service, Vedhunt may process:</p><ul><li>Contact details (name, email, phone, company info)</li><li>Project data and reports</li><li>Transaction or performance data</li><li>System or log data (e.g., Power BI logs, SQL transactions)</li><li>Non-clinical healthcare data (member IDs, claim reference IDs — anonymized)</li></ul><p>Sensitive Personal Data (if applicable): In limited cases (e.g., healthcare vendors), only pseudonymized or masked data is used, ensuring no direct identifiers are accessible.</p>"
    },
    {
      id: "5",
      title: "5. Sub-Processors",
      content: "<p>Vedhunt may use third-party service providers (e.g., AWS, Azure, Google Cloud, Microsoft Power BI, Sendinblue, or Zoho) to perform specific functions.</p><p>Vedhunt ensures that:</p><ul><li>Sub-processors are bound by written contracts ensuring equivalent data protection.</li><li>Clients are informed and may object to specific sub-processors.</li></ul><p>Data transfers comply with international standards (Standard Contractual Clauses or similar).</p>"
    },
    {
      id: "6",
      title: "6. Data Security",
      content: "<p>Vedhunt InfoTech implements reasonable security practices under Indian IT Rules and industry-standard measures, including:</p><ul><li>SSL/TLS encryption for all transmissions</li><li>Encrypted storage for client files and databases</li><li>Role-based access control (RBAC)</li><li>Regular security audits and firewall protection</li><li>Daily backups and disaster recovery systems</li><li>2FA and VPN-based access for internal operations</li></ul><p>If a data breach occurs, Vedhunt will promptly notify the Client (within 72 hours) with full details and corrective actions.</p>"
    },
    {
      id: "7",
      title: "7. Confidentiality",
      content: "<ul><li>All data, project information, and deliverables are treated as confidential.</li><li>Employees, contractors, and partners are bound by NDAs.</li><li>Confidentiality obligations remain effective even after contract termination.</li></ul>"
    },
    {
      id: "8",
      title: "8. Data Retention and Deletion",
      content: "<p>Vedhunt retains client data only as long as necessary for the project or as required by law.</p><p>Upon completion or termination of the engagement:</p><ul><li>All personal data will be securely deleted, anonymized, or returned to the Client.</li><li>Backup copies will be purged within 30 to 60 days unless required for legal compliance.</li></ul>"
    },
    {
      id: "9",
      title: "9. Data Subject Rights",
      content: "<p>Vedhunt assists the Client in fulfilling requests from data subjects, including:</p><ul><li>Access, correction, or deletion of their personal data.</li><li>Restriction or objection to processing.</li><li>Data portability (where applicable).</li></ul><p>Vedhunt shall not respond directly to such requests without prior approval from the Client.</p>"
    },
    {
      id: "10",
      title: "10. International Data Transfers",
      content: "<p>If data is transferred outside India (e.g., hosting or cloud services), Vedhunt ensures:</p><ul><li>The transfer complies with applicable legal safeguards.</li><li>Only GDPR-compliant cloud providers (e.g., AWS, Azure, GCP) are used.</li><li>Data remains encrypted during and after transfer.</li></ul>"
    },
    {
      id: "11",
      title: "11. Audit and Compliance",
      content: "<ul><li>Vedhunt will make available all information necessary to demonstrate compliance.</li><li>The Client may, upon reasonable notice, audit Vedhunt’s data handling procedures (once per year).</li><li>Vedhunt will cooperate fully and correct any non-compliance promptly.</li></ul>"
    },
    {
      id: "12",
      title: "12. Data Breach Notification",
      content: "<p>In the event of an actual or suspected breach:</p><ol><li>Vedhunt will notify the Client within 72 hours.</li><li>The notice will include: Nature and scope of the breach, Data affected, Steps taken to mitigate risks.</li><li>Vedhunt will work closely with the Client to contain and remediate the issue.</li></ol>"
    },
    {
      id: "13",
      title: "13. Liability",
      content: "<p>Vedhunt InfoTech’s total liability arising out of data processing shall not exceed the total amount paid by the Client under the service contract during the 6-month period preceding the claim, unless caused by gross negligence or willful misconduct.</p>"
    },
    {
      id: "14",
      title: "14. Term and Termination",
      content: "<p>This DPA remains in effect:</p><ul><li>For as long as Vedhunt processes data on behalf of the Client; or</li><li>Until the termination of all service agreements.</li></ul><p>Upon termination:</p><ul><li>Vedhunt will delete or return all client data (as per Section 8).</li><li>Any surviving confidentiality and security obligations remain binding.</li></ul>"
    },
    {
      id: "15",
      title: "15. Governing Law and Jurisdiction",
      content: "<p>This Agreement shall be governed by and construed under the laws of India. All disputes shall be subject to the exclusive jurisdiction of the courts in Pune, Maharashtra, India.</p>"
    }
  ],
  acceptance: {
    title: 'Agreement Acceptance',
    description: 'By signing a Service Agreement or engaging Vedhunt InfoTech’s services, the Client acknowledges that they have reviewed and accepted this Data Processing Agreement. This DPA forms part of the binding contractual relationship between Vedhunt and the Client.',
    highlight: 'Vedhunt InfoTech is committed to protecting the integrity, confidentiality, and security of all client data — ensuring full compliance with Indian and international data protection laws.'
  }
};

/**
 * @desc    Get DPA Policy
 * @route   GET /api/settings/dpa
 * @access  Public
 */
exports.getDPA = async (req, res) => {
  try {
    let settings = await Settings.findOne({ key: 'dpa' });
    if (!settings) {
      settings = await Settings.create({
        key: 'dpa',
        value: DEFAULT_DPA_POLICY,
      });
    }
    res.json(settings.value);
  } catch (error) {
    console.error('Error fetching DPA:', error);
    res.status(500).json({ message: 'Server error while fetching DPA' });
  }
};

/**
 * @desc    Update DPA Policy
 * @route   PUT /api/admin/settings/dpa
 * @access  Private (Super Admin / Editor)
 */
exports.updateDPA = async (req, res) => {
  try {
    const updatedData = req.body;
    let settings = await Settings.findOne({ key: 'dpa' });
    
    if (settings) {
      settings.value = updatedData;
      await settings.save();
    } else {
      settings = await Settings.create({
        key: 'dpa',
        value: updatedData,
      });
    }
    
    res.json(settings.value);
  } catch (error) {
    console.error('Error updating DPA:', error);
    res.status(500).json({ message: 'Server error while updating DPA' });
  }
};

// Fallback default info for Refund & Billing Policy
const DEFAULT_REFUND_POLICY = {
  hero: {
    heading: 'Refund & Billing Policy',
    lastUpdated: 'May 2026',
    subtitle: 'Payments, Refunds & Service Terms at Vedhunt',
    paragraphs: [
      'At Vedhunt InfoTech, we are committed to delivering high-quality, customized solutions that add measurable value to our clients\' businesses. Our services are intellectual and time-based, meaning they involve professional expertise, research, planning, and effort invested from the moment a project begins.',
      'For this reason, our billing and refund policy is designed to maintain fairness, transparency, and mutual respect between Vedhunt InfoTech and our clients.'
    ]
  },
  scope: {
    title: '1. Scope',
    intro: 'This policy applies to all professional services offered by Vedhunt InfoTech, including:',
    items: [
      'Website & App Development',
      'Digital Marketing & Social Media Management',
      'Automation (SQL / Power BI / Python)',
      'MIS & Reporting Services',
      'Accounting & Financial Services',
      'Data Analytics, AI, and Consulting Projects'
    ]
  },
  billingTerms: {
    title: '2. Billing Terms',
    items: [
      {
        title: "1. Quotation & Agreement",
        content: "<p>Every project or engagement is initiated after a written quotation, proposal, or agreement is mutually approved. The scope of work, timeline, and payment schedule are clearly defined before commencement.</p>"
      },
      {
        title: "2. Advance Payment",
        content: "<p>Projects typically begin with an advance payment (as mentioned in the quotation or agreement). The advance is considered a confirmation of engagement and allocation of dedicated resources.</p>"
      },
      {
        title: "3. Milestone-Based Billing",
        content: "<p>Depending on the project type, billing may occur at key milestones, deliverable completion, or on a monthly retainer basis. All invoices are shared electronically, inclusive of applicable taxes (GST or others).</p>"
      },
      {
        title: "4. Accepted Payment Methods",
        content: "<ul><li>Bank Transfer (NEFT / RTGS / IMPS)</li><li>UPI / Payment Gateway</li><li>International Wire Transfer (for overseas clients)</li></ul>"
      }
    ]
  },
  noRefund: {
    title: '3. No Refund Policy',
    subtitle: 'Vedhunt InfoTech follows a strict No Refund Policy for all its professional services.',
    intro1: 'This is because our services involve significant intellectual effort, skilled manpower, and time investments that begin immediately upon project initiation.',
    intro2: 'We do not offer refunds for:',
    noRefundItems: [
      'Projects where any stage of design, development, or setup has commenced.',
      'Completed milestones, approved deliverables, or ongoing work-in-progress.',
      'Retainer, subscription, or maintenance plans once service has started.',
      'Third-party costs (e.g., domain, hosting, ad spend, software licenses, API integrations).'
    ],
    commitment: {
      title: 'Our Commitment',
      items: [
        'Every project is executed with clear communication and transparency.',
        'In case of any dissatisfaction, Vedhunt will work collaboratively to review, revise, or realign deliverables within the agreed scope.',
        'If a delay or issue arises due to our side, we will rectify or adjust timelines — instead of processing refunds — ensuring that our clients always receive complete value for their investment.'
      ],
      footer: 'Our priority is long-term client satisfaction, not one-time transactions.'
    }
  },
  cancellation: {
    title: '4. Project Cancellation',
    intro: 'Clients may request cancellation by written notice (email to info@vedhunt.in). In such cases:',
    items: [
      'Work completed up to the date of cancellation will be billed in full.',
      'Advance payments already received are non-refundable, as resources and time are already allocated.',
      'If any external vendor costs have been incurred (e.g., ads, hosting, tools), these will also be chargeable.'
    ]
  }
};

/**
 * @desc    Get Refund Policy
 * @route   GET /api/settings/refund-policy
 * @access  Public
 */
exports.getRefundPolicy = async (req, res) => {
  try {
    let settings = await Settings.findOne({ key: 'refund_policy' });
    if (!settings) {
      settings = await Settings.create({
        key: 'refund_policy',
        value: DEFAULT_REFUND_POLICY,
      });
    }
    res.json(settings.value);
  } catch (error) {
    console.error('Error fetching Refund Policy:', error);
    res.status(500).json({ message: 'Server error while fetching Refund Policy' });
  }
};

/**
 * @desc    Update Refund Policy
 * @route   PUT /api/admin/settings/refund-policy
 * @access  Private (Super Admin / Editor)
 */
exports.updateRefundPolicy = async (req, res) => {
  try {
    const updatedData = req.body;
    let settings = await Settings.findOne({ key: 'refund_policy' });
    
    if (settings) {
      settings.value = updatedData;
      await settings.save();
    } else {
      settings = await Settings.create({
        key: 'refund_policy',
        value: updatedData,
      });
    }
    
    res.json(settings.value);
  } catch (error) {
    console.error('Error updating Refund Policy:', error);
    res.status(500).json({ message: 'Server error while updating Refund Policy' });
  }
};

// Fallback default info for Facebook Settings
const DEFAULT_FACEBOOK_SETTINGS = {
  pixelId: '',
  isWebhookActive: true
};

/**
 * @desc    Get Facebook Integration Settings
 * @route   GET /api/settings/facebook
 * @access  Public
 */
exports.getFacebookSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne({ key: 'facebookIntegration' });
    if (!settings) {
      settings = await Settings.create({
        key: 'facebookIntegration',
        value: DEFAULT_FACEBOOK_SETTINGS,
      });
    }
    res.json(settings.value);
  } catch (error) {
    console.error('Error fetching Facebook Settings:', error);
    res.status(500).json({ message: 'Server error while fetching Facebook Settings' });
  }
};

/**
 * @desc    Update Facebook Integration Settings
 * @route   PUT /api/admin/settings/facebook
 * @access  Private (Super Admin / Editor)
 */
exports.updateFacebookSettings = async (req, res) => {
  try {
    const updatedData = req.body;
    let settings = await Settings.findOne({ key: 'facebookIntegration' });
    
    if (settings) {
      settings.value = updatedData;
      await settings.save();
    } else {
      settings = await Settings.create({
        key: 'facebookIntegration',
        value: updatedData,
      });
    }
    
    res.json(settings.value);
  } catch (error) {
    console.error('Error updating Facebook Settings:', error);
    res.status(500).json({ message: 'Server error while updating Facebook Settings' });
  }
};

const DEFAULT_CAMPAIGN_SETTINGS = {
  facebookPixel: { id: '', enabled: false },
  googleAnalytics: { id: '', enabled: false },
  googleTagManager: { id: '', enabled: false },
  googleAds: { id: 'AW-10976080417', enabled: true, conversionLabel: '8TJtCIb2vMIcEKHk5vEo' },
  linkedInInsight: { id: '', enabled: false },
  audit: { updatedBy: 'System', updatedAt: new Date() }
};

/**
 * @desc    Get Campaign Settings
 * @route   GET /api/settings/campaigns
 * @access  Public
 */
exports.getCampaignSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne({ key: 'campaign_settings' });
    if (!settings) {
      settings = await Settings.create({
        key: 'campaign_settings',
        value: DEFAULT_CAMPAIGN_SETTINGS,
      });
    }
    res.json(settings.value);
  } catch (error) {
    console.error('Error fetching Campaign Settings:', error);
    res.status(500).json({ message: 'Server error while fetching Campaign Settings' });
  }
};

/**
 * @desc    Update Campaign Settings
 * @route   PUT /api/admin/settings/campaigns
 * @access  Private (Super Admin / Editor)
 */
exports.updateCampaignSettings = async (req, res) => {
  try {
    const data = req.body;
    
    // Server-side validation
    const validators = {
      facebookPixel: /^\d+$/,
      googleAnalytics: /^G-[A-Z0-9]+$/,
      googleTagManager: /^GTM-[A-Z0-9]+$/,
      googleAds: /^AW-\d+$/,
      linkedInInsight: /^\d+$/
    };

    const validatePlatform = (platform, regex) => {
      if (data[platform] && data[platform].enabled && data[platform].id) {
        if (!regex.test(data[platform].id)) {
          return `Invalid format for ${platform} ID.`;
        }
      }
      return null;
    };

    const errors = [
      validatePlatform('facebookPixel', validators.facebookPixel),
      validatePlatform('googleAnalytics', validators.googleAnalytics),
      validatePlatform('googleTagManager', validators.googleTagManager),
      validatePlatform('googleAds', validators.googleAds),
      validatePlatform('linkedInInsight', validators.linkedInInsight)
    ].filter(Boolean);

    if (errors.length > 0) {
      return res.status(400).json({ message: 'Validation failed', errors });
    }

    // Add audit trail
    const userName = req.user && req.user.name ? req.user.name : 'Admin';
    data.audit = {
      updatedBy: userName,
      updatedAt: new Date()
    };

    let settings = await Settings.findOne({ key: 'campaign_settings' });
    
    if (settings) {
      settings.value = data;
      await settings.save();
    } else {
      settings = await Settings.create({
        key: 'campaign_settings',
        value: data,
      });
    }
    
    res.json(settings.value);
  } catch (error) {
    console.error('Error updating Campaign Settings:', error);
    res.status(500).json({ message: 'Server error while updating Campaign Settings' });
  }
};

/**
 * @desc    Get Email Settings
 * @route   GET /api/settings/email
 * @access  Public
 */
exports.getEmailSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne({ key: 'email_settings' });
    if (!settings) {
      settings = await Settings.create({
        key: 'email_settings',
        value: {
          emailFrom: process.env.EMAIL_FROM || '',
          hrEmail: process.env.HR_EMAIL || ''
        },
      });
    }
    res.json(settings.value);
  } catch (error) {
    console.error('Error fetching Email Settings:', error);
    res.status(500).json({ message: 'Server error while fetching Email Settings' });
  }
};

/**
 * @desc    Update Email Settings
 * @route   PUT /api/admin/settings/email
 * @access  Private (Super Admin / Editor)
 */
exports.updateEmailSettings = async (req, res) => {
  try {
    const updatedData = req.body;
    let settings = await Settings.findOne({ key: 'email_settings' });
    
    if (settings) {
      settings.value = updatedData;
      await settings.save();
    } else {
      settings = await Settings.create({
        key: 'email_settings',
        value: updatedData,
      });
    }
    
    res.json(settings.value);
  } catch (error) {
    console.error('Error updating Email Settings:', error);
    res.status(500).json({ message: 'Server error while updating Email Settings' });
  }
};

