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

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-[#FF6B00]" /></div>;

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl sm:text-3xl font-bold text-app-text">Manage Blogs & Categories</h1>
        <Link to="/admin/blogs/create" className="bg-[#FF6B00] text-white font-semibold px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-[#e66000] transition-colors shadow-sm">
          <Plus size={20} />
          Create Blog
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex space-x-4 border-b border-app-border mb-6">
        <button
          onClick={() => setActiveTab('blogs')}
          className={`py-3 px-4 font-semibold border-b-2 transition-colors ${
            activeTab === 'blogs' 
              ? 'border-[#FF6B00] text-[#FF6B00]' 
              : 'border-transparent text-app-text-muted hover:border-gray-400 hover:text-app-text'
          }`}
        >
          Blogs
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={`py-3 px-4 font-semibold border-b-2 transition-colors ${
            activeTab === 'categories' 
              ? 'border-[#FF6B00] text-[#FF6B00]' 
              : 'border-transparent text-app-text-muted hover:border-gray-400 hover:text-app-text'
          }`}
        >
          Categories
        </button>
      </div>

      {activeTab === 'categories' ? (
        <BlogCategoryManager />
      ) : (
        <>
          <div className="bg-app-card border border-app-border rounded-xl p-6 shadow-sm">
            <h2 className="text-xl font-bold mb-4 text-app-text">Blog Hero Settings</h2>
            <form onSubmit={handleSaveHero} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-app-text">Title</label>
                <input 
                  type="text" 
                  value={heroData.title || ''} 
                  onChange={e => setHeroData({...heroData, title: e.target.value})}
                  className="w-full bg-form-input-bg border border-app-border rounded-lg px-4 py-2.5 text-app-text placeholder-app-text-muted focus:outline-none focus:border-[#FF6B00] transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-app-text">Description</label>
                <textarea 
                  value={heroData.description || ''} 
                  onChange={e => setHeroData({...heroData, description: e.target.value})}
                  className="w-full bg-form-input-bg border border-app-border rounded-lg px-4 py-2.5 text-app-text placeholder-app-text-muted focus:outline-none focus:border-[#FF6B00] min-h-[100px] transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-app-text">Tags (comma separated)</label>
                <input 
                  type="text" 
                  value={(heroData.tags || []).join(', ')} 
                  onChange={e => setHeroData({...heroData, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)})}
                  className="w-full bg-form-input-bg border border-app-border rounded-lg px-4 py-2.5 text-app-text placeholder-app-text-muted focus:outline-none focus:border-[#FF6B00] transition-colors"
                />
              </div>
              <button type="submit" disabled={heroSaving} className="bg-[#FF6B00] text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-[#e66000] transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm">
                {heroSaving ? <Loader2 size={16} className="animate-spin" /> : null}
                Save Hero Settings
              </button>
            </form>
          </div>

          <div className="bg-app-card border border-app-border rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead className="bg-surface-variant text-app-text-muted text-xs uppercase font-medium">
                <tr>
                  <th className="px-6 py-3 font-medium">Post</th>
                  <th className="px-6 py-3 font-medium">Category</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {blogs.map(blog => (
                  <tr key={blog._id} className="hover:bg-surface-variant transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        {blog.thumbnail ? (
                          <img src={blog.thumbnail} alt="" className="w-16 h-10 object-cover rounded-lg border border-app-border" />
                        ) : (
                          <div className="w-16 h-10 bg-surface-variant rounded-lg border border-app-border flex items-center justify-center text-xs text-app-text-muted">No Img</div>
                        )}
                        <div>
                          <h3 className="font-semibold text-app-text">{blog.title}</h3>
                          <p className="text-xs text-app-text-muted mt-0.5">/{blog.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 bg-surface-variant rounded-md text-xs font-medium text-app-text">
                        {blog.category}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${blog.isPublished ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'}`}>
                        {blog.isPublished ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <Link to={`/admin/blogs/edit/${blog.slug}`} className="p-2 text-app-text-muted hover:text-[#FF6B00] transition-colors bg-surface-variant rounded-lg" title="Edit">
                          <Edit2 size={16} />
                        </Link>
                        <button onClick={() => handleDeleteClick(blog.slug)} className="p-2 text-app-text-muted hover:text-red-500 transition-colors bg-surface-variant rounded-lg" title="Delete">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {blogs.length === 0 && (
                  <tr>
                    <td colSpan="4" className="px-6 py-8 text-center text-app-text-muted">
                      No blogs found. Create one to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Custom Delete Confirmation Modal */}
          {deleteTargetSlug && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-app-card border border-app-border rounded-2xl p-6 max-w-md w-full shadow-2xl"
              >
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Trash2 className="w-8 h-8 text-red-500" />
                  </div>
                  <h3 className="text-xl font-bold text-app-text mb-2">Delete Blog?</h3>
                  <p className="text-sm text-app-text-muted">
                    Are you sure you want to permanently delete this blog? This action cannot be undone.
                  </p>
                </div>
                
                <div className="flex gap-3">
                  <button 
                    onClick={() => setDeleteTargetSlug(null)}
                    className="flex-1 py-2.5 px-4 bg-surface-variant hover:bg-gray-200 dark:hover:bg-gray-700 text-app-text font-semibold rounded-lg border border-app-border transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={confirmDelete}
                    className="flex-1 py-2.5 px-4 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg shadow-sm transition-colors"
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
