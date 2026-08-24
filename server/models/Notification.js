const mongoose = require('mongoose');

/**
 * In-app notifications, surfaced via the bell icon in AdminLayout. Currently
 * only used for lead-assignment alerts, but `type` is free enough to extend.
 */
const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true,
    index: true
  },
  type: {
    type: String,
    default: 'lead_assigned'
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
  // Deep link into the admin panel, e.g. /admin/leads?leadId=<id>
  link: {
    type: String,
    trim: true
  },
  lead: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead'
  },
  read: {
    type: Boolean,
    default: false,
    index: true
  }
}, { timestamps: true });

notificationSchema.index({ recipient: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
