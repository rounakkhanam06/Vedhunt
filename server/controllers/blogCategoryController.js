const BlogCategory = require('../models/BlogCategory');
const Blog = require('../models/Blog');

// Get all categories (Public or Admin)
exports.getCategories = async (req, res) => {
  try {
    // Sync existing categories from blogs to make sure nothing is lost
    const uniqueCategories = await Blog.distinct('category');
    for (const catName of uniqueCategories) {
      if (catName) {
        await BlogCategory.updateOne(
          { name: catName.toUpperCase() },
          { $setOnInsert: { name: catName.toUpperCase(), isActive: true } },
          { upsert: true }
        );
      }
    }

    const { activeOnly } = req.query;
    let query = {};
    if (activeOnly === 'true') {
      query.isActive = true;
    }
    const categories = await BlogCategory.find(query).sort({ name: 1 }).lean();
    res.status(200).json({ success: true, data: categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ success: false, message: 'Server error fetching categories' });
  }
};

// Create a new category
exports.createCategory = async (req, res) => {
  try {
    const { name, isActive } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Category name is required' });
    }
    const category = await BlogCategory.create({ name, isActive });
    res.status(201).json({ success: true, data: category });
  } catch (error) {
    console.error('Error creating category:', error);
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Category already exists' });
    }
    res.status(500).json({ success: false, message: 'Server error creating category' });
  }
};

// Update a category
exports.updateCategory = async (req, res) => {
  try {
    const categoryId = req.params.id;
    const { name, isActive } = req.body;

    const category = await BlogCategory.findById(categoryId);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    const oldName = category.name;
    let nameChanged = false;

    if (name && name.toUpperCase() !== oldName) {
      category.name = name.toUpperCase();
      nameChanged = true;
    }
    
    if (isActive !== undefined) {
      category.isActive = isActive;
    }

    await category.save();

    // Cascade update to blogs if name changed
    if (nameChanged) {
      await Blog.updateMany(
        { category: oldName },
        { $set: { category: category.name } }
      );
    }

    res.status(200).json({ success: true, data: category });
  } catch (error) {
    console.error('Error updating category:', error);
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Category name already exists' });
    }
    res.status(500).json({ success: false, message: 'Server error updating category' });
  }
};

// Delete a category
exports.deleteCategory = async (req, res) => {
  try {
    const categoryId = req.params.id;
    const category = await BlogCategory.findById(categoryId);
    
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    // Check if blogs use this category (case-insensitive)
    const blogCount = await Blog.countDocuments({ category: { $regex: new RegExp(`^${category.name}$`, 'i') } });
    if (blogCount > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot delete category. There are ${blogCount} blog(s) currently using this category.` 
      });
    }

    await BlogCategory.findByIdAndDelete(categoryId);
    res.status(200).json({ success: true, message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ success: false, message: 'Server error deleting category' });
  }
};
