const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: [true, 'Please provide full name'],
    trim: true
  },
  phone: {
    type: String,
    required: [true, 'Please provide phone number'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Please provide email address'],
    match: [
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
      'Please provide a valid email'
    ]
  },
  service: {
    type: String,
    required: [true, 'Please provide service needed']
  },
  businessName: {
    type: String,
    trim: true
  },
  message: {
    type: String,
    trim: true
  },
  source: {
    type: String,
    required: [true, 'Please provide lead source'],
    trim: true
  },
  consent: {
    type: Boolean,
    required: [true, 'Consent is required']
  },
  status: {
    type: String,
    enum: ['New', 'Contacted', 'Qualified', 'Lost'],
    default: 'New'
  }
}, { timestamps: true });

// Add single-field indexes for fast sorting and filtering
leadSchema.index({ status: 1 });
leadSchema.index({ createdAt: -1 });

// Add compound text index for scalable backend searching
leadSchema.index({ fullName: 'text', email: 'text', phone: 'text' });

module.exports = mongoose.model('Lead', leadSchema);
