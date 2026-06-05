const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  department: {
    type: String, // e.g., 'Engineering', 'Marketing', 'Creative Design'
    required: true,
  },
  type: {
    type: String, // e.g., 'Full Time', 'Part Time', 'Contract'
    default: 'Full Time',
  },
  location: {
    type: String,
    required: true,
  },
  experience: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['Published', 'Unpublished'],
    default: 'Published',
  },
}, { timestamps: true });

module.exports = mongoose.model('Job', jobSchema);
