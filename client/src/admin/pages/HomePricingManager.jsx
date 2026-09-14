import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Loader, Edit2, AlertTriangle, Check, Plus, Trash2, PlusCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function HomePricingManager() {
  const [cards, setCards] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const initialFormState = {
    title: '',
    slug: '',
    showOnHome: true,
    icon: 'Laptop',
    description: '',
    color: 'from-blue-500/20',
    popular: false,
    tiers: {
      starter: { price: '', period: '', features: [''] },
      growth: { price: '', period: '', features: [''] },
      enterprise: { price: '', period: '', features: [''] }
    }
  };

  const [form, setForm] = useState(initialFormState);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/home-pricing');
      setCards(res.data.data || []);
    } catch (error) {
      toast.error('Failed to load home pricing data');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(initialFormState);
    setIsModalOpen(true);
  };

  const openEdit = (item) => {
    setEditingId(item._id);
    setForm({
      title: item.title,
      slug: item.slug || '',
      showOnHome: item.showOnHome !== undefined ? item.showOnHome : true,
      icon: item.icon,
      description: item.description,
      color: item.color,
      popular: item.popular,
      tiers: {
        starter: {
          price: item.tiers.starter.price,
          period: item.tiers.starter.period,
          features: [...item.tiers.starter.features]
        },
        growth: {
          price: item.tiers.growth.price,
          period: item.tiers.growth.period,
          features: [...item.tiers.growth.features]
        },
        enterprise: {
          price: item.tiers.enterprise.price,
          period: item.tiers.enterprise.period,
          features: [...item.tiers.enterprise.features]
        }
      }
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this pricing card?")) {
      try {
        await api.delete(`/home-pricing/${id}`);
        toast.success("Card deleted successfully");
        fetchData();
      } catch (error) {
        toast.error("Failed to delete card");
        console.error(error);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Prevent more than 3 cards from being shown on the home page
    if (form.showOnHome) {
      const currentHomeCards = cards.filter(c => c.showOnHome && c._id !== editingId);
      if (currentHomeCards.length >= 3) {
        toast.error("You can only show 3 pricing cards on the Home Page. Please uncheck 'Show on Main Home Page' or remove another card from the Home Page first.", { duration: 5000 });
        return;
      }
    }

    setIsSaving(true);
    
    // Convert features back to array
    const dataToSubmit = {
      ...form,
      tiers: {
        starter: {
          ...form.tiers.starter,
          features: form.tiers.starter.features.map(f => f.trim()).filter(Boolean)
        },
        growth: {
          ...form.tiers.growth,
          features: form.tiers.growth.features.map(f => f.trim()).filter(Boolean)
        },
        enterprise: {
          ...form.tiers.enterprise,
          features: form.tiers.enterprise.features.map(f => f.trim()).filter(Boolean)
        }
      }
    };

    try {
      if (editingId) {
        await api.put(`/home-pricing/${editingId}`, dataToSubmit);
        toast.success('Card updated successfully');
      } else {
        await api.post('/home-pricing', dataToSubmit);
        toast.success('Card created successfully');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save card');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading && cards.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {isModalOpen && (
        <div className="bg-app-card border border-app-border rounded-xl p-6 sm:p-8 shadow-sm">
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-app-border">
            <div>
              <h2 className="text-2xl font-bold text-app-text">{editingId ? 'Edit Pricing Card' : 'Add New Pricing Card'}</h2>
            </div>
            <button onClick={() => setIsModalOpen(false)} className="px-5 py-2 border border-app-border rounded-lg text-app-text-muted hover:text-app-text hover:bg-app-bg transition-colors cursor-pointer text-sm font-medium">
              Cancel
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* General Info */}
            <div className="bg-app-bg p-6 rounded-xl border border-app-border">
              <h3 className="text-lg font-bold text-app-text mb-4">General Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium text-app-text-muted block mb-2">Title</label>
                  <input required type="text" value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="w-full bg-app-card border border-app-border rounded-lg px-4 py-2.5 text-app-text focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium text-app-text-muted block mb-2">Slug (URL endpoint)</label>
                  <input type="text" value={form.slug} onChange={e => setForm({...form, slug: e.target.value})} placeholder="Auto-generated if empty" className="w-full bg-app-card border border-app-border rounded-lg px-4 py-2.5 text-app-text placeholder:text-app-text-muted/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium text-app-text-muted block mb-2">Icon (Lucide name)</label>
                  <input required type="text" value={form.icon} onChange={e => setForm({...form, icon: e.target.value})} className="w-full bg-app-card border border-app-border rounded-lg px-4 py-2.5 text-app-text focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium text-app-text-muted block mb-2">Color Class (Tailwind)</label>
                  <input required type="text" value={form.color} onChange={e => setForm({...form, color: e.target.value})} className="w-full bg-app-card border border-app-border rounded-lg px-4 py-2.5 text-app-text focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm" />
                </div>
                <div className="flex items-center pt-4 space-x-6 col-span-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" id="showOnHome" checked={form.showOnHome} onChange={e => setForm({...form, showOnHome: e.target.checked})} className="w-4 h-4 rounded border-app-border text-primary focus:ring-primary cursor-pointer" />
                    <span className="text-sm font-medium text-app-text">Show on Main Home Page</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" id="popular" checked={form.popular} onChange={e => setForm({...form, popular: e.target.checked})} className="w-4 h-4 rounded border-app-border text-primary focus:ring-primary cursor-pointer" />
                    <span className="text-sm font-medium text-app-text">Most Popular Highlight</span>
                  </label>
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-app-text-muted block mb-2">Description</label>
                  <textarea required rows={2} value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full bg-app-card border border-app-border rounded-lg px-4 py-2.5 text-app-text focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none text-sm" />
                </div>
              </div>
            </div>

            {/* Tiers */}
            {['starter', 'growth', 'enterprise'].map(tierName => (
              <div key={tierName} className="bg-app-bg p-6 rounded-xl border border-app-border">
                <h3 className="text-lg font-bold text-app-text mb-4 capitalize">{tierName} Tier</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-sm font-medium text-app-text-muted block mb-2">Price string (e.g. ₹15K-30K)</label>
                    <input required type="text" value={form.tiers[tierName].price} onChange={e => setForm({...form, tiers: {...form.tiers, [tierName]: {...form.tiers[tierName], price: e.target.value}}})} className="w-full bg-app-card border border-app-border rounded-lg px-4 py-2.5 text-app-text focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-app-text-muted block mb-2">Period string (e.g. /mo)</label>
                    <input type="text" value={form.tiers[tierName].period} onChange={e => setForm({...form, tiers: {...form.tiers, [tierName]: {...form.tiers[tierName], period: e.target.value}}})} className="w-full bg-app-card border border-app-border rounded-lg px-4 py-2.5 text-app-text focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm" />
                  </div>
                  <div className="md:col-span-2">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-app-text-muted">Features</label>
                      <button 
                        type="button" 
                        onClick={() => {
                          const newTiers = { ...form.tiers };
                          newTiers[tierName].features.push('');
                          setForm({ ...form, tiers: newTiers });
                        }}
                        className="text-xs font-medium flex items-center gap-1 text-primary hover:underline cursor-pointer"
                      >
                        <Plus size={14} /> Add Feature
                      </button>
                    </div>
                    <div className="space-y-3">
                      {form.tiers[tierName].features.map((feature, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input 
                            required 
                            type="text" 
                            value={feature} 
                            placeholder={`Feature ${idx + 1}`}
                            onChange={e => {
                              const newTiers = { ...form.tiers };
                              newTiers[tierName].features[idx] = e.target.value;
                              setForm({ ...form, tiers: newTiers });
                            }} 
                            className="flex-grow bg-app-card border border-app-border rounded-lg px-4 py-2 text-app-text focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm" 
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const newTiers = { ...form.tiers };
                              newTiers[tierName].features.splice(idx, 1);
                              setForm({ ...form, tiers: newTiers });
                            }}
                            className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                            title="Remove feature"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                      {form.tiers[tierName].features.length === 0 && (
                        <p className="text-app-text-muted text-sm italic">No features added. Click "Add Feature" to create one.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            <div className="flex justify-end pt-6 border-t border-app-border sticky bottom-0 bg-app-card/95 backdrop-blur-sm py-4">
              <button type="submit" disabled={isSaving} className="flex items-center gap-2 px-8 py-2.5 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer shadow-sm">
                {isSaving ? <Loader className="w-5 h-5 animate-spin" /> : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {!isModalOpen && (
        <>
          <div className="flex items-center justify-between border-b border-app-border pb-4">
            <div>
              <h1 className="text-2xl font-bold text-app-text">Pricing Cards</h1>
              <p className="text-app-text-muted text-sm mt-1">Manage pricing cards displayed on the home page and ad landing pages.</p>
            </div>
            <button
              onClick={openAdd}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 transition-colors cursor-pointer shadow-sm text-sm"
            >
              <PlusCircle size={18} /> Add New Card
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cards.map((item) => (
              <div key={item._id} className={`bg-app-card border ${item.showOnHome ? 'border-primary/40' : 'border-app-border'} rounded-xl p-6 relative flex flex-col shadow-sm transition-shadow hover:shadow-md`}>
                {item.popular && (
                  <span className="absolute -top-2.5 -left-2 bg-primary text-white text-[10px] font-bold px-2.5 py-0.5 rounded shadow">
                    MOST POPULAR
                  </span>
                )}
                {item.showOnHome && (
                  <span className="absolute -top-2.5 -right-2 bg-emerald-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded shadow">
                    HOME PAGE
                  </span>
                )}
                <div className="mt-1 mb-2">
                  <h3 className="text-lg font-bold text-app-text">{item.title}</h3>
                  <p className="text-xs text-primary font-mono mt-0.5">{item.slug}</p>
                </div>
                <p className="text-xs text-app-text-muted mb-4">{item.description}</p>
                <div className="space-y-3 mb-6 flex-grow text-xs">
                  <div className="bg-app-bg p-3 rounded-lg space-y-2 border border-app-border">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-primary">Starter</span>
                      <span className="font-bold text-app-text">{item.tiers.starter.price}{item.tiers.starter.period}</span>
                    </div>
                  </div>
                  <div className="bg-app-bg p-3 rounded-lg space-y-2 border border-app-border">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-primary">Growth</span>
                      <span className="font-bold text-app-text">{item.tiers.growth.price}{item.tiers.growth.period}</span>
                    </div>
                  </div>
                  <div className="bg-app-bg p-3 rounded-lg space-y-2 border border-app-border">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-primary">Enterprise</span>
                      <span className="font-bold text-app-text">{item.tiers.enterprise.price}{item.tiers.enterprise.period}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-app-border mt-auto">
                  <button onClick={() => handleDelete(item._id)} className="px-3 py-1.5 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors flex gap-1.5 items-center text-xs font-semibold cursor-pointer" title="Delete">
                    <Trash2 size={15} /> Delete
                  </button>
                  <button onClick={() => openEdit(item)} className="px-3 py-1.5 bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 rounded-lg transition-colors flex gap-1.5 items-center text-xs font-semibold cursor-pointer" title="Edit">
                    <Edit2 size={15} /> Edit Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
