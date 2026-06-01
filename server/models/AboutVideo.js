const mongoose = require('mongoose');

const aboutVideoSchema = new mongoose.Schema({
  headingLine1: {
    type: String,
    required: true,
    default: 'Watch Our 2-Minute'
  },
  headingLine2: {
    type: String,
    required: true,
    default: 'Company Introduction'
  },
  description: {
    type: String,
    required: true,
    default: 'Take a quick virtual tour of Vedhunt InfoTech. Discover our advanced workspace, metrically proven software engineering standards, result-oriented marketing models, and compliant bookkeeping workflows.'
  },
  checklists: {
    type: [String],
    default: [
      '2 Minutes of clear, concise strategic overview',
      'Direct insights into our operational workflows',
      'Real-world examples of our software & marketing platforms',
      'A message from our executive leadership team'
    ]
  },
  videoUrl: {
    type: String,
    required: true,
    default: 'https://www.youtube.com/embed/hb6CFtZnj2c?autoplay=0&rel=0&modestbranding=1'
  },
  duration: {
    type: String,
    default: '2:15'
  }
}, { timestamps: true });

module.exports = mongoose.model('AboutVideo', aboutVideoSchema);
