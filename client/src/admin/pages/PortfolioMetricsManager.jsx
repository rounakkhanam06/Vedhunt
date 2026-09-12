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
          <h1 className="text-2xl font-bold text-app-text">Manage Portfolio Metrics</h1>
          <p className="mt-1 text-sm text-app-text-muted">
            Customize the animated counters displayed on the portfolio page.
          </p>
        </div>
      )}

      <div className="bg-app-card border border-app-border rounded-xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-app-border flex justify-between items-center bg-app-bg">
          <h2 className="text-lg font-semibold text-app-text">Portfolio Metrics Cards</h2>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2 bg-[#FF6B00] text-white text-sm font-semibold rounded-lg hover:bg-[#e66000] transition-colors cursor-pointer shadow-[0_4px_15px_rgba(255,107,0,0.2)]"
          >
            <Plus className="w-4 h-4" />
            Add Metric
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-app-border">
            <thead className="bg-app-bg">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-app-text-muted uppercase w-20">Order</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-app-text-muted uppercase">Label</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-app-text-muted uppercase">Value</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-app-text-muted uppercase">Description</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-app-text-muted uppercase">Icon</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-app-text-muted uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-app-text-muted uppercase w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-app-card divide-y divide-app-border">
              {metrics.map((metric, index) => (
                <tr key={metric._id} className="hover:bg-surface-variant transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-app-text">
                    <div className="flex flex-col gap-1 items-center w-min">
                      <button 
                        onClick={() => handleMove(index, -1)}
                        disabled={index === 0}
                        className="text-app-text-muted hover:text-app-text disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <span className="text-xs font-mono">{metric.order}</span>
                      <button 
                        onClick={() => handleMove(index, 1)}
                        disabled={index === metrics.length - 1}
                        className="text-app-text-muted hover:text-app-text disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-app-text font-semibold">{metric.label}</td>
                  <td className="px-6 py-4 text-sm text-app-text whitespace-nowrap font-medium">{metric.numericValue}{metric.suffix}</td>
                  <td className="px-6 py-4 text-sm text-app-text-muted max-w-xs truncate">{metric.desc}</td>
                  <td className="px-6 py-4 text-sm text-app-text-muted font-mono">{metric.icon}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button 
                      onClick={() => toggleVisibility(metric)}
                      className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full transition-colors cursor-pointer border ${
                        metric.isActive ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      {metric.isActive ? 'Active' : 'Hidden'}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-1">
                    <button onClick={() => handleOpenModal(metric)} className="text-[#FF6B00] hover:text-[#e66000] p-1.5 rounded-lg hover:bg-orange-500/10 transition-colors cursor-pointer" title="Edit">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => confirmDelete(metric)} className="text-red-500 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {metrics.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-app-text-muted text-sm">
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
          <div className="bg-app-card rounded-xl shadow-2xl border border-app-border w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-app-border flex justify-between items-center">
              <h3 className="text-xl font-bold text-app-text">
                {editingMetric ? 'Edit Portfolio Metric' : 'Add New Portfolio Metric'}
              </h3>
              <button onClick={handleCloseModal} className="text-app-text-muted hover:text-app-text cursor-pointer">
                <span className="text-2xl leading-none">&times;</span>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-app-text-muted mb-1">Label (e.g. Deployments Delivered)</label>
                  <input
                    type="text"
                    name="label"
                    required
                    className="w-full rounded-lg border border-app-border bg-form-input-bg px-4 py-2 text-app-text focus:border-[#FF6B00] outline-none transition-colors placeholder-app-text-muted"
                    value={formData.label}
                    onChange={handleChange}
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-app-text-muted mb-1">Description (e.g. Secure web systems...)</label>
                  <textarea
                    name="desc"
                    required
                    rows={2}
                    className="w-full rounded-lg border border-app-border bg-form-input-bg px-4 py-2 text-app-text focus:border-[#FF6B00] outline-none resize-none transition-colors placeholder-app-text-muted"
                    value={formData.desc}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-app-text-muted mb-1">Value (Number)</label>
                  <input
                    type="number"
                    name="numericValue"
                    required
                    className="w-full rounded-lg border border-app-border bg-form-input-bg px-4 py-2 text-app-text focus:border-[#FF6B00] outline-none transition-colors placeholder-app-text-muted"
                    value={formData.numericValue}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-app-text-muted mb-1">Suffix (e.g. +, %)</label>
                  <input
                    type="text"
                    name="suffix"
                    className="w-full rounded-lg border border-app-border bg-form-input-bg px-4 py-2 text-app-text focus:border-[#FF6B00] outline-none transition-colors placeholder-app-text-muted"
                    value={formData.suffix}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-app-text-muted mb-1">Icon Name (Lucide)</label>
                  <input
                    type="text"
                    name="icon"
                    required
                    placeholder="e.g. Zap, Award, Share2, Database"
                    className="w-full rounded-lg border border-app-border bg-form-input-bg px-4 py-2 text-app-text focus:border-[#FF6B00] outline-none transition-colors placeholder-app-text-muted"
                    value={formData.icon}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-app-text-muted mb-1">Order</label>
                  <input
                    type="number"
                    name="order"
                    required
                    className="w-full rounded-lg border border-app-border bg-form-input-bg px-4 py-2 text-app-text focus:border-[#FF6B00] outline-none transition-colors placeholder-app-text-muted"
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
                  className="w-4 h-4 rounded bg-form-input-bg border-app-border text-[#FF6B00] focus:ring-[#FF6B00] cursor-pointer"
                  checked={formData.isActive}
                  onChange={handleChange}
                />
                <label htmlFor="isActive" className="text-sm font-medium text-app-text cursor-pointer select-none">
                  Active (Visible on Portfolio Page)
                </label>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-app-border">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 border border-app-border rounded-lg text-sm font-medium text-app-text hover:bg-surface-variant transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-2 bg-[#FF6B00] text-white font-semibold rounded-lg hover:bg-[#e66000] disabled:opacity-70 transition-colors cursor-pointer shadow-[0_4px_15px_rgba(255,107,0,0.2)]"
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
          <div className="bg-app-card rounded-xl shadow-2xl border border-app-border w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-app-text text-center mb-2">Delete Metric</h3>
              <p className="text-app-text-muted text-sm text-center mb-6">
                Are you sure you want to delete <span className="text-app-text font-semibold">{metricToDelete.label}</span>? This action cannot be undone.
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setMetricToDelete(null)}
                  className="flex-1 px-4 py-2 border border-app-border rounded-lg text-sm font-medium text-app-text hover:bg-surface-variant transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-semibold hover:bg-red-600 transition-colors cursor-pointer"
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
