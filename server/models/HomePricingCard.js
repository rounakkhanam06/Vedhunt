const mongoose = require('mongoose');

const TierSchema = new mongoose.Schema({
  price: {
    type: String,
    required: true,
  },
  period: {
    type: String,
    default: '',
  },
  features: {
    type: [String],
    required: true,
  }
}, { _id: false }); // No separate ID for subdocuments to keep it clean

const HomePricingCardSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  icon: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  color: {
    type: String,
    required: true,
  },
  popular: {
    type: Boolean,
    default: false,
  },
  showOnHome: {
    type: Boolean,
    default: false,
  },
  slug: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
  },
  tiers: {
    starter: {
      type: TierSchema,
      required: true,
    },
    growth: {
      type: TierSchema,
      required: true,
    },
    enterprise: {
      type: TierSchema,
      required: true,
    }
  }
}, { timestamps: true });

module.exports = mongoose.model('HomePricingCard', HomePricingCardSchema);
