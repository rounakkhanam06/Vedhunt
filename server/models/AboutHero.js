const mongoose = require('mongoose');

const statSchema = new mongoose.Schema({
  value: { type: String, default: '' },
  labelTop: { type: String, default: '' },
  labelBottom: { type: String, default: '' }
}, { _id: false });

const aboutHeroSchema = new mongoose.Schema({
  tagline: { type: String, default: 'Who We Are' },
  titleLine1: { type: String, default: 'Creative Solutions' },
  titleLine2: { type: String, default: 'Driven by Data & Engineering' },
  description: { type: String, default: 'Vedhunt InfoTech provides successful business solutions to its clients to scale their profitability. It’s a trusted agency which provides customized services to businesses across India.' },
  servicesList: { 
    type: [String], 
    default: [
      'Web & App Engineering',
      'Creative Brand Identity',
      'Performance Ads & PPC',
      'SEO Search Dominance',
      'Outsource Bookkeeping',
      'SQL & Power BI Automation'
    ] 
  },
  ctaText: { type: String, default: 'Get Solution' },
  ctaLink: { type: String, default: '/get-quote' },
  stat1: { 
    type: statSchema, 
    default: { value: '99%', labelTop: 'Client', labelBottom: 'Retention' } 
  },
  stat2: { 
    type: statSchema, 
    default: { value: '140+', labelTop: 'Active', labelBottom: 'Projects' } 
  }
}, { timestamps: true });

module.exports = mongoose.model('AboutHero', aboutHeroSchema);
