import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import {
  FolderOpen, Plus, Search, X, Save,
  ChevronLeft, ChevronRight, Trash2, Edit2, Filter, LayoutList, Target
} from 'lucide-react';

const emptyForm = () => ({
  client_ref: '', projectName: '', startDate: '', expectedEndDate: '',
  internalNotes: '', status: 'Active',
  milestones: [{ title: '', internalDescription: '', status: 'Pending', targetDate: '', order: 1 }]
});

const STATUS_COLORS = {
  'Active': 'bg-green-500/10 text-green-400 border-green-500/20',
  'On Hold': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'Completed': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'Cancelled': 'bg-red-500/10 text-red-400 border-red-500/20',
};

export default function ProjectManager() {
  const [projects, setProjects] = useState([]);
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

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 15 };
      if (statusFilter) params.status = statusFilter;
      const r = await api.get('/admin/projects', { params });
      setProjects(r.data.data || []);
      setPagination(r.data.pagination || {});
    } catch { toast.error('Failed to load projects'); }
    finally { setLoading(false); }
  }, [page, statusFilter]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

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
  
  const openEdit = (prj) => {
    setEditTarget(prj);
    setForm({
      client_ref: prj.client_ref?._id || '',
      projectName: prj.projectName || '',
      startDate: prj.startDate?.split('T')[0] || '',
      expectedEndDate: prj.expectedEndDate?.split('T')[0] || '',
      internalNotes: prj.internalNotes || '',
      status: prj.status || 'Active',
      milestones: prj.milestones?.length ? prj.milestones.map(m => ({
        ...m,
        targetDate: m.targetDate?.split('T')[0] || '',
        completedOn: m.completedOn?.split('T')[0] || ''
      })) : []
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (form.startDate && form.expectedEndDate) {
      if (new Date(form.expectedEndDate) < new Date(form.startDate)) {
        return toast.error('Expected end date cannot be before the start date');
      }
    }

    setSaving(true);
    try {
      const payload = { ...form };
      if (editTarget) {
        await api.put(`/admin/projects/${editTarget._id}`, payload);
        toast.success('Project updated');
      } else {
        await api.post('/admin/projects', payload);
        toast.success('Project created');
      }
      setShowModal(false);
      fetchProjects();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const deleteProject = async (id) => {
    if (!window.confirm('Delete this project?')) return;
    try {
      await api.delete(`/admin/projects/${id}`);
      toast.success('Project deleted');
      fetchProjects();
    } catch { toast.error('Failed to delete'); }
  };

  const updateMilestone = (i, k, v) =>
    setForm(p => {
      const m = [...p.milestones];
      m[i] = { ...m[i], [k]: v };
      if (k === 'status' && v === 'Completed') m[i].completedOn = new Date().toISOString().split('T')[0];
      if (k === 'status' && v !== 'Completed') m[i].completedOn = '';
      return { ...p, milestones: m };
    });

  const addMilestone = () => setForm(p => ({
    ...p,
    milestones: [...p.milestones, { title: '', internalDescription: '', status: 'Pending', targetDate: '', order: p.milestones.length + 1 }]
  }));
  const removeMilestone = (i) => setForm(p => ({ ...p, milestones: p.milestones.filter((_, idx) => idx !== i) }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-on-surface font-heading">Project Manager</h1>
          <p className="text-on-surface-variant text-sm mt-1">Track client project progress &amp; milestones</p>
        </div>
        <div className="flex gap-3">
          <div className="bg-secondary/10 text-secondary px-4 py-2 rounded-lg font-bold text-sm">
            {pagination.total} Projects
          </div>
          <button onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-secondary text-white rounded-lg text-sm font-medium hover:bg-secondary/90 cursor-pointer">
            <Plus size={15} /> New Project
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 items-center">
        <Filter size={14} className="text-on-surface-variant" />
        {['', 'Active', 'On Hold', 'Completed', 'Cancelled'].map(s => (
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
        ) : projects.length === 0 ? (
          <div className="text-center py-16">
            <FolderOpen size={36} className="text-outline-variant mx-auto mb-3" />
            <p className="text-on-surface-variant">No projects found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-admin-bg border-b border-outline-variant text-on-surface-variant text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left">Project ID</th>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Client</th>
                  <th className="px-4 py-3 text-left hidden md:table-cell">Timeline</th>
                  <th className="px-4 py-3 text-center">Progress</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {projects.map(prj => (
                  <tr key={prj._id} className="hover:bg-surface-container-low transition-colors">
                    <td className="px-4 py-3 font-mono text-secondary text-xs">{prj.projectId}</td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-on-surface">{prj.projectName}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-on-surface text-xs">{prj.client_ref?.businessName || '—'}</p>
                      <p className="text-on-surface-variant text-[10px]">{prj.client_ref?.clientId}</p>
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant text-xs hidden md:table-cell">
                      {prj.startDate && new Date(prj.startDate).toLocaleDateString('en-IN')} <br />
                      <span className="text-[10px]">to</span> {prj.expectedEndDate ? new Date(prj.expectedEndDate).toLocaleDateString('en-IN') : 'TBD'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 max-w-[120px] mx-auto">
                        <div className="h-1.5 w-full bg-surface-variant rounded-full overflow-hidden">
                          <div className="h-full bg-secondary transition-all" style={{ width: `${prj.overallProgress}%` }} />
                        </div>
                        <span className="text-[10px] font-medium text-on-surface-variant">{prj.overallProgress}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center border rounded-full text-[10px] font-medium px-2.5 py-0.5 ${STATUS_COLORS[prj.status] || ''}`}>
                        {prj.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => openEdit(prj)} title="Edit"
                          className="p-1.5 text-secondary hover:bg-secondary/10 rounded-lg cursor-pointer">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => deleteProject(prj._id)} title="Delete"
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
              <h3 className="text-on-surface font-semibold">{editTarget ? 'Edit Project' : 'Create Project'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-surface-container-low text-on-surface-variant cursor-pointer"><X size={16} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto custom-scrollbar">
              
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-on-surface-variant text-xs font-medium mb-1.5">Project Name *</label>
                  <input type="text" required value={form.projectName} onChange={e => setForm(p => ({ ...p, projectName: e.target.value }))}
                    className="w-full px-3 py-2 bg-admin-bg border border-outline-variant rounded-xl text-on-surface text-sm focus:outline-none focus:border-secondary" />
                </div>
                <div>
                  <label className="block text-on-surface-variant text-xs font-medium mb-1.5">Client *</label>
                  <select value={form.client_ref} onChange={e => setForm(p => ({ ...p, client_ref: e.target.value }))} required
                    className="w-full px-3 py-2 bg-admin-bg border border-outline-variant rounded-xl text-on-surface text-sm focus:outline-none focus:border-secondary">
                    <option value="">Select client…</option>
                    {clients.map(c => <option key={c._id} value={c._id}>{c.businessName} — {c.clientId}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-on-surface-variant text-xs font-medium mb-1.5">Start Date</label>
                  <input type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))}
                    className="w-full px-3 py-2 bg-admin-bg border border-outline-variant rounded-xl text-on-surface text-sm focus:outline-none focus:border-secondary [color-scheme:dark]" />
                </div>
                <div>
                  <label className="block text-on-surface-variant text-xs font-medium mb-1.5">Expected End Date</label>
                  <input type="date" value={form.expectedEndDate} onChange={e => setForm(p => ({ ...p, expectedEndDate: e.target.value }))}
                    className="w-full px-3 py-2 bg-admin-bg border border-outline-variant rounded-xl text-on-surface text-sm focus:outline-none focus:border-secondary [color-scheme:dark]" />
                </div>
              </div>

              <div>
                <label className="block text-on-surface-variant text-xs font-medium mb-1.5">Internal Notes (Hidden from client)</label>
                <textarea value={form.internalNotes} onChange={e => setForm(p => ({ ...p, internalNotes: e.target.value }))} rows={2}
                  className="w-full px-3 py-2 bg-admin-bg border border-outline-variant rounded-xl text-on-surface text-sm focus:outline-none focus:border-secondary resize-none" />
              </div>

              <div>
                <label className="block text-on-surface-variant text-xs font-medium mb-1.5">Status</label>
                <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                  className="w-full max-w-xs px-3 py-2 bg-admin-bg border border-outline-variant rounded-xl text-on-surface text-sm focus:outline-none focus:border-secondary">
                  {['Active', 'On Hold', 'Completed', 'Cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <hr className="border-outline-variant" />

              {/* Milestones */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-on-surface font-semibold flex items-center gap-2"><Target size={16} className="text-secondary"/> Milestones</h4>
                  <button type="button" onClick={addMilestone}
                    className="px-3 py-1.5 text-xs font-medium bg-secondary/10 text-secondary rounded-lg hover:bg-secondary/20 cursor-pointer flex items-center gap-1">
                    <Plus size={12} /> Add Milestone
                  </button>
                </div>
                <div className="space-y-4">
                  {form.milestones.map((m, i) => (
                    <div key={i} className="bg-admin-bg border border-outline-variant rounded-xl p-4 relative group">
                      <button type="button" onClick={() => removeMilestone(i)} className="absolute top-3 right-3 text-on-surface-variant hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                        <X size={14} />
                      </button>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="lg:col-span-2">
                          <label className="text-[10px] text-on-surface-variant uppercase tracking-wider mb-1 block">Title *</label>
                          <input type="text" required value={m.title} onChange={e => updateMilestone(i, 'title', e.target.value)}
                            className="w-full px-2 py-1.5 bg-surface border border-outline-variant rounded text-on-surface text-xs focus:outline-none focus:border-secondary" />
                        </div>
                        <div>
                          <label className="text-[10px] text-on-surface-variant uppercase tracking-wider mb-1 block">Status</label>
                          <select value={m.status} onChange={e => updateMilestone(i, 'status', e.target.value)}
                            className="w-full px-2 py-1.5 bg-surface border border-outline-variant rounded text-on-surface text-xs focus:outline-none focus:border-secondary">
                            {['Pending', 'In Progress', 'Completed'].map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-on-surface-variant uppercase tracking-wider mb-1 block">Target Date</label>
                          <input type="date" value={m.targetDate} onChange={e => updateMilestone(i, 'targetDate', e.target.value)}
                            className="w-full px-2 py-1.5 bg-surface border border-outline-variant rounded text-on-surface text-xs focus:outline-none focus:border-secondary [color-scheme:dark]" />
                        </div>
                        <div className="lg:col-span-4">
                          <label className="text-[10px] text-on-surface-variant uppercase tracking-wider mb-1 block">Internal Description (Hidden from client)</label>
                          <input type="text" value={m.internalDescription} onChange={e => updateMilestone(i, 'internalDescription', e.target.value)}
                            className="w-full px-2 py-1.5 bg-surface border border-outline-variant rounded text-on-surface text-xs focus:outline-none focus:border-secondary" />
                        </div>
                      </div>
                    </div>
                  ))}
                  {form.milestones.length === 0 && (
                    <p className="text-center text-on-surface-variant text-sm py-4">No milestones defined yet.</p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-outline-variant">
                <button type="submit" disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 bg-secondary text-white rounded-xl text-sm font-medium hover:bg-secondary/90 disabled:opacity-60 cursor-pointer">
                  {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={14} />}
                  {editTarget ? 'Update Project' : 'Create Project'}
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
