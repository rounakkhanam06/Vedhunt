const LifeAtVedhuntHeader = require('../models/LifeAtVedhuntHeader');
const LifeAtVedhuntCard = require('../models/LifeAtVedhuntCard');
const { SuccessResponse } = require('../utils/apiResponse');

// Default initial data for migration
const defaultCards = [
  { 
    image: 'https://images.unsplash.com/photo-1573164713988-8665fc963095?auto=format&fit=crop&q=80&w=600', 
    tag: 'WORKSPACE', 
    title: 'Modern Tools', 
    span: '1x',
    order: 1 
  },
  { 
    image: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&q=80&w=1200', 
    tag: 'OUR TEAM', 
    title: 'Collaborating on the future', 
    span: '2x',
    order: 2 
  },
  { 
    image: 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&q=80&w=1200', 
    tag: 'CULTURE', 
    title: 'Continuous Learning', 
    span: '2x',
    order: 3 
  },
  { 
    image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&q=80&w=600', 
    tag: 'GROWTH', 
    title: 'Join Us', 
    span: '1x',
    order: 4 
  }
];

exports.getPublic = async (req, res, next) => {
  try {
    // Check if migration is needed
    const cardCount = await LifeAtVedhuntCard.countDocuments();
    if (cardCount === 0) {
      await LifeAtVedhuntCard.insertMany(defaultCards);
    }

    let header = await LifeAtVedhuntHeader.findOne().lean().select('-_id -__v -updatedAt -createdAt');
    if (!header) {
      header = { 
        heading: 'Life at', 
        highlightText: 'Vedhunt', 
        description: 'We believe in working hard, innovating continuously, and having fun along the way. Discover our vibrant culture, modern workspaces, and the incredible people driving our vision.' 
      };
      await LifeAtVedhuntHeader.create(header);
    }

    const cards = await LifeAtVedhuntCard.find({ isActive: true })
      .sort('order')
      .lean()
      .select('image tag title span -_id');

    res.status(200).json(new SuccessResponse({ header, cards }));
  } catch (error) {
    next(error);
  }
};

exports.getAdmin = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    let header = await LifeAtVedhuntHeader.findOne().lean();
    if (!header) {
      header = { 
        heading: 'Life at', 
        highlightText: 'Vedhunt', 
        description: 'We believe in working hard, innovating continuously, and having fun along the way. Discover our vibrant culture, modern workspaces, and the incredible people driving our vision.' 
      };
      await LifeAtVedhuntHeader.create(header);
      header = await LifeAtVedhuntHeader.findOne().lean();
    }

    const [cards, total] = await Promise.all([
      LifeAtVedhuntCard.find()
        .sort({ order: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      LifeAtVedhuntCard.countDocuments()
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

exports.updateHeader = async (req, res, next) => {
  try {
    const { heading, highlightText, description } = req.body;
    let header = await LifeAtVedhuntHeader.findOne();

    if (!header) {
      header = new LifeAtVedhuntHeader({ heading, highlightText, description, updatedBy: req.user._id });
    } else {
      header.heading = heading || header.heading;
      header.highlightText = highlightText || header.highlightText;
      header.description = description || header.description;
      header.updatedBy = req.user._id;
    }

    await header.save();
    res.status(200).json(new SuccessResponse(header, 'Header updated successfully'));
  } catch (error) {
    next(error);
  }
};

exports.createCard = async (req, res, next) => {
  try {
    const { image, tag, title, span, isActive, order } = req.body;
    const newCard = new LifeAtVedhuntCard({
      image,
      tag,
      title,
      span,
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

exports.updateCard = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    updates.updatedBy = req.user._id;

    const card = await LifeAtVedhuntCard.findByIdAndUpdate(id, updates, { new: true }).lean();
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

exports.deleteCard = async (req, res, next) => {
  try {
    const { id } = req.params;
    const card = await LifeAtVedhuntCard.findByIdAndUpdate(id, { isActive: false, updatedBy: req.user._id }, { new: true }).lean();
    
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
