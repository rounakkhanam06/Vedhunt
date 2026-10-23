const Settings = require('../models/Settings');
const logger = require('../utils/logger');

// Blog posts are never seeded: the blog must only ever show posts created by
// an admin, and anything an admin deletes must stay deleted across restarts.
// Only the blog page hero text gets a default, and $setOnInsert means it is
// written once and never overwrites admin edits.
exports.seedBlogsAndSettings = async () => {
  try {
    await Settings.findOneAndUpdate(
      { key: 'blogHero' },
      {
        $setOnInsert: {
          key: 'blogHero',
          value: {
            title: 'The Blog',
            description: 'Stay up to date on tips, tricks, & trends for social media & digital marketing. Explore our latest articles and insights.',
            tags: ['New', 'Insights & Trends']
          }
        }
      },
      { upsert: true, new: true }
    );
    logger.info('Blog Hero Settings seeded successfully.');
  } catch (error) {
    logger.error('Error seeding blog settings:', error);
  }
};
