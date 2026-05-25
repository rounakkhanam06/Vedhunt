import React, { useState, useEffect } from 'react';
import { contentService } from '../../services/contentService';
import { Save, Loader, Plus, Edit2, Trash2, Eye, EyeOff } from 'lucide-react';
import * as LucideIcons from 'lucide-react';

export default function WhyChooseUsManager({ isNested = false }) {
  const [data, setData] = useState({ header: {}, cards: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingHeader, setIsSavingHeader] = useState(false);
  const [headerForm, setHeaderForm] = useState({
    tagline: '',
    heading: '',
    highlightText: ''
  });

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSavingCard, setIsSavingCard] = useState(false);
  const [editingCard, setEditingCard] = useState(null);
  const [cardForm, setCardForm] = useState({
    icon: 'Target',
    title: '',
    description: '',
    order: 0,
    isActive: true
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const res = await contentService.getWhyChooseUsAdmin();
      if (res.data) {
        setData(res.data);
        setHeaderForm({
          tagline: res.data.header?.tagline || '',
          heading: res.data.header?.heading || '',
          highlightText: res.data.header?.highlightText || ''
        });
      }
    } catch (error) {
      alert('Failed to load data');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleHeaderSubmit = async (e) => {
    e.preventDefault();
    setIsSavingHeader(true);
    try {
      await contentService.updateWhyChooseUsHeader(headerForm);
      alert('Header updated successfully!');
      fetchData();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to update header');
    } finally {
      setIsSavingHeader(false);
    }
  };

  const openAddModal = () => {
    setEditingCard(null);
    setCardForm({ icon: 'Target', title: '', description: '', order: data.cards.length + 1, isActive: true });
    setIsModalOpen(true);
  };

  const openEditModal = (card) => {
    setEditingCard(card);
    setCardForm({ ...card });
    setIsModalOpen(true);
  };

  const handleCardSubmit = async (e) => {
    e.preventDefault();
    setIsSavingCard(true);
    try {
      if (editingCard) {
        await contentService.updateWhyChooseUsCard(editingCard._id, cardForm);
        alert('Card updated successfully!');
      } else {
        await contentService.createWhyChooseUsCard(cardForm);
        alert('Card created successfully!');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to save card');
    } finally {
      setIsSavingCard(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to soft delete this card?')) return;
    try {
      await contentService.deleteWhyChooseUsCard(id);
      alert('Card soft-deleted successfully!');
      fetchData();
    } catch (error) {
      alert('Failed to delete card');
    }
  };

  const toggleCardStatus = async (card) => {
    try {
      await contentService.updateWhyChooseUsCard(card._id, { isActive: !card.isActive });
      fetchData();
    } catch (error) {
      alert('Failed to update status');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className={isNested ? "space-y-10" : "mx-auto max-w-6xl space-y-10"}>
      {/* Header Management Section */}
      <div className="space-y-4">
        {!isNested && (
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Why Choose Us Section</h1>
              <p className="text-gray-400 text-sm mt-1">Manage the header text and the feature cards.</p>
            </div>
          </div>
        )}

        <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4 border-b border-white/10 pb-2">Header Settings</h2>
          <form onSubmit={handleHeaderSubmit} className="space-y-6 max-w-3xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Tagline</label>
                <input
                  type="text"
                  value={headerForm.tagline}
                  onChange={e => setHeaderForm({ ...headerForm, tagline: e.target.value })}
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary"
                  placeholder="e.g. Why Vedhunt"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Highlight Text (Orange)</label>
                <input
                  type="text"
                  value={headerForm.highlightText}
                  onChange={e => setHeaderForm({ ...headerForm, highlightText: e.target.value })}
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary"
                  placeholder="e.g. Precision"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Main Heading</label>
              <input
                type="text"
                value={headerForm.heading}
                onChange={e => setHeaderForm({ ...headerForm, heading: e.target.value })}
                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary"
                placeholder="e.g. Engineering Success with"
              />
            </div>
            <button
              type="submit"
              disabled={isSavingHeader}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-black font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isSavingHeader ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Header
            </button>
          </form>
        </div>
      </div>

      {/* Cards Management Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <h2 className="text-xl font-bold text-white">Feature Cards</h2>
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Card
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.cards.map((card) => {
            const Icon = LucideIcons[card.icon] || LucideIcons.HelpCircle;
            return (
              <div key={card._id} className={`bg-[#1a1a1a] border border-white/10 rounded-xl p-6 relative ${!card.isActive ? 'opacity-50' : ''}`}>
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Icon size={24} />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => toggleCardStatus(card)} className="p-2 bg-white/5 hover:bg-white/10 rounded text-gray-300" title="Toggle Visibility">
                      {card.isActive ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                    <button onClick={() => openEditModal(card)} className="p-2 bg-white/5 hover:bg-white/10 rounded text-blue-400">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => handleDelete(card._id)} className="p-2 bg-white/5 hover:bg-red-500/20 rounded text-red-400">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{card.title}</h3>
                <p className="text-sm text-gray-400 mb-4 line-clamp-3">{card.description}</p>
                <div className="text-xs text-gray-500">Order: {card.order} | Status: {card.isActive ? 'Active' : 'Hidden'}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6 w-full max-w-lg relative">
            <h2 className="text-xl font-bold text-white mb-6">{editingCard ? 'Edit Card' : 'Add New Card'}</h2>
            
            <form onSubmit={handleCardSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-300 block mb-1">Title</label>
                <input
                  required
                  type="text"
                  value={cardForm.title}
                  onChange={e => setCardForm({ ...cardForm, title: e.target.value })}
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-300 block mb-1">Description</label>
                <textarea
                  required
                  rows={3}
                  value={cardForm.description}
                  onChange={e => setCardForm({ ...cardForm, description: e.target.value })}
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-300 block mb-1">Lucide Icon Name</label>
                  <input
                    required
                    type="text"
                    value={cardForm.icon}
                    onChange={e => setCardForm({ ...cardForm, icon: e.target.value })}
                    placeholder="e.g. Target, Zap, Eye"
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary"
                  />
                  <p className="text-[10px] text-gray-500 mt-1">Must be an exact exported name from lucide-react</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-300 block mb-1">Display Order</label>
                  <input
                    type="number"
                    value={cardForm.order}
                    onChange={e => setCardForm({ ...cardForm, order: Number(e.target.value) })}
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={cardForm.isActive}
                  onChange={e => setCardForm({ ...cardForm, isActive: e.target.checked })}
                  className="w-4 h-4 rounded border-white/10 bg-black/50"
                />
                <label htmlFor="isActive" className="text-sm text-gray-300">Active (Visible)</label>
              </div>

              <div className="flex justify-end gap-4 mt-8 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingCard}
                  className="flex items-center gap-2 px-6 py-2 bg-primary text-black font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {isSavingCard ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Card
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
