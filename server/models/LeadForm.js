const mongoose = require('mongoose');

/**
 * Registry of the Facebook / Instagram Instant Forms that have delivered leads.
 *
 * One Facebook page can run many forms at once (BD hiring, IT hiring, service
 * enquiries, …) and they all arrive through the same webhook. A form registers
 * itself here the first time a lead from it comes in, and an admin then
 * classifies it as a Sales or Hiring form. That classification is what splits
 * the two workflows in the Lead Manager.
 */
const leadFormSchema = new mongoose.Schema({
  formId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  name: {
    type: String,
    trim: true,
    default: ''
  },
  // New forms default to Sales so an unclassified form never silently
  // disappears from the Lead Manager's default view.
  leadType: {
    type: String,
    enum: ['Sales', 'Hiring'],
    default: 'Sales'
  },
  platform: {
    type: String,
    enum: ['Facebook', 'Instagram'],
    default: 'Facebook'
  },
  // Set once an admin has explicitly chosen the type, so we can flag forms
  // that are still sitting on the default in the UI.
  isClassified: {
    type: Boolean,
    default: false
  },
  leadCount: {
    type: Number,
    default: 0
  },
  lastLeadAt: {
    type: Date
  }
}, { timestamps: true });

module.exports = mongoose.model('LeadForm', leadFormSchema);
