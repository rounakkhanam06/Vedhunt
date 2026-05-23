const logger = require('./logger');

/**
 * Placeholder for sending an email.
 * For now, this just logs the reset URL to the terminal so we can test the flow.
 * If you want to use NodeMailer, you can install it (`npm i nodemailer`)
 * and replace this function with a real transporter configuration.
 */
const sendEmail = async (options) => {
  // If nodemailer was installed:
  // const transporter = nodemailer.createTransport({ ... });
  // await transporter.sendMail(message);

  logger.info('----------------------------------------');
  logger.info(`Simulated Email Sent To: ${options.email}`);
  logger.info(`Subject: ${options.subject}`);
  logger.info(`Message:\n${options.message}`);
  logger.info('----------------------------------------');
};

module.exports = sendEmail;
