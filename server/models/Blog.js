const mongoose = require('mongoose');

const blockSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    required: true,
    enum: ['paragraph', 'heading', 'image', 'code', 'quote'], // Example block types
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  }
}, { _id: false }); // Prevents mongoose from creating an _id for each block

const blogSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Blog title is required'],
    trim: true,
  },
  slug: {
    type: String,
    required: [true, 'Blog slug is required'],
    unique: true,
    trim: true,
    lowercase: true,
  },
  excerpt: {
    type: String,
    trim: true,
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    trim: true,
    uppercase: true, // as in existing static data
  },
  author: {
    type: String,
    required: [true, 'Author is required'],
    trim: true,
  },
  thumbnail: {
    type: String,
    required: [true, 'Thumbnail image URL is required'],
  },
  contentBlocks: {
    type: [blockSchema],
    default: [],
  },
  isPublished: {
    type: Boolean,
    default: true,
  }
}, {
  timestamps: true,
});

// Create text index for search functionality
blogSchema.index({ title: 'text', excerpt: 'text' });

// Create list index for optimal query sorting (category filter + createdAt sort)
blogSchema.index({ isPublished: 1, category: 1, createdAt: -1 });

// Note: { slug: 1 } index is automatically created by Mongoose because of `unique: true`

const Blog = mongoose.model('Blog', blogSchema);

module.exports = Blog;
