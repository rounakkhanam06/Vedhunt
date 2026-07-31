const crypto = require('crypto');
const Lead = require('../models/Lead');
const LeadForm = require('../models/LeadForm');
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
    const adId    = leadData.ad_id;
    const formId  = leadData.form_id;

    // Check if duplicate before making any API calls
    const existingLead = await Lead.findOne({ fbLeadId });
    if (existingLead) {
      logger.info(`Duplicate FB Lead ID ignored: ${fbLeadId}`);
      return;
    }

    // Fetch full lead details using Graph API
    const pageAccessToken = process.env.FB_PAGE_ACCESS_TOKEN;
    if (!pageAccessToken) {
      logger.error('FB_PAGE_ACCESS_TOKEN is missing from environment variables. Cannot fetch lead data.');
      return;
    }

    // Request campaign/platform metadata alongside the answers. The leadgen
    // webhook payload only carries ad_id/adgroup_id/form_id — campaign details
    // and the fb-vs-ig platform flag are only available on the lead object.
    const leadFields = [
      'field_data',
      'campaign_id',
      'campaign_name',
      'adset_id',
      'ad_name',
      'platform',
      'is_organic'
    ].join(',');

    const url = `https://graph.facebook.com/v19.0/${fbLeadId}?fields=${leadFields}&access_token=${pageAccessToken}`;

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
          `Lead ID ${fbLeadId} was NOT saved.`
        );
      } else {
        logger.error(`Graph API error for lead ${fbLeadId}: [${data.error.code}] ${data.error.message}`);
      }
      return;
    }

    // ── Field Mapping ──────────────────────────────────────────────────────────
    let fullName     = 'Unknown';
    let email        = '';
    let phone        = 'Not provided';
    let city         = '';
    let businessName = '';
    let service      = `FB Form ${formId}`;

    if (data.field_data) {
      for (const field of data.field_data) {
        const val = (field.values && field.values[0]) ? field.values[0].trim() : '';
        if (!val) continue;

        switch (field.name) {
          case 'full_name':    fullName = val; break;
          case 'first_name':  fullName = fullName === 'Unknown' ? val : `${val} ${(fullName.split(' ')[1] || '')}`.trim(); break;
          case 'last_name':   fullName = fullName === 'Unknown' ? val : `${(fullName.split(' ')[0] || '')} ${val}`.trim(); break;
          case 'email':       email = val; break;
          case 'phone_number': phone = val; break;
          case 'city':        city = val; break;
          case 'company_name': businessName = val; break;
          case 'job_title':   businessName = businessName ? `${businessName} (${val})` : val; break;
        }
      }
    }

    // Sanitize required fields
    fullName = fullName.trim() || 'Unknown';
    phone    = phone.trim()    || 'Not provided';

    // Email validation — fallback to synthetic address if missing/invalid
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!email || !emailRegex.test(email)) {
      email = `fb_${fbLeadId}@facebook.com`;
    }

    // ── Platform Detection: Facebook vs Instagram ──────────────────────────────
    // Instagram Lead Ads are delivered through the same page webhook, so the
    // payload alone cannot tell them apart. The lead object's `platform` field
    // is the authoritative signal: 'ig' for Instagram, 'fb' for Facebook.
    const isInstagram = data.platform === 'ig' || data.platform === 'instagram';
    const platform = isInstagram ? 'Instagram' : 'Facebook';
    const utmSource = isInstagram ? 'instagram' : 'facebook';

    // ── Campaign Attribution ───────────────────────────────────────────────────
    const campaignId   = data.campaign_id || '';
    const campaignName = data.campaign_name || '';
    const adName       = data.ad_name || '';

    const sourceLabel = campaignName
      ? `${platform} Lead Ad (Campaign: ${campaignName})`
      : `${platform} Lead Ad (Ad: ${adId})`;

    // Prefer a human-readable campaign name in the admin UTM column, falling
    // back to the raw id when the token lacks ads-read permission.
    const utmCampaign = campaignName || campaignId;

    // ── Form Routing ───────────────────────────────────────────────────────────
    // Every form on the page delivers to this one webhook, so the form is what
    // tells a BD hiring lead apart from a service enquiry.
    const form = await resolveLeadForm(formId, platform, pageAccessToken);
    const formName = form?.name || `FB Form ${formId}`;
    const leadType = form?.leadType || 'Sales';

    // `service` is the sales team's editable "what do they want" column. The
    // form name describes that far better than an ad name does.
    service = formName;

    // ── Create Lead ────────────────────────────────────────────────────────────
    const lead = await Lead.create({
      fullName,
      email,
      phone,
      city,
      businessName,
      service,
      platform,
      fbLeadId,
      fbFormId: formId,
      fbFormName: formName,
      leadType,
      adCampaignId: campaignId,
      source: sourceLabel,
      consent: true,
      utmSource,
      utmMedium: data.is_organic ? 'organic' : 'cpc',
      utmCampaign,
      utmContent: adName
    });

    logger.info(
      `New ${platform} ${leadType} lead saved: ${lead.leadId} — ${fullName} (${phone}) [form: ${formName}]`
    );

    // ── Admin Email Notification ───────────────────────────────────────────────
    let hrEmail = process.env.HR_EMAIL || 'hr@vedhunt.in';
    try {
      const emailSettings = await Settings.findOne({ key: 'email_settings' });
      if (emailSettings?.value?.hrEmail) {
        hrEmail = emailSettings.value.hrEmail;
      }
    } catch (err) {
      logger.error('Error fetching email settings for FB lead notification:', err);
    }

    const emailContent = `
      <h3>New ${leadType} Lead from ${platform} Lead Ad</h3>
      <p><strong>Lead ID:</strong> ${lead.leadId}</p>
      <p><strong>Form:</strong> ${formName}</p>
      <p><strong>Type:</strong> ${leadType}</p>
      <p><strong>Name:</strong> ${fullName}</p>
      <p><strong>Phone:</strong> ${phone}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>City:</strong> ${city || 'Not provided'}</p>
      <p><strong>Business:</strong> ${businessName || 'Not provided'}</p>
      <p><strong>Platform:</strong> ${platform} Lead Ad</p>
      <p><strong>Campaign:</strong> ${campaignName || campaignId || 'N/A'}</p>
      <p><strong>Ad:</strong> ${adName || adId || 'N/A'}</p>
    `;

    try {
      await sendEmail({
        email: hrEmail,
        subject: `${platform} ${leadType} Lead: ${fullName} — ${phone} (${formName})`,
        html: emailContent
      });
    } catch (e) {
      logger.error(`Failed to send admin email for ${platform} lead (lead was still saved):`, e);
    }

  } catch (error) {
    logger.error('Error processing Facebook lead:', error);
  }
}

/**
 * Look up the Instant Form a lead came from, registering it on first sight.
 *
 * A page can run any number of forms and marketing adds new ones without
 * telling anyone, so the registry is populated from live traffic rather than
 * configured up front. A newly seen form defaults to 'Sales' and is flagged
 * unclassified until an admin sets its type in the Facebook Integration page.
 *
 * Never throws — a failure here must not cost us the lead.
 */
async function resolveLeadForm(formId, platform, pageAccessToken) {
  if (!formId) return null;

  try {
    let form = await LeadForm.findOne({ formId });

    if (!form) {
      // The lead object does not carry the form name, so fetch it separately.
      // Only ever runs once per form.
      let name = '';
      try {
        const res = await fetch(
          `https://graph.facebook.com/v19.0/${formId}?fields=name&access_token=${pageAccessToken}`
        );
        const formData = await res.json();
        if (formData.error) {
          logger.warn(`Could not fetch name for form ${formId}: ${formData.error.message}`);
        } else {
          name = formData.name || '';
        }
      } catch (err) {
        logger.warn(`Could not fetch name for form ${formId}: ${err.message}`);
      }

      form = await LeadForm.create({ formId, name, platform });
      logger.warn(
        `New Facebook lead form registered: "${name || formId}" (${formId}). ` +
        'It defaults to Sales — classify it in Admin → Facebook Integration.'
      );
    }

    // Fire-and-forget stats; a failure here is not worth losing the lead over.
    LeadForm.updateOne(
      { _id: form._id },
      { $inc: { leadCount: 1 }, $set: { lastLeadAt: new Date() } }
    ).catch((err) => logger.warn(`Could not update stats for form ${formId}: ${err.message}`));

    return form;
  } catch (error) {
    logger.error(`Error resolving lead form ${formId}:`, error);
    return null;
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
