import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import {
  FolderOpen, Plus, Search, X, Save,
  ChevronLeft, ChevronRight, Trash2, Edit2, Filter, LayoutList, Shield
} from 'lucide-react';

const emptyForm = () => ({
  client_ref: '', packageName: '', monthlyAmount: '', billingCycle: 'Monthly',
  supportHoursPerMonth: '', hoursUsedThisMonth: 0,
  contractStartDate: '', contractEndDate: '',
  status: 'Active', autoRenew: false, renewalNotes: ''
});

const STATUS_COLORS = {
  'Active': 'bg-green-500/10 text-green-400 border-green-500/20',
  'Paused': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'Expired': 'bg-red-500/10 text-red-400 border-red-500/20',
  'Cancelled': 'bg-gray-500/10 text-gray-400 border-gray-500/20',
};

export default function RetainerManager() {
  const [retainers, setRetainers] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/admin/clients', { params: { limit: 200 } })
      .then(r => setClients(r.data.data || []));
  }, []);

  const fetchRetainers = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 15 };
      if (statusFilter) params.status = statusFilter;
      const r = await api.get('/admin/retainers', { params });
      setRetainers(r.data.data || []);
      setPagination(r.data.pagination || {});
    } catch { toast.error('Failed to load retainers'); }
    finally { setLoading(false); }
  }, [page, statusFilter]);

  useEffect(() => { fetchRetainers(); }, [fetchRetainers]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showModal]);

  const openCreate = () => { setEditTarget(null); setForm(emptyForm()); setShowModal(true); };
  
  const openEdit = (ret) => {
    setEditTarget(ret);
    setForm({
      client_ref: ret.client_ref?._id || '',
      packageName: ret.packageName || '',
      monthlyAmount: ret.monthlyAmount || '',
      billingCycle: ret.billingCycle || 'Monthly',
      supportHoursPerMonth: ret.supportHoursPerMonth || '',
      hoursUsedThisMonth: ret.hoursUsedThisMonth || 0,
      contractStartDate: ret.contractStartDate?.split('T')[0] || '',
      contractEndDate: ret.contractEndDate?.split('T')[0] || '',
      status: ret.status || 'Active',
      autoRenew: !!ret.autoRenew,
      renewalNotes: ret.renewalNotes || ''
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (form.contractStartDate && form.contractEndDate) {
      if (new Date(form.contractEndDate) < new Date(form.contractStartDate)) {
        return toast.error('Contract end date cannot be before the start date');
      }
    }

    setSaving(true);
    try {
      const payload = { ...form };
      if (editTarget) {
        await api.put(`/admin/retainers/${editTarget._id}`, payload);
        toast.success('Retainer updated');
      } else {
        await api.post('/admin/retainers', payload);
        toast.success('Retainer created');
      }
      setShowModal(false);
      fetchRetainers();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const deleteRetainer = async (id) => {
    if (!window.confirm('Delete this retainer contract?')) return;
    try {
      await api.delete(`/admin/retainers/${id}`);
      toast.success('Retainer deleted');
      fetchRetainers();
    } catch { toast.error('Failed to delete'); }
  };

  const handleNumberChange = (k) => (e) => {
    let val = e.target.value;
    if (val.length > 1 && val.startsWith('0') && !val.startsWith('0.')) {
      val = val.replace(/^0+/, '');
    }
    setForm(p => ({ ...p, [k]: val }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-on-surface font-heading">Retainer Manager</h1>
          <p className="text-on-surface-variant text-sm mt-1">Manage client retainers and support hours</p>
        </div>
        <div className="flex gap-3">
          <div className="bg-secondary/10 text-secondary px-4 py-2 rounded-lg font-bold text-sm">
            {pagination.total} Contracts
          </div>
          <button onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-secondary text-white rounded-lg text-sm font-medium hover:bg-secondary/90 cursor-pointer">
            <Plus size={15} /> New Retainer
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 items-center">
        <Filter size={14} className="text-on-surface-variant" />
        {['', 'Active', 'Paused', 'Expired', 'Cancelled'].map(s => (
          <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-all ${
              statusFilter === s ? 'bg-secondary/15 text-secondary border-secondary/30' : 'bg-admin-bg text-on-surface-variant border-outline-variant hover:text-on-surface'
            }`}>
            {s || 'All'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-surface border border-outline-variant rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-7 h-7 border-2 border-secondary/30 border-t-secondary rounded-full animate-spin" />
          </div>
        ) : retainers.length === 0 ? (
          <div className="text-center py-16">
            <Shield size={36} className="text-outline-variant mx-auto mb-3" />
            <p className="text-on-surface-variant">No retainers found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-admin-bg border-b border-outline-variant text-on-surface-variant text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left">ID</th>
                  <th className="px-4 py-3 text-left">Package & Client</th>
                  <th className="px-4 py-3 text-left">Value</th>
                  <th className="px-4 py-3 text-left hidden md:table-cell">Timeline</th>
                  <th className="px-4 py-3 text-center">Hours (Used / Total)</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {retainers.map(ret => (
                  <tr key={ret._id} className="hover:bg-surface-container-low transition-colors">
                    <td className="px-4 py-3 font-mono text-secondary text-xs">{ret.retainerId}</td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-on-surface">{ret.packageName}</span>
                      <p className="text-on-surface-variant text-xs mt-0.5">{ret.client_ref?.businessName || '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant text-xs">
                      <span className="text-on-surface font-semibold">₹{ret.monthlyAmount?.toLocaleString('en-IN')}</span> / {ret.billingCycle}
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant text-xs hidden md:table-cell">
                      {ret.contractStartDate && new Date(ret.contractStartDate).toLocaleDateString('en-IN')} <br />
                      <span className="text-[10px]">to</span> {ret.contractEndDate && new Date(ret.contractEndDate).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="inline-flex flex-col items-center">
                        <span className="text-xs font-semibold text-on-surface">
                          {ret.hoursUsedThisMonth} <span className="text-on-surface-variant font-normal">/ {ret.supportHoursPerMonth}h</span>
                        </span>
                        <div className="w-20 h-1 mt-1 bg-surface-variant rounded-full overflow-hidden">
                          <div className={`h-full transition-all ${(ret.hoursUsedThisMonth / ret.supportHoursPerMonth) > 0.8 ? 'bg-red-500' : 'bg-secondary'}`} 
                               style={{ width: `${Math.min((ret.hoursUsedThisMonth / ret.supportHoursPerMonth) * 100, 100)}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center border rounded-full text-[10px] font-medium px-2.5 py-0.5 ${STATUS_COLORS[ret.status] || ''}`}>
                        {ret.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => openEdit(ret)} title="Edit"
                          className="p-1.5 text-secondary hover:bg-secondary/10 rounded-lg cursor-pointer">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => deleteRetainer(ret._id)} title="Delete"
                          className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg cursor-pointer">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-outline-variant">
            <p className="text-on-surface-variant text-xs">Page {pagination.page} of {pagination.totalPages}</p>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className="p-1.5 rounded-lg bg-admin-bg border border-outline-variant text-on-surface-variant hover:text-on-surface disabled:opacity-40 cursor-pointer">
                <ChevronLeft size={14} />
              </button>
              <button disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}
                className="p-1.5 rounded-lg bg-admin-bg border border-outline-variant text-on-surface-variant hover:text-on-surface disabled:opacity-40 cursor-pointer">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-3xl bg-surface border border-outline-variant rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant bg-admin-bg">
              <h3 className="text-on-surface font-semibold">{editTarget ? 'Edit Retainer' : 'Create Retainer'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-surface-container-low text-on-surface-variant cursor-pointer"><X size={16} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto custom-scrollbar">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-on-surface-variant text-xs font-medium mb-1.5">Client *</label>
                  <select value={form.client_ref} onChange={e => setForm(p => ({ ...p, client_ref: e.target.value }))} required
                    className="w-full px-3 py-2 bg-admin-bg border border-outline-variant rounded-xl text-on-surface text-sm focus:outline-none focus:border-secondary">
                    <option value="">Select client…</option>
                    {clients.map(c => <option key={c._id} value={c._id}>{c.businessName} — {c.clientId}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-on-surface-variant text-xs font-medium mb-1.5">Package Name *</label>
                  <input type="text" required value={form.packageName} onChange={e => setForm(p => ({ ...p, packageName: e.target.value }))}
                    className="w-full px-3 py-2 bg-admin-bg border border-outline-variant rounded-xl text-on-surface text-sm focus:outline-none focus:border-secondary" />
                </div>

                <div>
                  <label className="block text-on-surface-variant text-xs font-medium mb-1.5">Recurring Amount *</label>
                  <input type="number" required min="0" value={form.monthlyAmount} onChange={handleNumberChange('monthlyAmount')}
                    className="w-full px-3 py-2 bg-admin-bg border border-outline-variant rounded-xl text-on-surface text-sm focus:outline-none focus:border-secondary" />
                </div>
                <div>
                  <label className="block text-on-surface-variant text-xs font-medium mb-1.5">Billing Cycle *</label>
                  <select value={form.billingCycle} onChange={e => setForm(p => ({ ...p, billingCycle: e.target.value }))} required
                    className="w-full px-3 py-2 bg-admin-bg border border-outline-variant rounded-xl text-on-surface text-sm focus:outline-none focus:border-secondary">
                    {['Monthly', 'Quarterly', 'Annual'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-on-surface-variant text-xs font-medium mb-1.5">Total Hours / Month *</label>
                  <input type="number" required min="0" value={form.supportHoursPerMonth} onChange={handleNumberChange('supportHoursPerMonth')}
                    className="w-full px-3 py-2 bg-admin-bg border border-outline-variant rounded-xl text-on-surface text-sm focus:outline-none focus:border-secondary" />
                </div>
                <div>
                  <label className="block text-on-surface-variant text-xs font-medium mb-1.5">Hours Used (This Month)</label>
                  <input type="number" min="0" value={form.hoursUsedThisMonth} onChange={handleNumberChange('hoursUsedThisMonth')}
                    className="w-full px-3 py-2 bg-admin-bg border border-outline-variant rounded-xl text-on-surface text-sm focus:outline-none focus:border-secondary" />
                </div>

                <div>
                  <label className="block text-on-surface-variant text-xs font-medium mb-1.5">Contract Start Date *</label>
                  <input type="date" required value={form.contractStartDate} onChange={e => setForm(p => ({ ...p, contractStartDate: e.target.value }))}
                    className="w-full px-3 py-2 bg-admin-bg border border-outline-variant rounded-xl text-on-surface text-sm focus:outline-none focus:border-secondary [color-scheme:dark]" />
                </div>
                <div>
                  <label className="block text-on-surface-variant text-xs font-medium mb-1.5">Contract End Date *</label>
                  <input type="date" required value={form.contractEndDate} onChange={e => setForm(p => ({ ...p, contractEndDate: e.target.value }))}
                    className="w-full px-3 py-2 bg-admin-bg border border-outline-variant rounded-xl text-on-surface text-sm focus:outline-none focus:border-secondary [color-scheme:dark]" />
                </div>
              </div>

              <div>
                <label className="block text-on-surface-variant text-xs font-medium mb-1.5">Status</label>
                <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                  className="w-full max-w-xs px-3 py-2 bg-admin-bg border border-outline-variant rounded-xl text-on-surface text-sm focus:outline-none focus:border-secondary">
                  {['Active', 'Paused', 'Expired', 'Cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.autoRenew} onChange={e => setForm(p => ({ ...p, autoRenew: e.target.checked }))}
                    className="w-4 h-4 rounded border-outline-variant bg-admin-bg accent-secondary" />
                  <span className="text-sm text-on-surface">Auto-renew contract</span>
                </label>
              </div>

              <div>
                <label className="block text-on-surface-variant text-xs font-medium mb-1.5">Renewal/Internal Notes (Hidden from client)</label>
                <textarea value={form.renewalNotes} onChange={e => setForm(p => ({ ...p, renewalNotes: e.target.value }))} rows={2}
                  className="w-full px-3 py-2 bg-admin-bg border border-outline-variant rounded-xl text-on-surface text-sm focus:outline-none focus:border-secondary resize-none" />
              </div>

              <div className="flex gap-3 pt-4 border-t border-outline-variant">
                <button type="submit" disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 bg-secondary text-white rounded-xl text-sm font-medium hover:bg-secondary/90 disabled:opacity-60 cursor-pointer">
                  {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={14} />}
                  {editTarget ? 'Update Retainer' : 'Create Retainer'}
                </button>
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 bg-admin-bg border border-outline-variant text-on-surface-variant hover:text-on-surface rounded-xl text-sm cursor-pointer">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
