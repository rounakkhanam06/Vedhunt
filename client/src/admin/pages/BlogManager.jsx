import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Edit2, Trash2, Search, Link as LinkIcon, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import BlogCategoryManager from './BlogCategoryManager';

const BlogManager = () => {
  const [blogs, setBlogs] = useState([]);
  const [heroData, setHeroData] = useState({ title: '', description: '', tags: [] });
  const [loading, setLoading] = useState(true);
  const [heroSaving, setHeroSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('blogs'); // 'blogs' or 'categories'
  const navigate = useNavigate();

  const [deleteTargetSlug, setDeleteTargetSlug] = useState(null);

  const fetchBlogs = async () => {
    try {
      const response = await api.get('/blogs/admin/all'); // Admin route fetches ALL (including drafts)
      const result = response.data;
      if (result.success) {
        setBlogs(result.data);
      }
    } catch (error) {
      console.error('Error fetching blogs:', error);
    }
  };

  const fetchHero = async () => {
    try {
      const response = await api.get('/blogs/hero');
      const result = response.data;
      if (result.success && result.data && result.data.value) {
        setHeroData(result.data.value);
      }
    } catch (error) {
      console.error('Error fetching hero data:', error);
    }
  };

  useEffect(() => {
    Promise.all([fetchBlogs(), fetchHero()]).finally(() => setLoading(false));
  }, []);

  const handleSaveHero = async (e) => {
    e.preventDefault();
    setHeroSaving(true);
    try {
      const response = await api.put('/blogs/admin/hero', heroData);
      if (response.status === 200) {
        alert('Hero updated successfully!');
      } else {
        alert('Failed to update hero');
      }
    } catch (error) {
      console.error('Error updating hero:', error);
    } finally {
      setHeroSaving(false);
    }
  };

  const handleDeleteClick = (slug) => {
    setDeleteTargetSlug(slug);
  };

  const confirmDelete = async () => {
    if (!deleteTargetSlug) return;
    try {
      const response = await api.delete(`/blogs/${deleteTargetSlug}`);
      if (response.status === 200) {
        fetchBlogs();
      } else {
        alert('Failed to delete blog');
      }
    } catch (error) {
      console.error('Error deleting blog:', error);
    } finally {
      setDeleteTargetSlug(null);
    }
  };

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-heading font-bold text-on-surface">Manage Blogs & Categories</h1>
        <Link to="/admin/blogs/create" className="bg-primary text-black font-bold px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-primary-hover transition-colors">
          <Plus size={20} />
          Create Blog
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex space-x-4 border-b border-outline-variant mb-6">
        <button
          onClick={() => setActiveTab('blogs')}
          className={`py-2 px-4 font-bold border-b-2 transition-colors ${
            activeTab === 'blogs' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          Blogs
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={`py-2 px-4 font-bold border-b-2 transition-colors ${
            activeTab === 'categories' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-on-surface-variant hover:text-on-surface'
          }`}
        >
          Categories
        </button>
      </div>

      {activeTab === 'categories' ? (
        <BlogCategoryManager />
      ) : (
        <>
          <div className="bg-surface-container-low border border-outline-variant rounded-xl p-6">
        <h2 className="text-xl font-bold mb-4">Blog Hero Settings</h2>
        <form onSubmit={handleSaveHero} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-on-surface-variant">Title</label>
            <input 
              type="text" 
              value={heroData.title || ''} 
              onChange={e => setHeroData({...heroData, title: e.target.value})}
              className="w-full bg-surface border border-outline-variant rounded-lg px-4 py-2 text-on-surface focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-on-surface-variant">Description</label>
            <textarea 
              value={heroData.description || ''} 
              onChange={e => setHeroData({...heroData, description: e.target.value})}
              className="w-full bg-surface border border-outline-variant rounded-lg px-4 py-2 text-on-surface focus:outline-none focus:border-primary min-h-[100px]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-on-surface-variant">Tags (comma separated)</label>
            <input 
              type="text" 
              value={(heroData.tags || []).join(', ')} 
              onChange={e => setHeroData({...heroData, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)})}
              className="w-full bg-surface border border-outline-variant rounded-lg px-4 py-2 text-on-surface focus:outline-none focus:border-primary"
            />
          </div>
          <button type="submit" disabled={heroSaving} className="bg-surface-variant text-on-surface font-bold px-4 py-2 rounded-lg hover:bg-primary hover:text-black transition-colors disabled:opacity-50 flex items-center gap-2">
            {heroSaving ? <Loader2 size={16} className="animate-spin" /> : null}
            Save Hero Settings
          </button>
        </form>
      </div>

      <div className="bg-surface-container-low border border-outline-variant rounded-xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-surface-variant text-on-surface-variant text-sm uppercase">
            <tr>
              <th className="px-6 py-4 font-medium">Post</th>
              <th className="px-6 py-4 font-medium">Category</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {blogs.map(blog => (
              <tr key={blog._id} className="hover:bg-surface-variant/30 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-4">
                    {blog.thumbnail ? (
                      <img src={blog.thumbnail} alt="" className="w-16 h-10 object-cover rounded" />
                    ) : (
                      <div className="w-16 h-10 bg-surface-variant rounded flex items-center justify-center">No Img</div>
                    )}
                    <div>
                      <h3 className="font-bold text-on-surface">{blog.title}</h3>
                      <p className="text-xs text-on-surface-variant mt-1">/{blog.slug}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 bg-surface-variant rounded-md text-xs font-medium">
                    {blog.category}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-md text-xs font-medium ${blog.isPublished ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
                    {blog.isPublished ? 'Published' : 'Draft'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex justify-end gap-2">
                    <Link to={`/admin/blogs/edit/${blog.slug}`} className="p-2 text-on-surface-variant hover:text-primary transition-colors bg-surface rounded-lg">
                      <Edit2 size={18} />
                    </Link>
                    <button onClick={() => handleDeleteClick(blog.slug)} className="p-2 text-on-surface-variant hover:text-error transition-colors bg-surface rounded-lg">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {blogs.length === 0 && (
              <tr>
                <td colSpan="4" className="px-6 py-8 text-center text-on-surface-variant">
                  No blogs found. Create one to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {/* Custom Delete Confirmation Modal */}
      {deleteTargetSlug && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-surface-container-high border border-outline-variant rounded-2xl p-6 max-w-md w-full shadow-2xl"
          >
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-error/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-error" />
              </div>
              <h3 className="text-xl font-bold text-on-surface mb-2">Delete Blog?</h3>
              <p className="text-sm text-on-surface-variant">
                Are you sure you want to permanently delete this blog? This action cannot be undone.
              </p>
            </div>
            
            <div className="flex gap-3">
              <button 
                onClick={() => setDeleteTargetSlug(null)}
                className="flex-1 py-3 px-4 bg-surface-variant hover:bg-surface-variant/80 text-on-surface-variant font-bold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete}
                className="flex-1 py-3 px-4 bg-error hover:bg-error/90 text-white font-bold rounded-xl transition-colors"
              >
                Delete
              </button>
            </div>
          </motion.div>
        </div>
      )}
        </>
      )}
    </div>
  );
};

export default BlogManager;
