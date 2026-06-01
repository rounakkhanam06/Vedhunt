const mongoose = require('mongoose');

const aboutCompanySchema = new mongoose.Schema({
  tagline: { type: String, default: '' },
  headerLine1: { type: String, default: '' },
  headerLine2: { type: String, default: '' },
  centralBadge: {
    value: { type: String, default: '' },
    label1: { type: String, default: '' },
    label2: { type: String, default: '' }
  },
  descriptionParagraphs: { type: [String], default: [] },
  checklistItem1: {
    title: { type: String, default: '' },
    description: { type: String, default: '' }
  },
  checklistItem2: {
    title: { type: String, default: '' },
    description: { type: String, default: '' }
  },
  signature: {
    name: { type: String, default: '' },
    role: { type: String, default: '' }
  }
}, { timestamps: true });

module.exports = mongoose.model('AboutCompany', aboutCompanySchema);
