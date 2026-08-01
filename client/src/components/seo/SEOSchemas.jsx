import { Helmet } from 'react-helmet-async';

export default function SEOSchemas() {
  const orgSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Vedhunt InfoTech",
    "url": "https://vedhunt.in/",
    "logo": "https://vedhunt.in/favicon.svg",
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": "+91-8652410289",
      "contactType": "customer service"
    },
    "sameAs": [
      "https://www.linkedin.com/company/vedhunt-infotech",
      "https://www.instagram.com/vedhunt/",
      "https://www.facebook.com/Vedhunt6"
    ]
  };

  // No SearchAction here: it previously advertised /search?q=, which is not a
  // route on this site. Declaring a search endpoint that 404s is a broken
  // claim in structured data, so it is simply omitted.
  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Vedhunt InfoTech",
    "url": "https://vedhunt.in/"
  };

  // The services we sell, as an explicit list pointing at each service page.
  // This is the clearest signal available for what the business offers and
  // which URLs cover each offering.
  const SERVICES = [
    ['Website Development', 'website-development', 'Custom websites and web applications built for performance and conversion.'],
    ['Mobile App Development', 'mobile-app-development', 'Native and cross-platform mobile apps for Android and iOS.'],
    ['Social Media Management', 'social-media-management', 'Content, community and campaign management across social platforms.'],
    ['Performance Marketing', 'performance-marketing', 'Paid acquisition on Meta and Google measured against revenue.'],
    ['Accounting & Financial Services', 'accounting-financial-services', 'Bookkeeping, compliance and financial reporting for growing businesses.'],
    ['MIS Reporting Services', 'mis-reporting-services', 'Dashboards and management reporting that make operations measurable.']
  ];

  const servicesSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "Services offered by Vedhunt InfoTech",
    "itemListElement": SERVICES.map(([name, slug, description], index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "item": {
        "@type": "Service",
        "name": name,
        "description": description,
        "url": `https://vedhunt.in/services/${slug}`,
        "provider": { "@type": "Organization", "name": "Vedhunt InfoTech", "url": "https://vedhunt.in/" },
        "areaServed": { "@type": "Country", "name": "India" }
      }
    }))
  };

  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "Vedhunt InfoTech",
    "image": "https://vedhunt.in/favicon.svg",
    "url": "https://vedhunt.in/",
    "telephone": "+91-8652410289",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Office No, 7th Floor, Everest Nivara Infotech Park, A-702, Indira Nagar, MIDC Industrial Area, Turbhe",
      "addressLocality": "Navi Mumbai",
      "addressRegion": "Maharashtra",
      "postalCode": "400705",
      "addressCountry": "IN"
    }
  };

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(orgSchema)}
      </script>
      <script type="application/ld+json">
        {JSON.stringify(websiteSchema)}
      </script>
      <script type="application/ld+json">
        {JSON.stringify(localBusinessSchema)}
      </script>
      <script type="application/ld+json">
        {JSON.stringify(servicesSchema)}
      </script>
    </Helmet>
  );
}
