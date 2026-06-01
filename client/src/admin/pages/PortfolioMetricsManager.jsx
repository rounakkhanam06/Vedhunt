import React, { useState, useEffect } from 'react';
import { contentService } from '../../services/contentService';
import { Save, Loader, Plus, Pencil, Trash2, Loader2, ArrowUp, ArrowDown } from 'lucide-react';

export default function PortfolioMetricsManager({ isNested = false }) {
  const [metrics, setMetrics] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingMetric, setEditingMetric] = useState(null);
  const [metricToDelete, setMetricToDelete] = useState(null);

  const [formData, setFormData] = useState({
    numericValue: '',
    suffix: '',
    label: '',
    desc: '',
    icon: '',
    order: 0,
    isActive: true,
  });

  const fetchMetrics = async () => {
    try {
      setIsLoading(true);
      const data = await contentService.getPortfolioMetricsAdmin();
      if (data.data) {
        setMetrics(data.data || []);
      }
    } catch (error) {
      alert('Failed to load portfolio metrics');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  const handleOpenModal = (metric = null) => {
    if (metric) {
      setEditingMetric(metric);
      setFormData({ ...metric });
    } else {
      setEditingMetric(null);
      setFormData({
        numericValue: '',
        suffix: '',
        label: '',
        desc: '',
        icon: '',
        order: metrics.length + 1,
        isActive: true,
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingMetric(null);
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
      if (editingMetric) {
        await contentService.updatePortfolioMetric(editingMetric._id, formData);
        // Optimistic update
        setMetrics(metrics.map(m => m._id === editingMetric._id ? { ...m, ...formData } : m));
      } else {
        await contentService.createPortfolioMetric(formData);
        fetchMetrics(); // Refetch for synchronization
      }
      handleCloseModal();
    } catch (error) {
      alert('Failed to save portfolio metric');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = (metric) => {
    setMetricToDelete(metric);
  };

  const handleDelete = async () => {
    if (!metricToDelete) return;
    try {
      await contentService.deletePortfolioMetric(metricToDelete._id);
      // Optimistic update
      setMetrics(metrics.filter(m => m._id !== metricToDelete._id));
      setMetricToDelete(null);
    } catch (error) {
      alert('Failed to delete portfolio metric');
      console.error(error);
    }
  };

  const toggleVisibility = async (metric) => {
    try {
      const updatedStatus = !metric.isActive;
      // Optimistic update
      setMetrics(metrics.map(m => m._id === metric._id ? { ...m, isActive: updatedStatus } : m));
      await contentService.updatePortfolioMetric(metric._id, { isActive: updatedStatus });
    } catch (error) {
      alert('Failed to update visibility status');
      // Revert optimistic update on failure
      setMetrics(metrics.map(m => m._id === metric._id ? { ...m, isActive: metric.isActive } : m));
    }
  };

  const handleMove = async (index, direction) => {
    if (
      (direction === -1 && index === 0) || 
      (direction === 1 && index === metrics.length - 1)
    ) return;
    
    const newMetrics = [...metrics];
    const item = newMetrics[index];
    const swapItem = newMetrics[index + direction];
    
    const itemOrder = item.order;
    item.order = swapItem.order;
    swapItem.order = itemOrder;

    // Optimistic sorting
    setMetrics(newMetrics.sort((a, b) => a.order - b.order));
    
    try {
      await Promise.all([
        contentService.updatePortfolioMetric(item._id, { order: item.order }),
        contentService.updatePortfolioMetric(swapItem._id, { order: swapItem.order })
      ]);
    } catch (err) {
      alert('Failed to update order');
      fetchMetrics();
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
          <h1 className="text-2xl font-bold text-white">Manage Portfolio Metrics</h1>
          <p className="mt-1 text-sm text-gray-400">
            Customize the animated counters displayed on the portfolio page.
          </p>
        </div>
      )}

      <div className="bg-[#222222] border border-white/10 rounded-xl overflow-hidden shadow-xl">
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-[#1A1A1A]">
          <h2 className="text-lg font-semibold text-white">Portfolio Metrics Cards</h2>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2 bg-[#FF6B00] text-white text-sm font-semibold rounded-lg hover:bg-[#e66000] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Metric
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10">
            <thead className="bg-[#1A1A1A]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase w-20">Order</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Label</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Value</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Description</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Icon</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {metrics.map((metric, index) => (
                <tr key={metric._id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    <div className="flex flex-col gap-1 items-center w-min">
                      <button 
                        onClick={() => handleMove(index, -1)}
                        disabled={index === 0}
                        className="text-gray-500 hover:text-white disabled:opacity-30"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <span className="text-xs">{metric.order}</span>
                      <button 
                        onClick={() => handleMove(index, 1)}
                        disabled={index === metrics.length - 1}
                        className="text-gray-500 hover:text-white disabled:opacity-30"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-white font-medium">{metric.label}</td>
                  <td className="px-6 py-4 text-sm text-gray-300 whitespace-nowrap">{metric.numericValue}{metric.suffix}</td>
                  <td className="px-6 py-4 text-sm text-gray-400 max-w-xs truncate">{metric.desc}</td>
                  <td className="px-6 py-4 text-sm text-gray-400">{metric.icon}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button 
                      onClick={() => toggleVisibility(metric)}
                      className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full transition-colors ${
                        metric.isActive ? 'bg-green-100/10 text-green-400 hover:bg-green-100/20' : 'bg-gray-100/10 text-gray-400 hover:bg-gray-100/20'
                      }`}
                    >
                      {metric.isActive ? 'Active' : 'Hidden'}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                    <button onClick={() => handleOpenModal(metric)} className="text-[#FF6B00] hover:text-[#e66000]">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => confirmDelete(metric)} className="text-red-500 hover:text-red-400">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {metrics.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-gray-500 text-sm">
                    No metrics found. Click "Add Metric" to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#222222] rounded-xl shadow-2xl border border-white/10 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-white/10 flex justify-between items-center">
              <h3 className="text-xl font-bold text-white">
                {editingMetric ? 'Edit Portfolio Metric' : 'Add New Portfolio Metric'}
              </h3>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-white">
                <span className="text-2xl leading-none">&times;</span>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1">Label (e.g. Deployments Delivered)</label>
                  <input
                    type="text"
                    name="label"
                    required
                    className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-4 py-2 text-white focus:border-[#FF6B00] outline-none"
                    value={formData.label}
                    onChange={handleChange}
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1">Description (e.g. Secure web systems...)</label>
                  <textarea
                    name="desc"
                    required
                    rows={2}
                    className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-4 py-2 text-white focus:border-[#FF6B00] outline-none resize-none"
                    value={formData.desc}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Value (Number)</label>
                  <input
                    type="number"
                    name="numericValue"
                    required
                    className="w-full rounded-lg border border-white/10 bg-[#1A1A1A] px-4 py-2 text-white focus:border-[#FF6B00] outline-none"
                    value={formData.numericValue}
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
                    placeholder="e.g. Zap, Award, Share2, Database"
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
                  Active (Visible on Portfolio Page)
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
                  Save Metric
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {metricToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-[#222222] rounded-xl shadow-2xl border border-white/10 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-white text-center mb-2">Delete Metric</h3>
              <p className="text-gray-400 text-sm text-center mb-6">
                Are you sure you want to delete <span className="text-white font-semibold">{metricToDelete.label}</span>? This action cannot be undone.
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setMetricToDelete(null)}
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
