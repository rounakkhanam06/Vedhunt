const mongoose = require('mongoose');

const testimonialSchema = new mongoose.Schema(
  {
    author: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      default: 'Client',
      trim: true,
    },
    quote: {
      type: String,
      required: true,
      trim: true,
    },
    avatar: {
      type: String,
      default: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150&h=150&fit=crop', // generic default avatar
    },
    country: {
      type: String,
      default: 'India',
      trim: true,
    },
    countryFlag: {
      type: String,
      default: '🇮🇳',
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    source: {
      type: String,
      enum: ['client', 'system'],
      default: 'client', // 'client' for public submissions, 'system' for admin/hardcoded
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Testimonial', testimonialSchema);
