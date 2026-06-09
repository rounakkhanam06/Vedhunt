const logger = require('./logger');
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send an email using Resend API.
 * @param {Object} options - Email options.
 * @param {string} options.email - The recipient email address.
 * @param {string} options.subject - The subject of the email.
 * @param {string} options.message - The plaintext message (or HTML).
 */
const sendEmail = async (options) => {
  try {
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'noreply@vedhunt.in',
      to: options.email,
      subject: options.subject,
      html: options.html || `<p>${options.message.replace(/\n/g, '<br>')}</p>`,
    });

    if (error) {
      logger.error('Resend API Error:', error);
      throw new Error('Email could not be sent');
    }

    logger.info(`Email Sent Successfully To: ${options.email} (ID: ${data.id})`);
  } catch (error) {
    logger.error(`Error sending email to ${options.email}:`, error.message);
    throw error;
  }
};

module.exports = sendEmail;
