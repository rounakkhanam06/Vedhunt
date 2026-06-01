const AboutOurEdge = require('../models/AboutOurEdge');

exports.getAboutOurEdge = async (req, res) => {
  try {
    let data = await AboutOurEdge.findOne();
    if (!data) {
      data = await AboutOurEdge.create({
        tagline: 'Our Edge',
        title: 'Why Scaled Brands Trust Vedhunt InfoTech',
        description: 'We eliminate technical bottlenecks by uniting engineering precision, marketing strategy, and transparent reporting systems under one single cohesive roof.',
        cards: [
          { title: 'End-to-End Ownership', desc: 'From wireframes and strategic plans to high-availability production deployments.' },
          { title: 'Dedicated Domain Experts', desc: 'Seniors and principal architects leading app design, automation, and bookkeeping.' },
          { title: '100% Tailored Strategies', desc: 'No cookie-cutter templates. Custom digital models to solve your explicit bottlenecks.' },
          { title: 'Ethical Digital Practices', desc: 'Absolute compliance, semantic code structure, and honest metric-supported dashboards.' }
        ]
      });
    }
    res.json(data);
  } catch (error) {
    console.error('Error fetching About Our Edge:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

exports.updateAboutOurEdge = async (req, res) => {
  try {
    const { tagline, title, description, cards } = req.body;
    
    let data = await AboutOurEdge.findOne();
    
    if (data) {
      data.tagline = tagline;
      data.title = title;
      data.description = description;
      data.cards = cards;
      await data.save();
    } else {
      data = await AboutOurEdge.create({
        tagline,
        title,
        description,
        cards
      });
    }
    
    res.json(data);
  } catch (error) {
    console.error('Error updating About Our Edge:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};
