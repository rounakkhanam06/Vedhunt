const Blog = require('../models/Blog');
const Settings = require('../models/Settings');
const agenda = require('../jobs/agenda');
const slugify = require('slugify');
const logger = require('../utils/logger');

// The blog's URL: from the typed slug, or from the title when the slug box is
// left empty. "My SEO Tips & Tricks" → "my-seo-tips-and-tricks".
const toSlug = (value) => slugify(String(value || ''), { lower: true, strict: true, trim: true });

function withCleanSlug(body) {
  const data = { ...body };
  const slug = toSlug(data.slug) || toSlug(data.title);
  if (slug) data.slug = slug;
  else delete data.slug; // nothing usable → the "slug is required" validation message
  return data;
}

// Mongoose validation → one readable 400 naming every missing/invalid field
function validationMessage(error) {
  if (error?.name !== 'ValidationError') return null;
  return Object.values(error.errors).map((e) => e.message).join('. ');
}

// The newsletter is a side effect: queuing it must never fail the save itself
function queueBlogNewsletter(blog) {
  if (!blog.isPublished) return;
  try {
    Promise.resolve(agenda.now('sendNewsletterBatch', { type: 'BLOG_UPDATE', blogId: blog._id.toString() }))
      .catch((err) => logger.error(`Could not queue blog newsletter for ${blog.slug}: ${err.message}`));
  } catch (err) {
    logger.error(`Could not queue blog newsletter for ${blog.slug}: ${err.message}`);
  }
}

// --- Public Endpoints ---

// Get all blogs with filtering and optimized lean selection
exports.getBlogs = async (req, res) => {
  try {
    const { category, search } = req.query;
    let query = { isPublished: true };

    if (category && category !== 'All') {
      query.category = category.toUpperCase();
    }

    if (search) {
      query.$text = { $search: search };
    }

    const blogs = await Blog.find(query)
      .select('title slug excerpt category author thumbnail createdAt')
      .sort(search ? { score: { $meta: 'textScore' } } : { createdAt: -1 })
      .lean();

    res.status(200).json({ success: true, count: blogs.length, data: blogs });
  } catch (error) {
    console.error('Error fetching blogs:', error);
    res.status(500).json({ success: false, message: 'Server error fetching blogs' });
  }
};

// Get single blog by slug
exports.getBlogBySlug = async (req, res) => {
  try {
    const blog = await Blog.findOne({ slug: req.params.slug, isPublished: true }).lean();
    if (!blog) {
      return res.status(404).json({ success: false, message: 'Blog not found' });
    }
    res.status(200).json({ success: true, data: blog });
  } catch (error) {
    console.error('Error fetching blog:', error);
    res.status(500).json({ success: false, message: 'Server error fetching blog' });
  }
};

// --- Admin Endpoints ---

// Get single blog by slug (Admin - includes unpublished)
exports.getAdminBlogBySlug = async (req, res) => {
  try {
    const blog = await Blog.findOne({ slug: req.params.slug }).lean();
    if (!blog) {
      return res.status(404).json({ success: false, message: 'Blog not found' });
    }
    res.status(200).json({ success: true, data: blog });
  } catch (error) {
    console.error('Error fetching admin blog:', error);
    res.status(500).json({ success: false, message: 'Server error fetching blog' });
  }
};

// Create a new blog
exports.createBlog = async (req, res) => {
  try {
    const blog = await Blog.create(withCleanSlug(req.body));

    // Trigger email broadcast if the blog is published
    queueBlogNewsletter(blog);

    res.status(201).json({ success: true, data: blog });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Blog with this slug already exists — change the slug' });
    }
    const invalid = validationMessage(error);
    if (invalid) return res.status(400).json({ success: false, message: invalid });
    logger.error('Error creating blog:', error);
    res.status(500).json({ success: false, message: 'Server error creating blog' });
  }
};

// Update an existing blog
exports.updateBlog = async (req, res) => {
  try {
    const blog = await Blog.findOneAndUpdate({ slug: req.params.slug }, withCleanSlug(req.body), {
      new: true,
      runValidators: true,
    });
    if (!blog) {
      return res.status(404).json({ success: false, message: 'Blog not found' });
    }

    // Trigger email broadcast if the blog was just published
    // Note: To be perfectly accurate we would check if it transitioned from draft to published,
    // but for simplicity we trigger if it's published. Ideally, add a 'newsletterSent' flag to avoid duplicates.
    queueBlogNewsletter(blog);

    res.status(200).json({ success: true, data: blog });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Blog with this slug already exists — change the slug' });
    }
    const invalid = validationMessage(error);
    if (invalid) return res.status(400).json({ success: false, message: invalid });
    logger.error('Error updating blog:', error);
    res.status(500).json({ success: false, message: 'Server error updating blog' });
  }
};

// Delete a blog
exports.deleteBlog = async (req, res) => {
  try {
    const blog = await Blog.findOneAndDelete({ slug: req.params.slug });
    if (!blog) {
      return res.status(404).json({ success: false, message: 'Blog not found' });
    }
    res.status(200).json({ success: true, message: 'Blog deleted' });
  } catch (error) {
    console.error('Error deleting blog:', error);
    res.status(500).json({ success: false, message: 'Server error deleting blog' });
  }
};

// Get admin blog list (includes unpublished)
exports.getAdminBlogs = async (req, res) => {
  try {
    const blogs = await Blog.find()
      .select('title slug category isPublished createdAt')
      .sort({ createdAt: -1 })
      .lean();
    res.status(200).json({ success: true, data: blogs });
  } catch (error) {
    console.error('Error fetching admin blogs:', error);
    res.status(500).json({ success: false, message: 'Server error fetching admin blogs' });
  }
};

// --- Settings Endpoints (Blog Hero) ---

// Get Blog Hero Settings
exports.getBlogHeroSettings = async (req, res) => {
  try {
    const settings = await Settings.findOne({ key: 'blogHero' }).lean();
    if (!settings) {
      // Return default if not set
      return res.status(200).json({
        success: true,
        data: {
          key: 'blogHero',
          value: {
            title: 'The Blog',
            description: 'Stay up to date on tips, tricks, & trends for social media & digital marketing. Explore our latest articles and insights.',
            tags: ['New', 'Insights & Trends']
          }
        }
      });
    }
    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    console.error('Error fetching blog hero settings:', error);
    res.status(500).json({ success: false, message: 'Server error fetching settings' });
  }
};

// Update Blog Hero Settings
exports.updateBlogHeroSettings = async (req, res) => {
  try {
    const { title, description, tags } = req.body;
    
    if (!title || !description) {
      return res.status(400).json({ success: false, message: 'Title and description are required' });
    }

    const value = { title, description, tags: tags || [] };

    const settings = await Settings.findOneAndUpdate(
      { key: 'blogHero' },
      { key: 'blogHero', value },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    console.error('Error updating blog hero settings:', error);
    res.status(500).json({ success: false, message: 'Server error updating settings' });
  }
};
