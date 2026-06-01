const AboutVisionMission = require('../models/AboutVisionMission');

exports.getAboutVisionMission = async (req, res) => {
  try {
    let data = await AboutVisionMission.findOne();
    if (!data) {
      data = await AboutVisionMission.create({
        visionTagline: 'Our Vision',
        visionTitle: 'Grow Smarter, Faster & More Ethically',
        visionDescription: 'To become a globally recognized technology partner that empowers organizations to leverage digital systems securely and ethically, fostering massive organic business scale.',
        missionTagline: 'Our Mission',
        missionTitle: 'Simplifying Core Digital Processes',
        missionDescription: 'To deliver innovative, result-driven solutions using modern technologies that simplify business processes, enhance productivity, and maximize client profitability with zero compromises.'
      });
    }
    res.json(data);
  } catch (error) {
    console.error('Error fetching About Vision Mission:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

exports.updateAboutVisionMission = async (req, res) => {
  try {
    const {
      visionTagline,
      visionTitle,
      visionDescription,
      missionTagline,
      missionTitle,
      missionDescription
    } = req.body;
    
    let data = await AboutVisionMission.findOne();
    
    if (data) {
      data.visionTagline = visionTagline;
      data.visionTitle = visionTitle;
      data.visionDescription = visionDescription;
      data.missionTagline = missionTagline;
      data.missionTitle = missionTitle;
      data.missionDescription = missionDescription;
      await data.save();
    } else {
      data = await AboutVisionMission.create({
        visionTagline,
        visionTitle,
        visionDescription,
        missionTagline,
        missionTitle,
        missionDescription
      });
    }
    
    res.json(data);
  } catch (error) {
    console.error('Error updating About Vision Mission:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};
