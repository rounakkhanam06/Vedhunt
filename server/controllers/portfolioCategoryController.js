const PortfolioCategory = require('../models/PortfolioCategory');
const Portfolio = require('../models/Portfolio');

// The three categories that used to be hard-coded. Created once if the
// collection is empty, so existing showcases keep their category.
const DEFAULT_CATEGORIES = [
  { key: 'development', label: 'Web & App Engineering', badge: 'Engineering', displayOrder: 1 },
  { key: 'automation', label: 'Automation & Business Finance', badge: 'Finance & Tech', displayOrder: 2 },
  { key: 'marketing', label: 'SEO & Growth Marketing', badge: 'Marketing & SEO', displayOrder: 3 },
];

const ensureDefaults = async () => {
  if ((await PortfolioCategory.estimatedDocumentCount()) > 0) return;
  await PortfolioCategory.bulkWrite(
    DEFAULT_CATEGORIES.map((c) => ({
      updateOne: { filter: { key: c.key }, update: { $setOnInsert: c }, upsert: true },
    })),
    { ordered: false }
  );
};

const slugify = (s = '') =>
  String(s).toLowerCase().trim().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);

/** True when `key` is an existing category (used by showcase create/update). */
const categoryExists = async (key) => {
  await ensureDefaults();
  return !!(key && (await PortfolioCategory.exists({ key })));
};

// GET /api/portfolio/categories — public, active only
const getPublicCategories = async (req, res) => {
  try {
    await ensureDefaults();
    const data = await PortfolioCategory.find({ isActive: true })
      .sort({ displayOrder: 1, createdAt: 1 })
      .select('key label badge displayOrder')
      .lean();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/portfolio/admin/categories — all, with how many showcases use each
const getAdminCategories = async (req, res) => {
  try {
    await ensureDefaults();
    const [cats, counts] = await Promise.all([
      PortfolioCategory.find().sort({ displayOrder: 1, createdAt: 1 }).lean(),
      Portfolio.aggregate([{ $group: { _id: '$category', n: { $sum: 1 } } }]),
    ]);
    const byKey = Object.fromEntries(counts.map((c) => [c._id, c.n]));
    res.json({ success: true, data: cats.map((c) => ({ ...c, itemCount: byKey[c.key] || 0 })) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const pickEditable = (body) => {
  const out = {};
  if (body.label !== undefined) out.label = String(body.label).trim();
  if (body.badge !== undefined) out.badge = String(body.badge).trim();
  if (body.displayOrder !== undefined) out.displayOrder = Number(body.displayOrder) || 0;
  if (body.isActive !== undefined) out.isActive = !!body.isActive;
  return out;
};

// POST /api/portfolio/admin/categories
const createCategory = async (req, res) => {
  try {
    const fields = pickEditable(req.body);
    if (!fields.label) return res.status(400).json({ success: false, message: 'Please provide a category name' });
    const key = slugify(req.body.key || fields.label);
    if (!key) return res.status(400).json({ success: false, message: 'Please provide a valid category name' });
    if (await PortfolioCategory.exists({ key })) {
      return res.status(400).json({ success: false, message: `A category with key "${key}" already exists` });
    }
    const cat = await PortfolioCategory.create({ ...fields, key });
    res.status(201).json({ success: true, data: cat });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// PUT /api/portfolio/admin/categories/:id — key is fixed
const updateCategory = async (req, res) => {
  try {
    const fields = pickEditable(req.body);
    if (fields.label === '') return res.status(400).json({ success: false, message: 'Category name cannot be empty' });
    const cat = await PortfolioCategory.findByIdAndUpdate(req.params.id, { $set: fields }, { new: true, runValidators: true });
    if (!cat) return res.status(404).json({ success: false, message: 'Category not found' });
    res.json({ success: true, data: cat });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// DELETE /api/portfolio/admin/categories/:id — refused while showcases use it
const deleteCategory = async (req, res) => {
  try {
    const cat = await PortfolioCategory.findById(req.params.id);
    if (!cat) return res.status(404).json({ success: false, message: 'Category not found' });
    const used = await Portfolio.countDocuments({ category: cat.key });
    if (used) {
      return res.status(400).json({
        success: false,
        message: `"${cat.label}" is used by ${used} showcase(s). Move them to another category or deactivate it instead.`,
      });
    }
    await cat.deleteOne();
    res.json({ success: true, message: 'Category deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  categoryExists,
  getPublicCategories,
  getAdminCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};
