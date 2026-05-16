import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, User, Tag } from 'lucide-react';
import { BLOG_POSTS } from '../constants';

const BlogDetail = () => {
  const { id } = useParams();
  
  // Find the post by ID
  const post = BLOG_POSTS.find(p => p.id === parseInt(id) || p.id === id);

  if (!post) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col items-center justify-center">
        <h1 className="text-4xl font-serif mb-4">Post Not Found</h1>
        <Link to="/blog" className="text-primary hover:underline flex items-center gap-2">
          <ArrowLeft size={16} /> Back to Blog
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white pt-28 pb-20">
      <div className="max-w-4xl mx-auto px-4">
        {/* Back Button */}
        <Link to="/blog" className="text-white/60 hover:text-primary flex items-center gap-2 mb-8 transition-colors duration-300 w-fit">
          <ArrowLeft size={16} /> Back to Blog
        </Link>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center gap-3 mb-4">
            <span className="px-3 py-1 bg-white/5 border border-white/10 text-primary text-[10px] font-black tracking-widest rounded-full uppercase">
              {post.category}
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl font-serif text-white mb-6 leading-tight">
            {post.title}
          </h1>

          {/* Meta Info */}
          <div className="flex flex-wrap items-center gap-6 text-white/40 text-sm mb-10 pb-6 border-b border-white/5">
            <div className="flex items-center gap-2">
              <User size={14} className="text-primary" />
              <span>By Vedhunt Team</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-primary" />
              <span>May 16, 2026</span>
            </div>
            <div className="flex items-center gap-2">
              <Tag size={14} className="text-primary" />
              <span>{post.category}</span>
            </div>
          </div>
        </motion.div>

        {/* Image */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="aspect-[21/9] overflow-hidden rounded-lg mb-10 bg-white/5"
        >
          <img
            src={post.image}
            alt={post.title}
            className="w-full h-full object-cover"
          />
        </motion.div>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="prose prose-invert max-w-none"
        >
          <p className="text-white/80 text-lg leading-relaxed mb-6 font-serif italic">
            {post.excerpt}
          </p>
          
          <p className="text-white/60 text-base leading-relaxed mb-6">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
          </p>
          
          <p className="text-white/60 text-base leading-relaxed mb-6">
            Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit.
          </p>
          
          <p className="text-white/60 text-base leading-relaxed mb-6">
            At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident, similique sunt in culpa qui officia deserunt mollitia animi, id est laborum et dolorum fuga.
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default BlogDetail;
