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

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Vedhunt InfoTech",
    "url": "https://vedhunt.in/",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://vedhunt.in/search?q={search_term_string}",
      "query-input": "required name=search_term_string"
    }
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
    </Helmet>
  );
}
