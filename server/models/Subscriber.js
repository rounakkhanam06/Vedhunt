const mongoose = require('mongoose');

const subscriberSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Please provide an email address'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email'
    ]
  },
  active: {
    type: Boolean,
    default: true
  },
  unsubscribeToken: {
    type: String,
    required: true
  },
  subscribedAt: {
    type: Date,
    default: Date.now
  },
  unsubscribedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Index for faster queries in admin panel and duplicate checks
subscriberSchema.index({ email: 1 });
subscriberSchema.index({ active: 1 });

module.exports = mongoose.model('Subscriber', subscriberSchema);
