import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import {
  MessageCircle, Search, X, Save, Plus,
  ChevronLeft, ChevronRight, Trash2, Edit2, Filter, AlertCircle, Clock
} from 'lucide-react';

const emptyForm = () => ({
  client_ref: '', subject: '', description: '', category: 'General Inquiry',
  priority: 'Medium', status: 'Open', resolution: ''
});

const STATUS_COLORS = {
  'Open': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'In Progress': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'Pending Client': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  'Resolved': 'bg-green-500/10 text-green-400 border-green-500/20',
  'Closed': 'bg-gray-500/10 text-gray-400 border-gray-500/20',
};

const PRIORITY_COLORS = {
  'Low': 'text-green-400',
  'Medium': 'text-blue-400',
  'High': 'text-amber-400',
  'Critical': 'text-red-500',
};

export default function SupportDeskManager() {
  const [tickets, setTickets] = useState([]);
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

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 15 };
      if (statusFilter) params.status = statusFilter;
      const r = await api.get('/admin/tickets', { params });
      setTickets(r.data.data || []);
      setPagination(r.data.pagination || {});
    } catch { toast.error('Failed to load tickets'); }
    finally { setLoading(false); }
  }, [page, statusFilter]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const openCreate = () => { setEditTarget(null); setForm(emptyForm()); setShowModal(true); };
  
  const openEdit = (t) => {
    setEditTarget(t);
    setForm({
      client_ref: t.client_ref?._id || '',
      subject: t.subject || '',
      description: t.description || '',
      category: t.category || 'General Inquiry',
      priority: t.priority || 'Medium',
      status: t.status || 'Open',
      resolution: t.resolution || ''
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form };
      if (editTarget) {
        await api.put(`/admin/tickets/${editTarget._id}`, payload);
        toast.success('Ticket updated');
      } else {
        await api.post('/admin/tickets', payload);
        toast.success('Ticket created');
      }
      setShowModal(false);
      fetchTickets();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const deleteTicket = async (id) => {
    if (!window.confirm('Delete this support ticket?')) return;
    try {
      await api.delete(`/admin/tickets/${id}`);
      toast.success('Ticket deleted');
      fetchTickets();
    } catch { toast.error('Failed to delete'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-on-surface font-heading">Support Desk</h1>
          <p className="text-on-surface-variant text-sm mt-1">Manage client support tickets & SLA deadlines</p>
        </div>
        <div className="flex gap-3">
          <div className="bg-secondary/10 text-secondary px-4 py-2 rounded-lg font-bold text-sm">
            {pagination.total} Tickets
          </div>
          <button onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-secondary text-white rounded-lg text-sm font-medium hover:bg-secondary/90 cursor-pointer">
            <Plus size={15} /> Open Ticket
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Filter size={14} className="text-on-surface-variant" />
        {['', 'Open', 'In Progress', 'Pending Client', 'Resolved', 'Closed'].map(s => (
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
        ) : tickets.length === 0 ? (
          <div className="text-center py-16">
            <MessageCircle size={36} className="text-outline-variant mx-auto mb-3" />
            <p className="text-on-surface-variant">No tickets found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-admin-bg border-b border-outline-variant text-on-surface-variant text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left">Ticket</th>
                  <th className="px-4 py-3 text-left">Subject & Client</th>
                  <th className="px-4 py-3 text-center">Priority</th>
                  <th className="px-4 py-3 text-left hidden md:table-cell">Category</th>
                  <th className="px-4 py-3 text-center">SLA Deadline</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {tickets.map(t => (
                  <tr key={t._id} className="hover:bg-surface-container-low transition-colors">
                    <td className="px-4 py-3 font-mono text-secondary text-xs">{t.ticketId}</td>
                    <td className="px-4 py-3 max-w-[200px] truncate">
                      <span className="font-semibold text-on-surface">{t.subject}</span>
                      <p className="text-on-surface-variant text-xs mt-0.5">{t.client_ref?.businessName || '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-center font-medium">
                      <span className={PRIORITY_COLORS[t.priority] || 'text-on-surface'}>{t.priority}</span>
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant text-xs hidden md:table-cell">{t.category}</td>
                    <td className="px-4 py-3 text-center text-xs">
                      {['Resolved', 'Closed'].includes(t.status) ? (
                        <span className="text-on-surface-variant">Done</span>
                      ) : t.isSLABreached ? (
                        <span className="flex items-center justify-center gap-1 text-red-500 font-bold bg-red-500/10 px-2 py-1 rounded-md">
                          <AlertCircle size={12}/> Breached
                        </span>
                      ) : (
                        <div className="flex flex-col items-center">
                          <span className="text-on-surface flex items-center gap-1">
                            <Clock size={12} className="text-amber-500"/>
                            {new Date(t.slaDeadline).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center border rounded-full text-[10px] font-medium px-2.5 py-0.5 ${STATUS_COLORS[t.status] || ''}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => openEdit(t)} title="Edit"
                          className="p-1.5 text-secondary hover:bg-secondary/10 rounded-lg cursor-pointer">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => deleteTicket(t._id)} title="Delete"
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
              <h3 className="text-on-surface font-semibold">{editTarget ? 'Edit Support Ticket' : 'Create Support Ticket'}</h3>
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
                  <label className="block text-on-surface-variant text-xs font-medium mb-1.5">Category *</label>
                  <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} required
                    className="w-full px-3 py-2 bg-admin-bg border border-outline-variant rounded-xl text-on-surface text-sm focus:outline-none focus:border-secondary">
                    {['Bug Report', 'Feature Request', 'General Inquiry', 'Urgent Fix'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-on-surface-variant text-xs font-medium mb-1.5">Subject *</label>
                  <input type="text" required maxLength="200" value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
                    className="w-full px-3 py-2 bg-admin-bg border border-outline-variant rounded-xl text-on-surface text-sm focus:outline-none focus:border-secondary" />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-on-surface-variant text-xs font-medium mb-1.5">Issue Description *</label>
                  <textarea required value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={4}
                    className="w-full px-3 py-2 bg-admin-bg border border-outline-variant rounded-xl text-on-surface text-sm focus:outline-none focus:border-secondary resize-none" />
                </div>
                
                <div>
                  <label className="block text-on-surface-variant text-xs font-medium mb-1.5">Priority Level</label>
                  <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}
                    className={`w-full px-3 py-2 bg-admin-bg border border-outline-variant rounded-xl text-sm font-semibold focus:outline-none focus:border-secondary ${PRIORITY_COLORS[form.priority]}`}>
                    {['Low', 'Medium', 'High', 'Critical'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {!editTarget && <p className="text-[10px] text-on-surface-variant mt-1">SLA deadline is auto-calculated based on priority.</p>}
                </div>

                <div>
                  <label className="block text-on-surface-variant text-xs font-medium mb-1.5">Ticket Status</label>
                  <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                    className="w-full px-3 py-2 bg-admin-bg border border-outline-variant rounded-xl text-on-surface text-sm focus:outline-none focus:border-secondary">
                    {['Open', 'In Progress', 'Pending Client', 'Resolved', 'Closed'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-on-surface-variant text-xs font-medium mb-1.5">Internal Resolution Notes (Hidden from client)</label>
                  <textarea value={form.resolution} onChange={e => setForm(p => ({ ...p, resolution: e.target.value }))} rows={3}
                    placeholder="Enter resolution notes, root cause, or internal discussion..."
                    className="w-full px-3 py-2 bg-admin-bg border border-outline-variant rounded-xl text-on-surface text-sm focus:outline-none focus:border-secondary resize-none" />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-outline-variant">
                <button type="submit" disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 bg-secondary text-white rounded-xl text-sm font-medium hover:bg-secondary/90 disabled:opacity-60 cursor-pointer">
                  {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={14} />}
                  {editTarget ? 'Update Ticket' : 'Create Ticket'}
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
