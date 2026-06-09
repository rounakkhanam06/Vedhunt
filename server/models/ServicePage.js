const mongoose = require('mongoose');

const servicePageSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  subtitle: { type: String, required: true },
  tagline: { type: String, required: true },
  overview: [{ type: String }],
  highlights: [{
    text: { type: String },
    desc: { type: String }
  }],
  subServices: [{
    icon: { type: String }, // Storing icon component name as a string
    title: { type: String },
    description: { type: String }
  }],
  process: [{
    step: { type: String },
    title: { type: String },
    desc: { type: String }
  }],
  pricing: {
    type: { type: String },
    toggleLabels: {
      primary: { type: String },
      secondary: { type: String }
    },
    plans: [{
      title: { type: String },
      priceOneTime: { type: String },
      priceSupport: { type: String },
      subtitle: { type: String },
      features: [{ type: String }],
      cta: { type: String },
      highlight: { type: Boolean }
    }]
  },
  portfolio: [{
    image: { type: String },
    title: { type: String },
    metric: { type: String },
    description: { type: String },
    appLink: { type: String },
    iframeUrl: { type: String }
  }],
  faqs: [{
    q: { type: String },
    a: { type: String }
  }],
  testimonial: {
    feedback: { type: String },
    author: { type: String },
    role: { type: String },
    avatar: { type: String }
  },
  testimonials: [{
    feedback: { type: String },
    author: { type: String },
    role: { type: String },
    country: { type: String },
    avatar: { type: String }
  }]
}, { timestamps: true });

const ServicePage = mongoose.model('ServicePage', servicePageSchema);

module.exports = ServicePage;
