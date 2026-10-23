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
  name: {
    type: String,
    trim: true,
    default: ''
  },
  status: {
    type: String,
    enum: ['Subscribed', 'Unsubscribed'],
    default: 'Subscribed'
  },
  active: {
    type: Boolean,
    default: true
  },
  source: {
    type: String,
    trim: true,
    default: 'Website'
  },
  tags: {
    type: [String],
    default: []
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
  },
  unsubscribeReason: {
    type: String,
    trim: true,
    default: ''
  }
}, {
  timestamps: true
});

// Synchronize status and active boolean before saving
subscriberSchema.pre('save', function (next) {
  if (this.isModified('active') && !this.isModified('status')) {
    this.status = this.active ? 'Subscribed' : 'Unsubscribed';
  } else if (this.isModified('status')) {
    this.active = this.status === 'Subscribed';
  }
  next();
});

// Index for faster queries in admin panel and duplicate checks
subscriberSchema.index({ email: 1 });
subscriberSchema.index({ active: 1 });
subscriberSchema.index({ status: 1 });
subscriberSchema.index({ subscribedAt: -1 });

module.exports = mongoose.model('Subscriber', subscriberSchema);
