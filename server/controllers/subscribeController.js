const crypto = require('crypto');
const Subscriber = require('../models/Subscriber');
const { sendEmail } = require('../utils/sendEmail');
const logger = require('../utils/logger');
const sanitizeHtml = require('sanitize-html');
const agenda = require('../jobs/agenda');
const rateLimit = require('express-rate-limit');

exports.subscribeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 5, // limit each IP to 5 subscribe requests per windowMs
  message: { success: false, message: 'Too many subscription attempts from this IP, please try again after an hour' }
});

const EMAIL_REGEX = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;

// @desc    Subscribe to newsletter (Public)
// @route   POST /api/subscribe
// @access  Public
exports.subscribe = async (req, res) => {
  try {
    const { email, name, source } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Please provide an email address' });
    }

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    let subscriber = await Subscriber.findOne({ email: normalizedEmail });

    if (subscriber) {
      if (subscriber.active) {
        return res.status(200).json({ success: true, message: 'You are already subscribed to our newsletter!', alreadySubscribed: true });
      } else {
        // Reactivate
        const newToken = crypto.randomBytes(32).toString('hex');
        subscriber.active = true;
        subscriber.status = 'Subscribed';
        subscriber.unsubscribedAt = null;
        subscriber.unsubscribeReason = '';
        subscriber.unsubscribeToken = newToken;
        if (name) subscriber.name = name.trim();
        if (source) subscriber.source = source.trim();
        await subscriber.save();
      }
    } else {
      subscriber = await Subscriber.create({
        email: normalizedEmail,
        name: name ? name.trim() : '',
        source: source ? source.trim() : 'Website',
        status: 'Subscribed',
        active: true,
        unsubscribeToken: crypto.randomBytes(32).toString('hex')
      });
    }

    // Respond immediately
    res.status(201).json({ success: true, message: 'Successfully subscribed to the newsletter!' });

    // Send Welcome Email Asynchronously
    const frontendUrl = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
    const unsubscribeLink = `${frontendUrl}/unsubscribe/${subscriber.unsubscribeToken}`;

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #ff6b00; text-align: center;">Welcome to the Vedhunt Community!</h2>
        <p style="color: #333; font-size: 16px; line-height: 1.5;">Hi${subscriber.name ? ' ' + subscriber.name : ' there'},</p>
        <p style="color: #333; font-size: 16px; line-height: 1.5;">Thank you for joining our community! We're thrilled to have you on board. You'll now receive our latest updates, insights, and digital strategies straight to your inbox.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${frontendUrl}" style="background-color: #ff6b00; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Explore Vedhunt Infotech</a>
        </div>
        <p style="color: #333; font-size: 16px; line-height: 1.5;">Best regards,<br>The Vedhunt Team</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #999; font-size: 12px; text-align: center;">
          You are receiving this email because you subscribed to our newsletter.<br>
          If you'd like to stop receiving these emails, you can <a href="${unsubscribeLink}" style="color: #ff6b00;">unsubscribe here</a>.
        </p>
      </div>
    `;

    sendEmail({
      email: subscriber.email,
      subject: 'Welcome to the Vedhunt Community!',
      html: emailHtml
    }).catch(err => {
      logger.error(`Background email send failed for ${subscriber.email}:`, err);
    });

  } catch (error) {
    logger.error('Error in subscribe:', error);
    res.status(500).json({ success: false, message: 'Server error during subscription' });
  }
};

// @desc    Unsubscribe from newsletter (Public)
// @route   GET /api/subscribe/unsubscribe/:token
// @access  Public
exports.unsubscribe = async (req, res) => {
  try {
    const { token } = req.params;
    const subscriber = await Subscriber.findOne({ unsubscribeToken: token });

    if (!subscriber) {
      return res.status(404).json({ success: false, message: 'Invalid or expired unsubscribe link.' });
    }

    if (!subscriber.active) {
      return res.status(200).json({ success: true, message: 'You have already unsubscribed.' });
    }

    subscriber.active = false;
    subscriber.status = 'Unsubscribed';
    subscriber.unsubscribedAt = new Date();
    subscriber.unsubscribeReason = req.query.reason || 'User opted out via unsubscribe link';
    await subscriber.save();

    logger.info(`User unsubscribed: ${subscriber.email}`);
    res.status(200).json({ success: true, message: 'You have been successfully unsubscribed from the newsletter.' });
  } catch (error) {
    logger.error('Error in unsubscribe:', error);
    res.status(500).json({ success: false, message: 'Server error during unsubscription' });
  }
};

// @desc    Get all subscribers (Admin)
// @route   GET /api/subscribe/admin/list
// @access  Private/Admin
exports.getSubscribers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = (req.query.search || '').trim();
    const status = req.query.status || 'all';

    const query = {};

    if (search) {
      query.$or = [
        { email: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { source: { $regex: search, $options: 'i' } }
      ];
    }

    if (status === 'active' || status === 'Subscribed') {
      query.active = true;
    } else if (status === 'inactive' || status === 'Unsubscribed') {
      query.active = false;
    }

    const startIndex = (page - 1) * limit;
    const total = await Subscriber.countDocuments(query);
    const totalActive = await Subscriber.countDocuments({ active: true });
    const totalInactive = await Subscriber.countDocuments({ active: false });

    const subscribers = await Subscriber.find(query)
      .sort({ subscribedAt: -1 })
      .skip(startIndex)
      .limit(limit);

    res.status(200).json({
      success: true,
      count: subscribers.length,
      total,
      totalActive,
      totalInactive,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1
      },
      data: subscribers
    });
  } catch (error) {
    logger.error('Error in getSubscribers:', error);
    res.status(500).json({ success: false, message: 'Server error fetching subscribers' });
  }
};

// @desc    Add a subscriber manually (Admin)
// @route   POST /api/subscribe/admin/subscribers
// @access  Private/Admin
exports.addSubscriber = async (req, res) => {
  try {
    const { email, name, source, tags } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email address is required' });
    }

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    let subscriber = await Subscriber.findOne({ email: normalizedEmail });

    if (subscriber) {
      if (subscriber.active) {
        return res.status(400).json({ success: false, message: 'This email is already an active subscriber' });
      }
      // Re-activate if was previously unsubscribed
      subscriber.active = true;
      subscriber.status = 'Subscribed';
      subscriber.unsubscribedAt = null;
      subscriber.unsubscribeReason = '';
      if (name) subscriber.name = name.trim();
      if (source) subscriber.source = source.trim();
      if (Array.isArray(tags)) subscriber.tags = tags;
      await subscriber.save();
      return res.status(200).json({ success: true, message: 'Subscriber reactivated successfully', data: subscriber });
    }

    subscriber = await Subscriber.create({
      email: normalizedEmail,
      name: name ? name.trim() : '',
      source: source ? source.trim() : 'Manual / Admin',
      tags: Array.isArray(tags) ? tags : [],
      status: 'Subscribed',
      active: true,
      unsubscribeToken: crypto.randomBytes(32).toString('hex')
    });

    res.status(201).json({ success: true, message: 'Subscriber added successfully', data: subscriber });
  } catch (error) {
    logger.error('Error in addSubscriber:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error adding subscriber' });
  }
};

// @desc    Toggle subscription status (Admin)
// @route   PATCH /api/subscribe/admin/subscribers/:id/status
// @access  Private/Admin
exports.toggleSubscriberStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const subscriber = await Subscriber.findById(id);

    if (!subscriber) {
      return res.status(404).json({ success: false, message: 'Subscriber not found' });
    }

    // Toggle active state
    const willBeActive = !subscriber.active;
    subscriber.active = willBeActive;
    subscriber.status = willBeActive ? 'Subscribed' : 'Unsubscribed';
    if (!willBeActive) {
      subscriber.unsubscribedAt = new Date();
      subscriber.unsubscribeReason = 'Marked unsubscribed by Admin';
    } else {
      subscriber.unsubscribedAt = null;
      subscriber.unsubscribeReason = '';
    }

    await subscriber.save();

    res.status(200).json({
      success: true,
      message: `Subscriber status updated to ${subscriber.status}`,
      data: subscriber
    });
  } catch (error) {
    logger.error('Error in toggleSubscriberStatus:', error);
    res.status(500).json({ success: false, message: 'Server error updating subscriber status' });
  }
};

// @desc    Delete a subscriber (Admin)
// @route   DELETE /api/subscribe/admin/subscribers/:id
// @access  Private/Admin
exports.deleteSubscriber = async (req, res) => {
  try {
    const { id } = req.params;
    const subscriber = await Subscriber.findByIdAndDelete(id);

    if (!subscriber) {
      return res.status(404).json({ success: false, message: 'Subscriber not found' });
    }

    res.status(200).json({ success: true, message: 'Subscriber deleted successfully' });
  } catch (error) {
    logger.error('Error in deleteSubscriber:', error);
    res.status(500).json({ success: false, message: 'Server error deleting subscriber' });
  }
};

// @desc    Export subscribers to CSV (Admin)
// @route   GET /api/subscribe/admin/export
// @access  Private/Admin
exports.exportSubscribers = async (req, res) => {
  try {
    const subscribers = await Subscriber.find().sort({ subscribedAt: -1 });

    const escapeCsv = (str) => {
      if (str === null || str === undefined) return '';
      const s = String(str).replace(/"/g, '""');
      return `"${s}"`;
    };

    let csvContent = 'Email,Name,Status,Source,Subscribed Date,Unsubscribed Date,Unsubscribe Reason\n';

    subscribers.forEach(sub => {
      const email = escapeCsv(sub.email);
      const name = escapeCsv(sub.name || '');
      const status = escapeCsv(sub.status || (sub.active ? 'Subscribed' : 'Unsubscribed'));
      const source = escapeCsv(sub.source || 'Website');
      const subDate = sub.subscribedAt ? escapeCsv(new Date(sub.subscribedAt).toISOString()) : '""';
      const unsubDate = sub.unsubscribedAt ? escapeCsv(new Date(sub.unsubscribedAt).toISOString()) : '""';
      const reason = escapeCsv(sub.unsubscribeReason || '');

      csvContent += `${email},${name},${status},${source},${subDate},${unsubDate},${reason}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=newsletter_subscribers.csv');
    res.status(200).send(csvContent);

  } catch (error) {
    logger.error('Error in exportSubscribers:', error);
    res.status(500).json({ success: false, message: 'Server error during export' });
  }
};

// @desc    Broadcast manual newsletter to all active subscribers or a specific target
// @route   POST /api/subscribe/admin/broadcast
// @access  Private/Admin
exports.broadcastNewsletter = async (req, res) => {
  try {
    const { subject, htmlContent, targetEmail } = req.body;

    if (!subject || !htmlContent) {
      return res.status(400).json({ success: false, message: 'Subject and HTML content are required' });
    }

    // Sanitize HTML to prevent XSS
    const sanitizedHtml = sanitizeHtml(htmlContent, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat([
        'img', 'h1', 'h2', 'h3', 'p', 'a', 'b', 'i', 'strong', 'em', 'strike', 'code', 'hr', 'br', 'div', 'table', 'thead', 'caption', 'tbody', 'tr', 'th', 'td', 'pre', 'iframe'
      ]),
      allowedAttributes: {
        ...sanitizeHtml.defaults.allowedAttributes,
        '*': ['style', 'class'],
        'img': ['src', 'alt', 'width', 'height'],
        'a': ['href', 'name', 'target']
      }
    });

    // Trigger background batch job
    agenda.now('sendNewsletterBatch', {
      type: 'MANUAL_BROADCAST',
      subject,
      htmlContent: sanitizedHtml,
      targetEmail
    });

    res.status(200).json({
      success: true,
      message: targetEmail
        ? 'Email queued for the subscriber.'
        : 'Broadcast queued successfully. Emails are being sent in the background.'
    });

  } catch (error) {
    logger.error('Error in broadcastNewsletter:', error);
    res.status(500).json({ success: false, message: 'Server error during broadcast scheduling' });
  }
};
