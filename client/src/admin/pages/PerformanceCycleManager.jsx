import { useState, useEffect } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { Plus, Play, Lock, Calendar, ChevronRight, BarChart2, X } from 'lucide-react';

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1];

const BAND_COLORS = {
  Active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Draft:  'bg-orange-500/10 text-orange-400 border-orange-500/20',
  Closed: 'bg-surface-variant text-app-text-muted border-app-border',
};

const PerformanceCycleManager = () => {
  const [cycles, setCycles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [form, setForm] = useState({
    quarter: 'Q1',
    year: CURRENT_YEAR,
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    fetchCycles();
  }, []);

  const fetchCycles = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/performance/cycles');
      if (res.data.success) setCycles(res.data.cycles);
    } catch {
      toast.error('Failed to load performance cycles.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.startDate || !form.endDate) {
      toast.error('Start and End dates are required.');
      return;
    }
    setIsSaving(true);
    try {
      const title = `${form.quarter} ${form.year} — Performance Cycle`;
      const res = await api.post('/performance/cycles', { ...form, title, year: Number(form.year) });
      if (res.data.success) {
        toast.success('Cycle created successfully!');
        setShowModal(false);
        setForm({ quarter: 'Q1', year: CURRENT_YEAR, startDate: '', endDate: '' });
        fetchCycles();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create cycle.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (cycleId, newStatus) => {
    const label = newStatus === 'Active' ? 'activate' : 'close';
    if (!window.confirm(`Are you sure you want to ${label} this cycle? ${newStatus === 'Active' ? 'All other active cycles will be closed.' : ''}`)) return;
    try {
      const res = await api.put(`/performance/cycles/${cycleId}`, { status: newStatus });
      if (res.data.success) {
        toast.success(`Cycle ${label}d successfully!`);
        fetchCycles();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to ${label} cycle.`);
    }
  };

  return (
    <div className="text-app-text space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
            <Calendar className="text-orange-500" size={28} />
            Performance Cycles
          </h1>
          <p className="text-app-text-muted text-sm mt-1">Create and manage quarterly performance review cycles.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-medium transition-all shadow-lg hover:shadow-orange-500/20 active:scale-[0.98] cursor-pointer"
        >
          <Plus size={18} /> New Cycle
        </button>
      </div>

      {/* Info Banner */}
      <div className="bg-orange-500/5 border border-orange-500/15 rounded-xl p-4 text-sm text-orange-300">
        <span className="font-bold text-orange-400">Note:</span> Only one cycle can be <span className="font-bold">Active</span> at a time. Activating a new cycle will automatically close any currently active one.
      </div>

      {/* Cycle Cards */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 rounded-full border-2 border-orange-500/20 border-t-orange-500 animate-spin" />
        </div>
      ) : cycles.length === 0 ? (
        <div className="text-center py-20 bg-app-card rounded-xl border border-app-border text-app-text-muted">
          No cycles created yet. Click <strong className="text-app-text">New Cycle</strong> to get started.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {cycles.map(cycle => (
            <div key={cycle._id} className="bg-app-card border border-app-border rounded-2xl p-5 space-y-4 hover:border-app-text-muted/40 transition-colors">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-xs text-app-text-muted uppercase tracking-wider mb-1">{cycle.quarter} · {cycle.year}</div>
                  <h3 className="font-bold text-app-text text-base leading-tight">{cycle.title}</h3>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${BAND_COLORS[cycle.status]}`}>
                  {cycle.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-app-bg rounded-lg p-3 border border-app-border">
                  <div className="text-app-text-muted mb-0.5">Start Date</div>
                  <div className="font-bold text-app-text">{new Date(cycle.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                </div>
                <div className="bg-app-bg rounded-lg p-3 border border-app-border">
                  <div className="text-app-text-muted mb-0.5">End Date</div>
                  <div className="font-bold text-app-text">{new Date(cycle.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                </div>
              </div>

              <div className="text-xs text-app-text-muted">
                Created by: <span className="text-app-text-muted">{cycle.createdBy?.email || 'Admin'}</span>
              </div>

              <div className="flex gap-2 pt-1 border-t border-app-border">
                {cycle.status === 'Draft' && (
                  <button
                    onClick={() => handleStatusChange(cycle._id, 'Active')}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-xs font-bold transition-colors cursor-pointer border border-emerald-500/20"
                  >
                    <Play size={12} /> Activate
                  </button>
                )}
                {cycle.status === 'Active' && (
                  <>
                    <button
                      onClick={() => handleStatusChange(cycle._id, 'Closed')}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-surface-variant text-app-text-muted hover:bg-app-border text-xs font-bold transition-colors cursor-pointer border border-app-border"
                    >
                      <Lock size={12} /> Close Cycle
                    </button>
                    <a
                      href="/admin/performance-goals"
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 text-xs font-bold transition-colors border border-orange-500/20"
                    >
                      <BarChart2 size={12} /> Assign KPIs <ChevronRight size={12} />
                    </a>
                  </>
                )}
                {cycle.status === 'Closed' && (
                  <div className="flex-1 text-center py-2 text-xs text-app-text-muted font-medium">Cycle Closed</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-app-card border border-app-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center p-5 border-b border-app-border">
              <div>
                <h2 className="text-lg font-bold">Create New Cycle</h2>
                <p className="text-xs text-app-text-muted mt-0.5">Define the quarter, year, and date range.</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-app-text-muted hover:text-app-text cursor-pointer transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-app-text-muted mb-1.5">Quarter <span className="text-orange-500">*</span></label>
                  <select
                    value={form.quarter}
                    onChange={e => setForm(f => ({ ...f, quarter: e.target.value }))}
                    className="w-full text-sm rounded-lg border border-app-border bg-form-input-bg px-4 py-2.5 text-app-text focus:outline-none focus:ring-1 focus:ring-orange-500"
                  >
                    {QUARTERS.map(q => <option key={q}>{q}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-app-text-muted mb-1.5">Year <span className="text-orange-500">*</span></label>
                  <select
                    value={form.year}
                    onChange={e => setForm(f => ({ ...f, year: e.target.value }))}
                    className="w-full text-sm rounded-lg border border-app-border bg-form-input-bg px-4 py-2.5 text-app-text focus:outline-none focus:ring-1 focus:ring-orange-500"
                  >
                    {YEARS.map(y => <option key={y}>{y}</option>)}
                  </select>
                </div>
              </div>

              <div className="bg-app-bg rounded-lg p-3 border border-app-border">
                <div className="text-xs text-app-text-muted mb-1">Preview Title</div>
                <div className="font-bold text-orange-400 text-sm">{form.quarter} {form.year} — Performance Cycle</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-app-text-muted mb-1.5">Start Date <span className="text-orange-500">*</span></label>
                  <input
                    type="date"
                    required
                    value={form.startDate}
                    onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                    className="w-full text-sm rounded-lg border border-app-border bg-form-input-bg px-4 py-2.5 text-app-text focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-app-text-muted mb-1.5">End Date <span className="text-orange-500">*</span></label>
                  <input
                    type="date"
                    required
                    min={form.startDate}
                    value={form.endDate}
                    onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                    className="w-full text-sm rounded-lg border border-app-border bg-form-input-bg px-4 py-2.5 text-app-text focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-lg border border-app-border text-app-text-muted hover:bg-surface-variant hover:text-app-text transition-all cursor-pointer text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-semibold transition-all cursor-pointer text-sm disabled:opacity-60"
                >
                  {isSaving ? 'Creating...' : 'Create Cycle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PerformanceCycleManager;
