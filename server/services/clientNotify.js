// Client notifications: one call stores the in-app (bell) notification and
// emails the client. Never throws — a notification problem must not fail
// the admin/employee action that triggered it.
const Client = require('../models/Client');
const ClientNotification = require('../models/ClientNotification');
const { sendEmail } = require('../utils/sendEmail');
const logger = require('../utils/logger');

const portalUrl = (link = '/client/dashboard') =>
  `${(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '')}${link}`;

const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const money = (n) => `₹${(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const date = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '');
const clip = (s, n = 500) => (String(s || '').length > n ? `${String(s).slice(0, n)}…` : String(s || ''));

function emailHtml({ contactName, heading, lines, ctaLabel, link }) {
  const body = lines.map((l) => `<p style="margin:0 0 12px;color:#374151;font-size:14px;line-height:1.6">${l}</p>`).join('');
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;border:1px solid #eee;border-radius:10px;overflow:hidden">
  <div style="height:5px;background:#FF6B35"></div>
  <div style="padding:24px 28px">
    <p style="margin:0 0 4px;color:#9CA3AF;font-size:12px;letter-spacing:.05em;text-transform:uppercase">Vedhunt Client Portal</p>
    <h2 style="margin:0 0 16px;color:#111;font-size:20px">${escapeHtml(heading)}</h2>
    <p style="margin:0 0 12px;color:#374151;font-size:14px">Hello ${escapeHtml(contactName || 'there')},</p>
    ${body}
    <p style="margin:20px 0"><a href="${escapeHtml(portalUrl(link))}" style="background:#FF6B35;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:bold;display:inline-block">${escapeHtml(ctaLabel)}</a></p>
    <p style="margin:24px 0 0;color:#9CA3AF;font-size:12px">— Team Vedhunt InfoTech</p>
  </div>
</div>`;
}

/**
 * @param {object} opts
 * @param {string|ObjectId} opts.clientId
 * @param {string} opts.type
 * @param {string} opts.title       bell title + email subject/heading
 * @param {string} opts.message     bell text (plain)
 * @param {string} opts.link        portal path the bell/email opens
 * @param {string[]} opts.emailLines  email paragraphs — MUST already be HTML-escaped
 * @param {string} [opts.ctaLabel]
 * @returns {Promise<object|null>} the stored notification (null on failure)
 */
async function notifyClient({ clientId, type, title, message, link, emailLines, ctaLabel = 'Open Client Portal' }) {
  try {
    const client = await Client.findById(clientId).select('email contactName isActive').lean();
    if (!client || !client.isActive) return null;

    const notification = await ClientNotification.create({ client: client._id, type, title, message, link });

    // Email in the background — Resend latency/outages never slow or fail the request
    if (client.email) {
      sendEmail({
        email: client.email,
        subject: `${title} — Vedhunt`,
        html: emailHtml({ contactName: client.contactName, heading: title, lines: emailLines || [escapeHtml(message)], ctaLabel, link }),
      }).catch((err) => logger.error(`Client notification email failed (${type}) for ${client.email}: ${err.message}`));
    }
    return notification;
  } catch (error) {
    logger.error(`Client notification failed (${type}):`, error.message);
    return null;
  }
}

// ─── Event helpers (one per trigger) ─────────────────────────────────────────

const notifyInvoiceCreated = (invoice) =>
  notifyClient({
    clientId: invoice.client_ref,
    type: 'invoice_created',
    title: `New invoice ${invoice.invoiceId || ''}`.trim(),
    message: `${money(invoice.totalAmount)} due by ${date(invoice.dueDate)}.`,
    link: '/client/dashboard?tab=billing',
    emailLines: [
      `A new invoice <strong>${escapeHtml(invoice.invoiceId || '')}</strong> has been issued to you.`,
      `Amount: <strong>${escapeHtml(money(invoice.totalAmount))}</strong><br>Due date: <strong>${escapeHtml(date(invoice.dueDate))}</strong>`,
      'You can view, download and pay it from the Billing section of your portal.',
    ],
    ctaLabel: 'View invoice',
  });

const notifyPaymentApproved = (payment, invoice) =>
  notifyClient({
    clientId: payment.client_ref,
    type: 'payment_approved',
    title: `Payment received${invoice?.invoiceId ? ` for ${invoice.invoiceId}` : ''}`,
    message: invoice?.paymentStatus === 'Paid'
      ? `${money(payment.amountPaid)} verified. The invoice is now fully paid.`
      : `${money(payment.amountPaid)} verified. Remaining: ${money(Math.max(0, (invoice?.totalAmount || 0) - (invoice?.paidAmount || 0)))}.`,
    link: '/client/dashboard?tab=billing',
    emailLines: [
      `We have verified your payment of <strong>${escapeHtml(money(payment.amountPaid))}</strong>${payment.utrNumber ? ` (UTR ${escapeHtml(payment.utrNumber)})` : ''}${invoice?.invoiceId ? ` against invoice <strong>${escapeHtml(invoice.invoiceId)}</strong>` : ''}.`,
      invoice?.paymentStatus === 'Paid'
        ? 'The invoice is now marked as <strong>Paid in full</strong>. Thank you!'
        : `Remaining balance: <strong>${escapeHtml(money(Math.max(0, (invoice?.totalAmount || 0) - (invoice?.paidAmount || 0))))}</strong>.`,
    ],
    ctaLabel: 'View billing',
  });

const notifyPaymentRejected = (payment, invoice) =>
  notifyClient({
    clientId: payment.client_ref,
    type: 'payment_rejected',
    title: `Payment proof not accepted${invoice?.invoiceId ? ` for ${invoice.invoiceId}` : ''}`,
    message: `Reason: ${clip(payment.rejectionReason, 200)}`,
    link: '/client/dashboard?tab=billing',
    emailLines: [
      `We could not verify the payment proof you submitted for <strong>${escapeHtml(money(payment.amountPaid))}</strong>${payment.utrNumber ? ` (UTR ${escapeHtml(payment.utrNumber)})` : ''}.`,
      `Reason: ${escapeHtml(clip(payment.rejectionReason, 500))}`,
      'Please check the details and submit the proof again from your portal, or raise a support ticket if you need help.',
    ],
    ctaLabel: 'Review payment',
  });

const notifyTicketReply = (ticket, senderName, text) =>
  notifyClient({
    clientId: ticket.client_ref,
    type: 'ticket_reply',
    title: `New reply on ${ticket.ticketId || 'your ticket'}`,
    message: `${senderName || 'Vedhunt Support'}: ${clip(text, 140)}`,
    link: '/client/dashboard?tab=support',
    emailLines: [
      `<strong>${escapeHtml(senderName || 'Vedhunt Support')}</strong> replied to your ticket <strong>${escapeHtml(ticket.ticketId || '')}</strong> — “${escapeHtml(ticket.subject || '')}”:`,
      `<span style="display:block;border-left:3px solid #FF6B35;padding-left:12px;white-space:pre-wrap">${escapeHtml(clip(text))}</span>`,
    ],
    ctaLabel: 'Reply in portal',
  });

// Only statuses the client needs to act on / know about
const STATUS_TEXT = {
  'Pending Client': 'Our team is waiting for your reply.',
  Resolved: 'Your ticket has been marked as resolved. Reply if the issue is still not fixed.',
  Closed: 'Your ticket has been closed.',
};
const notifyTicketStatus = (ticket) =>
  STATUS_TEXT[ticket.status]
    ? notifyClient({
      clientId: ticket.client_ref,
      type: 'ticket_status',
      title: `${ticket.ticketId || 'Ticket'} is now ${ticket.status}`,
      message: STATUS_TEXT[ticket.status],
      link: '/client/dashboard?tab=support',
      emailLines: [
        `Your ticket <strong>${escapeHtml(ticket.ticketId || '')}</strong> — “${escapeHtml(ticket.subject || '')}” is now <strong>${escapeHtml(ticket.status)}</strong>.`,
        escapeHtml(STATUS_TEXT[ticket.status]),
      ],
      ctaLabel: 'View ticket',
    })
    : Promise.resolve(null);

const notifyAgreementUpdated = (clientId) =>
  notifyClient({
    clientId,
    type: 'agreement_updated',
    title: 'Your service agreement is ready to review',
    message: 'Please review and accept your service agreement to continue using the portal.',
    link: '/client/dashboard?tab=agreement',
    emailLines: [
      'Your service agreement has been prepared or updated.',
      'Please log in to review and accept it. You will be asked to do this when you open the portal.',
    ],
    ctaLabel: 'Review agreement',
  });

module.exports = {
  notifyClient,
  notifyInvoiceCreated,
  notifyPaymentApproved,
  notifyPaymentRejected,
  notifyTicketReply,
  notifyTicketStatus,
  notifyAgreementUpdated,
  STATUS_TEXT,
};
