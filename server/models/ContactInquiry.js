const mongoose = require('mongoose');

const contactInquirySchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true,
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  },
  phone: {
    type: String,
    required: true,
    trim: true,
  },
  message: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['Unread', 'Read', 'Responded'],
    default: 'Unread',
  }
}, { timestamps: true });

// Add compound indexes for efficient pagination and sorting
contactInquirySchema.index({ createdAt: -1 });
contactInquirySchema.index({ email: 1 });
contactInquirySchema.index({ phone: 1 });

module.exports = mongoose.model('ContactInquiry', contactInquirySchema);
