const logger = require('./logger');
const { Resend } = require('resend');
const Settings = require('../models/Settings');

/**
 * Send an email using Resend API.
 * @param {Object} options - Email options.
 * @param {string} options.email - The recipient email address.
 * @param {string} options.subject - The subject of the email.
 * @param {string} options.message - The plaintext message (or HTML).
 */
const sendEmail = async (options) => {
  try {
    if (!process.env.RESEND_API_KEY) {
      logger.error('RESEND_API_KEY is missing in environment variables');
      throw new Error('Email could not be sent due to missing API key');
    }

    let emailFrom = process.env.EMAIL_FROM || 'noreply@vedhunt.in';
    try {
      const emailSettings = await Settings.findOne({ key: 'email_settings' });
      if (emailSettings && emailSettings.value && emailSettings.value.emailFrom) {
        emailFrom = emailSettings.value.emailFrom;
      }
    } catch (err) {
      logger.error('Error fetching email settings:', err);
    }
    
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from: emailFrom,
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
/**
 * Send multiple emails using Resend Batch API.
 * @param {Array} emailPayloads - Array of email options.
 */
const sendEmailBatch = async (emailPayloads) => {
  try {
    if (!process.env.RESEND_API_KEY) {
      logger.error('RESEND_API_KEY is missing in environment variables');
      throw new Error('Email could not be sent due to missing API key');
    }
    
    if (!emailPayloads || emailPayloads.length === 0) return;

    let emailFrom = process.env.EMAIL_FROM || 'noreply@vedhunt.in';
    try {
      const emailSettings = await Settings.findOne({ key: 'email_settings' });
      if (emailSettings && emailSettings.value && emailSettings.value.emailFrom) {
        emailFrom = emailSettings.value.emailFrom;
      }
    } catch (err) {
      logger.error('Error fetching email settings for batch:', err);
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    
    // Format payloads for Resend Batch API
    const formattedPayloads = emailPayloads.map(opts => ({
      from: emailFrom,
      to: opts.email,
      subject: opts.subject,
      html: opts.html || `<p>${opts.message.replace(/\n/g, '<br>')}</p>`,
    }));

    const { data, error } = await resend.batch.send(formattedPayloads);

    if (error) {
      logger.error('Resend Batch API Error:', error);
      throw new Error('Batch Email could not be sent');
    }

    logger.info(`Successfully sent batch of ${emailPayloads.length} emails. (ID: ${data?.id || 'batch'})`);
  } catch (error) {
    logger.error(`Error sending batch email:`, error.message);
    throw error;
  }
};

module.exports = { sendEmail, sendEmailBatch };
