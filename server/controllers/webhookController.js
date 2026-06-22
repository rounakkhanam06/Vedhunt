const crypto = require('crypto');
const Lead = require('../models/Lead');
const Settings = require('../models/Settings');
const { sendEmail } = require('../utils/sendEmail');
const logger = require('../utils/logger');

// ==========================================
// FACEBOOK LEAD ADS WEBHOOK
// ==========================================

/**
 * @desc    Verify Facebook Webhook Subscription
 * @route   GET /api/leads/webhook/facebook
 * @access  Public
 */
exports.verifyFacebookWebhook = (req, res) => {
  const verify_token = process.env.FB_VERIFY_TOKEN;

  // Parse params from the webhook verification request
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === verify_token) {
      logger.info('Facebook Webhook Verified');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  } else {
    res.sendStatus(400);
  }
};

/**
 * @desc    Receive Facebook Lead Ads Payload
 * @route   POST /api/leads/webhook/facebook
 * @access  Public (Verified by HMAC)
 */
exports.receiveFacebookLead = async (req, res) => {
  try {
    // 1. Verify Signature
    const signature = req.headers['x-hub-signature-256'];
    if (!signature) {
      return res.status(401).send('No signature provided');
    }

    const elements = signature.split('=');
    const signatureHash = elements[1];
    
    // Note: req.body MUST be raw buffer for this to work correctly!
    const expectedHash = crypto
      .createHmac('sha256', process.env.FB_APP_SECRET)
      .update(req.body)
      .digest('hex');

    if (signatureHash !== expectedHash) {
      logger.error('Facebook webhook signature mismatch');
      return res.status(401).send('Invalid signature');
    }

    // 2. Parse payload
    const body = JSON.parse(req.body.toString());

    if (body.object !== 'page') {
      return res.status(404).send('Not a page object');
    }

    // Acknowledge receipt to Facebook immediately
    res.status(200).send('EVENT_RECEIVED');

    // Process entries asynchronously
    body.entry.forEach(async (entry) => {
      entry.changes.forEach(async (change) => {
        if (change.field === 'leadgen') {
          const leadData = change.value;
          await processFacebookLead(leadData);
        }
      });
    });

  } catch (error) {
    logger.error('Error handling Facebook webhook:', error);
    // Don't send 500 back or Facebook will retry repeatedly
    if (!res.headersSent) res.status(200).send('Error processed');
  }
};

async function processFacebookLead(leadData) {
  try {
    const fbLeadId = leadData.leadgen_id;
    const adId = leadData.ad_id;
    const formId = leadData.form_id;

    // Check if duplicate
    const existingLead = await Lead.findOne({ fbLeadId });
    if (existingLead) {
      logger.info(`Duplicate FB Lead ID ignored: ${fbLeadId}`);
      return;
    }

    // Fetch full lead details using Graph API
    const pageAccessToken = process.env.FB_PAGE_ACCESS_TOKEN;
    if (!pageAccessToken) {
      logger.error('FB_PAGE_ACCESS_TOKEN is missing');
      return;
    }

    // Dynamically import node-fetch if using Node < 18
    let fetchFn;
    try {
        fetchFn = fetch; // native fetch
    } catch(e) {
        // Fallback for older node versions
        const fetchModule = await import('node-fetch');
        fetchFn = fetchModule.default;
    }

    const response = await fetchFn(`https://graph.facebook.com/v19.0/${fbLeadId}?access_token=${pageAccessToken}`);
    const data = await response.json();

    if (data.error) {
      logger.error('Error fetching lead data from Graph API:', data.error);
      return;
    }

    // Map Facebook field data to our Lead schema
    let fullName = 'Unknown';
    let email = '';
    let phone = 'Not provided';
    let city = '';
    let businessName = '';
    let service = `FB Form ${formId}`;

    if (data.field_data) {
      data.field_data.forEach(field => {
        const val = (field.values && field.values[0]) ? field.values[0].trim() : '';
        if (!val) return;

        switch(field.name) {
          case 'full_name': fullName = val; break;
          case 'first_name': fullName = fullName === 'Unknown' ? val : val + ' ' + (fullName.split(' ')[1] || ''); break;
          case 'last_name': fullName = fullName === 'Unknown' ? val : (fullName.split(' ')[0] || '') + ' ' + val; break;
          case 'email': email = val; break;
          case 'phone_number': phone = val; break;
          case 'city': city = val; break;
          case 'company_name': businessName = val; break;
          case 'job_title': businessName = businessName ? `${businessName} (${val})` : val; break;
        }
      });
    }

    // Sanitize and ensure required fields for Mongoose validation
    fullName = fullName.trim() || 'Unknown';
    phone = phone.trim() || 'Not provided';
    
    // Validate email format, fallback if invalid/missing
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!email || !emailRegex.test(email)) {
      email = `fb_${fbLeadId}@facebook.com`;
    }

    // Map campaign data if available in the webhook (sometimes it is)
    // Sometimes ad details need another Graph API call to `ad_id`
    const lead = await Lead.create({
      fullName,
      email,
      phone,
      city,
      businessName,
      service,
      platform: 'Facebook',
      fbLeadId,
      adCampaignId: leadData.campaign_id || '',
      source: `Facebook Lead Ad (Ad: ${adId})`,
      consent: true,
      utmSource: 'facebook',
      utmMedium: 'cpc',
      utmCampaign: leadData.campaign_id || ''
    });

    // Send Admin Email
    let hrEmail = process.env.HR_EMAIL || 'hr@vedhunt.in';
    try {
      const emailSettings = await Settings.findOne({ key: 'email_settings' });
      if (emailSettings && emailSettings.value && emailSettings.value.hrEmail) {
        hrEmail = emailSettings.value.hrEmail;
      }
    } catch (err) {
      logger.error('Error fetching email settings:', err);
    }
    const emailContent = `
      <h3>New Lead from Facebook Lead Ad</h3>
      <p><strong>Name:</strong> ${fullName}</p>
      <p><strong>Phone:</strong> ${phone}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Platform:</strong> Facebook</p>
      <p><strong>Form ID:</strong> ${formId}</p>
    `;

    try {
      await sendEmail({
        email: hrEmail,
        subject: `FB Lead: ${fullName}`,
        html: emailContent
      });
    } catch (e) {
      logger.error('Failed to send email for FB lead', e);
    }

  } catch (error) {
    logger.error('Error processing Facebook lead:', error);
  }
}

// ==========================================
// GOOGLE ADS LEAD WEBHOOK
// ==========================================

/**
 * @desc    Receive Google Ads Lead Payload
 * @route   POST /api/leads/webhook/google
 * @access  Public (Verified by Google Key)
 */
exports.receiveGoogleLead = async (req, res) => {
  try {
    const { google_key, lead_id, user_column_data, campaign_id } = req.body;

    // Verify secret key (configured in Google Ads UI)
    if (google_key !== process.env.GOOGLE_WEBHOOK_KEY) {
      logger.error('Google webhook key mismatch');
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (!lead_id || !user_column_data) {
      return res.status(400).json({ success: false, message: 'Invalid payload' });
    }

    // Check if duplicate
    const existingLead = await Lead.findOne({ fbLeadId: `google_${lead_id}` }); // Reuse fbLeadId for uniqueness
    if (existingLead) {
      logger.info(`Duplicate Google Lead ID ignored: ${lead_id}`);
      return res.status(200).send('OK');
    }

    // Map Google field data to our Lead schema
    let fullName = 'Unknown';
    let email = 'unknown@example.com';
    let phone = 'Unknown';
    let city = '';
    let businessName = '';
    let service = `Google Ad Campaign ${campaign_id || ''}`;

    user_column_data.forEach(field => {
      const val = field.string_value || '';
      switch(field.column_id) {
        case 'FULL_NAME': fullName = val; break;
        case 'FIRST_NAME': fullName = fullName === 'Unknown' ? val : val + ' ' + fullName.split(' ')[1]; break;
        case 'LAST_NAME': fullName = fullName === 'Unknown' ? val : fullName.split(' ')[0] + ' ' + val; break;
        case 'USER_EMAIL': email = val; break;
        case 'USER_PHONE': phone = val; break;
        case 'CITY': city = val; break;
        case 'COMPANY_NAME': businessName = val; break;
      }
    });

    const lead = await Lead.create({
      fullName,
      email,
      phone,
      city,
      businessName,
      service,
      platform: 'Google Ads',
      fbLeadId: `google_${lead_id}`,
      adCampaignId: campaign_id || '',
      source: `Google Lead Ad (Campaign: ${campaign_id})`,
      consent: true,
      utmSource: 'google',
      utmMedium: 'cpc',
      utmCampaign: campaign_id || ''
    });

    // Send Admin Email
    let hrEmail = process.env.HR_EMAIL || 'hr@vedhunt.in';
    try {
      const emailSettings = await Settings.findOne({ key: 'email_settings' });
      if (emailSettings && emailSettings.value && emailSettings.value.hrEmail) {
        hrEmail = emailSettings.value.hrEmail;
      }
    } catch (err) {
      logger.error('Error fetching email settings:', err);
    }
    const emailContent = `
      <h3>New Lead from Google Ads Lead Form</h3>
      <p><strong>Name:</strong> ${fullName}</p>
      <p><strong>Phone:</strong> ${phone}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Platform:</strong> Google Ads</p>
    `;

    try {
      await sendEmail({
        email: hrEmail,
        subject: `Google Lead: ${fullName}`,
        html: emailContent
      });
    } catch (e) {
      logger.error('Failed to send email for Google lead', e);
    }

    res.status(200).send('OK');

  } catch (error) {
    logger.error('Error handling Google webhook:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
