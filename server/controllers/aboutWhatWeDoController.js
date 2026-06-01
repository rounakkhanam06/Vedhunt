const AboutWhatWeDo = require('../models/AboutWhatWeDo');

const defaultCards = [
  {
    icon: 'Code',
    title: 'Web & Mobile Engineering',
    desc: 'High-performing, responsive, and scalable web and mobile applications tailored to your brand and business goals.'
  },
  {
    icon: 'Share2',
    title: 'Social Media Management',
    desc: 'Expertly managed campaigns and engaging organic content designed to build community and drive brand loyalty.'
  },
  {
    icon: 'Megaphone',
    title: 'Performance Marketing',
    desc: 'Targeted ad strategies across Google, Meta, and LinkedIn Ads that drive leads, conversions, and long-term brand value.'
  },
  {
    icon: 'Palette',
    title: 'UI/UX Design',
    desc: 'Intuitive, visually stunning, and user-centric designs that communicate your vision and values effectively to your targeted audience.'
  },
  {
    icon: 'Calculator',
    title: 'Accounting & Financial Services',
    desc: 'Transparent financial management, outsourced bookkeeping, and compliance reporting services for smooth business operations.'
  },
  {
    icon: 'BarChart3',
    title: 'MIS & Reporting Services',
    desc: 'Smart dashboards and automated insights to enable quick, data-driven, and highly effective executive decision-making.'
  },
  {
    icon: 'Cpu',
    title: 'Enterprise Process Automation',
    desc: 'Streamlining business workflows through powerful automation and custom business intelligence tools (SQL, Power BI, Python) to save time and eliminate errors.'
  }
];

exports.getAboutWhatWeDo = async (req, res) => {
  try {
    let data = await AboutWhatWeDo.findOne();
    if (!data) {
      data = await AboutWhatWeDo.create({
        tagline: 'What We Do',
        title: 'Comprehensive Technology & Financial Solutions',
        description: "Vedhunt InfoTech provides successful business solutions to its clients to scale their profitability. It's a trusted agency which provides customized services to businesses across India.",
        cards: defaultCards
      });
    }
    res.json(data);
  } catch (error) {
    console.error('Error fetching About What We Do:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

exports.updateAboutWhatWeDo = async (req, res) => {
  try {
    const { tagline, title, description, cards } = req.body;
    let data = await AboutWhatWeDo.findOne();
    
    if (data) {
      data.tagline = tagline;
      data.title = title;
      data.description = description;
      data.cards = cards;
      await data.save();
    } else {
      data = await AboutWhatWeDo.create({ tagline, title, description, cards });
    }
    
    res.json(data);
  } catch (error) {
    console.error('Error updating About What We Do:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};
