import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, ExternalLink, Clock, Award, Filter, ArrowRight } from 'lucide-react';

// Static video data
const VIDEOS_DATA = [
  {
    id: 1,
    title: 'Next-Gen SEO Strategy for E-Commerce',
    description: 'How we helped a leading retail brand achieve a 300% increase in organic traffic using our advanced SEO framework.',
    youtubeId: 'dQw4w9WgXcQ', // Placeholder ID
    category: 'SEO',
    thumbnail: 'https://images.unsplash.com/photo-1460925895917-afdab027452e?q=80&w=2426&auto=format&fit=crop',
    duration: '12:45',
    featured: true,
    clientLogo: 'https://images.unsplash.com/photo-1599305445671-ac291c9509c7?w=100&h=100&fit=crop&auto=format'
  },
  {
    id: 2,
    title: 'Brand Identity Redesign: Arctic Tech',
    description: 'A complete visual overhaul for a SaaS company, resulting in a 40% increase in user engagement.',
    youtubeId: 'dQw4w9WgXcQ',
    category: 'Branding',
    thumbnail: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2400&auto=format&fit=crop',
    duration: '08:20',
    featured: false,
    clientLogo: 'https://images.unsplash.com/photo-1599305445671-ac291c9509c7?w=100&h=100&fit=crop&auto=format'
  },
  {
    id: 3,
    title: 'High-Converting Marketing Campaign',
    description: 'Breakdown of our multi-channel marketing campaign that generated over $1M in revenue in 30 days.',
    youtubeId: 'dQw4w9WgXcQ',
    category: 'Marketing',
    thumbnail: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?q=80&w=2574&auto=format&fit=crop',
    duration: '15:10',
    featured: false,
    clientLogo: 'https://images.unsplash.com/photo-1599305445671-ac291c9509c7?w=100&h=100&fit=crop&auto=format'
  },
  {
    id: 4,
    title: 'Modern Web Design with 3D Elements',
    description: 'Exploring the process of building a cutting-edge website with Spline 3D and Framer Motion.',
    youtubeId: 'dQw4w9WgXcQ',
    category: 'Web Design',
    thumbnail: 'https://images.unsplash.com/photo-1547658719-da2b51169166?q=80&w=2564&auto=format&fit=crop',
    duration: '10:30',
    featured: false,
    clientLogo: 'https://images.unsplash.com/photo-1599305445671-ac291c9509c7?w=100&h=100&fit=crop&auto=format'
  },
  {
    id: 5,
    title: 'Custom App Development Case Study',
    description: 'How we built a scalable mobile application for a fintech startup from scratch.',
    youtubeId: 'dQw4w9WgXcQ',
    category: 'App Development',
    thumbnail: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?q=80&w=2600&auto=format&fit=crop',
    duration: '14:20',
    featured: false,
    clientLogo: 'https://images.unsplash.com/photo-1599305445671-ac291c9509c7?w=100&h=100&fit=crop&auto=format'
  },
  {
    id: 6,
    title: 'Advanced SEO: Link Building Techniques',
    description: 'Learn the ethical link building strategies we use to rank our clients on the first page of Google.',
    youtubeId: 'dQw4w9WgXcQ',
    category: 'SEO',
    thumbnail: 'https://images.unsplash.com/photo-1562577309-4932fdd64cd1?q=80&w=2574&auto=format&fit=crop',
    duration: '09:45',
    featured: false,
    clientLogo: 'https://images.unsplash.com/photo-1599305445671-ac291c9509c7?w=100&h=100&fit=crop&auto=format'
  }
];

const CATEGORIES = ['All', 'SEO', 'Marketing', 'Web Design', 'App Development', 'Branding'];

const Videos = () => {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [featuredVideo, setFeaturedVideo] = useState(VIDEOS_DATA.find(v => v.featured) || VIDEOS_DATA[0]);

  const filteredVideos = selectedCategory === 'All' 
    ? VIDEOS_DATA 
    : VIDEOS_DATA.filter(video => video.category === selectedCategory);

  return (
    <div className="min-h-screen bg-[#131313] text-white overflow-hidden">
      {/* Floating Glow Effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#FF6B00]/10 rounded-full filter blur-3xl opacity-50 -z-10 animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-[#FF6B00]/5 rounded-full filter blur-3xl opacity-30 -z-10" />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6">
        <div className="max-w-6xl mx-auto text-center relative z-10">
          <motion.span 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-[#FF6B00] text-sm font-black tracking-widest uppercase mb-4 block"
          >
            Video Showcase
          </motion.span>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-3xl md:text-4xl font-bold mb-6 tracking-tighter"
          >
            Client Success <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF6B00] to-[#FF8A00]">In Motion</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-white/60 text-sm md:text-base max-w-2xl mx-auto mb-8 leading-relaxed"
          >
            Explore our portfolio of successful projects through these in-depth video case studies and breakdowns.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            <button className="bg-[#FF6B00] text-white px-8 py-4 rounded-full font-bold hover:bg-[#FF8A00] transition-all duration-300 flex items-center gap-2 mx-auto group shadow-lg shadow-[#FF6B00]/20">
              Schedule a Call <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </motion.div>
        </div>
      </section>

      {/* Featured Video Section */}
      <section className="py-20 px-6 bg-[#0A0A0A]/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col lg:flex-row gap-12 items-center">
            {/* Video Player */}
            <div className="w-full lg:w-2/3">
              <div className="relative aspect-video rounded-2xl overflow-hidden shadow-2xl border border-white/10 group bg-black">
                <iframe
                  className="w-full h-full absolute inset-0"
                  src={`https://www.youtube.com/embed/${featuredVideo.youtubeId}?autoplay=0&rel=0`}
                  title={featuredVideo.title}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
                {/* Glow overlay on player */}
                <div className="absolute inset-0 border border-[#FF6B00]/20 pointer-events-none rounded-2xl group-hover:border-[#FF6B00]/40 transition-colors duration-500" />
              </div>
            </div>

            {/* Video Info */}
            <div className="w-full lg:w-1/3 space-y-6">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-[#FF6B00]/10 border border-[#FF6B00]/20 text-[#FF6B00] text-xs font-bold rounded-full">
                  Featured Case Study
                </span>
                <span className="flex items-center gap-1 text-white/40 text-xs font-bold">
                  <Clock size={14} /> {featuredVideo.duration}
                </span>
              </div>
              
              <h2 className="text-2xl font-bold tracking-tight">
                {featuredVideo.title}
              </h2>
              
              <p className="text-white/60 text-sm leading-relaxed">
                {featuredVideo.description}
              </p>

              <div className="flex items-center gap-4 pt-4 border-t border-white/5">
                <img 
                  src={featuredVideo.clientLogo} 
                  alt="Client Logo" 
                  className="w-10 h-10 rounded-full border border-white/10"
                />
                <div>
                  <p className="text-sm font-bold">Verified Client</p>
                  <p className="text-xs text-white/40">{featuredVideo.category} Results</p>
                </div>
              </div>

              <div className="pt-4">
                <a 
                  href={`https://youtube.com/watch?v=${featuredVideo.youtubeId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-[#FF6B00] font-bold hover:text-[#FF8A00] transition-colors group"
                >
                  Watch on YouTube <ExternalLink size={16} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Category Tabs & Grid */}
      <section className="py-20 px-6 relative">
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <div className="flex flex-col md:flex-row justify-between items-center mb-12 gap-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Explore All Videos</h2>
              <p className="text-white/60 text-sm">Filter by category to find relevant case studies.</p>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap items-center gap-2 bg-[#0A0A0A] p-1 rounded-full border border-white/5">
              {CATEGORIES.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-5 py-2 text-xs font-black tracking-wider uppercase rounded-full transition-all duration-300 relative ${
                    selectedCategory === category 
                    ? 'text-white' 
                    : 'text-white/40 hover:text-white'
                  }`}
                >
                  {selectedCategory === category && (
                    <motion.div 
                      layoutId="activeTab"
                      className="absolute inset-0 bg-[#FF6B00] rounded-full -z-10"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  {category}
                </button>
              ))}
            </div>
          </div>

          {/* Video Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <AnimatePresence mode="popLayout">
              {filteredVideos.map((video) => (
                <motion.div
                  key={video.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.4 }}
                  className="group relative bg-[#0A0A0A] rounded-2xl overflow-hidden border border-white/5 hover:border-[#FF6B00]/20 transition-all duration-500 flex flex-col h-full"
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-video overflow-hidden bg-black">
                    <img 
                      src={video.thumbnail} 
                      alt={video.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-70 group-hover:opacity-90"
                    />
                    
                    {/* Hover Glow */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#131313] via-transparent to-transparent opacity-60" />
                    
                    {/* Play Icon */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-[#FF6B00] flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform duration-300">
                        <Play size={20} className="text-white ml-0.5" />
                      </div>
                    </div>

                    {/* Duration Badge */}
                    <div className="absolute bottom-3 right-3 px-2 py-1 bg-black/80 rounded text-xs font-bold flex items-center gap-1 border border-white/10">
                      <Clock size={12} /> {video.duration}
                    </div>

                    {/* Category Badge */}
                    <div className="absolute top-3 left-3 px-3 py-1 bg-[#0A0A0A]/80 backdrop-blur-sm rounded-full text-[10px] font-black uppercase tracking-wider border border-white/10 text-white/80">
                      {video.category}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-6 flex flex-col flex-grow space-y-3">
                    <h3 className="text-base font-bold group-hover:text-[#FF6B00] transition-colors duration-300">
                      {video.title}
                    </h3>
                    
                    <p className="text-white/50 text-sm leading-relaxed flex-grow">
                      {video.description}
                    </p>

                    <div className="pt-4 flex justify-between items-center border-t border-white/5">
                      <button 
                        onClick={() => {
                          setFeaturedVideo(video);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="text-xs font-bold text-white/40 hover:text-[#FF6B00] transition-colors flex items-center gap-1"
                      >
                        Load in Player <ArrowRight size={14} />
                      </button>
                      
                      <a 
                        href={`https://youtube.com/watch?v=${video.youtubeId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-white/40 hover:text-[#FF6B00] transition-colors"
                      >
                        <ExternalLink size={16} />
                      </a>
                    </div>
                  </div>

                  {/* Hover Border Glow */}
                  <div className="absolute inset-0 border border-transparent group-hover:border-[#FF6B00]/10 pointer-events-none rounded-2xl transition-colors duration-500" />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* Premium Features Section (Netflix style or similar) */}
      <section className="py-20 px-6 bg-[#0A0A0A]/30">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <Award className="text-[#FF6B00]" size={28} />
            <h2 className="text-3xl font-bold">Premium Breakdowns</h2>
          </div>

          <div className="flex gap-6 overflow-x-auto pb-6 scrollbar-hide">
            {VIDEOS_DATA.filter(v => v.category === 'SEO' || v.category === 'Marketing').map((video) => (
              <div 
                key={`premium-${video.id}`}
                className="min-w-[300px] md:min-w-[400px] bg-[#0A0A0A] rounded-xl overflow-hidden border border-white/5 hover:border-[#FF6B00]/20 transition-all duration-300"
              >
                <div className="relative aspect-[16/9]">
                  <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <span className="text-[#FF6B00] text-xs font-bold uppercase mb-1 block">{video.category}</span>
                    <h3 className="text-base font-bold text-white">{video.title}</h3>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Videos;
