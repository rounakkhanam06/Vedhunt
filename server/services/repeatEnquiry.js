const Lead = require('../models/Lead');
const Notification = require('../models/Notification');
const Settings = require('../models/Settings');
const { sendPushToAdmin } = require('../utils/pushNotify');
const { notifyLeadManagers } = require('../utils/notifyLeadManagers');
const { sendEmail } = require('../utils/sendEmail');
const logger = require('../utils/logger');

// A second submit for the same service inside this window is a double-click
// or a retried form, not a new enquiry.
const DOUBLE_SUBMIT_WINDOW_MS = 10 * 60 * 1000;
// Closed-out leads come back into the open lists when the person returns.
const REOPEN_STATUSES = ['Lost', 'Dropped'];

const norm = (s) => String(s || '').trim().toLowerCase();

/**
 * Attach a repeat submission to the lead that already holds this phone/email.
 * Returns { recorded: false, reason } when it is ignored (double-submit or an
 * already-recorded webhook id), otherwise { recorded: true, lead, reopened }.
 * sameRequest is true when this service was already asked for earlier, so the
 * website can tell the person their request is already with us.
 *
 * enquiry: { platform, service, message, source, utmSource, utmMedium,
 *            utmCampaign, externalId, rawPayload }
 * opts.notify: false skips the bell/push/email (Facebook backfill).
 */
async function recordRepeatEnquiry(existing, enquiry, { notify = true, now = new Date() } = {}) {
  const lead = await Lead.findById(existing._id);
  if (!lead) return { recorded: false, reason: 'missing' };

  if (enquiry.externalId && (lead.fbLeadId === enquiry.externalId
      || (lead.repeatEnquiries || []).some((e) => e.externalId === enquiry.externalId))) {
    return { recorded: false, reason: 'already-recorded' };
  }

  // Has this person already asked for this service, on any earlier enquiry?
  const earlierServices = [lead.service, ...(lead.servicesRequired || []), ...(lead.repeatEnquiries || []).map((e) => e.service)];
  const sameRequest = earlierServices.some((s) => norm(s) && norm(s) === norm(enquiry.service || 'Not specified'));

  // Double-submit: same service as the most recent contact, within the window
  const lastAt = lead.lastEnquiryAt || lead.createdAt;
  const lastService = (lead.repeatEnquiries || []).length
    ? lead.repeatEnquiries[lead.repeatEnquiries.length - 1].service
    : lead.service;
  if (lastAt && now - new Date(lastAt) < DOUBLE_SUBMIT_WINDOW_MS && norm(lastService) === norm(enquiry.service)) {
    return { recorded: false, reason: 'double-submit', sameRequest: true };
  }

  const service = enquiry.service || 'Not specified';
  lead.repeatEnquiries.push({ ...enquiry, service, date: now });
  lead.repeatEnquiryCount = (lead.repeatEnquiryCount || 0) + 1;
  lead.lastEnquiryAt = now;

  if (enquiry.service && enquiry.service !== 'Not specified'
      && !(lead.servicesRequired || []).some((s) => norm(s) === norm(enquiry.service))
      && norm(lead.service) !== norm(enquiry.service)) {
    lead.servicesRequired.push(enquiry.service);
  }

  const via = enquiry.platform ? ` via ${enquiry.platform}` : '';
  lead.pipelineHistory.push({ status: lead.status, date: now, note: `Repeat enquiry${via}: ${service}` });

  let reopened = false;
  if (REOPEN_STATUSES.includes(lead.status)) {
    const from = lead.status;
    lead.status = 'New';
    lead.pipelineHistory.push({ status: 'New', date: now, note: `Reopened from ${from} — customer enquired again` });
    reopened = true;
  }

  await lead.save();
  logger.info(`Repeat enquiry recorded on ${lead.leadId}${via}: ${service}${reopened ? ' (reopened)' : ''}`);

  if (notify) await alertRepeatEnquiry(lead, { ...enquiry, service }, reopened);
  return { recorded: true, lead, reopened, sameRequest };
}

/** Bell + push to the owner (or lead managers if unassigned) and HR email. Never throws. */
async function alertRepeatEnquiry(lead, enquiry, reopened) {
  const title = reopened ? 'Closed lead enquired again' : 'Repeat enquiry';
  const message = `${lead.fullName} — ${enquiry.service}${enquiry.platform ? ` · ${enquiry.platform}` : ''}`;
  const link = `/admin/leads?leadId=${lead._id}`;
  try {
    if (lead.assignedTo) {
      await Notification.create({ recipient: lead.assignedTo, type: 'repeat_enquiry', title, message, link, lead: lead._id });
      await sendPushToAdmin(lead.assignedTo, { title, body: message, link }).catch(() => {});
    } else {
      await notifyLeadManagers({ type: 'repeat_enquiry', title, message, link, lead: lead._id });
    }
  } catch (err) {
    logger.error('Repeat enquiry alert failed:', err);
  }

  try {
    let hrEmail = process.env.HR_EMAIL || 'hr@vedhunt.in';
    const emailSettings = await Settings.findOne({ key: 'email_settings' }).catch(() => null);
    if (emailSettings?.value?.hrEmail) hrEmail = emailSettings.value.hrEmail;
    const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    await sendEmail({
      email: hrEmail,
      subject: `Repeat enquiry: ${lead.fullName} - ${enquiry.service} (${lead.leadId})`,
      html: `
        <h3>Repeat enquiry on existing lead ${esc(lead.leadId)}${reopened ? ' (reopened)' : ''}</h3>
        <p><strong>Name:</strong> ${esc(lead.fullName)}</p>
        <p><strong>Phone:</strong> ${esc(lead.phone)}</p>
        <p><strong>Email:</strong> ${esc(lead.email)}</p>
        <p><strong>New service:</strong> ${esc(enquiry.service)}</p>
        <p><strong>Via:</strong> ${esc(enquiry.platform)} — ${esc(enquiry.source)}</p>
        <p><strong>Current status:</strong> ${esc(lead.status)}</p>
        ${enquiry.message ? `<p><strong>Message:</strong><br>${esc(enquiry.message).replace(/\n/g, '<br>')}</p>` : ''}
      `
    });
  } catch (err) {
    logger.error('Repeat enquiry email failed:', err);
  }
}

module.exports = { recordRepeatEnquiry, DOUBLE_SUBMIT_WINDOW_MS };
