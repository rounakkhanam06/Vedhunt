import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Loader, Edit2, Trash2, Plus, Tag, Eye, EyeOff } from 'lucide-react';

export default function BlogCategoryManager() {
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const initialFormState = {
    name: '',
    isActive: true
  };

  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/blog-categories');
      setCategories(res.data?.data || []);
    } catch (error) {
      alert('Failed to load blog categories');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteCategory = async (id) => {
    if (!window.confirm('Are you sure you want to delete this category?')) return;
    
    // Store previous categories for rollback
    const prevCategories = [...categories];
    // Optimistic UI update: remove it instantly
    setCategories(prev => prev.filter(cat => cat._id !== id));

    try {
      await api.delete(`/blog-categories/${id}`);
      // We don't need to fetchCategories() because we already removed it from UI
    } catch (error) {
      // Revert optimistic update on failure
      setCategories(prevCategories);
      alert(error.response?.data?.message || 'Failed to delete category');
      console.error(error);
    }
  };

  const toggleStatus = async (category) => {
    // Optimistic UI update for instant feedback
    setCategories(prev => 
      prev.map(cat => 
        cat._id === category._id ? { ...cat, isActive: !cat.isActive } : cat
      )
    );

    try {
      await api.put(`/blog-categories/${category._id}`, { isActive: !category.isActive });
      // We don't strictly need to fetchCategories here since we updated state optimistically,
      // but it's safe to sync silently in the background if preferred. We'll skip it to keep it fully instant.
    } catch (error) {
      // Revert optimistic update on failure
      setCategories(prev => 
        prev.map(cat => 
          cat._id === category._id ? { ...cat, isActive: category.isActive } : cat
        )
      );
      alert('Failed to update status');
      console.error(error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (editingId) {
        await api.put(`/blog-categories/${editingId}`, formData);
        alert('Category updated successfully!');
      } else {
        await api.post('/blog-categories', formData);
        alert('Category added successfully!');
      }
      setIsModalOpen(false);
      setFormData(initialFormState);
      setEditingId(null);
      fetchCategories();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to save category');
    } finally {
      setIsSaving(false);
    }
  };

  const openAddModal = () => {
    setEditingId(null);
    setFormData(initialFormState);
    setIsModalOpen(true);
  };

  const openEditModal = (category) => {
    setEditingId(category._id);
    setFormData({
      name: category.name,
      isActive: category.isActive
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
    <div className="space-y-8">
      <div className="flex items-center justify-between border-b border-app-border pb-4">
        <div>
          <h2 className="text-xl font-bold text-app-text">Categories</h2>
          <p className="text-app-text-muted text-sm mt-1">Manage categories for your blog posts.</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 bg-[#FF6B00] text-white font-semibold rounded-lg hover:bg-[#e66000] transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" /> Add Category
        </button>
      </div>

      {categories.length === 0 ? (
        <div className="text-center text-app-text-muted py-12 bg-app-card rounded-xl border border-app-border shadow-sm">
          <Tag className="w-12 h-12 mx-auto mb-3 opacity-30 text-app-text-muted" />
          <p>No categories found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((category) => (
            <div key={category._id} className="bg-app-card border border-app-border rounded-xl p-6 relative flex flex-col shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-app-text">{category.name}</h3>
                </div>
              </div>
              
              <div className="space-y-1 mb-6 text-sm text-app-text-muted flex-1">
                <p className="flex items-center gap-2">
                  <strong className="text-app-text">Status:</strong>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    category.isActive 
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
                  }`}>
                    {category.isActive ? 'Active' : 'Inactive'}
                  </span>
                </p>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-app-border mt-auto">
                <div className="flex gap-2">
                  <button 
                    onClick={() => openEditModal(category)}
                    className="p-2 bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => toggleStatus(category)}
                    className={`p-2 rounded-lg transition-colors cursor-pointer ${
                      category.isActive 
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20' 
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                    title={category.isActive ? 'Deactivate' : 'Activate'}
                  >
                    {category.isActive ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                </div>
                
                <button 
                  onClick={() => deleteCategory(category._id)}
                  className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg transition-colors"
                  title="Delete Category"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-app-card border border-app-border rounded-xl p-6 w-full max-w-md relative shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-xl font-bold text-app-text mb-6">
              {editingId ? 'Edit Category' : 'Add New Category'}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-app-text block mb-1">Category Name *</label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. TECHNOLOGY"
                  className="w-full bg-form-input-bg border border-app-border rounded-lg px-4 py-2.5 text-app-text placeholder-app-text-muted focus:outline-none focus:border-[#FF6B00] uppercase transition-colors"
                />
              </div>

              <div className="flex items-center gap-2 mt-4">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-[#FF6B00] bg-form-input-bg border-app-border rounded focus:ring-[#FF6B00]"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-app-text">
                  Active
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-app-border mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 border border-app-border rounded-lg text-sm font-medium text-app-text-muted hover:bg-surface-variant transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-2.5 bg-[#FF6B00] text-white font-semibold rounded-lg hover:bg-[#e66000] transition-colors disabled:opacity-50 shadow-sm"
                >
                  {isSaving ? <Loader className="w-4 h-4 animate-spin" /> : 'Save Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
