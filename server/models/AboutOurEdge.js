const mongoose = require('mongoose');

const cardSchema = new mongoose.Schema({
  title: String,
  desc: String
});

const aboutOurEdgeSchema = new mongoose.Schema({
  tagline: {
    type: String,
    default: 'Our Edge'
  },
  title: {
    type: String,
    default: 'Why Scaled Brands Trust Vedhunt InfoTech'
  },
  description: {
    type: String,
    default: 'We eliminate technical bottlenecks by uniting engineering precision, marketing strategy, and transparent reporting systems under one single cohesive roof.'
  },
  cards: [cardSchema]
}, { timestamps: true });

module.exports = mongoose.model('AboutOurEdge', aboutOurEdgeSchema);
