const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema(
  {
    id_string: { type: String, required: true, unique: true }, // e.g. 'web-dev'
    slug: { type: String, required: true },
    title: { type: String, required: true },
    subtitle: { type: String },
    shortDescription: { type: String },
    description: { type: String },
    subServices: { type: String },
    iconName: { type: String, required: true }, // e.g. 'Globe'
    features: [{ type: String }],
    cta: { type: String, default: 'Get Started' },
    imageUrl: { type: String },
    imagePublicId: { type: String },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    showOnHome: { type: Boolean, default: true },
    showOnServicesPage: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  },
  { timestamps: true }
);

// Compound Indexes for query optimization
serviceSchema.index({ isDeleted: 1, isActive: 1, order: 1 });
serviceSchema.index({ slug: 1 });

// Query Middleware: Exclude soft-deleted items by default
serviceSchema.pre(/^find/, function () {
  this.where({ isDeleted: { $ne: true } });
});

const Service = mongoose.model('Service', serviceSchema);

module.exports = Service;
