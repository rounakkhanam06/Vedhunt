const mongoose = require('mongoose');

const careerHeroSchema = new mongoose.Schema(
  {
    headingTop: {
      type: String,
      default: 'Join the',
    },
    headingHighlight: {
      type: String,
      default: 'Vedhunt Team',
    },
    description: {
      type: String,
      default: 'Build elite, high-performance digital products with a team of passionate engineers, creative designers, and strategic marketers.',
    },
    benefits: {
      type: [String],
      default: ['Growth Opportunities', 'Flexible Work', 'Learning Culture', 'Competitive Pay', 'Team Culture'],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CareerHero', careerHeroSchema);
