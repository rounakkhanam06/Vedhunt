import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { Loader, Plus, Edit2, Trash2, X } from 'lucide-react';

const emptyForm = { label: '', badge: '', displayOrder: 0, isActive: true };
const inputCls =
  'w-full bg-form-input-bg border border-app-border rounded-lg px-4 py-2.5 text-app-text focus:outline-none focus:border-primary transition-colors';

// Admin CRUD for portfolio showcase categories (the filter tabs on /portfolio).
export default function PortfolioCategoriesManager({ onChange }) {
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const load = async () => {
    try {
      const res = await api.get('/portfolio/admin/categories');
      setCategories(res.data.data || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load categories');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...emptyForm, displayOrder: categories.length + 1 });
    setIsFormOpen(true);
  };

  const openEdit = (cat) => {
    setEditingId(cat._id);
    setForm({ label: cat.label, badge: cat.badge || '', displayOrder: cat.displayOrder || 0, isActive: cat.isActive });
    setIsFormOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (editingId) {
        await api.put(`/portfolio/admin/categories/${editingId}`, form);
        toast.success('Category updated');
      } else {
        await api.post('/portfolio/admin/categories', form);
        toast.success('Category created');
      }
      setIsFormOpen(false);
      await load();
      onChange?.();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save category');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (cat) => {
    if (!window.confirm(`Delete category "${cat.label}"?`)) return;
    try {
      await api.delete(`/portfolio/admin/categories/${cat._id}`);
      toast.success('Category deleted');
      await load();
      onChange?.();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete category');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-app-text">Showcase Categories</h2>
          <p className="text-sm text-app-text-muted">These appear as filter tabs on the Portfolio page.</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-[#FF6B00] hover:bg-[#e66000] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Add Category
        </button>
      </div>

      {isFormOpen && (
        <form onSubmit={handleSubmit} className="rounded-xl bg-app-card p-6 border border-app-border space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-app-text">{editingId ? 'Edit Category' : 'New Category'}</h3>
            <button type="button" onClick={() => setIsFormOpen(false)} className="text-app-text-muted hover:text-app-text cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-app-text-muted block mb-2">Tab Name *</label>
              <input
                required
                maxLength={80}
                className={inputCls}
                placeholder="e.g. Mobile Apps"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-app-text-muted block mb-2">Card Badge Text</label>
              <input
                maxLength={40}
                className={inputCls}
                placeholder="Short label shown on cards (defaults to tab name)"
                value={form.badge}
                onChange={(e) => setForm({ ...form, badge: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-app-text-muted block mb-2">Display Order</label>
              <input
                type="number"
                className={inputCls}
                value={form.displayOrder}
                onChange={(e) => setForm({ ...form, displayOrder: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-app-text-muted block mb-2">Show on Portfolio Page?</label>
              <select
                className={inputCls}
                value={form.isActive ? 'yes' : 'no'}
                onChange={(e) => setForm({ ...form, isActive: e.target.value === 'yes' })}
              >
                <option value="yes">Yes, show as a filter tab</option>
                <option value="no">No, hide this tab</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 bg-[#FF6B00] hover:bg-[#e66000] text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isSaving && <Loader className="w-4 h-4 animate-spin" />}
              {editingId ? 'Save Changes' : 'Create Category'}
            </button>
          </div>
        </form>
      )}

      <div className="rounded-xl bg-app-card border border-app-border overflow-x-auto">
        <table className="min-w-full divide-y divide-app-border text-sm">
          <thead className="bg-app-bg">
            <tr className="text-left text-xs uppercase tracking-wider text-app-text-muted">
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Tab Name</th>
              <th className="px-4 py-3">Badge</th>
              <th className="px-4 py-3">Showcases</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-app-border">
            {categories.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-4 py-8 text-center text-app-text-muted">No categories yet.</td>
              </tr>
            ) : (
              categories.map((cat) => (
                <tr key={cat._id} className="text-app-text">
                  <td className="px-4 py-3">{cat.displayOrder}</td>
                  <td className="px-4 py-3 font-medium">{cat.label}</td>
                  <td className="px-4 py-3 text-app-text-muted">{cat.badge || '—'}</td>
                  <td className="px-4 py-3">{cat.itemCount}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs border ${cat.isActive ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-gray-500/10 text-app-text-muted border-app-border'}`}>
                      {cat.isActive ? 'Visible' : 'Hidden'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => openEdit(cat)} className="p-1.5 text-[#FF6B00] hover:bg-orange-500/10 rounded-lg cursor-pointer" title="Edit">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(cat)} className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg cursor-pointer" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
