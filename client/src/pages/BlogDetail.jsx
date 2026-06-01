import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, User, Tag } from 'lucide-react';
import api from '../services/api';

// Block Components
const TextBlock = ({ text }) => (
  <p className="text-app-text-muted text-base leading-relaxed mb-6 font-serif">
    {text}
  </p>
);

const HeadingBlock = ({ text, level }) => {
  const TagName = `h${level || 2}`;
  return (
    <TagName className="text-app-text font-heading font-bold mb-4 mt-8">
      {text}
    </TagName>
  );
};

const ImageBlock = ({ url, caption }) => (
  <figure className="mb-8">
    <div className="aspect-[21/9] overflow-hidden rounded-lg bg-app-card/30 border border-app-border/40">
      <img src={url} alt={caption || "Blog image"} className="w-full h-full object-cover" />
    </div>
    {caption && <figcaption className="text-center text-sm text-app-text-muted mt-2 italic">{caption}</figcaption>}
  </figure>
);

const QuoteBlock = ({ text, author }) => (
  <blockquote className="border-l-4 border-primary pl-4 my-8 italic">
    <p className="text-app-text text-lg mb-2">{text}</p>
    {author && <footer className="text-sm text-primary">— {author}</footer>}
  </blockquote>
);

const DefaultBlock = () => null;

const blockRenderer = {
  paragraph: TextBlock,
  heading: HeadingBlock,
  image: ImageBlock,
  quote: QuoteBlock,
};

const BlogDetail = () => {
  const { id: slug } = useParams(); // Using the existing route parameter name ':id' as 'slug'
  
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBlog = async () => {
      try {
        const response = await api.get(`/blogs/${slug}`);
        const result = response.data;
        if (result.success) {
          setPost(result.data);
        }
      } catch (error) {
        console.error("Error fetching blog details:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchBlog();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-app-bg text-app-text flex flex-col items-center justify-center mesh-grid">
        <h1 className="text-2xl font-heading font-bold mb-4">Loading Post...</h1>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-app-bg text-app-text flex flex-col items-center justify-center mesh-grid">
        <h1 className="text-4xl font-heading font-bold mb-4">Post Not Found</h1>
        <Link to="/blog" className="text-primary hover:underline flex items-center gap-2">
          <ArrowLeft size={16} /> Back to Blog
        </Link>
      </div>
    );
  }

  const formattedDate = new Date(post.createdAt || new Date()).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <div className="min-h-screen bg-app-bg text-app-text-muted pt-28 pb-20 mesh-grid relative overflow-hidden">
      <div className="max-w-4xl mx-auto px-4 relative z-10">
        {/* Back Button */}
        <Link to="/blog" className="text-app-text-muted hover:text-primary flex items-center gap-2 mb-8 transition-colors duration-300 w-fit">
          <ArrowLeft size={16} /> Back to Blog
        </Link>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center gap-3 mb-4">
            <span className="px-3 py-1 bg-primary/10 border border-primary/20 text-primary text-[10px] font-black tracking-widest rounded-full uppercase">
              {post.category}
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl font-heading font-bold text-app-text mb-6 leading-tight">
            {post.title}
          </h1>

          {/* Meta Info */}
          <div className="flex flex-wrap items-center gap-6 text-app-text-muted text-sm mb-10 pb-6 border-b border-app-border/40">
            <div className="flex items-center gap-2">
              <User size={14} className="text-primary" />
              <span>By {post.author || 'Vedhunt Team'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-primary" />
              <span>{formattedDate}</span>
            </div>
            <div className="flex items-center gap-2">
              <Tag size={14} className="text-primary" />
              <span>{post.category}</span>
            </div>
          </div>
        </motion.div>

        {/* Image */}
        {post.thumbnail && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="aspect-[21/9] overflow-hidden rounded-lg mb-10 bg-app-card/30 border border-app-border/40"
          >
            <img
              src={post.thumbnail}
              alt={post.title}
              className="w-full h-full object-cover"
            />
          </motion.div>
        )}

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="prose dark:prose-invert max-w-none text-app-text-muted"
        >
          {post.excerpt && (
            <p className="text-app-text text-lg leading-relaxed mb-6 font-serif italic">
              {post.excerpt}
            </p>
          )}
          
          {post.contentBlocks && post.contentBlocks.map((block) => {
            const BlockComponent = blockRenderer[block.type] || DefaultBlock;
            return <BlockComponent key={block.id || Math.random()} {...block.data} />;
          })}
        </motion.div>
      </div>
    </div>
  );
};

export default BlogDetail;
