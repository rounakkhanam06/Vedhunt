import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';

const SITE_NAME = 'Vedhunt InfoTech';
const ORIGIN = 'https://vedhunt.in';

/**
 * Title and description per public route.
 *
 * Every page previously served the same `<title>Vedhunt InfoTech</title>` from
 * index.html, so to a crawler they were indistinguishable on first fetch.
 */
const PAGE_META = {
  '/': {
    title: 'Vedhunt InfoTech | Digital Marketing & Web Development Agency in Navi Mumbai',
    description: 'Vedhunt InfoTech builds websites and mobile apps and runs performance marketing, SEO and social media for growing businesses. Based in Navi Mumbai.'
  },
  '/services': {
    title: 'Our Services | Web Development, Mobile Apps & Performance Marketing',
    description: 'Website development, mobile app development, social media management, performance marketing, accounting and MIS reporting services from Vedhunt InfoTech.'
  },
  '/portfolio': {
    title: 'Portfolio & Case Studies',
    description: 'Real projects and measurable results from our website, mobile app and digital marketing work.'
  },
  '/pricing': {
    title: 'Pricing Plans',
    description: 'Transparent pricing for website development, mobile apps and digital marketing retainers.'
  },
  '/about': {
    title: 'About Us',
    description: 'Who we are, how we work, and why growing businesses trust Vedhunt InfoTech with their digital presence.'
  },
  '/blog': {
    title: 'Blog & Insights',
    description: 'Practical articles on SEO, web development, mobile apps and paid advertising from the Vedhunt team.'
  },
  '/career': {
    title: 'Careers',
    description: 'Open roles at Vedhunt InfoTech in Navi Mumbai. Join a team building digital products and running campaigns that perform.'
  },
  '/faq': {
    title: 'Frequently Asked Questions',
    description: 'Answers to common questions about our services, timelines, pricing and process.'
  },
  '/get-quote': {
    title: 'Get a Quote',
    description: 'Tell us what you need and get a tailored proposal for your website, app or marketing campaign.'
  },
  '/privacy-policy': { title: 'Privacy Policy', description: 'How Vedhunt InfoTech collects, uses and protects your personal data.' },
  '/terms-and-conditions': { title: 'Terms & Conditions', description: 'The terms governing use of Vedhunt InfoTech services and website.' },
  '/cookie-policy': { title: 'Cookie Policy', description: 'How and why Vedhunt InfoTech uses cookies.' },
  '/data-processing-agreement': { title: 'Data Processing Agreement', description: 'Our data processing terms for clients and partners.' },
  '/refund-and-billing-policy': { title: 'Refund & Billing Policy', description: 'Billing cycles, refunds and cancellation terms for Vedhunt InfoTech services.' },
  '/sitemap': { title: 'Sitemap', description: 'Every page on Vedhunt InfoTech, in one place — services, blog articles, company and legal pages.' }
};

/**
 * `/service/:slug` is a legacy duplicate of `/services/:slug` and both render
 * the same page, so point the canonical at the one we publish in the sitemap.
 */
const canonicalFor = (pathname) => {
  const clean = pathname.replace(/\/+$/, '') || '/';
  const legacyService = clean.match(/^\/service\/([^/]+)$/);
  return `${ORIGIN}${legacyService ? `/services/${legacyService[1]}` : clean}`;
};

export default function RouteSeo() {
  const { pathname } = useLocation();
  const clean = pathname.replace(/\/+$/, '') || '/';
  const meta = PAGE_META[clean];
  const canonical = canonicalFor(pathname);

  // Detail pages set their own title and description from live content, so
  // only the canonical is contributed here. Helmet lets the deeper component
  // win for tags it also declares.
  return (
    <Helmet>
      <link rel="canonical" href={canonical} />
      {meta && <title>{meta.title}</title>}
      {meta && <meta name="description" content={meta.description} />}
      {meta && <meta property="og:title" content={meta.title} />}
      {meta && <meta property="og:description" content={meta.description} />}
      {meta && <meta property="og:url" content={canonical} />}
      {meta && <meta property="og:type" content="website" />}
      {meta && <meta property="og:site_name" content={SITE_NAME} />}
      {meta && <meta name="twitter:card" content="summary_large_image" />}
      {meta && <meta name="twitter:title" content={meta.title} />}
      {meta && <meta name="twitter:description" content={meta.description} />}
    </Helmet>
  );
}
