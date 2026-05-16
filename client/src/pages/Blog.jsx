import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, ArrowRight, ArrowUpRight } from 'lucide-react';
import { BLOG_POSTS } from '../constants';
import BlogCard from '../components/ui/BlogCard';



const Blog = () => {
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const categories = ['All', 'Social Media', 'Wellness', 'Business', 'Copywriting', 'Development', 'SEO'];

  const filteredPosts = BLOG_POSTS.filter(post => {
    const matchesCategory = activeCategory === 'All' || post.category.toLowerCase() === activeCategory.toLowerCase();
    const matchesSearch = post.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          post.excerpt.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#0A0A0A] pt-20 pb-20">
      {/* Hero Section with Smoke Effect */}
      <section className="relative min-h-[35vh] flex items-center overflow-hidden mb-10">
        {/* Background Waves/Shapes based on inspiration */}
        <div className="absolute inset-0 z-0">
          {/* Fluid shape covering top right and going down */}
          <div className="absolute -top-20 -right-20 w-[60%] h-[120%] bg-gradient-to-bl from-[#FF8A00]/10 via-[#FF6B00]/5 to-transparent rounded-bl-[100px] transform rotate-12 filter blur-2xl" />
          
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0A0A0A]/50 to-[#0A0A0A]" />
        </div>

        <div className="w-full px-4 md:px-8 relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-left max-w-3xl"
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="px-3 py-1 bg-white/5 border border-white/10 text-primary text-[10px] font-black tracking-widest rounded-full uppercase">
                New
              </span>
              <span className="text-white/40 text-[10px] font-black tracking-widest uppercase">
                Insights & Trends
              </span>
            </div>
            
            <h1 className="text-4xl md:text-5xl font-serif text-white mb-4 tracking-tighter leading-none uppercase">
              The Blog
            </h1>
            
            <p className="text-white/60 text-sm md:text-base mb-6 max-w-2xl leading-relaxed">
              Stay up to date on tips, tricks, & trends for social media & digital marketing. Explore our latest articles and insights.
            </p>
          </motion.div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6">
        {/* Browse Section */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-8 mb-10 pb-6 border-b border-white/5">
          <span className="font-serif italic text-2xl text-white/60">Browse the blog :</span>
          <div className="flex flex-wrap items-center justify-center gap-8">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`text-[10px] font-black tracking-[0.2em] uppercase transition-all duration-300 ${
                  activeCategory === category 
                  ? 'text-primary' 
                  : 'text-white/40 hover:text-white'
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
            <div className="py-40 text-center">
              <h3 className="text-2xl text-white/40 font-bold">No articles found matching your criteria.</h3>
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
          className="mt-24 relative rounded-sm overflow-hidden bg-[#121212] border border-white/5 p-8 md:p-12 text-center"
        >
          <div className="relative z-10">
            <h2 className="text-3xl md:text-4xl font-serif text-white mb-4">Join the Community</h2>
            <p className="text-white/50 text-base mb-8 max-w-xl mx-auto italic font-serif">
              Subscribe to our newsletter for exclusive digital strategy insights.
            </p>
            <div className="flex flex-col md:flex-row items-center justify-center gap-0 max-w-lg mx-auto">
              <input
                type="email"
                placeholder="Enter your email"
                className="w-full bg-white/5 border border-white/10 py-3 px-6 text-white focus:outline-none focus:border-primary transition-all duration-300"
              />
              <button className="w-full md:w-auto bg-white text-black font-black px-8 py-3 hover:bg-primary transition-all duration-300 whitespace-nowrap uppercase text-[10px] tracking-widest">
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
