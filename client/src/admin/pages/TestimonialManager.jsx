import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Loader, Edit2, Trash2, CheckCircle, XCircle, Plus, MessageSquare, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function TestimonialManager() {
  const [testimonials, setTestimonials] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [sourceFilter, setSourceFilter] = useState('all'); // all, client, system
  
  const initialFormState = {
    author: '',
    role: '',
    quote: '',
    country: 'India',
    countryFlag: '🇮🇳',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150&h=150&fit=crop',
    showOnPages: ['home']
  };

  const [formData, setFormData] = useState(initialFormState);
  const [isUploading, setIsUploading] = useState(false);
  
  const WORD_LIMIT = 100;

  const countWords = (str) => {
    return (str || '').trim().split(/\s+/).filter(word => word.length > 0).length;
  };

  const wordCount = countWords(formData.quote);

  useEffect(() => {
    fetchTestimonials();
  }, []);

  useEffect(() => {
    const isAnyModalOpen = isModalOpen || !!deleteConfirmId;
    if (isAnyModalOpen) {
      const scrollY = window.scrollY;
      document.body.classList.add('modal-open');
      document.body.style.top = `-${scrollY}px`;
    } else {
      const scrollY = document.body.style.top;
      document.body.classList.remove('modal-open');
      document.body.style.top = '';
      window.scrollTo(0, parseInt(scrollY || '0') * -1);
    }
    return () => {
      const scrollY = document.body.style.top;
      document.body.classList.remove('modal-open');
      document.body.style.top = '';
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY) * -1);
      }
    };
  }, [isModalOpen, deleteConfirmId]);

  const fetchTestimonials = async (showLoader = true) => {
    try {
      if (showLoader) setIsLoading(true);
      const res = await api.get('/testimonials');
      setTestimonials(res.data.data || []);
    } catch (error) {
      alert('Failed to load testimonials');
      console.error(error);
    } finally {
      if (showLoader) setIsLoading(false);
    }
  };

  const updateStatus = async (id, status) => {
    // Optimistic update for smooth animation
    setTestimonials(prev => prev.map(t => t._id === id ? { ...t, status } : t));
    try {
      await api.put(`/testimonials/${id}/status`, { status });
    } catch (error) {
      alert('Failed to update status');
      console.error(error);
      fetchTestimonials(false); // Revert on failure
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    setIsDeleting(true);
    // Optimistic removal
    const idToDelete = deleteConfirmId;
    setTestimonials(prev => prev.filter(t => t._id !== idToDelete));
    try {
      await api.delete(`/testimonials/${idToDelete}`);
      setDeleteConfirmId(null);
    } catch (error) {
      alert('Failed to delete testimonial');
      console.error(error);
      fetchTestimonials(false); // Revert on failure
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
      // Use the authenticated admin upload route
      const res = await api.post('/upload', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.url) {
        setFormData({ ...formData, avatar: res.data.url });
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to upload image');
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (wordCount > WORD_LIMIT) {
      alert(`The review exceeds the ${WORD_LIMIT} word limit. Please shorten it.`);
      return;
    }
    
    setIsSaving(true);
    try {
      if (editingId) {
        await api.put(`/testimonials/${editingId}`, formData);
        alert('Testimonial updated successfully!');
      } else {
        await api.post('/testimonials/admin', formData);
        alert('Testimonial added successfully!');
      }
      setIsModalOpen(false);
      setFormData(initialFormState);
      setEditingId(null);
      fetchTestimonials();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to save testimonial');
    } finally {
      setIsSaving(false);
    }
  };

  const openAddModal = () => {
    setEditingId(null);
    setFormData(initialFormState);
    setIsModalOpen(true);
  };

  const openEditModal = (testimonial) => {
    setEditingId(testimonial._id);
    setFormData({
      author: testimonial.author,
      role: testimonial.role || '',
      quote: testimonial.quote,
      country: testimonial.country || '',
      countryFlag: testimonial.countryFlag || '',
      avatar: testimonial.avatar || initialFormState.avatar,
      showOnPages: testimonial.showOnPages || ['home'],
    });
    setIsModalOpen(true);
  };

  const filteredTestimonials = testimonials
    .filter(t => t.status === activeTab)
    .filter(t => sourceFilter === 'all' ? true : t.source === sourceFilter);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Testimonials Management</h1>
          <p className="text-gray-400 text-sm mt-1">Manage client reviews and approve public submissions.</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-black font-medium rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Testimonial
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 border-b border-white/10 pb-4 justify-between">
        <div className="flex gap-2 bg-[#1a1a1a] p-1 rounded-lg border border-white/10">
          {['pending', 'approved', 'rejected'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === tab 
                  ? 'bg-white/10 text-white shadow-sm' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              <span className="ml-2 bg-black/50 px-2 py-0.5 rounded-full text-xs">
                {testimonials.filter(t => t.status === tab).length}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Source:</span>
          <select 
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="bg-[#1a1a1a] border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
          >
            <option value="all">All Submissions</option>
            <option value="client">Client Added</option>
            <option value="system">Vedhunt System</option>
          </select>
        </div>
      </div>

      {/* Testimonials List */}
      {filteredTestimonials.length === 0 ? (
        <div className="text-center text-gray-500 py-12 bg-[#1a1a1a] rounded-xl border border-white/5">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p>No {activeTab} testimonials found.</p>
        </div>
      ) : (
        <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredTestimonials.map((t) => (
              <motion.div 
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                transition={{ duration: 0.2 }}
                key={t._id} 
                className="bg-[#1a1a1a] border border-white/10 rounded-xl p-4 relative flex flex-col"
              >
                <div className="flex gap-3 items-start mb-3">
                <img src={t.avatar} alt={t.author} className="w-10 h-10 rounded-full object-cover border border-white/10" />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <h3 className="text-sm font-bold text-white truncate pr-2">{t.author}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${
                      t.source === 'system' ? 'bg-primary/20 text-primary' : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {t.source === 'system' ? 'System' : 'Client'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 truncate">{t.role}</p>
                  <div className="text-[11px] text-gray-500">{t.countryFlag} {t.country}</div>
                </div>
              </div>
              
              <div className="bg-black/30 p-2.5 rounded-lg text-xs text-gray-300 italic mb-3 flex-1 line-clamp-3">
                "{t.quote}"
              </div>

                <div className="flex items-center justify-between pt-3 border-t border-white/10 mt-auto">
                  <div className="flex gap-2">
                    <button 
                      onClick={() => openEditModal(t)}
                      className="p-2 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded transition-all hover:scale-105 active:scale-95 cursor-pointer"
                      title="Edit"
                    >
                      <Edit2 size={16} />
                    </button>
                    {activeTab !== 'approved' && (
                      <button 
                        onClick={() => updateStatus(t._id, 'approved')}
                        className="p-2 bg-green-500/10 text-green-500 hover:bg-green-500/20 rounded transition-all hover:scale-105 active:scale-95 cursor-pointer"
                        title="Approve"
                      >
                        <CheckCircle size={16} />
                      </button>
                    )}
                    {activeTab !== 'rejected' && (
                      <button 
                        onClick={() => updateStatus(t._id, 'rejected')}
                        className="p-2 bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 rounded transition-all hover:scale-105 active:scale-95 cursor-pointer"
                        title="Reject"
                      >
                        <XCircle size={16} />
                      </button>
                    )}
                  </div>
                  
                  <button 
                    onClick={() => setDeleteConfirmId(t._id)}
                    className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded transition-all hover:scale-105 active:scale-95 cursor-pointer"
                    title="Delete Permanently"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-5 w-full max-w-lg relative">
            <h2 className="text-lg font-bold text-white mb-4">
              {editingId ? 'Edit Testimonial' : 'Add New Testimonial'}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[13px] font-medium text-gray-300 block mb-1">Author Name *</label>
                  <input
                    required
                    type="text"
                    value={formData.author}
                    onChange={e => setFormData({ ...formData, author: e.target.value })}
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-[13px] font-medium text-gray-300 block mb-1">Role / Designation</label>
                  <input
                    type="text"
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                    placeholder="e.g. CEO, Founder"
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[13px] font-medium text-gray-300 block mb-1">Country</label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={e => setFormData({ ...formData, country: e.target.value })}
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-[13px] font-medium text-gray-300 block mb-1">Country Flag Emoji</label>
                  <input
                    type="text"
                    value={formData.countryFlag}
                    onChange={e => setFormData({ ...formData, countryFlag: e.target.value })}
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 mb-3">
                <div className="relative w-12 h-12 rounded-full overflow-hidden border border-white/10 shrink-0 bg-black/50">
                  <img src={formData.avatar} alt="Avatar preview" className="w-full h-full object-cover" />
                  {isUploading && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Loader className="w-4 h-4 text-white animate-spin" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <label className="text-[13px] font-medium text-gray-300 block mb-1">Upload Photo (Optional)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={isUploading || isSaving}
                    className="block w-full text-xs text-gray-400
                      file:mr-3 file:py-1.5 file:px-3
                      file:rounded-full file:border-0
                      file:text-xs file:font-semibold
                      file:bg-primary/10 file:text-primary
                      hover:file:bg-primary/20
                      disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[13px] font-medium text-gray-300">Quote / Review *</label>
                  <span className={`text-xs ${wordCount > WORD_LIMIT ? 'text-red-500' : 'text-gray-400'}`}>
                    {wordCount} / {WORD_LIMIT} words
                  </span>
                </div>
                <textarea
                  required
                  rows={3}
                  value={formData.quote}
                  onChange={(e) => {
                    const words = countWords(e.target.value);
                    if (words <= WORD_LIMIT + 10) {
                      setFormData({...formData, quote: e.target.value});
                    }
                  }}
                  className={`w-full bg-black/50 border ${wordCount > WORD_LIMIT ? 'border-red-500' : 'border-white/10'} rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary resize-none`}
                  placeholder="Share your experience working with us..."
                />
              </div>

              <div className="mb-3">
                <label className="text-[13px] font-medium text-gray-300 block mb-1.5">Show on Pages</label>
                <div className="grid grid-cols-2 gap-1.5 bg-black/50 p-2.5 rounded-lg border border-white/10">
                  {[
                    { id: 'home', label: 'Home Page (Main)' },
                    { id: 'app-development', label: 'App Dev (Landing Page)' },
                    { id: 'social-media', label: 'Social Media (Landing Page)' },
                    { id: 'performance-marketing', label: 'Perf. Marketing (Landing Page)' },
                    { id: 'accounting', label: 'Accounting (Landing Page)' },
                    { id: 'mis-reporting', label: 'MIS Reporting (Landing Page)' }
                  ].map(page => (
                    <label key={page.id} className="flex items-center gap-2 cursor-pointer text-xs text-gray-300 hover:text-white transition-colors">
                      <input 
                        type="checkbox" 
                        className="accent-primary w-3 h-3"
                        checked={formData.showOnPages.includes(page.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({ ...formData, showOnPages: [...formData.showOnPages, page.id] });
                          } else {
                            setFormData({ ...formData, showOnPages: formData.showOnPages.filter(id => id !== page.id) });
                          }
                        }}
                      />
                      {page.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-white/10 mt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving || isUploading || wordCount > WORD_LIMIT || wordCount === 0}
                  className="flex items-center gap-2 px-5 py-1.5 text-sm bg-primary text-black font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {isSaving ? <Loader className="w-3.5 h-3.5 animate-spin" /> : 'Save Testimonial'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6 w-full max-w-sm relative text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4 border border-red-500/20">
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Delete Testimonial?</h2>
            <p className="text-gray-400 text-sm mb-6">
              This action cannot be undone. This testimonial will be permanently removed from the system.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setDeleteConfirmId(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
              >
                {isDeleting ? <Loader className="w-4 h-4 animate-spin" /> : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
