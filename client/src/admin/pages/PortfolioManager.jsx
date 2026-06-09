import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Loader, Edit2, Trash2, Plus, Image as ImageIcon, Laptop, Database, Share2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import PortfolioMetricsManager from './PortfolioMetricsManager';
import PortfolioCTAManager from './PortfolioCTAManager';
import PortfolioHeroManager from './PortfolioHeroManager';

export default function PortfolioManager() {
  const [portfolios, setPortfolios] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [activeTab, setActiveTab] = useState('showcases');
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, itemId: null });
  const [isDeleting, setIsDeleting] = useState(false);
  
  const initialFormState = {
    title: '',
    clientUrl: '',
    category: 'development',
    tagline: '',
    description: '',
    tags: '',
    image: '',
    statLabel: '',
    statValue: '',
    icon: 'Laptop',
    featured: false,
    displayOrder: 0,
    status: 'active'
  };

  const [formData, setFormData] = useState(initialFormState);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    fetchPortfolios();
  }, []);

  const fetchPortfolios = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/portfolio/admin');
      setPortfolios(res.data.data || []);
    } catch (error) {
      toast.error('Failed to load portfolios');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const deletePortfolio = (id) => {
    setDeleteModal({ isOpen: true, itemId: id });
  };

  const confirmDelete = async () => {
    if (!deleteModal.itemId) return;
    setIsDeleting(true);
    try {
      await api.delete(`/portfolio/${deleteModal.itemId}`);
      toast.success('Portfolio item deleted successfully');
      setDeleteModal({ isOpen: false, itemId: null });
      fetchPortfolios();
    } catch (error) {
      toast.error('Failed to delete portfolio');
      console.error(error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const data = new FormData();
    data.append('image', file);

    setIsUploading(true);
    try {
      const res = await api.post('/upload', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.url) {
        setFormData({ ...formData, image: res.data.url });
        toast.success('Image uploaded successfully!');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to upload image');
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Check displayOrder uniqueness on the client side
    const duplicateOrderExists = portfolios.some(item => 
      item.displayOrder === formData.displayOrder && item._id !== editingId
    );

    if (duplicateOrderExists) {
      toast.error(`Display Order ${formData.displayOrder} is already assigned to another card! Please give a unique display order.`);
      return;
    }

    setIsSaving(true);
    
    // Convert tags string to array
    const dataToSubmit = {
      ...formData,
      tags: typeof formData.tags === 'string' 
        ? formData.tags.split(',').map(tag => tag.trim()).filter(Boolean)
        : formData.tags
    };

    try {
      if (editingId) {
        await api.put(`/portfolio/${editingId}`, dataToSubmit);
        toast.success('Portfolio item updated successfully!');
      } else {
        await api.post('/portfolio', dataToSubmit);
        toast.success('Portfolio item added successfully!');
      }
      setIsModalOpen(false);
      setFormData(initialFormState);
      setEditingId(null);
      fetchPortfolios();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save portfolio item');
    } finally {
      setIsSaving(false);
    }
  };

  const openAddModal = () => {
    setEditingId(null);
    setFormData(initialFormState);
    setIsModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingId(item._id);
    setFormData({
      title: item.title,
      clientUrl: item.clientUrl,
      category: item.category,
      tagline: item.tagline,
      description: item.description,
      tags: item.tags ? item.tags.join(', ') : '',
      image: item.image,
      statLabel: item.statLabel,
      statValue: item.statValue,
      icon: item.icon,
      featured: item.featured || false,
      displayOrder: item.displayOrder || 0,
      status: item.status || 'active'
    });
    setIsModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {isModalOpen ? (
        // Full Page Form View
        <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-8">
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/10">
            <div>
              <h2 className="text-2xl font-bold text-white">
                {editingId ? 'Edit Showcase' : 'Add New Showcase'}
              </h2>
              <p className="text-gray-400 text-sm mt-1">Provide the details for this showcase project.</p>
            </div>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-5 py-2 border border-white/10 rounded-lg text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
            >
              Back to List
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-medium text-gray-300 block mb-2">Title *</label>
                <input
                  required
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Visionsfinity Shipping"
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300 block mb-2">Client URL *</label>
                <input
                  required
                  type="url"
                  value={formData.clientUrl}
                  onChange={e => setFormData({ ...formData, clientUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-medium text-gray-300 block mb-2">Category *</label>
                <select
                  required
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary"
                >
                  <option value="development">Web & App Engineering</option>
                  <option value="automation">Automation & Business Finance</option>
                  <option value="marketing">SEO & Growth Marketing</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300 block mb-2">Show on Main Portfolio Page? *</label>
                <select
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value })}
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary"
                >
                  <option value="active">Yes, show on main Portfolio page</option>
                  <option value="inactive">No, hide from main Portfolio page (Draft)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-300 block mb-2">Tagline *</label>
              <input
                required
                type="text"
                value={formData.tagline}
                onChange={e => setFormData({ ...formData, tagline: e.target.value })}
                placeholder="e.g. Global Freight & Logistic Visualizers"
                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-300 block mb-2">Description *</label>
              <textarea
                required
                rows={4}
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="A detailed description of the project..."
                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary resize-none"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-300 block mb-2">Tags (Comma separated) *</label>
              <input
                required
                type="text"
                value={formData.tags}
                onChange={e => setFormData({ ...formData, tags: e.target.value })}
                placeholder="React, Node.js, MongoDB"
                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-medium text-gray-300 block mb-2">Stat Label *</label>
                <input
                  required
                  type="text"
                  value={formData.statLabel}
                  onChange={e => setFormData({ ...formData, statLabel: e.target.value })}
                  placeholder="Lighthouse Score"
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300 block mb-2">Stat Value *</label>
                <input
                  required
                  type="text"
                  value={formData.statValue}
                  onChange={e => setFormData({ ...formData, statValue: e.target.value })}
                  placeholder="98/100"
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-medium text-gray-300 block mb-2">Icon Type</label>
                <select
                  value={formData.icon}
                  onChange={e => setFormData({ ...formData, icon: e.target.value })}
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary"
                >
                  <option value="Laptop">Laptop (Development)</option>
                  <option value="Database">Database (Automation)</option>
                  <option value="Share2">Share2 (Marketing)</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300 block mb-2">Display Order</label>
                <input
                  type="number"
                  value={formData.displayOrder}
                  onChange={e => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })}
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 bg-black/30 p-4 rounded-lg border border-white/5">
              <input
                type="checkbox"
                id="featured"
                checked={formData.featured}
                onChange={e => setFormData({ ...formData, featured: e.target.checked })}
                className="w-5 h-5 bg-black/50 border border-white/10 rounded text-primary focus:ring-primary cursor-pointer"
              />
              <label htmlFor="featured" className="text-sm font-medium text-gray-300 cursor-pointer select-none">
                Show on Homepage as Featured Project? (Checked = Yes)
              </label>
            </div>

            <div className="flex items-center gap-6 bg-black/30 p-6 rounded-lg border border-white/5">
              <div className="relative w-32 h-20 bg-black/50 rounded-lg overflow-hidden border border-white/10 shrink-0">
                {formData.image ? (
                  <img src={formData.image} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center w-full h-full">
                    <ImageIcon className="w-8 h-8 text-white/25" />
                  </div>
                )}
                {isUploading && (
                  <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                    <Loader className="w-5 h-5 text-white animate-spin" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-300 block mb-2">Upload Showcase Image *</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={isUploading || isSaving}
                  className="block w-full text-sm text-gray-400
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-lg file:border-0
                    file:text-sm file:font-semibold
                    file:bg-primary/10 file:text-primary
                    hover:file:bg-primary/20
                    disabled:opacity-50 cursor-pointer"
                />
              </div>
            </div>

            <div className="flex justify-end gap-4 pt-6 border-t border-white/10">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-2.5 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving || isUploading || !formData.image}
                className="flex items-center gap-2 px-8 py-2.5 bg-primary text-black font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {isSaving ? <Loader className="w-5 h-5 animate-spin" /> : 'Save Showcase'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        // Grid View
        <>
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Portfolio Management</h1>
              <p className="text-gray-400 text-sm mt-1">Manage showcases, case studies, past projects, and metrics.</p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="border-b border-white/10 my-6">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('showcases')}
                className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors ${
                  activeTab === 'showcases'
                    ? 'border-[#FF6B00] text-[#FF6B00]'
                    : 'border-transparent text-gray-400 hover:border-gray-300 hover:text-gray-300'
                }`}
              >
                Project Showcases
              </button>
              <button
                onClick={() => setActiveTab('metrics')}
                className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors ${
                  activeTab === 'metrics'
                    ? 'border-[#FF6B00] text-[#FF6B00]'
                    : 'border-transparent text-gray-400 hover:border-gray-300 hover:text-gray-300'
                }`}
              >
                Portfolio Metrics
              </button>
              <button
                onClick={() => setActiveTab('hero')}
                className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors ${
                  activeTab === 'hero'
                    ? 'border-[#FF6B00] text-[#FF6B00]'
                    : 'border-transparent text-gray-400 hover:border-gray-300 hover:text-gray-300'
                }`}
              >
                Hero Section
              </button>
              <button
                onClick={() => setActiveTab('cta')}
                className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors ${
                  activeTab === 'cta'
                    ? 'border-[#FF6B00] text-[#FF6B00]'
                    : 'border-transparent text-gray-400 hover:border-gray-300 hover:text-gray-300'
                }`}
              >
                CTA Section
              </button>
            </nav>
          </div>

          {activeTab === 'showcases' ? (
            <>
              <div className="flex justify-end mb-6">
                <button
                  onClick={openAddModal}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-black font-medium rounded-lg hover:bg-primary/90 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add Showcase
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {portfolios.map((item) => (
                  <div key={item._id} className={`bg-[#1a1a1a] border ${item.status === 'inactive' ? 'border-red-500/50' : 'border-white/10'} rounded-xl p-6 relative flex flex-col`}>
                    {item.featured && (
                      <span className="absolute -top-2 -right-2 bg-yellow-500 text-black text-[10px] font-bold px-2 py-1 rounded shadow">
                        FEATURED
                      </span>
                    )}
                    <div className="flex gap-4 items-start mb-4">
                      {item.image ? (
                        <img src={item.image} alt={item.title} className="w-16 h-12 rounded object-cover border border-white/10" />
                      ) : (
                        <div className="w-16 h-12 bg-white/5 rounded flex items-center justify-center">
                          <ImageIcon className="w-6 h-6 text-white/20" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-white truncate pr-2">{item.title}</h3>
                        <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full uppercase tracking-wider">
                          {item.category}
                        </span>
                      </div>
                    </div>
                    
                    <p className="text-xs text-gray-400 italic mb-2 line-clamp-1">{item.tagline}</p>
                    <p className="text-xs text-gray-500 mb-4 line-clamp-2 flex-1">{item.description}</p>

                    <div className="flex items-center justify-between pt-4 border-t border-white/10 mt-auto">
                      <div className="flex gap-2">
                        <button 
                          onClick={() => openEditModal(item)}
                          className="p-2 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded transition-colors"
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                      </div>
                      <button 
                        onClick={() => deletePortfolio(item._id)}
                        className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : activeTab === 'metrics' ? (
            <PortfolioMetricsManager isNested={true} />
          ) : activeTab === 'hero' ? (
            <PortfolioHeroManager isNested={true} />
          ) : (
            <PortfolioCTAManager isNested={true} />
          )}
        </>
      )}
      {/* Delete Confirmation Modal */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6 w-full max-w-md shadow-2xl relative">
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Delete Showcase</h3>
              <p className="text-gray-400 mb-6 text-sm">
                Are you sure you want to delete this showcase? This action cannot be undone.
              </p>
              <div className="flex gap-3 w-full">
                <button
                  type="button"
                  onClick={() => setDeleteModal({ isOpen: false, itemId: null })}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2.5 border border-white/10 rounded-lg text-gray-300 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={isDeleting}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {isDeleting ? <Loader className="w-4 h-4 animate-spin" /> : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
