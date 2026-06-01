const mongoose = require('mongoose');

const whatWeDoCardSchema = new mongoose.Schema({
  icon: {
    type: String,
    required: true,
    default: 'Code' // Default lucide-react icon name
  },
  title: {
    type: String,
    required: true
  },
  desc: {
    type: String,
    required: true
  }
});

const aboutWhatWeDoSchema = new mongoose.Schema({
  tagline: {
    type: String,
    default: 'What We Do'
  },
  title: {
    type: String,
    default: 'Comprehensive Technology & Financial Solutions'
  },
  description: {
    type: String,
    default: "Vedhunt InfoTech provides successful business solutions to its clients to scale their profitability. It's a trusted agency which provides customized services to businesses across India."
  },
  cards: [whatWeDoCardSchema]
}, { timestamps: true });

module.exports = mongoose.model('AboutWhatWeDo', aboutWhatWeDoSchema);
