import React, { useState, useEffect } from 'react';
import { contentService } from '../../services/contentService';
import { Save, Loader, Plus, Pencil, Trash2, Loader2, ArrowUp, ArrowDown } from 'lucide-react';

export default function StatsManager({ isNested = false }) {
  const [stats, setStats] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingStat, setEditingStat] = useState(null);
  const [statToDelete, setStatToDelete] = useState(null);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 20;

  const [formData, setFormData] = useState({
    value: '',
    suffix: '',
    label: '',
    icon: '',
    order: 0,
    isActive: true,
  });

  const fetchStats = async () => {
    try {
      setIsLoading(true);
      const data = await contentService.getStatsCounterAdmin(page, limit);
      if (data.data) {
        setStats(data.data.stats || []);
        setTotalPages(data.data.pagination?.pages || 1);
      }
    } catch (error) {
      alert('Failed to load stats');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [page]);

  const handleOpenModal = (stat = null) => {
    if (stat) {
      setEditingStat(stat);
      setFormData({ ...stat });
    } else {
      setEditingStat(null);
      setFormData({
        value: '',
        suffix: '',
        label: '',
        icon: '',
        order: stats.length + 1,
        isActive: true,
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingStat(null);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (editingStat) {
        await contentService.updateStat(editingStat._id, formData);
        // Optimistic update
        setStats(stats.map(s => s._id === editingStat._id ? { ...s, ...formData } : s));
      } else {
        await contentService.createStat(formData);
        fetchStats(); // Refetch for pagination sync
      }
      handleCloseModal();
    } catch (error) {
      alert('Failed to save stat');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = (stat) => {
    setStatToDelete(stat);
  };

  const handleDelete = async () => {
    if (!statToDelete) return;
    try {
      await contentService.deleteStat(statToDelete._id);
      // Optimistic update
      setStats(stats.filter(s => s._id !== statToDelete._id));
      setStatToDelete(null);
    } catch (error) {
      alert('Failed to delete stat');
      console.error(error);
    }
  };

  // Quick visibility toggle
  const toggleVisibility = async (stat) => {
    try {
      const updatedStatus = !stat.isActive;
      // Optimistic update
      setStats(stats.map(s => s._id === stat._id ? { ...s, isActive: updatedStatus } : s));
      await contentService.updateStat(stat._id, { isActive: updatedStatus });
    } catch (error) {
      alert('Failed to update status');
      // Revert optimistic update on failure
      setStats(stats.map(s => s._id === stat._id ? { ...s, isActive: stat.isActive } : s));
    }
  };

  const handleMove = async (index, direction) => {
    if (
      (direction === -1 && index === 0) || 
      (direction === 1 && index === stats.length - 1)
    ) return;
    
    const newStats = [...stats];
    const item = newStats[index];
    const swapItem = newStats[index + direction];
    
    const itemOrder = item.order;
    item.order = swapItem.order;
    swapItem.order = itemOrder;

    // Optimistic sorting
    setStats(newStats.sort((a, b) => a.order - b.order));
    
    try {
      await Promise.all([
        contentService.updateStat(item._id, { order: item.order }),
        contentService.updateStat(swapItem._id, { order: swapItem.order })
      ]);
    } catch (err) {
      alert('Failed to update order');
      fetchStats();
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 text-[#FF6B00] animate-spin" />
      </div>
    );
  }

  return (
    <div className={isNested ? "space-y-6" : "max-w-4xl mx-auto space-y-6"}>
      {!isNested && (
        <div>
          <h1 className="text-2xl font-bold text-app-text">Manage Stats Counter</h1>
          <p className="mt-1 text-sm text-app-text-muted">
            Customize the animated counters displayed on the homepage.
          </p>
        </div>
      )}

      <div className="bg-app-card border border-app-border rounded-xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-app-border flex justify-between items-center bg-app-card">
          <h2 className="text-lg font-semibold text-app-text">Stats Cards</h2>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2 bg-[#FF6B00] text-white text-sm font-semibold rounded-lg hover:bg-[#e66000] transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Stat
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-app-border">
            <thead className="bg-surface-variant">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-app-text-muted uppercase">Order</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-app-text-muted uppercase">Label</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-app-text-muted uppercase">Value</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-app-text-muted uppercase">Icon</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-app-text-muted uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-app-text-muted uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {stats.map((stat, index) => (
                <tr key={stat._id} className="hover:bg-surface-variant transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-app-text-muted">
                    <div className="flex flex-col gap-1 items-center w-min">
                      <button 
                        onClick={() => handleMove(index, -1)}
                        disabled={index === 0}
                        className="text-app-text-muted hover:text-app-text disabled:opacity-30"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <span className="text-xs font-medium">{stat.order}</span>
                      <button 
                        onClick={() => handleMove(index, 1)}
                        disabled={index === stats.length - 1}
                        className="text-app-text-muted hover:text-app-text disabled:opacity-30"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-app-text font-medium">{stat.label}</td>
                  <td className="px-6 py-4 text-sm text-app-text-muted">{stat.value}{stat.suffix}</td>
                  <td className="px-6 py-4 text-sm text-app-text-muted">{stat.icon}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button 
                      onClick={() => toggleVisibility(stat)}
                      className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full transition-colors ${
                        stat.isActive ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      {stat.isActive ? 'Active' : 'Hidden'}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                    <button onClick={() => handleOpenModal(stat)} className="text-[#FF6B00] hover:text-[#e66000]">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => confirmDelete(stat)} className="text-red-500 hover:text-red-400">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {stats.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-app-text-muted text-sm">
                    No stats found. Click "Add Stat" to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-app-border flex justify-between items-center bg-app-card">
            <button 
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 bg-surface-variant border border-app-border rounded-lg text-sm text-app-text disabled:opacity-50 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Previous
            </button>
            <span className="text-sm text-app-text-muted">Page {page} of {totalPages}</span>
            <button 
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 bg-surface-variant border border-app-border rounded-lg text-sm text-app-text disabled:opacity-50 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-app-card rounded-xl shadow-2xl border border-app-border w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-app-border flex justify-between items-center">
              <h3 className="text-xl font-bold text-app-text">
                {editingStat ? 'Edit Stat' : 'Add New Stat'}
              </h3>
              <button onClick={handleCloseModal} className="text-app-text-muted hover:text-app-text">
                <span className="text-2xl leading-none">&times;</span>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-app-text mb-1">Label (e.g. Clients Served)</label>
                  <input
                    type="text"
                    name="label"
                    required
                    className="w-full rounded-lg border border-app-border bg-form-input-bg px-4 py-2.5 text-app-text focus:border-[#FF6B00] outline-none transition-colors"
                    value={formData.label}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-app-text mb-1">Value (Number)</label>
                  <input
                    type="number"
                    name="value"
                    required
                    className="w-full rounded-lg border border-app-border bg-form-input-bg px-4 py-2.5 text-app-text focus:border-[#FF6B00] outline-none transition-colors"
                    value={formData.value}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-app-text mb-1">Suffix (e.g. +, %)</label>
                  <input
                    type="text"
                    name="suffix"
                    className="w-full rounded-lg border border-app-border bg-form-input-bg px-4 py-2.5 text-app-text focus:border-[#FF6B00] outline-none transition-colors"
                    value={formData.suffix}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-app-text mb-1">Icon Name (Lucide)</label>
                  <input
                    type="text"
                    name="icon"
                    required
                    placeholder="e.g. Users, Layers"
                    className="w-full rounded-lg border border-app-border bg-form-input-bg px-4 py-2.5 text-app-text focus:border-[#FF6B00] outline-none transition-colors"
                    value={formData.icon}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-app-text mb-1">Order</label>
                  <input
                    type="number"
                    name="order"
                    required
                    className="w-full rounded-lg border border-app-border bg-form-input-bg px-4 py-2.5 text-app-text focus:border-[#FF6B00] outline-none transition-colors"
                    value={formData.order}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  name="isActive"
                  id="isActive"
                  className="w-4 h-4 rounded bg-form-input-bg border-app-border text-[#FF6B00] focus:ring-[#FF6B00]"
                  checked={formData.isActive}
                  onChange={handleChange}
                />
                <label htmlFor="isActive" className="text-sm font-medium text-app-text cursor-pointer">
                  Active (Visible on Homepage)
                </label>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-app-border">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 border border-app-border rounded-lg text-sm font-medium text-app-text-muted hover:bg-surface-variant transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-2.5 bg-[#FF6B00] text-white font-semibold rounded-lg hover:bg-[#e66000] disabled:opacity-70 shadow-sm"
                >
                  {isSaving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Stat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {statToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-app-card rounded-xl shadow-2xl border border-app-border w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-app-text text-center mb-2">Delete Stat</h3>
              <p className="text-app-text-muted text-sm text-center mb-6">
                Are you sure you want to delete <span className="text-app-text font-semibold">{statToDelete.label}</span>? This action cannot be undone.
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setStatToDelete(null)}
                  className="flex-1 px-4 py-2 border border-app-border rounded-lg text-sm font-medium text-app-text-muted hover:bg-surface-variant transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 px-4 py-2 bg-red-500 text-white text-sm font-semibold rounded-lg hover:bg-red-600 shadow-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
