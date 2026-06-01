const mongoose = require('mongoose');
const slugify = require('slugify');

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, unique: true, index: true }, // Auto-generated via middleware
  description: { type: String },
  icon: { type: String }, // e.g., 'Globe', 'Smartphone' (mapping to Lucide icons)
  order: { type: Number, default: 0 }, // For sorting on UI
  status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
  seo: {
    metaTitle: { type: String },
    metaDescription: { type: String },
    keywords: [{ type: String }]
  }
}, { timestamps: true });

// Auto-generate slug before saving
categorySchema.pre('save', function() {
  if (this.isModified('name')) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
});

module.exports = mongoose.model('PricingCategory', categorySchema);
