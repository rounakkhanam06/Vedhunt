import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Loader, Edit2, Trash2, Plus, GripVertical, Image as ImageIcon } from 'lucide-react';

export default function LifeAtVedhuntManager() {
  const [data, setData] = useState({ header: null, cards: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [isHeaderSaving, setIsHeaderSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const [headerForm, setHeaderForm] = useState({
    heading: '',
    highlightText: '',
    description: ''
  });

  const initialFormState = {
    title: '',
    tag: '',
    image: '',
    span: '1x',
    order: 0,
    isActive: true
  };
  const [formData, setFormData] = useState(initialFormState);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/content/admin/life-at-vedhunt');
      if (res.data?.data) {
        setData(res.data.data);
        if (res.data.data.header) {
          setHeaderForm({
            heading: res.data.data.header.heading || '',
            highlightText: res.data.data.header.highlightText || '',
            description: res.data.data.header.description || ''
          });
        }
      }
    } catch (error) {
      console.error(error);
      alert('Failed to load Life at Vedhunt data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleHeaderSubmit = async (e) => {
    e.preventDefault();
    setIsHeaderSaving(true);
    try {
      await api.put('/content/admin/life-at-vedhunt/header', headerForm);
      alert('Header updated successfully!');
      fetchData();
    } catch (error) {
      console.error(error);
      alert('Failed to update header');
    } finally {
      setIsHeaderSaving(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formDataToUpload = new FormData();
    formDataToUpload.append('image', file);

    setIsUploading(true);
    try {
      const res = await api.post('/upload', formDataToUpload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.url) {
        setFormData({ ...formData, image: res.data.url });
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
    if (!formData.image) {
      alert("Image is required");
      return;
    }
    
    setIsSaving(true);
    try {
      if (editingId) {
        await api.put(`/content/admin/life-at-vedhunt/cards/${editingId}`, formData);
      } else {
        await api.post('/content/admin/life-at-vedhunt/cards', {
          ...formData,
          order: data.cards.length + 1
        });
      }
      setIsModalOpen(false);
      setFormData(initialFormState);
      setEditingId(null);
      fetchData();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to save card');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteCard = async (id) => {
    if (!window.confirm('Are you sure you want to delete this card?')) return;
    try {
      await api.delete(`/content/admin/life-at-vedhunt/cards/${id}`);
      fetchData();
    } catch (error) {
      console.error(error);
      alert('Failed to delete card');
    }
  };

  const openAddModal = () => {
    setEditingId(null);
    setFormData({
      ...initialFormState,
      order: data.cards.length + 1
    });
    setIsModalOpen(true);
  };

  const openEditModal = (card) => {
    setEditingId(card._id);
    setFormData({
      title: card.title,
      tag: card.tag,
      image: card.image,
      span: card.span || '1x',
      order: card.order,
      isActive: card.isActive
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
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Life at Vedhunt</h1>
          <p className="text-gray-400 text-sm mt-1">Manage the culture section on the Career page.</p>
        </div>
      </div>

      {/* Header Section Form */}
      <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6">
        <h2 className="text-lg font-bold text-white mb-4">Section Header</h2>
        <form onSubmit={handleHeaderSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-300 block mb-1">Heading Part 1</label>
              <input
                type="text"
                value={headerForm.heading}
                onChange={e => setHeaderForm({ ...headerForm, heading: e.target.value })}
                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary"
                placeholder="Life at"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-300 block mb-1">Highlighted Text</label>
              <input
                type="text"
                value={headerForm.highlightText}
                onChange={e => setHeaderForm({ ...headerForm, highlightText: e.target.value })}
                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary"
                placeholder="Vedhunt"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-300 block mb-1">Description Paragraph</label>
            <textarea
              rows={3}
              value={headerForm.description}
              onChange={e => setHeaderForm({ ...headerForm, description: e.target.value })}
              className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary"
            />
          </div>
          <button
            type="submit"
            disabled={isHeaderSaving}
            className="px-6 py-2 bg-primary/10 text-primary border border-primary/20 font-medium rounded-lg hover:bg-primary/20 transition-colors flex items-center gap-2"
          >
            {isHeaderSaving && <Loader className="w-4 h-4 animate-spin" />}
            Save Header
          </button>
        </form>
      </div>

      {/* Cards List */}
      <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white">Culture Cards</h2>
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-black font-medium rounded-lg hover:bg-primary/90 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" /> Add Card
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.cards.map((card) => (
            <div key={card._id} className={`bg-black/40 border border-white/5 rounded-xl p-4 flex flex-col relative ${card.isActive ? '' : 'opacity-50'}`}>
              <div className="aspect-video w-full mb-4 bg-black rounded-lg overflow-hidden relative">
                <img src={card.image} alt={card.title} className="w-full h-full object-cover" />
                <div className="absolute top-2 left-2 bg-black/70 px-2 py-1 rounded text-xs font-mono text-white">
                  Order: {card.order} | Span: {card.span}
                </div>
              </div>
              <div className="flex-1">
                <span className="text-[10px] uppercase tracking-wider text-primary font-bold bg-primary/10 px-2 py-1 rounded inline-block mb-2">
                  {card.tag}
                </span>
                <h3 className="text-white font-bold">{card.title}</h3>
              </div>
              
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/10">
                <button 
                  onClick={() => openEditModal(card)}
                  className="flex-1 flex justify-center items-center gap-2 py-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded transition-colors text-xs font-medium"
                >
                  <Edit2 size={14} /> Edit
                </button>
                <button 
                  onClick={() => deleteCard(card._id)}
                  className="flex-1 flex justify-center items-center gap-2 py-1.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded transition-colors text-xs font-medium"
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </div>
          ))}
          {data.cards.length === 0 && (
            <div className="col-span-full text-center py-8 text-gray-500">
              No cards found.
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6 w-full max-w-lg relative max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-white mb-6">
              {editingId ? 'Edit Card' : 'Add New Card'}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-300 block mb-1">Title *</label>
                <input
                  required
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Modern Tools"
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-300 block mb-1">Tag (Badge Text) *</label>
                <input
                  required
                  type="text"
                  value={formData.tag}
                  onChange={e => setFormData({ ...formData, tag: e.target.value })}
                  placeholder="e.g. WORKSPACE"
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-300 block mb-1">Order</label>
                  <input
                    type="number"
                    value={formData.order}
                    onChange={e => setFormData({ ...formData, order: Number(e.target.value) })}
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-300 block mb-1">Card Span (Grid Size)</label>
                  <select
                    value={formData.span}
                    onChange={e => setFormData({ ...formData, span: e.target.value })}
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary"
                  >
                    <option value="1x">1 Column (1x)</option>
                    <option value="2x">2 Columns (2x)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between bg-black/50 border border-white/10 rounded-lg p-3">
                <span className="text-sm font-medium text-gray-300">Is Active</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={formData.isActive}
                    onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-300 block mb-2">Card Image *</label>
                {formData.image && (
                  <div className="relative aspect-video rounded-lg overflow-hidden border border-white/10 mb-3 bg-black">
                    <img src={formData.image} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={isUploading}
                    className="block w-full text-sm text-gray-400
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-full file:border-0
                      file:text-sm file:font-semibold
                      file:bg-primary/10 file:text-primary
                      hover:file:bg-primary/20
                      disabled:opacity-50 cursor-pointer"
                  />
                  {isUploading && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <Loader className="w-5 h-5 text-primary animate-spin" />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving || isUploading}
                  className="flex items-center gap-2 px-6 py-2 bg-primary text-black font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {isSaving ? <Loader className="w-4 h-4 animate-spin" /> : 'Save Card'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
