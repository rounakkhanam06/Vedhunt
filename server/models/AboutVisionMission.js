const mongoose = require('mongoose');

const aboutVisionMissionSchema = new mongoose.Schema({
  visionTagline: {
    type: String,
    default: 'Our Vision'
  },
  visionTitle: {
    type: String,
    default: 'Grow Smarter, Faster & More Ethically'
  },
  visionDescription: {
    type: String,
    default: 'To become a globally recognized technology partner that empowers organizations to leverage digital systems securely and ethically, fostering massive organic business scale.'
  },
  missionTagline: {
    type: String,
    default: 'Our Mission'
  },
  missionTitle: {
    type: String,
    default: 'Simplifying Core Digital Processes'
  },
  missionDescription: {
    type: String,
    default: 'To deliver innovative, result-driven solutions using modern technologies that simplify business processes, enhance productivity, and maximize client profitability with zero compromises.'
  }
}, { timestamps: true });

module.exports = mongoose.model('AboutVisionMission', aboutVisionMissionSchema);
