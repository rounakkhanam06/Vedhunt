const crypto = require('crypto');
const Subscriber = require('../models/Subscriber');
const sendEmail = require('../utils/sendEmail');
const logger = require('../utils/logger');
// Rate Limiting
const rateLimit = require('express-rate-limit');

exports.subscribeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 5, // limit each IP to 5 subscribe requests per windowMs
  message: { success: false, message: 'Too many subscription attempts from this IP, please try again after an hour' }
});

// @desc    Subscribe to newsletter
// @route   POST /api/subscribe
// @access  Public
exports.subscribe = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Please provide an email address' });
    }

    // Email regex validation
    const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    
    let subscriber = await Subscriber.findOne({ email: normalizedEmail });

    if (subscriber) {
      if (subscriber.active) {
        return res.status(200).json({ success: true, message: 'You are already subscribed to our newsletter!', alreadySubscribed: true });
      } else {
        // Reactivate
        subscriber.active = true;
        subscriber.unsubscribedAt = undefined;
        subscriber.unsubscribeToken = crypto.randomBytes(32).toString('hex');
        await subscriber.save();
      }
    } else {
      // Create new
      subscriber = await Subscriber.create({
        email: normalizedEmail,
        unsubscribeToken: crypto.randomBytes(32).toString('hex')
      });
    }

    // Respond to user immediately
    res.status(201).json({ success: true, message: 'Successfully subscribed to the newsletter!' });

    // Send Welcome Email Asynchronously
    const frontendUrl = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
    const unsubscribeLink = `${frontendUrl}/unsubscribe/${subscriber.unsubscribeToken}`;

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #ff6b00; text-align: center;">Welcome to the Vedhunt Community!</h2>
        <p style="color: #333; font-size: 16px; line-height: 1.5;">Hi there,</p>
        <p style="color: #333; font-size: 16px; line-height: 1.5;">Thank you for joining our community! We're thrilled to have you on board. You'll now receive our latest updates, insights, and digital marketing strategies straight to your inbox.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${frontendUrl}" style="background-color: #ff6b00; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Explore Vedhunt</a>
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

// @desc    Unsubscribe from newsletter
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
    subscriber.unsubscribedAt = Date.now();
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
    const search = req.query.search || '';
    const status = req.query.status || 'all';

    const query = {};
    
    if (search) {
      query.email = { $regex: search, $options: 'i' };
    }

    if (status === 'active') {
      query.active = true;
    } else if (status === 'inactive') {
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
        totalPages: Math.ceil(total / limit)
      },
      data: subscribers
    });
  } catch (error) {
    logger.error('Error in getSubscribers:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Export subscribers to CSV (Admin)
// @route   GET /api/subscribe/admin/export
// @access  Private/Admin
exports.exportSubscribers = async (req, res) => {
  try {
    const subscribers = await Subscriber.find().sort({ subscribedAt: -1 });

    let csvContent = 'Email,Status,Subscribed Date,Unsubscribed Date\\n';

    subscribers.forEach(sub => {
      const email = sub.email;
      const status = sub.active ? 'Active' : 'Unsubscribed';
      const subDate = sub.subscribedAt ? new Date(sub.subscribedAt).toISOString() : '';
      const unsubDate = sub.unsubscribedAt ? new Date(sub.unsubscribedAt).toISOString() : '';
      
      csvContent += `${email},${status},${subDate},${unsubDate}\\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=subscribers.csv');
    res.status(200).send(csvContent);

  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error during export' });
  }
};

const sanitizeHtml = require('sanitize-html');
const agenda = require('../jobs/agenda');

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
      allowedTags: sanitizeHtml.defaults.allowedTags.concat([ 'img', 'h1', 'h2', 'h3', 'p', 'a', 'b', 'i', 'strong', 'em', 'strike', 'code', 'hr', 'br', 'div', 'table', 'thead', 'caption', 'tbody', 'tr', 'th', 'td', 'pre', 'iframe' ]),
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

    res.status(200).json({ success: true, message: targetEmail ? 'Email queued for the subscriber.' : 'Broadcast queued successfully. Emails are being sent in the background.' });

  } catch (error) {
    logger.error('Error in broadcastNewsletter:', error);
    res.status(500).json({ success: false, message: 'Server error during broadcast scheduling' });
  }
};
