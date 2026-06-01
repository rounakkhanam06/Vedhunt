const mongoose = require('mongoose');
const slugify = require('slugify');

const planSchema = new mongoose.Schema({
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'PricingCategory', required: true, index: true },
  title: { type: String, required: true, trim: true },
  slug: { type: String, unique: true, index: true }, // Auto-generated via middleware
  tech: { type: String, required: true }, 
  
  // Future-Proof Pricing Structure
  pricing: {
    amount: { type: Number, required: true }, // e.g., 15000
    discountedAmount: { type: Number, default: null }, // e.g., 12000 (Offer price)
    currency: { type: String, default: 'INR' }, // e.g., 'INR', 'USD'
    period: { type: String, enum: ['one-time', 'monthly', 'yearly'], default: 'one-time' },
    isStartingAt: { type: Boolean, default: false }, // For '₹15,000+' formatting
    discountPercentage: { type: Number, default: 0, min: 0, max: 100 }
  },

  features: [{ type: String, required: true }],
  highlight: { type: Boolean, default: false }, // "Best Choice" badge
  status: { type: String, enum: ['active', 'inactive', 'draft'], default: 'active', index: true },
  order: { type: Number, default: 0 }, // For custom sorting
  
  seo: {
    metaTitle: { type: String },
    metaDescription: { type: String },
    keywords: [{ type: String }]
  }
}, { timestamps: true });

// Auto-generate slug before saving
planSchema.pre('save', function() {
  if (this.isModified('title')) {
    this.slug = slugify(this.title, { lower: true, strict: true });
  }
});

// Compound Index for fast fetching of active plans by category
planSchema.index({ category: 1, status: 1, order: 1 });

module.exports = mongoose.model('PricingPlan', planSchema);
