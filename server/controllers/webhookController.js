const crypto = require('crypto');
const Lead = require('../models/Lead');
const Settings = require('../models/Settings');
const { sendEmail } = require('../utils/sendEmail');
const logger = require('../utils/logger');
const { GRAPH, LEAD_FIELDS, prettifyKey, saveFacebookLead } = require('../services/facebookLeads');
const { findDuplicateLead } = require('../services/leadDedup');
const { autoAssignLead } = require('../services/leadAssignment');

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

    // express.raw() leaves req.body as {} when the content type does not match,
    // which would make the HMAC below throw an opaque TypeError. Catch it here
    // so the cause is obvious in the logs.
    if (!Buffer.isBuffer(req.body)) {
      logger.error(
        `Facebook webhook received a non-raw body (content-type: ${req.headers['content-type']}). ` +
        'The webhook route must be registered before the global express.json().'
      );
      return res.status(400).send('Expected raw body');
    }

    const signatureHash = signature.split('=')[1] || '';

    const expectedHash = crypto
      .createHmac('sha256', process.env.FB_APP_SECRET)
      .update(req.body)
      .digest('hex');

    // Constant-time compare. timingSafeEqual throws on length mismatch, so the
    // lengths are checked first.
    const received = Buffer.from(signatureHash, 'utf8');
    const expected = Buffer.from(expectedHash, 'utf8');
    if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) {
      logger.error('Facebook webhook signature mismatch');
      return res.status(401).send('Invalid signature');
    }

    // 2. Parse payload
    const body = JSON.parse(req.body.toString());

    // Anything that is not a page event is acknowledged with 200. A non-2xx
    // makes Facebook retry the delivery and counts towards the failure rate
    // that can get the whole subscription disabled.
    if (body.object !== 'page') {
      logger.info(`Ignoring Facebook webhook for object: ${body.object}`);
      return res.status(200).send('EVENT_RECEIVED');
    }

    // Acknowledge receipt to Facebook immediately
    // Facebook requires a 200 response within ~5 seconds or it will retry
    res.status(200).send('EVENT_RECEIVED');

    // FIX: Use for...of instead of forEach with async callbacks.
    // forEach does NOT await async callbacks — errors were silently swallowed.
    // Entries for other subscribed fields (messaging, feed, …) carry no
    // `changes` array, so guard before iterating.
    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field === 'leadgen') {
          const leadData = change.value;
          // Pass the page_id so we can detect Instagram vs Facebook
          leadData._pageId = entry.id;
          await processFacebookLead(leadData);
        }
      }
    }

  } catch (error) {
    logger.error('Error handling Facebook webhook:', error);
    // Don't send 500 back or Facebook will retry repeatedly
    if (!res.headersSent) res.status(200).send('Error processed');
  }
};

async function processFacebookLead(leadData) {
  try {
    const fbLeadId = leadData.leadgen_id;
    const formId   = leadData.form_id;

    // Check if duplicate before making any API calls
    if (await Lead.exists({ fbLeadId })) {
      logger.info(`Duplicate FB Lead ID ignored: ${fbLeadId}`);
      return;
    }

    const pageAccessToken = process.env.FB_PAGE_ACCESS_TOKEN;
    if (!pageAccessToken) {
      logger.error('FB_PAGE_ACCESS_TOKEN is missing from environment variables. Cannot fetch lead data.');
      return;
    }

    // The leadgen webhook payload only carries ad_id/adgroup_id/form_id —
    // the answers, campaign details and the fb-vs-ig platform flag all live
    // on the lead object itself.
    const url = `${GRAPH}/${fbLeadId}?fields=${LEAD_FIELDS}&access_token=${pageAccessToken}`;

    // We already returned 200 to Facebook, so it will never redeliver this
    // lead. A transient network blip or Graph API 5xx would lose it for good —
    // retry a few times before giving up.
    let data;
    const MAX_ATTEMPTS = 3;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const response = await fetch(url);
        data = await response.json();

        // Codes 1, 2 and 4 are Graph API's transient/throttling errors.
        const transient = data.error && [1, 2, 4].includes(data.error.code);
        if (!transient) break;

        logger.warn(
          `Transient Graph API error for lead ${fbLeadId} ` +
          `(attempt ${attempt}/${MAX_ATTEMPTS}): [${data.error.code}] ${data.error.message}`
        );
      } catch (err) {
        logger.warn(`Graph API request failed for lead ${fbLeadId} (attempt ${attempt}/${MAX_ATTEMPTS}): ${err.message}`);
        data = null;
      }

      if (attempt < MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }

    if (!data) {
      logger.error(`Graph API unreachable after ${MAX_ATTEMPTS} attempts. Lead ID ${fbLeadId} was NOT saved.`);
      return;
    }

    if (data.error) {
      // Provide clear guidance for token expiry — the most common failure mode
      if (data.error.code === 190) {
        logger.error(
          `FB_PAGE_ACCESS_TOKEN is EXPIRED or INVALID (code 190). ` +
          `Renew it in Facebook Business Manager → Pages → Page Settings → Advanced. ` +
          `Lead ID ${fbLeadId} was NOT saved. The lead sync will pick it up once the token is fixed.`
        );
      } else {
        logger.error(`Graph API error for lead ${fbLeadId}: [${data.error.code}] ${data.error.message}`);
      }
      return;
    }

    // Mapping, form routing and persistence are shared with the polling sync
    // so a lead looks the same however it reached us.
    data.id = data.id || fbLeadId;
    data.ad_id = data.ad_id || leadData.ad_id || '';
    await saveFacebookLead({ fbLead: data, formId, pageAccessToken, notify: true });

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
    const { google_key, lead_id, user_column_data, campaign_id } = req.body || {};

    // Verify secret key (configured in Google Ads UI). Fail closed when the key
    // is not configured at all, rather than comparing against undefined.
    if (!process.env.GOOGLE_WEBHOOK_KEY) {
      logger.error(
        'GOOGLE_WEBHOOK_KEY is missing from environment variables. ' +
        'Every Google Ads lead will be rejected until it is set and the same ' +
        'value is entered in the Google Ads lead form delivery settings.'
      );
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

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

    // As with Facebook, answers to the form's own qualifying questions are the
    // point of the lead — keep any column we do not map to a column of its own.
    const extraAnswers = [];

    user_column_data.forEach(field => {
      const val = field.string_value || '';
      if (!val) return;
      switch(field.column_id) {
        case 'FULL_NAME': fullName = val; break;
        case 'FIRST_NAME': fullName = fullName === 'Unknown' ? val : val + ' ' + fullName.split(' ')[1]; break;
        case 'LAST_NAME': fullName = fullName === 'Unknown' ? val : fullName.split(' ')[0] + ' ' + val; break;
        case 'USER_EMAIL': email = val; break;
        case 'USER_PHONE': phone = val; break;
        case 'CITY': city = val; break;
        case 'COMPANY_NAME': businessName = val; break;
        default: extraAnswers.push({ label: prettifyKey(String(field.column_id).toLowerCase()), value: val });
      }
    });

    // Checked against the raw scraped phone/email (still 'Unknown' /
    // 'unknown@example.com' at this point for a form that didn't ask) so a
    // second lead lacking a real email never matches the first one's
    // placeholder and gets wrongly dropped as a duplicate.
    const contactDuplicate = await findDuplicateLead({
      phone: phone === 'Unknown' ? '' : phone,
      email: email === 'unknown@example.com' ? '' : email
    });
    if (contactDuplicate) {
      logger.info(`Google lead ${lead_id} matches existing lead ${contactDuplicate.leadId} by phone/email — skipping duplicate.`);
      return res.status(200).send('OK');
    }

    const lead = await Lead.create({
      fullName,
      email,
      phone,
      city,
      businessName,
      message: extraAnswers.map(({ label, value }) => `${label}: ${value}`).join('\n'),
      service,
      platform: 'Google Ads',
      fbLeadId: `google_${lead_id}`,
      adCampaignId: campaign_id || '',
      source: `Google Lead Ad (Campaign: ${campaign_id})`,
      consent: true,
      utmSource: 'google',
      utmMedium: 'cpc',
      utmCampaign: campaign_id || '',
      // The untouched webhook body, captured before field mapping.
      rawPayload: req.body
    });

    // Never throws — logs and leaves the lead Unassigned on any failure.
    await autoAssignLead(lead);

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
