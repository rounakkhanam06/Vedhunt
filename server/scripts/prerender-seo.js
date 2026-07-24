const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('Prerender SEO: No MONGODB_URI found in server/.env, skipping prerender.');
  process.exit(0);
}

// Minimal schemas to fetch data
const serviceSchema = new mongoose.Schema({
  title: String,
  slug: String,
  isActive: Boolean,
  metaTitle: String,
  metaDescription: String,
  shortDescription: String,
  imageUrl: String
}, { strict: false });

const servicePageSchema = new mongoose.Schema({
  serviceSlug: String,
  isActive: Boolean,
  metaTitle: String,
  metaDescription: String,
  ogImage: String,
  title: String
}, { strict: false });

const Service = mongoose.models.Service || mongoose.model('Service', serviceSchema);
const ServicePage = mongoose.models.ServicePage || mongoose.model('ServicePage', servicePageSchema);

async function prerenderSEO() {
  try {
    console.log('Connecting to MongoDB for SEO prerendering...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected.');

    const services = await Service.find({ isActive: true }).lean();
    const servicePages = await ServicePage.find({ isActive: true }).lean();

    const indexPath = path.resolve(__dirname, '../../client/dist/index.html');
    if (!fs.existsSync(indexPath)) {
      console.error('Prerender SEO: client/dist/index.html not found, skipping prerender.');
      return;
    }

    const baseHtml = fs.readFileSync(indexPath, 'utf8');

    const servicesDir = path.resolve(__dirname, '../../client/dist/services');
    if (!fs.existsSync(servicesDir)) {
      fs.mkdirSync(servicesDir, { recursive: true });
    }

    let generatedCount = 0;

    for (const service of services) {
      const slug = service.slug;
      const details = servicePages.find(p => p.serviceSlug === slug) || {};

      const ogTitle = details.metaTitle || service.metaTitle || details.title || service.title || 'Vedhunt Infotech Service';
      const ogDesc = details.metaDescription || service.metaDescription || service.shortDescription || 'Professional services by Vedhunt Infotech.';
      const ogImage = details.ogImage || service.imageUrl || 'https://vedhunt.in/og-banner.jpg';
      const canonicalUrl = `https://vedhunt.in/services/${slug}`;

      const safeTitle = ogTitle.replace(/"/g, '&quot;');
      const safeDesc = ogDesc.replace(/"/g, '&quot;');
      const safeImage = ogImage.replace(/"/g, '&quot;');

      const metaTags = `
    <title>${safeTitle}</title>
    <meta name="description" content="${safeDesc}" />
    <meta property="og:site_name" content="Vedhunt Infotech" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDesc}" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:image" content="${safeImage}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${safeDesc}" />
    <meta name="twitter:image" content="${safeImage}" />
  `;

      const newHtml = baseHtml.replace('</head>', `${metaTags}</head>`);

      const serviceSlugDir = path.join(servicesDir, slug);
      if (!fs.existsSync(serviceSlugDir)) {
        fs.mkdirSync(serviceSlugDir, { recursive: true });
      }
      
      fs.writeFileSync(path.join(serviceSlugDir, 'index.html'), newHtml, 'utf8');
      generatedCount++;
    }

    console.log(`Prerender SEO: Successfully generated ${generatedCount} static service pages.`);

  } catch (error) {
    console.error('Prerender SEO Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB connection closed.');
  }
}

prerenderSEO();
