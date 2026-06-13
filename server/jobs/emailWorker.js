const Subscriber = require('../models/Subscriber');
const Blog = require('../models/Blog');
const { sendEmailBatch } = require('../utils/sendEmail');
const logger = require('../utils/logger');
const crypto = require('crypto');

// Utility to create unsubscribe token (reusing same logic from subscribeController if any, or just plain if token is saved)
// Assuming we use email as base for token, or we might need to fetch the token from subscriber. 
// Wait, we generate token when user subscribes. Let's see Subscriber model.
// To avoid guessing, we can just fetch subscriber.unsubscribeToken.

module.exports = function (agenda) {
  agenda.define('sendNewsletterBatch', { priority: 'high', concurrency: 1 }, async (job, done) => {
    try {
      const { type, blogId, subject, htmlContent } = job.attrs.data;

      logger.info(`Starting sendNewsletterBatch for type: ${type}`);

      let emailSubject = subject;
      let emailHtmlContent = htmlContent;

      if (type === 'BLOG_UPDATE') {
        const blog = await Blog.findById(blogId);
        if (!blog) {
          logger.error(`Blog with ID ${blogId} not found. Skipping.`);
          return done();
        }

        emailSubject = `New Blog Post: ${blog.title}`;

        // Construct HTML (In production, use a proper template)
        emailHtmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
            <h2 style="color: #ff6b00;">${blog.title}</h2>
            <p>${blog.excerpt || ''}</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL}/blog/${blog.slug}" style="background-color: #ff6b00; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Read Full Article</a>
            </div>
            <hr style="border: 1px solid #eee; margin: 30px 0;" />
            <p style="font-size: 12px; color: #888; text-align: center;">
              You received this email because you subscribed to updates from Vedhunt.<br>
              <a href="{{UNSUBSCRIBE_LINK}}" style="color: #888; text-decoration: underline;">Unsubscribe</a>
            </p>
          </div>
        `;
      } else if (type === 'MANUAL_BROADCAST') {
        // Wrap manual content to ensure unsubscribe link is present
        emailHtmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
            ${htmlContent}
            <hr style="border: 1px solid #eee; margin: 30px 0;" />
            <p style="font-size: 12px; color: #888; text-align: center;">
              You received this email because you subscribed to updates from Vedhunt.<br>
              <a href="{{UNSUBSCRIBE_LINK}}" style="color: #888; text-decoration: underline;">Unsubscribe</a>
            </p>
          </div>
        `;
      } else {
        throw new Error(`Unknown job type: ${type}`);
      }

      // Fetch active subscribers or specific target email
      let query = { active: true };
      if (job.attrs.data.targetEmail) {
        query.email = job.attrs.data.targetEmail;
      }
      const subscribers = await Subscriber.find(query);

      if (subscribers.length === 0) {
        logger.info('No active subscribers found. Skipping broadcast.');
        return done();
      }

      logger.info(`Found ${subscribers.length} active subscribers. Preparing batching...`);

      const BATCH_SIZE = 100;
      for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
        const batch = subscribers.slice(i, i + BATCH_SIZE);

        const emailPayloads = batch.map(sub => {
          const unsubLink = `${process.env.FRONTEND_URL}/unsubscribe/${sub.unsubscribeToken}`;
          return {
            email: sub.email,
            subject: emailSubject,
            html: emailHtmlContent.replace('{{UNSUBSCRIBE_LINK}}', unsubLink)
          };
        });

        // Send batch
        await sendEmailBatch(emailPayloads);

        // Delay 500ms to avoid rate limits
        if (i + BATCH_SIZE < subscribers.length) {
          await new Promise(res => setTimeout(res, 500));
        }
      }

      logger.info(`Successfully completed sendNewsletterBatch for type: ${type}`);
      done();
    } catch (error) {
      logger.error(`Error in sendNewsletterBatch worker: ${error.message}`);
      // Retry logic manually if needed, or let agenda retry if we configure it
      done(error);
    }
  });
};
