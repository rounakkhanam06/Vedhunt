const Lead = require('../models/Lead');
const LeadForm = require('../models/LeadForm');
const Settings = require('../models/Settings');
const { sendEmail } = require('../utils/sendEmail');
const logger = require('../utils/logger');

const GRAPH = 'https://graph.facebook.com/v19.0';

/**
 * Shared Facebook lead handling.
 *
 * Both the webhook (push) and the polling sync (pull) end up here, so a lead
 * looks identical however it arrived. Keeping one copy of this matters: an
 * earlier duplicate of the field mapping is exactly how the `phone` vs
 * `phone_number` bug survived unnoticed on a live hiring form.
 */

/** Fields to request when reading a lead object from the Graph API. */
const LEAD_FIELDS = [
  'id',
  'created_time',
  'field_data',
  'campaign_id',
  'campaign_name',
  'adset_id',
  'ad_id',
  'ad_name',
  'platform',
  'is_organic'
].join(',');

/**
 * Facebook's prefilled question keys vary between forms — the same phone field
 * arrives as `phone_number` on one form and `phone` on another. Matching only
 * one spelling silently drops the answer, so every known spelling is listed.
 * Anything not in here is treated as a custom question and kept in `message`.
 */
const STANDARD_FIELDS = {
  fullName:    ['full_name', 'name'],
  firstName:   ['first_name'],
  lastName:    ['last_name'],
  email:       ['email', 'email_address', 'work_email'],
  phone:       ['phone_number', 'phone', 'mobile_number', 'work_phone_number'],
  city:        ['city'],
  companyName: ['company_name'],
  jobTitle:    ['job_title']
};

/** Turn a question key like `what's_your_timeline?` into a readable label. */
function prettifyKey(key) {
  const text = String(key || '').replace(/_/g, ' ').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : 'Answer';
}

/** Facebook's own test leads carry literal placeholder text in every answer. */
function isTestLead(fbLead) {
  return (fbLead.field_data || []).some((f) =>
    (f.values || []).some((v) => String(v).includes('<test lead:'))
  );
}

/**
 * Split a lead's answers into our columns plus everything else, which is kept
 * verbatim — budget, timeline, years of experience, expected CTC are the whole
 * point of a lead form.
 */
function mapFieldData(fieldData = [], questionLabels = new Map()) {
  let fullName = 'Unknown';
  let email = '';
  let phone = 'Not provided';
  let city = '';
  let businessName = '';
  const extraAnswers = [];

  for (const field of fieldData) {
    const values = (field.values || []).map((v) => String(v).trim()).filter(Boolean);
    if (!values.length) continue;

    const val = values.join(', '); // multi-select questions return several
    const key = String(field.name || '').toLowerCase();

    if (STANDARD_FIELDS.fullName.includes(key)) {
      fullName = val;
    } else if (STANDARD_FIELDS.firstName.includes(key)) {
      fullName = fullName === 'Unknown' ? val : `${val} ${(fullName.split(' ')[1] || '')}`.trim();
    } else if (STANDARD_FIELDS.lastName.includes(key)) {
      fullName = fullName === 'Unknown' ? val : `${(fullName.split(' ')[0] || '')} ${val}`.trim();
    } else if (STANDARD_FIELDS.email.includes(key)) {
      email = val;
    } else if (STANDARD_FIELDS.phone.includes(key)) {
      phone = val;
    } else if (STANDARD_FIELDS.city.includes(key)) {
      city = val;
    } else if (STANDARD_FIELDS.companyName.includes(key)) {
      businessName = val;
    } else if (STANDARD_FIELDS.jobTitle.includes(key)) {
      businessName = businessName ? `${businessName} (${val})` : val;
    } else {
      extraAnswers.push({ label: questionLabels.get(field.name) || prettifyKey(field.name), value: val });
    }
  }

  return {
    fullName: fullName.trim() || 'Unknown',
    email,
    phone: phone.trim() || 'Not provided',
    city,
    businessName,
    message: extraAnswers.map(({ label, value }) => `${label}: ${value}`).join('\n')
  };
}

/**
 * Look up the Instant Form a lead came from, registering it on first sight.
 *
 * A page can run any number of forms and marketing adds new ones without
 * telling anyone, so the registry is populated from live traffic rather than
 * configured up front. A newly seen form defaults to 'Sales' and is flagged
 * unclassified until an admin sets its type.
 *
 * Never throws — a failure here must not cost us the lead.
 */
async function resolveLeadForm(formId, platform, pageAccessToken) {
  if (!formId) return null;

  try {
    let form = await LeadForm.findOne({ formId });

    if (!form) {
      let name = '';
      let questions = [];
      try {
        const res = await fetch(`${GRAPH}/${formId}?fields=name,questions{key,label}&access_token=${pageAccessToken}`);
        const formData = await res.json();
        if (formData.error) {
          logger.warn(`Could not fetch details for form ${formId}: ${formData.error.message}`);
        } else {
          name = formData.name || '';
          questions = (formData.questions || [])
            .filter((q) => q.key)
            .map((q) => ({ key: q.key, label: q.label || '' }));
        }
      } catch (err) {
        logger.warn(`Could not fetch details for form ${formId}: ${err.message}`);
      }

      form = await LeadForm.create({ formId, name, platform, questions });
      logger.warn(
        `New Facebook lead form registered: "${name || formId}" (${formId}). ` +
        'It defaults to Sales — classify it in Admin → Facebook Integration.'
      );
    }

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

/** Notify the team. Never throws — the lead is already saved by this point. */
async function notifyAdmin(lead, { platform, leadType, formName, campaignName, campaignId, adName, adId }) {
  let hrEmail = process.env.HR_EMAIL || 'hr@vedhunt.in';
  try {
    const emailSettings = await Settings.findOne({ key: 'email_settings' });
    if (emailSettings?.value?.hrEmail) hrEmail = emailSettings.value.hrEmail;
  } catch (err) {
    logger.error('Error fetching email settings for lead notification:', err);
  }

  const html = `
    <h3>New ${leadType} Lead from ${platform} Lead Ad</h3>
    <p><strong>Lead ID:</strong> ${lead.leadId}</p>
    <p><strong>Form:</strong> ${formName}</p>
    <p><strong>Type:</strong> ${leadType}</p>
    <p><strong>Name:</strong> ${lead.fullName}</p>
    <p><strong>Phone:</strong> ${lead.phone}</p>
    <p><strong>Email:</strong> ${lead.email}</p>
    <p><strong>City:</strong> ${lead.city || 'Not provided'}</p>
    <p><strong>Business:</strong> ${lead.businessName || 'Not provided'}</p>
    <p><strong>Campaign:</strong> ${campaignName || campaignId || 'N/A'}</p>
    <p><strong>Ad:</strong> ${adName || adId || 'N/A'}</p>
    ${lead.message ? `<p><strong>Answers:</strong><br>${lead.message.replace(/\n/g, '<br>')}</p>` : ''}
  `;

  try {
    await sendEmail({
      email: hrEmail,
      subject: `${platform} ${leadType} Lead: ${lead.fullName} — ${lead.phone} (${formName})`,
      html
    });
  } catch (e) {
    logger.error(`Failed to send admin email for ${platform} lead (lead was still saved):`, e);
  }
}

/**
 * Persist one Graph API lead object.
 *
 * Safe to call for a lead we already hold — the fbLeadId check makes this
 * idempotent, which is what lets the poller re-scan the same window without
 * creating duplicates.
 *
 * @param {object}  fbLead           lead object already fetched from the Graph API
 * @param {string}  formId           the Instant Form it came from
 * @param {string}  pageAccessToken  used only to look up an unseen form
 * @param {boolean} notify           send the team an email (off for backfills)
 * @param {boolean} useSubmittedTime keep Facebook's submission time as createdAt
 */
async function saveFacebookLead({ fbLead, formId, pageAccessToken, notify = true, useSubmittedTime = false }) {
  const fbLeadId = fbLead.id;

  if (await Lead.exists({ fbLeadId })) return { created: false, reason: 'duplicate' };
  if (isTestLead(fbLead)) return { created: false, reason: 'test-lead' };

  // Instagram Lead Ads are delivered through the same page webhook, so the
  // payload alone cannot tell them apart. The lead object's `platform` field
  // is the authoritative signal: 'ig' for Instagram, 'fb' for Facebook.
  const isInstagram = fbLead.platform === 'ig' || fbLead.platform === 'instagram';
  const platform = isInstagram ? 'Instagram' : 'Facebook';
  const utmSource = isInstagram ? 'instagram' : 'facebook';

  const form = await resolveLeadForm(formId, platform, pageAccessToken);
  const formName = form?.name || `FB Form ${formId}`;
  const leadType = form?.leadType || 'Sales';
  const questionLabels = new Map(
    (form?.questions || []).filter((q) => q.label).map((q) => [q.key, q.label])
  );

  const mapped = mapFieldData(fbLead.field_data, questionLabels);

  // Fall back to a synthetic address when the form did not ask for one, or
  // the answer is not a usable address — email is required on the model.
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  const email = (mapped.email && emailRegex.test(mapped.email))
    ? mapped.email
    : `fb_${fbLeadId}@facebook.com`;

  const campaignId = fbLead.campaign_id || '';
  const campaignName = fbLead.campaign_name || '';
  const adName = fbLead.ad_name || '';
  const adId = fbLead.ad_id || '';

  const doc = {
    ...mapped,
    email,
    // `service` is the sales team's editable "what do they want" column. The
    // form name describes that far better than an ad name does.
    service: formName,
    platform,
    fbLeadId,
    fbFormId: formId,
    fbFormName: formName,
    leadType,
    adCampaignId: campaignId,
    source: campaignName
      ? `${platform} Lead Ad (Campaign: ${campaignName})`
      : `${platform} Lead Ad (Ad: ${adId || 'n/a'})`,
    consent: true,
    utmSource,
    utmMedium: fbLead.is_organic ? 'organic' : 'cpc',
    utmCampaign: campaignName || campaignId,
    utmContent: adName
  };

  if (useSubmittedTime && fbLead.created_time) doc.createdAt = new Date(fbLead.created_time);

  let lead;
  try {
    lead = await Lead.create(doc);
  } catch (err) {
    // A racing webhook and poller can both pass the exists() check; the unique
    // index settles it and the loser simply reports a duplicate.
    if (err.code === 11000) return { created: false, reason: 'duplicate' };
    throw err;
  }

  logger.info(
    `New ${platform} ${leadType} lead saved: ${lead.leadId} — ${lead.fullName} (${lead.phone}) [form: ${formName}]`
  );

  if (notify) {
    await notifyAdmin(lead, { platform, leadType, formName, campaignName, campaignId, adName, adId });
  }

  return { created: true, lead };
}

module.exports = {
  GRAPH,
  LEAD_FIELDS,
  STANDARD_FIELDS,
  prettifyKey,
  isTestLead,
  mapFieldData,
  resolveLeadForm,
  saveFacebookLead
};
