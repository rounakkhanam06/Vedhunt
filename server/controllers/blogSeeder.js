const Blog = require('../models/Blog');
const Settings = require('../models/Settings');
const logger = require('../utils/logger');
const crypto = require('crypto');

const legacyBlogs = [
  {
    title: 'The Future of Web Development: What to Expect in 2026',
    category: 'DEVELOPMENT',
    excerpt: 'Explore the latest trends in web development, from AI-driven coding to the rise of edge computing and micro-frontends.',
    image: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?q=80&w=800&h=500&fit=crop',
    author: 'Andrew Wills'
  },
  {
    title: 'Mastering Brand Identity in a Digital-First World',
    category: 'BRANDING',
    excerpt: 'How to build a brand that resonates with modern consumers and stands out in an increasingly crowded digital marketplace.',
    image: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?q=80&w=800&h=500&fit=crop',
    author: 'Alisha Smith'
  },
  {
    title: 'Maximizing ROI: Strategies for High-Performance Ad Campaigns',
    category: 'MARKETING',
    excerpt: 'Learn the secrets of running successful PPC campaigns that drive conversions and scale your business growth.',
    image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=800&h=500&fit=crop',
    author: 'Robert White'
  },
  {
    title: 'The Power of Data: Transforming Business Intelligence with Power BI',
    category: 'STRATEGY',
    excerpt: 'Unlock the potential of your business data with interactive dashboards and real-time analytics for better decision making.',
    image: 'https://images.unsplash.com/photo-1454165833767-027ffea9e778?q=80&w=800&h=500&fit=crop',
    author: 'Sarah George'
  },
  {
    title: 'Mobile App Trends: Creating Seamless User Experiences',
    category: 'MOBILE APPS',
    excerpt: 'A deep dive into the latest mobile app design patterns and technologies that are defining the next generation of mobile apps.',
    image: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?q=80&w=800&h=500&fit=crop',
    author: 'Andrew Wills'
  },
  {
    title: 'SEO Secrets: Dominating Search Rankings in 2026',
    category: 'SEO',
    excerpt: 'Everything you need to know about search engine optimization in the era of AI-powered search and semantic understanding.',
    image: 'https://images.unsplash.com/photo-1571721795195-a2ca2d3370a9?q=80&w=800&h=500&fit=crop',
    author: 'Robert White'
  }
];

const generateSlug = (title) => {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
};

exports.seedBlogsAndSettings = async () => {
  try {
    // 1. Seed Blog Hero Settings
    await Settings.findOneAndUpdate(
      { key: 'blogHero' },
      {
        $setOnInsert: {
          key: 'blogHero',
          value: {
            title: 'THE BLOG',
            description: 'Stay up to date on tips, tricks, & trends for social media & digital marketing. Explore our latest articles and insights.',
            tags: ['New', 'Insights & Trends']
          }
        }
      },
      { upsert: true, new: true }
    );
    logger.info('Blog Hero Settings seeded successfully.');

    // 2. Seed Legacy Blogs
    for (const blog of legacyBlogs) {
      const slug = generateSlug(blog.title);
      
      // We will map the excerpt to a paragraph block for detailed view
      const contentBlocks = [
        {
          id: crypto.randomUUID(),
          type: 'paragraph',
          data: {
            text: blog.excerpt
          }
        },
        {
          id: crypto.randomUUID(),
          type: 'image',
          data: {
            url: blog.image,
            caption: blog.title
          }
        },
        {
          id: crypto.randomUUID(),
          type: 'paragraph',
          data: {
            text: 'This is a seeded blog post. You can edit or replace this content in the admin dashboard.'
          }
        }
      ];

      await Blog.findOneAndUpdate(
        { slug: slug },
        {
          $setOnInsert: {
            title: blog.title,
            slug: slug,
            category: blog.category,
            excerpt: blog.excerpt,
            thumbnail: blog.image,
            author: blog.author,
            contentBlocks: contentBlocks,
            isPublished: true,
          }
        },
        { upsert: true, new: true }
      );
    }
    
    logger.info('Legacy blogs seeded successfully.');
  } catch (error) {
    logger.error('Error seeding blogs and settings:', error);
  }
};
