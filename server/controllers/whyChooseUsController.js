const WhyChooseUsHeader = require('../models/WhyChooseUsHeader');
const WhyChooseUsCard = require('../models/WhyChooseUsCard');
const { SuccessResponse } = require('../utils/apiResponse');

// Default initial data for migration
const defaultCards = [
  { icon: 'Target', title: "Result-Oriented", description: "We focus heavily on measurable outcomes that directly drive your business growth.", order: 1 },
  { icon: 'Eye', title: "Full Transparency", description: "No hidden charges, no vague metrics—clear communication at every phase.", order: 2 },
  { icon: 'Zap', title: "Fast Turnaround", description: "Optimized agile development workflows to deliver your projects ahead of schedule.", order: 3 },
  { icon: 'Headphones', title: "Dedicated Support", description: "Get a dedicated account manager reachable directly over WhatsApp for seamless updates.", order: 4 },
  { icon: 'Lightbulb', title: "Creative + Technical", description: "A powerful combination of stunning visual UX design and robust backend engineering.", order: 5 },
  { icon: 'BarChart3', title: "Data-Driven", description: "Every campaign, design layout, and process optimization is backed by real user data analytics.", order: 6 }
];

exports.getWhyChooseUsPublic = async (req, res, next) => {
  try {
    // Check if migration is needed
    const cardCount = await WhyChooseUsCard.countDocuments();
    if (cardCount === 0) {
      await WhyChooseUsCard.insertMany(defaultCards);
    }

    let header = await WhyChooseUsHeader.findOne().lean().select('-_id -__v -updatedAt -createdAt');
    if (!header) {
      header = { tagline: 'Why Vedhunt', heading: 'Engineering Success with', highlightText: 'Precision' };
    }

    const cards = await WhyChooseUsCard.find({ isActive: true })
      .sort('order')
      .lean()
      .select('icon title description -_id');

    res.status(200).json(new SuccessResponse({ header, cards }));
  } catch (error) {
    next(error);
  }
};

exports.getWhyChooseUsAdmin = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    let header = await WhyChooseUsHeader.findOne().lean();
    if (!header) {
      header = { tagline: 'Why Vedhunt', heading: 'Engineering Success with', highlightText: 'Precision' };
    }

    const [cards, total] = await Promise.all([
      WhyChooseUsCard.find()
        .sort({ order: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      WhyChooseUsCard.countDocuments()
    ]);

    res.status(200).json(new SuccessResponse({
      header,
      cards,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }));
  } catch (error) {
    next(error);
  }
};

exports.updateWhyChooseUsHeader = async (req, res, next) => {
  try {
    const { tagline, heading, highlightText } = req.body;
    let header = await WhyChooseUsHeader.findOne();

    if (!header) {
      header = new WhyChooseUsHeader({ tagline, heading, highlightText, updatedBy: req.user._id });
    } else {
      header.tagline = tagline || header.tagline;
      header.heading = heading || header.heading;
      header.highlightText = highlightText || header.highlightText;
      header.updatedBy = req.user._id;
    }

    await header.save();
    res.status(200).json(new SuccessResponse(header, 'Header updated successfully'));
  } catch (error) {
    next(error);
  }
};

exports.createWhyChooseUsCard = async (req, res, next) => {
  try {
    const { icon, title, description, isActive, order } = req.body;
    const newCard = new WhyChooseUsCard({
      icon,
      title,
      description,
      isActive,
      order: order || 0,
      updatedBy: req.user._id
    });
    
    await newCard.save();
    res.status(201).json(new SuccessResponse(newCard, 'Card created successfully'));
  } catch (error) {
    next(error);
  }
};

exports.updateWhyChooseUsCard = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    updates.updatedBy = req.user._id;

    const card = await WhyChooseUsCard.findByIdAndUpdate(id, updates, { new: true }).lean();
    if (!card) {
      const error = new Error('Card not found');
      error.statusCode = 404;
      throw error;
    }

    res.status(200).json(new SuccessResponse(card, 'Card updated successfully'));
  } catch (error) {
    next(error);
  }
};

exports.deleteWhyChooseUsCard = async (req, res, next) => {
  try {
    const { id } = req.params;
    const card = await WhyChooseUsCard.findByIdAndUpdate(id, { isActive: false, updatedBy: req.user._id }, { new: true }).lean();
    
    if (!card) {
      const error = new Error('Card not found');
      error.statusCode = 404;
      throw error;
    }

    res.status(200).json(new SuccessResponse(null, 'Card soft-deleted successfully'));
  } catch (error) {
    next(error);
  }
};
