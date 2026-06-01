const mongoose = require('mongoose');

const servicesHeroSchema = new mongoose.Schema(
  {
    badgeText: {
      type: String,
      default: 'Our Capabilities',
    },
    headingTop: {
      type: String,
      default: 'High Performance Solutions at',
    },
    headingHighlight: {
      type: String,
      default: 'Economical Prices',
    },
    description: {
      type: String,
      default: 'We take pride in our hands-on tech expertise, proactive customer communication, and premium engineering. Explore how we scale business operations through custom solutions.',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ServicesHero', servicesHeroSchema);
