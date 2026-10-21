import React from 'react';
import { formatCategory } from '../../utils/formatCategory';
import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

const BlogCard = ({ post }) => {
  return (
    <Link to={`/blog/${post.slug || post.id}`} className="block h-full no-underline">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="group flex flex-col h-full cursor-pointer glass-panel bg-app-card border border-app-border rounded-lg p-4 shadow-lg hover:border-primary/30 hover:-translate-y-1 transition-all duration-500"
      >
        {/* Image with Category Label */}
        <div className="relative flex mb-6">
          {/* Category Label */}
          <span
            title={formatCategory(post.category)}
            className="absolute top-3 left-3 z-10 max-w-[calc(100%-1.5rem)] truncate text-xs font-bold tracking-wide bg-primary text-black px-3 py-1 rounded-full shadow-[0_4px_10px_rgba(255,107,0,0.3)]"
          >
            {formatCategory(post.category)}
          </span>

          {/* Image - Reduced height with 16:9 aspect ratio */}
          <div className="flex-grow aspect-[2/1] overflow-hidden rounded-sm bg-app-bg">
            <img
              src={post.thumbnail || post.image}
              alt={post.title}
              className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all duration-700 group-hover:scale-105"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-col flex-grow">
          <h3 className="text-xl font-heading font-bold text-app-text mb-3 group-hover:text-primary transition-colors duration-300 leading-tight">
            {post.title}
          </h3>

          <p className="text-app-text-muted text-sm leading-relaxed mb-6 line-clamp-2">
            {post.excerpt}
          </p>

          <div className="mt-auto">
            <div className="flex items-center gap-2 text-app-text hover:text-primary italic font-serif text-sm transition-colors duration-300 group/btn">
              Read More
              <ArrowRight size={16} className="transition-transform duration-300 group-hover/btn:translate-x-1" />
            </div>
          </div>
        </div>
      </motion.div>
    </Link>
  );
};

export default BlogCard;
