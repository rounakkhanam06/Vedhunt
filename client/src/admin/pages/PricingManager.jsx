import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Loader, Edit2, Trash2, Plus, AlertTriangle, Tag, FileText } from 'lucide-react';
import toast from 'react-hot-toast';

export default function PricingManager() {
  const [categories, setCategories] = useState([]);
  const [plans, setPlans] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modals state
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [activeTab, setActiveTab] = useState('plans');
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, itemId: null, type: null }); // type: 'category' or 'plan'
  const [isDeleting, setIsDeleting] = useState(false);

  // Forms initial state
  const initialCategoryState = {
    name: '',
    description: '',
    icon: 'web',
    order: 0,
    status: 'active',
    seo: { metaTitle: '', metaDescription: '', keywords: '' }
  };

  const initialPlanState = {
    category: '',
    title: '',
    tech: '',
    pricing: { amount: '', discountedAmount: '', currency: 'INR', period: 'one-time', isStartingAt: false, discountPercentage: 0 },
    features: '',
    highlight: false,
    status: 'active',
    order: 0,
    seo: { metaTitle: '', metaDescription: '', keywords: '' }
  };

  const [categoryForm, setCategoryForm] = useState(initialCategoryState);
  const [planForm, setPlanForm] = useState(initialPlanState);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [catsRes, plansRes] = await Promise.all([
        api.get('/pricing/admin/categories'),
        api.get('/pricing/admin/plans')
      ]);
      setCategories(catsRes.data.data || []);
      setPlans(plansRes.data.data || []);
    } catch (error) {
      toast.error('Failed to load pricing data');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = (id, type) => {
    setDeleteModal({ isOpen: true, itemId: id, type });
  };

  const confirmDelete = async () => {
    if (!deleteModal.itemId || !deleteModal.type) return;
    setIsDeleting(true);
    try {
      if (deleteModal.type === 'category') {
        await api.delete(`/pricing/admin/categories/${deleteModal.itemId}`);
        toast.success('Category deleted successfully');
      } else {
        await api.delete(`/pricing/admin/plans/${deleteModal.itemId}`);
        toast.success('Plan deleted successfully');
      }
      setDeleteModal({ isOpen: false, itemId: null, type: null });
      fetchData();
    } catch (error) {
      toast.error(`Failed to delete ${deleteModal.type}`);
      console.error(error);
    } finally {
      setIsDeleting(false);
    }
  };

  // --- Category Handlers ---
  const handleCategorySubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    const dataToSubmit = {
      ...categoryForm,
      seo: {
        ...categoryForm.seo,
        keywords: typeof categoryForm.seo.keywords === 'string' 
          ? categoryForm.seo.keywords.split(',').map(k => k.trim()).filter(Boolean)
          : categoryForm.seo.keywords
      }
    };
    try {
      if (editingId) {
        await api.put(`/pricing/admin/categories/${editingId}`, dataToSubmit);
        toast.success('Category updated successfully');
      } else {
        await api.post('/pricing/admin/categories', dataToSubmit);
        toast.success('Category created successfully');
      }
      setIsCategoryModalOpen(false);
      setCategoryForm(initialCategoryState);
      setEditingId(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save category');
    } finally {
      setIsSaving(false);
    }
  };

  const openAddCategory = () => {
    setEditingId(null);
    setCategoryForm(initialCategoryState);
    setIsCategoryModalOpen(true);
  };

  const openEditCategory = (item) => {
    setEditingId(item._id);
    setCategoryForm({
      name: item.name,
      description: item.description || '',
      icon: item.icon || 'web',
      order: item.order || 0,
      status: item.status || 'active',
      seo: {
        metaTitle: item.seo?.metaTitle || '',
        metaDescription: item.seo?.metaDescription || '',
        keywords: item.seo?.keywords ? item.seo.keywords.join(', ') : ''
      }
    });
    setIsCategoryModalOpen(true);
  };

  // --- Plan Handlers ---
  const handlePlanSubmit = async (e) => {
    e.preventDefault();
    
    if (planForm.pricing.amount === '' || planForm.pricing.amount === null || planForm.pricing.amount === undefined) {
      toast.error('Amount cannot be empty');
      return;
    }

    setIsSaving(true);
    const dataToSubmit = {
      ...planForm,
      pricing: {
        ...planForm.pricing,
        amount: Number(planForm.pricing.amount),
        discountedAmount: planForm.pricing.discountedAmount ? Number(planForm.pricing.discountedAmount) : null
      },
      features: typeof planForm.features === 'string'
        ? planForm.features.split('\n').map(f => f.trim()).filter(Boolean)
        : planForm.features,
      seo: {
        ...planForm.seo,
        keywords: typeof planForm.seo.keywords === 'string' 
          ? planForm.seo.keywords.split(',').map(k => k.trim()).filter(Boolean)
          : planForm.seo.keywords
      }
    };
    try {
      if (editingId) {
        await api.put(`/pricing/admin/plans/${editingId}`, dataToSubmit);
        toast.success('Plan updated successfully');
      } else {
        await api.post('/pricing/admin/plans', dataToSubmit);
        toast.success('Plan created successfully');
      }
      setIsPlanModalOpen(false);
      setPlanForm(initialPlanState);
      setEditingId(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save plan');
    } finally {
      setIsSaving(false);
    }
  };

  const openAddPlan = () => {
    setEditingId(null);
    setPlanForm({ ...initialPlanState, category: categories.length > 0 ? categories[0]._id : '' });
    setIsPlanModalOpen(true);
  };

  const openEditPlan = (item) => {
    setEditingId(item._id);
    setPlanForm({
      category: item.category?._id || item.category,
      title: item.title,
      tech: item.tech,
      pricing: {
        amount: item.pricing?.amount || '',
        discountedAmount: item.pricing?.discountedAmount || '',
        currency: item.pricing?.currency || 'INR',
        period: item.pricing?.period || 'one-time',
        isStartingAt: item.pricing?.isStartingAt || false,
        discountPercentage: item.pricing?.discountPercentage || 0
      },
      features: item.features ? item.features.join('\n') : '',
      highlight: item.highlight || false,
      status: item.status || 'active',
      order: item.order || 0,
      seo: {
        metaTitle: item.seo?.metaTitle || '',
        metaDescription: item.seo?.metaDescription || '',
        keywords: item.seo?.keywords ? item.seo.keywords.join(', ') : ''
      }
    });
    setIsPlanModalOpen(true);
  };

  if (isLoading && categories.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      
      {/* Forms logic handling */}
      {isCategoryModalOpen && (
        <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-8">
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/10">
            <div>
              <h2 className="text-2xl font-bold text-white">
                {editingId ? 'Edit Category' : 'Add New Category'}
              </h2>
            </div>
            <button onClick={() => setIsCategoryModalOpen(false)} className="px-5 py-2 border border-white/10 rounded-lg text-gray-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer">
              Back
            </button>
          </div>
          <form onSubmit={handleCategorySubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-medium text-gray-300 block mb-2">Name *</label>
                <input required type="text" value={categoryForm.name} onChange={e => setCategoryForm({...categoryForm, name: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300 block mb-2">Icon ID</label>
                <input type="text" value={categoryForm.icon} onChange={e => setCategoryForm({...categoryForm, icon: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary" placeholder="e.g. web, app, branding" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300 block mb-2">Display Order</label>
                <input type="number" value={categoryForm.order} onChange={e => setCategoryForm({...categoryForm, order: parseInt(e.target.value) || 0})} className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300 block mb-2">Status</label>
                <select value={categoryForm.status} onChange={e => setCategoryForm({...categoryForm, status: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-300 block mb-2">Description</label>
              <textarea rows={2} value={categoryForm.description} onChange={e => setCategoryForm({...categoryForm, description: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary resize-none" />
            </div>
            <h3 className="text-lg font-bold text-white border-b border-white/10 pb-2 mt-6">SEO Fields</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-medium text-gray-300 block mb-2">Meta Title</label>
                <input type="text" value={categoryForm.seo.metaTitle} onChange={e => setCategoryForm({...categoryForm, seo: {...categoryForm.seo, metaTitle: e.target.value}})} className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300 block mb-2">Meta Keywords</label>
                <input type="text" value={categoryForm.seo.keywords} onChange={e => setCategoryForm({...categoryForm, seo: {...categoryForm.seo, keywords: e.target.value}})} placeholder="Comma separated" className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-300 block mb-2">Meta Description</label>
              <textarea rows={2} value={categoryForm.seo.metaDescription} onChange={e => setCategoryForm({...categoryForm, seo: {...categoryForm.seo, metaDescription: e.target.value}})} className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary resize-none" />
            </div>
            
            <div className="flex justify-end pt-6 border-t border-white/10">
              <button type="submit" disabled={isSaving} className="flex items-center gap-2 px-8 py-2.5 bg-primary text-black font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer">
                {isSaving ? <Loader className="w-5 h-5 animate-spin" /> : 'Save Category'}
              </button>
            </div>
          </form>
        </div>
      )}

      {isPlanModalOpen && (
        <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-8">
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/10">
            <div>
              <h2 className="text-2xl font-bold text-white">
                {editingId ? 'Edit Plan' : 'Add New Plan'}
              </h2>
            </div>
            <button onClick={() => setIsPlanModalOpen(false)} className="px-5 py-2 border border-white/10 rounded-lg text-gray-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer">
              Back
            </button>
          </div>
          <form onSubmit={handlePlanSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-medium text-gray-300 block mb-2">Category *</label>
                <select required value={planForm.category} onChange={e => setPlanForm({...planForm, category: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary">
                  <option value="" disabled>Select Category</option>
                  {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300 block mb-2">Title *</label>
                <input required type="text" value={planForm.title} onChange={e => setPlanForm({...planForm, title: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary" />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-300 block mb-2">Tech Stack / Subtitle *</label>
                <input required type="text" value={planForm.tech} onChange={e => setPlanForm({...planForm, tech: e.target.value})} placeholder="e.g. Next.js · React · Tailwind" className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary" />
              </div>
            </div>

            <h3 className="text-lg font-bold text-white border-b border-white/10 pb-2 mt-6">Pricing Configuration</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
              <div>
                <label className="text-sm font-medium text-gray-300 block mb-2">Amount *</label>
                <input required type="number" value={planForm.pricing.amount} onChange={e => {
                  let val = e.target.value;
                  if (val.length > 1 && val.startsWith('0')) {
                    val = val.replace(/^0+/, '');
                  }
                  setPlanForm({...planForm, pricing: {...planForm.pricing, amount: val}});
                }} className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300 block mb-2">Offer Price</label>
                <input type="number" value={planForm.pricing.discountedAmount} onChange={e => {
                  let val = e.target.value;
                  if (val.length > 1 && val.startsWith('0')) {
                    val = val.replace(/^0+/, '');
                  }
                  setPlanForm({...planForm, pricing: {...planForm.pricing, discountedAmount: val}});
                }} placeholder="Optional" className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300 block mb-2">Currency</label>
                <select value={planForm.pricing.currency} onChange={e => setPlanForm({...planForm, pricing: {...planForm.pricing, currency: e.target.value}})} className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary">
                  <option value="INR">INR</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300 block mb-2">Period</label>
                <select value={planForm.pricing.period} onChange={e => setPlanForm({...planForm, pricing: {...planForm.pricing, period: e.target.value}})} className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary">
                  <option value="one-time">One-Time</option>
                  <option value="monthly">Monthly (/mo)</option>
                  <option value="yearly">Yearly (/yr)</option>
                </select>
              </div>
              <div className="flex items-center gap-3 pt-6">
                <input type="checkbox" id="isStartingAt" checked={planForm.pricing.isStartingAt} onChange={e => setPlanForm({...planForm, pricing: {...planForm.pricing, isStartingAt: e.target.checked}})} className="w-5 h-5 bg-black/50 border border-white/10 rounded text-primary focus:ring-primary cursor-pointer" />
                <label htmlFor="isStartingAt" className="text-sm font-medium text-gray-300 cursor-pointer">Append '+'</label>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-300 block mb-2">Features (One per line) *</label>
              <textarea required rows={6} value={planForm.features} onChange={e => setPlanForm({...planForm, features: e.target.value})} placeholder="Custom UI/UX design&#10;SEO-friendly architecture&#10;Fully responsive design" className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary resize-none" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="text-sm font-medium text-gray-300 block mb-2">Display Order</label>
                <input type="number" value={planForm.order} onChange={e => setPlanForm({...planForm, order: parseInt(e.target.value) || 0})} className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300 block mb-2">Status</label>
                <select value={planForm.status} onChange={e => setPlanForm({...planForm, status: e.target.value})} className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="flex items-center gap-3 pt-6">
                <input type="checkbox" id="highlight" checked={planForm.highlight} onChange={e => setPlanForm({...planForm, highlight: e.target.checked})} className="w-5 h-5 bg-black/50 border border-white/10 rounded text-primary focus:ring-primary cursor-pointer" />
                <label htmlFor="highlight" className="text-sm font-medium text-gray-300 cursor-pointer">Best Choice Highlight</label>
              </div>
            </div>

            <h3 className="text-lg font-bold text-white border-b border-white/10 pb-2 mt-6">SEO Fields</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-medium text-gray-300 block mb-2">Meta Title</label>
                <input type="text" value={planForm.seo.metaTitle} onChange={e => setPlanForm({...planForm, seo: {...planForm.seo, metaTitle: e.target.value}})} className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300 block mb-2">Meta Keywords</label>
                <input type="text" value={planForm.seo.keywords} onChange={e => setPlanForm({...planForm, seo: {...planForm.seo, keywords: e.target.value}})} placeholder="Comma separated" className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-300 block mb-2">Meta Description</label>
              <textarea rows={2} value={planForm.seo.metaDescription} onChange={e => setPlanForm({...planForm, seo: {...planForm.seo, metaDescription: e.target.value}})} className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary resize-none" />
            </div>

            <div className="flex justify-end pt-6 border-t border-white/10">
              <button type="submit" disabled={isSaving} className="flex items-center gap-2 px-8 py-2.5 bg-primary text-black font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer">
                {isSaving ? <Loader className="w-5 h-5 animate-spin" /> : 'Save Plan'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Listing View */}
      {!isCategoryModalOpen && !isPlanModalOpen && (
        <>
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Pricing Management</h1>
              <p className="text-gray-400 text-sm mt-1">Manage pricing categories, plans, and SEO metrics.</p>
            </div>
          </div>

          <div className="border-b border-white/10 my-6">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              <button onClick={() => setActiveTab('plans')} className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors ${activeTab === 'plans' ? 'border-[#FF6B00] text-[#FF6B00]' : 'border-transparent text-gray-400 hover:border-gray-300 hover:text-gray-300'}`}>
                Pricing Plans
              </button>
              <button onClick={() => setActiveTab('categories')} className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors ${activeTab === 'categories' ? 'border-[#FF6B00] text-[#FF6B00]' : 'border-transparent text-gray-400 hover:border-gray-300 hover:text-gray-300'}`}>
                Categories
              </button>
            </nav>
          </div>

          {activeTab === 'plans' && (
            <div>
              <div className="flex justify-end mb-6">
                <button onClick={openAddPlan} className="flex items-center gap-2 px-4 py-2 bg-primary text-black font-medium rounded-lg hover:bg-primary/90 transition-colors cursor-pointer">
                  <Plus className="w-4 h-4" /> Add Plan
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {plans.map((item) => (
                  <div key={item._id} className={`bg-[#1a1a1a] border ${item.status === 'inactive' ? 'border-red-500/50' : 'border-white/10'} rounded-xl p-6 relative flex flex-col`}>
                    {item.highlight && (
                      <span className="absolute -top-2 -right-2 bg-primary text-black text-[10px] font-bold px-2 py-1 rounded shadow">
                        BEST CHOICE
                      </span>
                    )}
                    <h3 className="text-lg font-bold text-white mb-1">{item.title}</h3>
                    <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full uppercase tracking-wider inline-block mb-3">
                      {item.category?.name || 'Uncategorized'}
                    </span>
                    <p className="text-xs text-gray-400 mb-3">{item.tech}</p>
                    <div className="text-xl font-black text-white mb-4">
                      {item.pricing?.amount} {item.pricing?.currency} {item.pricing?.isStartingAt ? '+' : ''} {item.pricing?.period === 'monthly' ? '/mo' : ''}
                    </div>
                    
                    <div className="flex items-center justify-between pt-4 border-t border-white/10 mt-auto">
                      <button onClick={() => openEditPlan(item)} className="p-2 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded transition-colors cursor-pointer" title="Edit">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDelete(item._id, 'plan')} className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded transition-colors cursor-pointer" title="Delete">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'categories' && (
            <div>
              <div className="flex justify-end mb-6">
                <button onClick={openAddCategory} className="flex items-center gap-2 px-4 py-2 bg-primary text-black font-medium rounded-lg hover:bg-primary/90 transition-colors cursor-pointer">
                  <Plus className="w-4 h-4" /> Add Category
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {categories.map((item) => (
                  <div key={item._id} className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6 relative flex flex-col">
                    <h3 className="text-lg font-bold text-white mb-2">{item.name}</h3>
                    <p className="text-xs text-gray-400 mb-4">{item.description}</p>
                    <div className="flex items-center justify-between pt-4 border-t border-white/10 mt-auto">
                      <button onClick={() => openEditCategory(item)} className="p-2 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded transition-colors cursor-pointer" title="Edit">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDelete(item._id, 'category')} className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded transition-colors cursor-pointer" title="Delete">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
              <h3 className="text-xl font-bold text-white mb-2">Delete {deleteModal.type === 'category' ? 'Category' : 'Plan'}</h3>
              <p className="text-gray-400 mb-6 text-sm">
                Are you sure? This action cannot be undone. {deleteModal.type === 'category' && 'Deleting a category will NOT delete its plans automatically.'}
              </p>
              <div className="flex gap-3 w-full">
                <button type="button" onClick={() => setDeleteModal({ isOpen: false, itemId: null, type: null })} disabled={isDeleting} className="flex-1 px-4 py-2.5 border border-white/10 rounded-lg text-gray-300 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50 cursor-pointer">
                  Cancel
                </button>
                <button type="button" onClick={confirmDelete} disabled={isDeleting} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 cursor-pointer">
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
