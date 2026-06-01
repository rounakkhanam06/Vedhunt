const AboutCompany = require('../models/AboutCompany');

const getAboutCompany = async (req, res) => {
  try {
    let company = await AboutCompany.findOne();
    if (!company) {
      // Seed default data if none exists
      company = await AboutCompany.create({
        tagline: 'About Our Company',
        headerLine1: 'Empowering Businesses',
        headerLine2: 'Through Smart Technology & Ethical Strategy',
        centralBadge: {
          value: '5+',
          label1: 'Years Of',
          label2: 'Excellence'
        },
        descriptionParagraphs: [
          "At *Vedhunt InfoTech*, we believe technology isn't just about code — it's about creating meaningful impact.",
          "We are a **next-generation IT, Digital Marketing, and Automation solutions company** helping businesses streamline operations, boost digital presence, and accelerate growth through intelligent, ethical, and scalable solutions.",
          "Founded with a vision to *bridge the gap between technology and business success*, Vedhunt InfoTech has evolved into a trusted partner for startups, SMEs, and enterprises across multiple industries.",
          "Our team of innovators, strategists, and engineers work together to design and deliver end-to-end digital solutions that transform how organizations operate and grow."
        ],
        checklistItem1: {
          title: 'Certified Company',
          description: 'Industry-certified security compliance & standard-driven procedures.'
        },
        checklistItem2: {
          title: 'Award Ceremony',
          description: 'Recognized for excellence in automation & performance-driven marketing.'
        },
        signature: {
          name: 'Rakesh Kumar',
          role: 'Chairman & Founder Tech, Vedhunt'
        }
      });
    }
    res.json(company);
  } catch (error) {
    console.error('Error fetching About Company content:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

const updateAboutCompany = async (req, res) => {
  try {
    let company = await AboutCompany.findOne();
    if (!company) {
      company = new AboutCompany(req.body);
    } else {
      Object.assign(company, req.body);
    }
    await company.save();
    res.json({ message: 'About Company content updated successfully', data: company });
  } catch (error) {
    console.error('Error updating About Company content:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  getAboutCompany,
  updateAboutCompany
};
