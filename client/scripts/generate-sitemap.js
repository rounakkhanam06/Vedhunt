import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DOMAIN = 'https://vedhunt.in';
const DESTINATION = path.resolve(__dirname, '../public/sitemap.xml');

// List of all static routes in the app
const routes = [
  { path: '/', priority: 1.0, changefreq: 'weekly' },
  { path: '/services', priority: 0.9, changefreq: 'weekly' },
  { path: '/portfolio', priority: 0.9, changefreq: 'weekly' },
  { path: '/pricing', priority: 0.9, changefreq: 'weekly' },
  { path: '/about', priority: 0.8, changefreq: 'weekly' },
  { path: '/blog', priority: 0.8, changefreq: 'weekly' },
  { path: '/career', priority: 0.8, changefreq: 'weekly' },
  { path: '/videos', priority: 0.8, changefreq: 'weekly' },
  { path: '/faq', priority: 0.8, changefreq: 'weekly' },
  { path: '/get-quote', priority: 0.8, changefreq: 'monthly' },
  { path: '/privacy-policy', priority: 0.5, changefreq: 'yearly' },
  { path: '/terms', priority: 0.5, changefreq: 'yearly' },
  { path: '/cookie-policy', priority: 0.5, changefreq: 'yearly' },
  { path: '/dpa', priority: 0.5, changefreq: 'yearly' },
  { path: '/refund-policy', priority: 0.5, changefreq: 'yearly' }
];

const generateSitemap = () => {
  const currentDate = new Date().toISOString();
  
  const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes.map(route => `  <url>
    <loc>${DOMAIN}${route.path}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority.toFixed(1)}</priority>
  </url>`).join('\n')}
</urlset>`;

  fs.writeFileSync(DESTINATION, sitemapContent, 'utf8');
  console.log(`Sitemap successfully generated at ${DESTINATION}`);
};

generateSitemap();
