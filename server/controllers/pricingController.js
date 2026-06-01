const PricingCategory = require('../models/PricingCategory');
const PricingPlan = require('../models/PricingPlan');

// @desc    Get all active pricing categories and plans
// @route   GET /api/pricing
// @access  Public
const getPricing = async (req, res) => {
  try {
    const plans = await PricingPlan.find({ status: 'active' })
      .populate('category')
      .sort({ order: 1 });

    res.status(200).json({
      success: true,
      data: plans
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all active pricing categories
// @route   GET /api/pricing/categories
// @access  Public
const getPublicCategories = async (req, res) => {
  try {
    const categories = await PricingCategory.find({ status: 'active' }).sort({ order: 1 });
    res.status(200).json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ================= ADMIN CATEGORY CONTROLLERS =================

// @desc    Get all categories for admin
// @route   GET /api/pricing/admin/categories
// @access  Private/Admin
const getAdminCategories = async (req, res) => {
  try {
    const categories = await PricingCategory.find().sort({ order: 1 });
    res.status(200).json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create a category
// @route   POST /api/pricing/admin/categories
// @access  Private/Admin
const createCategory = async (req, res) => {
  try {
    const category = await PricingCategory.create(req.body);
    res.status(201).json({ success: true, data: category });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Update a category
// @route   PUT /api/pricing/admin/categories/:id
// @access  Private/Admin
const updateCategory = async (req, res) => {
  try {
    const category = await PricingCategory.findById(req.params.id);
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });

    Object.assign(category, req.body);
    await category.save();

    res.status(200).json({ success: true, data: category });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Delete a category
// @route   DELETE /api/pricing/admin/categories/:id
// @access  Private/Admin
const deleteCategory = async (req, res) => {
  try {
    const category = await PricingCategory.findByIdAndDelete(req.params.id);
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });
    
    // Optionally delete all plans associated with this category
    await PricingPlan.deleteMany({ category: req.params.id });

    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ================= ADMIN PLAN CONTROLLERS =================

// @desc    Get all plans for admin
// @route   GET /api/pricing/admin/plans
// @access  Private/Admin
const getAdminPlans = async (req, res) => {
  try {
    const filter = {};
    if (req.query.category && req.query.category !== 'all') {
      filter.category = req.query.category;
    }

    const plans = await PricingPlan.find(filter)
      .populate('category', 'name slug')
      .sort({ category: 1, order: 1 });
      
    res.status(200).json({ success: true, data: plans });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create a plan
// @route   POST /api/pricing/admin/plans
// @access  Private/Admin
const createPlan = async (req, res) => {
  try {
    const plan = await PricingPlan.create(req.body);
    const populatedPlan = await PricingPlan.findById(plan._id).populate('category', 'name slug');
    res.status(201).json({ success: true, data: populatedPlan });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Update a plan
// @route   PUT /api/pricing/admin/plans/:id
// @access  Private/Admin
const updatePlan = async (req, res) => {
  try {
    const plan = await PricingPlan.findById(req.params.id);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });

    Object.assign(plan, req.body);
    await plan.save();
    
    const populatedPlan = await PricingPlan.findById(plan._id).populate('category', 'name slug');
    res.status(200).json({ success: true, data: populatedPlan });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Delete a plan
// @route   DELETE /api/pricing/admin/plans/:id
// @access  Private/Admin
const deletePlan = async (req, res) => {
  try {
    const plan = await PricingPlan.findByIdAndDelete(req.params.id);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });

    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Seed function for pricing (Optional, for initial setup)
const seedPricingData = async () => {
  // Can be implemented later to migrate static data
};

module.exports = {
  getPricing,
  getPublicCategories,
  getAdminCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getAdminPlans,
  createPlan,
  updatePlan,
  deletePlan,
  seedPricingData
};
