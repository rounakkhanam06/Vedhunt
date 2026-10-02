const mongoose = require('mongoose');

/**
 * In-app notifications for the Client Portal bell. Kept separate from
 * models/Notification.js, whose recipient is always an Admin.
 * Created through services/clientNotify.js (which also emails the client).
 */
const clientNotificationSchema = new mongoose.Schema({
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
    index: true
  },
  // invoice_created | payment_approved | payment_rejected | ticket_reply |
  // ticket_status | agreement_updated
  type: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    trim: true
  },
  // Path inside the portal, e.g. /client/dashboard?tab=billing
  link: {
    type: String,
    trim: true
  },
  read: {
    type: Boolean,
    default: false,
    index: true
  }
}, { timestamps: true });

clientNotificationSchema.index({ client: 1, createdAt: -1 });

module.exports = mongoose.model('ClientNotification', clientNotificationSchema);
