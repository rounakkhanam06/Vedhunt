import React from 'react';
import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

const BlogCard = ({ post }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="group flex flex-col h-full cursor-pointer bg-app-card border border-white/10 rounded-lg p-4 shadow-lg hover:border-primary/30 transition-all duration-500"
    >
      {/* Image and Vertical Category Container */}
      <div className="relative flex mb-6">
        {/* Vertical Category Label */}
        <div className="relative w-10 flex items-start justify-center">
          <span className="absolute top-0 rotate-180 [writing-mode:vertical-lr] text-[10px] font-black tracking-[0.3em] text-white/40 uppercase group-hover:text-primary transition-colors duration-300">
            {post.category}
          </span>
        </div>

        {/* Image - Reduced height with 16:9 aspect ratio */}
        <div className="flex-grow aspect-[2/1] overflow-hidden rounded-sm bg-white/5">
          <img
            src={post.image}
            alt={post.title}
            className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all duration-700 group-hover:scale-105"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col flex-grow pl-10">
        <h3 className="text-xl font-serif text-white mb-3 group-hover:text-primary transition-colors duration-300 leading-tight">
          {post.title}
        </h3>

        <p className="text-white/50 text-sm leading-relaxed mb-6 line-clamp-2">
          {post.excerpt}
        </p>

        <div className="mt-auto">
          <Link to={`/blog/${post.id}`} className="flex items-center gap-2 text-white/80 hover:text-primary italic font-serif text-sm transition-colors duration-300 group/btn">
            Read More
            <ArrowRight size={16} className="transition-transform duration-300 group-hover/btn:translate-x-1" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
};

export default BlogCard;
