const Service = require('../models/Service');
const Blog = require('../models/Blog');

const BASE_URL = 'https://vedhunt.in';

exports.generateSitemap = async (req, res, next) => {
  try {
    // 1. Define Static Core Pages
    const staticPages = [
      { url: '/', priority: 1.0, changefreq: 'weekly' },
      { url: '/services', priority: 0.9, changefreq: 'weekly' },
      { url: '/portfolio', priority: 0.9, changefreq: 'weekly' },
      { url: '/pricing', priority: 0.9, changefreq: 'weekly' },
      { url: '/about', priority: 0.8, changefreq: 'monthly' },
      { url: '/blog', priority: 0.8, changefreq: 'weekly' },
      { url: '/career', priority: 0.8, changefreq: 'monthly' },
      { url: '/videos', priority: 0.8, changefreq: 'monthly' },
      { url: '/faq', priority: 0.8, changefreq: 'monthly' },
      { url: '/contact', priority: 0.8, changefreq: 'yearly' }, // adding contact
      { url: '/get-quote', priority: 0.8, changefreq: 'monthly' },
      { url: '/privacy-policy', priority: 0.5, changefreq: 'yearly' },
      { url: '/terms', priority: 0.5, changefreq: 'yearly' },
      { url: '/cookie-policy', priority: 0.5, changefreq: 'yearly' },
      { url: '/dpa', priority: 0.5, changefreq: 'yearly' },
      { url: '/refund-policy', priority: 0.5, changefreq: 'yearly' }
    ];

    // 2. Fetch Active Dynamic Content
    // We only need slug and updatedAt for the sitemap
    const [services, blogs] = await Promise.all([
      Service.find({ isActive: true }).select('slug updatedAt').lean(),
      Blog.find({ isPublished: true }).select('slug updatedAt').lean()
    ]);

    // 3. Build XML String
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // Helper function to generate <url> block
    const generateUrlNode = (path, lastmod, changefreq, priority) => {
      // Ensure we format the date correctly for sitemap standard (ISO string or YYYY-MM-DD)
      const dateStr = lastmod instanceof Date ? lastmod.toISOString().split('T')[0] : lastmod;

      let node = `  <url>\n`;
      node += `    <loc>${BASE_URL}${path}</loc>\n`;
      if (dateStr) {
        node += `    <lastmod>${dateStr}</lastmod>\n`;
      }
      if (changefreq) {
        node += `    <changefreq>${changefreq}</changefreq>\n`;
      }
      if (priority) {
        node += `    <priority>${priority.toFixed(1)}</priority>\n`;
      }
      node += `  </url>\n`;
      return node;
    };

    // Get today's date for static pages
    const today = new Date().toISOString().split('T')[0];

    // Append static pages
    staticPages.forEach(page => {
      xml += generateUrlNode(page.url, today, page.changefreq, page.priority);
    });

    // Append Service pages
    services.forEach(service => {
      xml += generateUrlNode(`/services/${service.slug}`, service.updatedAt, 'weekly', 0.9);
    });

    // Append Blog pages
    blogs.forEach(blog => {
      xml += generateUrlNode(`/blog/${blog.slug}`, blog.updatedAt, 'monthly', 0.8);
    });

    xml += '</urlset>';

    // 4. Send Response
    res.header('Content-Type', 'application/xml');
    res.status(200).send(xml);
  } catch (error) {
    console.error('Error generating sitemap:', error);
    next(error); // Pass to global error handler
  }
};
