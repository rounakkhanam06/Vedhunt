const AdvantageHeader = require('../models/AdvantageHeader');
const AdvantageRow = require('../models/AdvantageRow');
const { SuccessResponse } = require('../utils/apiResponse');

// Initial default data from the frontend
const defaultRows = [
  { feature: "All-in-One Services", vedhunt: "8 services under one roof", typical: "Usually 2–3 services", order: 1 },
  { feature: "Pricing", vedhunt: "Transparent, no hidden fees", typical: "Often vague or inflated", order: 2 },
  { feature: "Reporting", vedhunt: "Real-time dashboards & reports", typical: "Monthly PDF only", order: 3 },
  { feature: "Communication", vedhunt: "Dedicated manager + WhatsApp", typical: "Email tickets only", order: 4 },
  { feature: "Strategy", vedhunt: "Custom strategy per client", typical: "Generic templates", order: 5 },
  { feature: "Technology", vedhunt: "Own tech stack + automation", typical: "Outsourced delivery", order: 6 },
  { feature: "ROI Focus", vedhunt: "KPI-based campaigns always", typical: "Vanity metrics focus", order: 7 }
];

// Helper to ensure header exists
const ensureHeader = async () => {
  let header = await AdvantageHeader.findOne().lean();
  if (!header) {
    header = await AdvantageHeader.create({});
  }
  return header;
};

// Helper to ensure rows exist (auto seed)
const ensureRows = async () => {
  const count = await AdvantageRow.countDocuments();
  if (count === 0) {
    await AdvantageRow.insertMany(defaultRows);
  }
};

// @desc    Get Advantage section data for public view (only active rows)
// @route   GET /api/content/advantage
// @access  Public
exports.getAdvantagePublic = async (req, res, next) => {
  try {
    const [header, rows] = await Promise.all([
      ensureHeader(),
      ensureRows().then(() => 
        AdvantageRow.find({ isActive: true })
          .sort({ order: 1 })
          .select('-createdAt -updatedAt -isActive')
          .lean()
      )
    ]);
    return res.status(200).json(new SuccessResponse({ header, rows }));
  } catch (error) {
    next(error);
  }
};

// @desc    Get Advantage section data for admin (all rows)
// @route   GET /api/content/advantage/admin
// @access  Private/Admin
exports.getAdvantageAdmin = async (req, res, next) => {
  try {
    const [header, rows] = await Promise.all([
      ensureHeader(),
      ensureRows().then(() => 
        AdvantageRow.find()
          .sort({ order: 1 })
          .lean()
      )
    ]);
    return res.status(200).json(new SuccessResponse({ header, rows }));
  } catch (error) {
    next(error);
  }
};

// @desc    Update Advantage header
// @route   PUT /api/content/advantage/header
// @access  Private/Admin
exports.updateAdvantageHeader = async (req, res, next) => {
  try {
    const header = await AdvantageHeader.findOneAndUpdate({}, req.body, { 
      new: true, 
      upsert: true,
      runValidators: true 
    }).lean();
    return res.status(200).json(new SuccessResponse(header, 'Header updated successfully'));
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new Advantage row
// @route   POST /api/content/advantage/row
// @access  Private/Admin
exports.createAdvantageRow = async (req, res, next) => {
  try {
    const count = await AdvantageRow.countDocuments();
    const order = req.body.order || count + 1;
    
    const row = await AdvantageRow.create({ ...req.body, order });
    return res.status(201).json(new SuccessResponse(row, 'Row created successfully'));
  } catch (error) {
    next(error);
  }
};

// @desc    Update an Advantage row
// @route   PUT /api/content/advantage/row/:id
// @access  Private/Admin
exports.updateAdvantageRow = async (req, res, next) => {
  try {
    const row = await AdvantageRow.findByIdAndUpdate(
      req.params.id, 
      req.body, 
      { new: true, runValidators: true }
    ).lean();
    
    if (!row) {
      return res.status(404).json({ success: false, message: 'Row not found' });
    }
    return res.status(200).json(new SuccessResponse(row, 'Row updated successfully'));
  } catch (error) {
    next(error);
  }
};

// @desc    Delete an Advantage row (hard delete)
// @route   DELETE /api/content/advantage/row/:id
// @access  Private/Admin
exports.deleteAdvantageRow = async (req, res, next) => {
  try {
    const row = await AdvantageRow.findByIdAndDelete(req.params.id);
    
    if (!row) {
      return res.status(404).json({ success: false, message: 'Row not found' });
    }
    return res.status(200).json(new SuccessResponse(null, 'Row deleted successfully'));
  } catch (error) {
    next(error);
  }
};
