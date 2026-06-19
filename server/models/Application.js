const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true,
  },
  fullName: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: true,
  },
  experienceYears: {
    type: String,
    required: true,
  },
  currentCTC: {
    type: String,
  },
  expectedCTC: {
    type: String,
  },
  noticePeriod: {
    type: String,
  },
  linkedinUrl: {
    type: String,
  },
  portfolioUrl: {
    type: String,
  },
  resumeUrl: {
    type: String,
    required: true, // Will store local path since Google Drive is skipped
  },
  coverLetter: {
    type: String,
  },
  status: {
    type: String,
    enum: ['Pending', 'Interviewing', 'Selected / Hired', 'Rejected'],
    default: 'Pending'
  }
}, { timestamps: true });

module.exports = mongoose.model('Application', applicationSchema);
