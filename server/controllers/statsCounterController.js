const StatsCounterCard = require('../models/StatsCounterCard');
const { SuccessResponse } = require('../utils/apiResponse');

// Default initial data for migration
const defaultStats = [
  { value: 50, suffix: "+", label: "Clients Served", icon: "Users", order: 1 },
  { value: 8, suffix: "+", label: "Services", icon: "Layers", order: 2 },
  { value: 100, suffix: "%", label: "Transparency", icon: "ShieldCheck", order: 3 },
  { value: 3, suffix: "+", label: "Years' Experience", icon: "Clock", order: 4 }
];

// Helper to auto seed
const ensureStats = async () => {
  const count = await StatsCounterCard.countDocuments();
  if (count === 0) {
    await StatsCounterCard.insertMany(defaultStats);
  }
};

// @desc    Get Stats Counter data for public view (only active)
// @route   GET /api/content/stats-counter
// @access  Public
exports.getStatsPublic = async (req, res, next) => {
  try {
    await ensureStats();
    
    const stats = await StatsCounterCard.find({ isActive: true })
      .sort({ order: 1 })
      .select('-createdAt -updatedAt -isActive -__v')
      .lean();
      
    return res.status(200).json(new SuccessResponse(stats));
  } catch (error) {
    next(error);
  }
};

// @desc    Get Stats Counter data for admin
// @route   GET /api/content/admin/stats-counter
// @access  Private/Admin
exports.getStatsAdmin = async (req, res, next) => {
  try {
    await ensureStats();
    
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const [stats, total] = await Promise.all([
      StatsCounterCard.find()
        .sort({ order: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      StatsCounterCard.countDocuments()
    ]);
      
    return res.status(200).json(new SuccessResponse({
      stats,
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

// @desc    Create a new Stats Counter card
// @route   POST /api/content/admin/stats-counter
// @access  Private/Admin
exports.createStat = async (req, res, next) => {
  try {
    const count = await StatsCounterCard.countDocuments();
    const order = req.body.order || count + 1;
    
    const stat = await StatsCounterCard.create({ ...req.body, order, updatedBy: req.user._id });
    return res.status(201).json(new SuccessResponse(stat, 'Stat created successfully'));
  } catch (error) {
    next(error);
  }
};

// @desc    Update a Stats Counter card
// @route   PUT /api/content/admin/stats-counter/:id
// @access  Private/Admin
exports.updateStat = async (req, res, next) => {
  try {
    const stat = await StatsCounterCard.findByIdAndUpdate(
      req.params.id, 
      { ...req.body, updatedBy: req.user._id },
      { new: true, runValidators: true }
    ).lean();
    
    if (!stat) {
      return res.status(404).json({ success: false, message: 'Stat not found' });
    }
    
    return res.status(200).json(new SuccessResponse(stat, 'Stat updated successfully'));
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a Stats Counter card (hard delete)
// @route   DELETE /api/content/admin/stats-counter/:id
// @access  Private/Admin
exports.deleteStat = async (req, res, next) => {
  try {
    const stat = await StatsCounterCard.findByIdAndDelete(req.params.id);
    
    if (!stat) {
      return res.status(404).json({ success: false, message: 'Stat not found' });
    }
    
    return res.status(200).json(new SuccessResponse(null, 'Stat deleted successfully'));
  } catch (error) {
    next(error);
  }
};
