import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, Map } from 'lucide-react';
import { SERVICES } from '../constants';
import api from '../services/api';

const STATIC_LINKS = {
  Main: [
    { to: '/', label: 'Home' },
    { to: '/about', label: 'About Us' },
    { to: '/services', label: 'Services' },
    { to: '/portfolio', label: 'Portfolio' },
    { to: '/pricing', label: 'Pricing' },
    { to: '/blog', label: 'Blog & Insights' },
    { to: '/career', label: 'Careers' },
    { to: '/faq', label: "FAQ's" },
    { to: '/get-quote', label: 'Get a Quote' }
  ],
  'Legal & Compliance': [
    { to: '/privacy-policy', label: 'Privacy Policy' },
    { to: '/terms-and-conditions', label: 'Terms & Conditions' },
    { to: '/cookie-policy', label: 'Cookie Policy' },
    { to: '/data-processing-agreement', label: 'Data Processing Agreement' },
    { to: '/refund-and-billing-policy', label: 'Refund & Billing Policy' }
  ]
};

export default function Sitemap() {
  const [blogs, setBlogs] = useState([]);

  useEffect(() => {
    let isMounted = true;
    api.get('/blogs')
      .then((res) => {
        if (isMounted && res.data?.success) setBlogs(res.data.data);
      })
      .catch((err) => console.error('Failed to fetch blogs for sitemap:', err));
    return () => { isMounted = false; };
  }, []);

  const sections = [
    { title: 'Main', links: STATIC_LINKS.Main },
    {
      title: 'Services',
      links: SERVICES.map((s) => ({ to: `/services/${s.slug}`, label: s.title }))
    },
    {
      title: 'Blog & Insights',
      links: blogs.map((b) => ({ to: `/blog/${b.slug || b._id}`, label: b.title }))
    },
    { title: 'Legal & Compliance', links: STATIC_LINKS['Legal & Compliance'] }
  ];

  return (
    <div className="min-h-screen bg-app-bg text-app-text pt-32 pb-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-14 space-y-4"
        >
          <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Map className="w-7 h-7" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold font-heading text-app-text tracking-tight">
            Sitemap
          </h1>
          <p className="text-sm text-app-text-muted max-w-lg mx-auto leading-relaxed">
            Every page on Vedhunt InfoTech, in one place.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-12">
          {sections.map((section) => (
            section.links.length > 0 && (
              <div key={section.title} className="space-y-4">
                <div className="relative pb-1">
                  <h2 className="text-app-text font-bold text-sm uppercase tracking-wider">
                    {section.title}
                  </h2>
                  <div className="absolute bottom-0 left-0 w-8 h-0.5 bg-primary rounded-full" />
                </div>
                <ul className="space-y-2.5">
                  {section.links.map((link) => (
                    <li key={link.to} className="flex items-center gap-2 group">
                      <ChevronRight className="w-4 h-4 text-primary shrink-0 transition-transform group-hover:translate-x-1" />
                      <Link
                        to={link.to}
                        className="text-sm text-app-text-muted hover:text-primary transition-colors duration-300 truncate"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )
          ))}
        </div>
      </div>
    </div>
  );
}
