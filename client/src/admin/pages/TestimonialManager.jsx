import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Loader, Edit2, Trash2, CheckCircle, XCircle, Plus, MessageSquare } from 'lucide-react';

export default function TestimonialManager() {
  const [testimonials, setTestimonials] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
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

  const fetchTestimonials = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/testimonials');
      setTestimonials(res.data.data || []);
    } catch (error) {
      alert('Failed to load testimonials');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateStatus = async (id, status) => {
    try {
      await api.put(`/testimonials/${id}/status`, { status });
      fetchTestimonials();
    } catch (error) {
      alert('Failed to update status');
      console.error(error);
    }
  };

  const deleteTestimonial = async (id) => {
    if (!window.confirm('Are you sure you want to delete this testimonial completely?')) return;
    try {
      await api.delete(`/testimonials/${id}`);
      fetchTestimonials();
    } catch (error) {
      alert('Failed to delete testimonial');
      console.error(error);
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTestimonials.map((t) => (
            <div key={t._id} className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6 relative flex flex-col">
              <div className="flex gap-4 items-start mb-4">
                <img src={t.avatar} alt={t.author} className="w-12 h-12 rounded-full object-cover border border-white/10" />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <h3 className="text-lg font-bold text-white truncate pr-2">{t.author}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      t.source === 'system' ? 'bg-primary/20 text-primary' : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {t.source === 'system' ? 'System' : 'Client'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 truncate mt-0.5">{t.role}</p>
                  <div className="text-xs text-gray-500 mt-1">{t.countryFlag} {t.country}</div>
                </div>
              </div>
              
              <div className="bg-black/30 p-3 rounded-lg text-sm text-gray-300 italic mb-6 flex-1">
                "{t.quote}"
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-white/10 mt-auto">
                <div className="flex gap-2">
                  <button 
                    onClick={() => openEditModal(t)}
                    className="p-2 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded transition-colors"
                    title="Edit"
                  >
                    <Edit2 size={16} />
                  </button>
                  {activeTab !== 'approved' && (
                    <button 
                      onClick={() => updateStatus(t._id, 'approved')}
                      className="p-2 bg-green-500/10 text-green-500 hover:bg-green-500/20 rounded transition-colors"
                      title="Approve"
                    >
                      <CheckCircle size={16} />
                    </button>
                  )}
                  {activeTab !== 'rejected' && (
                    <button 
                      onClick={() => updateStatus(t._id, 'rejected')}
                      className="p-2 bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 rounded transition-colors"
                      title="Reject"
                    >
                      <XCircle size={16} />
                    </button>
                  )}
                </div>
                
                <button 
                  onClick={() => deleteTestimonial(t._id)}
                  className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded transition-colors"
                  title="Delete Permanently"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6 w-full max-w-lg relative">
            <h2 className="text-xl font-bold text-white mb-6">
              {editingId ? 'Edit Testimonial' : 'Add New Testimonial'}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-300 block mb-1">Author Name *</label>
                  <input
                    required
                    type="text"
                    value={formData.author}
                    onChange={e => setFormData({ ...formData, author: e.target.value })}
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-300 block mb-1">Role / Designation</label>
                  <input
                    type="text"
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                    placeholder="e.g. CEO, Founder"
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-300 block mb-1">Country</label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={e => setFormData({ ...formData, country: e.target.value })}
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-300 block mb-1">Country Flag Emoji</label>
                  <input
                    type="text"
                    value={formData.countryFlag}
                    onChange={e => setFormData({ ...formData, countryFlag: e.target.value })}
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4 mb-4">
                <div className="relative w-16 h-16 rounded-full overflow-hidden border border-white/10 shrink-0 bg-black/50">
                  <img src={formData.avatar} alt="Avatar preview" className="w-full h-full object-cover" />
                  {isUploading && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Loader className="w-4 h-4 text-white animate-spin" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium text-gray-300 block mb-1">Upload Photo (Optional)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={isUploading || isSaving}
                    className="block w-full text-sm text-gray-400
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-full file:border-0
                      file:text-sm file:font-semibold
                      file:bg-primary/10 file:text-primary
                      hover:file:bg-primary/20
                      disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-sm font-medium text-gray-300">Quote / Review *</label>
                  <span className={`text-xs ${wordCount > WORD_LIMIT ? 'text-red-500' : 'text-gray-400'}`}>
                    {wordCount} / {WORD_LIMIT} words
                  </span>
                </div>
                <textarea
                  required
                  rows={4}
                  value={formData.quote}
                  onChange={(e) => {
                    const words = countWords(e.target.value);
                    if (words <= WORD_LIMIT + 10) {
                      setFormData({...formData, quote: e.target.value});
                    }
                  }}
                  className={`w-full bg-black/50 border ${wordCount > WORD_LIMIT ? 'border-red-500' : 'border-white/10'} rounded-lg px-3 py-2 text-white focus:outline-none focus:border-primary resize-none`}
                  placeholder="Share your experience working with us..."
                />
              </div>

              <div className="mb-4">
                <label className="text-sm font-medium text-gray-300 block mb-2">Show on Pages</label>
                <div className="grid grid-cols-2 gap-2 bg-black/50 p-3 rounded-lg border border-white/10">
                  {[
                    { id: 'home', label: 'Home Page (Main)' },
                    { id: 'app-development', label: 'App Dev (Landing Page)' },
                    { id: 'social-media', label: 'Social Media (Landing Page)' },
                    { id: 'performance-marketing', label: 'Perf. Marketing (Landing Page)' },
                    { id: 'accounting', label: 'Accounting (Landing Page)' },
                    { id: 'mis-reporting', label: 'MIS Reporting (Landing Page)' }
                  ].map(page => (
                    <label key={page.id} className="flex items-center gap-2 cursor-pointer text-sm text-gray-300 hover:text-white transition-colors">
                      <input 
                        type="checkbox" 
                        className="accent-primary"
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

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving || isUploading || wordCount > WORD_LIMIT || wordCount === 0}
                  className="flex items-center gap-2 px-6 py-2 bg-primary text-black font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {isSaving ? <Loader className="w-4 h-4 animate-spin" /> : 'Save Testimonial'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
