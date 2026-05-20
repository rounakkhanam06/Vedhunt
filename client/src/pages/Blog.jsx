import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, ArrowRight, ArrowUpRight } from 'lucide-react';
import { BLOG_POSTS } from '../constants';
import BlogCard from '../components/ui/BlogCard';

const Blog = () => {
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Dynamically extract and format categories from BLOG_POSTS
  const dynamicCategories = ['All', ...new Set(BLOG_POSTS.map(post => {
    return post.category.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
  }))];

  const filteredPosts = BLOG_POSTS.filter(post => {
    const formattedPostCategory = post.category.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
    const matchesCategory = activeCategory === 'All' || formattedPostCategory === activeCategory;
    const matchesSearch = post.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          post.excerpt.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="bg-app-bg text-app-text-muted min-h-screen pt-24 pb-20 mesh-grid relative overflow-hidden">
      {/* Hero Section */}
      <section className="relative min-h-[35vh] flex items-center overflow-hidden mb-10">
        <div className="absolute inset-0 z-0">
          <div className="absolute -top-20 -right-20 w-[60%] h-[120%] bg-gradient-to-bl from-primary/10 via-primary/5 to-transparent rounded-bl-[100px] transform rotate-12 filter blur-2xl" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-app-bg/50 to-app-bg" />
        </div>

        <div className="w-full px-4 md:px-8 relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center max-w-3xl mx-auto"
          >
            <div className="flex items-center justify-center gap-3 mb-4">
              <span className="px-3 py-1 bg-primary/10 border border-primary/20 text-primary text-[10px] font-black tracking-widest rounded-full uppercase">
                New
              </span>
              <span className="text-app-text-muted text-[10px] font-black tracking-widest uppercase">
                Insights & Trends
              </span>
            </div>
            
            <h1 className="text-4xl md:text-5xl font-heading font-black text-app-text mb-4 tracking-tighter leading-none uppercase">
              The Blog
            </h1>
            
            <p className="text-app-text-muted text-sm md:text-base mb-6 max-w-2xl mx-auto leading-relaxed">
              Stay up to date on tips, tricks, & trends for social media & digital marketing. Explore our latest articles and insights.
            </p>
          </motion.div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6 relative z-10">
        
        {/* Search Input Box */}
        <div className="relative w-full max-w-xl mx-auto mb-10">
          <input
            type="text"
            placeholder="Search articles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-app-card/50 border border-app-border rounded-full py-3.5 pl-12 pr-6 text-app-text placeholder-app-text-muted/60 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all duration-300 shadow-sm text-sm"
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-app-text-muted/60 w-5 h-5" />
        </div>

        {/* Browse Section */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-8 mb-10 pb-6 border-b border-app-border/40">
          <span className="font-heading font-bold text-lg text-app-text-muted">Browse by :</span>
          <div className="flex flex-wrap items-center justify-center gap-8">
            {dynamicCategories.map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`text-[10px] font-black tracking-[0.2em] uppercase transition-all duration-300 ${
                  activeCategory === category 
                  ? 'text-primary' 
                  : 'text-app-text-muted hover:text-app-text'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Blog Grid */}
        <div className="mt-10">
          {filteredPosts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-24">
              {filteredPosts.map((post) => (
                <BlogCard 
                  key={post.id} 
                  post={post} 
                />
              ))}
            </div>
          ) : (
            <div className="py-20 text-center">
              <h3 className="text-2xl text-app-text-muted font-bold">No articles found matching your criteria.</h3>
              <button 
                onClick={() => {setActiveCategory('All'); setSearchQuery('');}}
                className="mt-6 text-primary font-bold hover:underline"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>

        {/* Newsletter Section */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="mt-24 glass-panel rounded-3xl p-8 md:p-12 bg-gradient-to-br from-app-card/90 via-app-card/75 to-app-bg border border-app-border relative overflow-hidden orange-glow shadow-2xl text-center"
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary/5 rounded-full filter blur-[100px] pointer-events-none" />
          
          <div className="relative z-10">
            <h2 className="text-3xl md:text-4xl font-heading font-black text-app-text mb-4">Join the Community</h2>
            <p className="text-app-text-muted text-base mb-8 max-w-xl mx-auto font-medium">
              Subscribe to our newsletter for exclusive digital strategy insights.
            </p>
            <div className="flex flex-col md:flex-row items-center justify-center gap-3 max-w-lg mx-auto">
              <input
                type="email"
                placeholder="Enter your email"
                className="w-full bg-app-bg border border-app-border rounded-lg py-3.5 px-6 text-app-text focus:outline-none focus:border-primary transition-all duration-300"
              />
              <button className="w-full md:w-auto bg-primary text-black font-black px-8 py-3.5 rounded-lg hover:bg-primary-hover hover:shadow-[0_0_25px_rgba(255,107,0,0.45)] transition-all duration-300 whitespace-nowrap uppercase text-[10px] tracking-widest">
                Subscribe
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Blog;
