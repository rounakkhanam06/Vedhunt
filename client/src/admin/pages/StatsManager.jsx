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
          <h1 className="text-2xl font-bold text-white">Manage Stats Counter</h1>
          <p className="mt-1 text-sm text-gray-400">
            Customize the animated counters displayed on the homepage.
          </p>
        </div>
      )}

      <div className="bg-[#222222] border border-white/10 rounded-xl overflow-hidden shadow-xl">
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-[#1A1A1A]">
          <h2 className="text-lg font-semibold text-white">Stats Cards</h2>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2 bg-[#FF6B00] text-white text-sm font-semibold rounded-lg hover:bg-[#e66000] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Stat
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10">
            <thead className="bg-[#1A1A1A]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Order</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Label</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Value</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Icon</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {stats.map((stat, index) => (
                <tr key={stat._id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    <div className="flex flex-col gap-1 items-center w-min">
                      <button 
                        onClick={() => handleMove(index, -1)}
                        disabled={index === 0}
                        className="text-gray-500 hover:text-white disabled:opacity-30"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <span className="text-xs">{stat.order}</span>
                      <button 
                        onClick={() => handleMove(index, 1)}
                        disabled={index === stats.length - 1}
                        className="text-gray-500 hover:text-white disabled:opacity-30"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-white font-medium">{stat.label}</td>
                  <td className="px-6 py-4 text-sm text-gray-300">{stat.value}{stat.suffix}</td>
                  <td className="px-6 py-4 text-sm text-gray-400">{stat.icon}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button 
                      onClick={() => toggleVisibility(stat)}
                      className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full transition-colors ${
                        stat.isActive ? 'bg-green-100/10 text-green-400 hover:bg-green-100/20' : 'bg-gray-100/10 text-gray-400 hover:bg-gray-100/20'
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
                  <td colSpan="6" className="px-6 py-8 text-center text-gray-500 text-sm">
                    No stats found. Click "Add Stat" to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-white/10 flex justify-between items-center bg-[#1A1A1A]">
            <button 
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 bg-white/5 border border-white/10 rounded text-sm text-white disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-gray-400">Page {page} of {totalPages}</span>
            <button 
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 bg-white/5 border border-white/10 rounded text-sm text-white disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#222222] rounded-xl shadow-2xl border border-white/10 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-white/10 flex justify-between items-center">
              <h3 className="text-xl font-bold text-white">
                {editingStat ? 'Edit Stat' : 'Add New Stat'}
              </h3>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-white">
                <Trash2 className="w-5 h-5 opacity-0 pointer-events-none" />
                <span className="text-2xl leading-none">&times;</span>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1">Label (e.g. Clients Served)</label>
                  <input
                    type="text"
                    name="label"
                    required
                    className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-4 py-2 text-white focus:border-[#FF6B00] outline-none"
                    value={formData.label}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Value (Number)</label>
                  <input
                    type="number"
                    name="value"
                    required
                    className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-4 py-2 text-white focus:border-[#FF6B00] outline-none"
                    value={formData.value}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Suffix (e.g. +, %)</label>
                  <input
                    type="text"
                    name="suffix"
                    className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-4 py-2 text-white focus:border-[#FF6B00] outline-none"
                    value={formData.suffix}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Icon Name (Lucide)</label>
                  <input
                    type="text"
                    name="icon"
                    required
                    placeholder="e.g. Users, Layers"
                    className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-4 py-2 text-white focus:border-[#FF6B00] outline-none"
                    value={formData.icon}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Order</label>
                  <input
                    type="number"
                    name="order"
                    required
                    className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-4 py-2 text-white focus:border-[#FF6B00] outline-none"
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
                  className="w-4 h-4 rounded bg-[#1A1A1A] border-white/10 text-[#FF6B00] focus:ring-[#FF6B00]"
                  checked={formData.isActive}
                  onChange={handleChange}
                />
                <label htmlFor="isActive" className="text-sm font-medium text-gray-300 cursor-pointer">
                  Active (Visible on Homepage)
                </label>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 border border-white/10 rounded-lg text-sm font-medium text-gray-300 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-2 bg-[#FF6B00] text-white font-semibold rounded-lg hover:bg-[#e66000] disabled:opacity-70"
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
          <div className="bg-[#222222] rounded-xl shadow-2xl border border-white/10 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-white text-center mb-2">Delete Stat</h3>
              <p className="text-gray-400 text-sm text-center mb-6">
                Are you sure you want to delete <span className="text-white font-semibold">{statToDelete.label}</span>? This action cannot be undone.
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setStatToDelete(null)}
                  className="flex-1 px-4 py-2 border border-white/10 rounded-lg text-sm font-medium text-gray-300 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 px-4 py-2 bg-red-500 text-white text-sm font-semibold rounded-lg hover:bg-red-600"
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
