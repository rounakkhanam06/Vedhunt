import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import {
  Users, Plus, Search, Eye, X, Edit2, ToggleLeft, ToggleRight,
  Mail, Phone, Building, UserCheck, Link2, ChevronLeft, ChevronRight, Save,
} from 'lucide-react';

const EMPTY_FORM = {
  businessName: '', contactName: '', email: '', phone: '',
  password: '', notes: '', leadRef: '',
};

export default function ClientManager() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [dSearch, setDSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [previewClient, setPreviewClient] = useState(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDSearch(search); setPage(1); }, 500);
    return () => clearTimeout(t);
  }, [search]);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/clients', { params: { page, limit: 15, search: dSearch } });
      setClients(res.data.data || []);
      setTotal(res.data.pagination?.total || 0);
      setTotalPages(res.data.pagination?.totalPages || 1);
    } catch { toast.error('Failed to load clients'); }
    finally { setLoading(false); }
  }, [page, dSearch]);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  // Lock scroll when modal or preview is open
  useEffect(() => {
    if (showModal || previewClient) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [showModal, previewClient]);

  const openCreate = () => { setSelectedClient(null); setForm(EMPTY_FORM); setShowModal(true); };

  const openEdit = (client) => {
    setSelectedClient(client);
    setForm({
      businessName: client.businessName || '',
      contactName: client.contactName || '',
      email: client.email || '',
      phone: client.phone || '',
      password: '',
      notes: client.notes || '',
      leadRef: client.leadRef?._id || client.leadRef || '',
    });
    setShowModal(true);
  };
  const openPreview = (client) => { setPreviewClient(client); };
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Frontend Validation
    if (form.businessName.length < 2 || form.businessName.length > 100) {
      return toast.error('Business name must be between 2 and 100 characters');
    }
    if (form.contactName.length < 2 || form.contactName.length > 50) {
      return toast.error('Contact name must be between 2 and 50 characters');
    }
    if (!/^[A-Za-z\s]+$/.test(form.contactName)) {
      return toast.error('Contact name cannot contain numbers or special characters');
    }
    if (form.phone && !/^\+?[1-9]\d{9,14}$/.test(form.phone)) {
      return toast.error('Please enter a valid phone number (10-15 digits)');
    }
    if (!/^\S+@\S+\.\S+$/.test(form.email)) {
      return toast.error('Please enter a valid email address');
    }

    setSaving(true);
    try {
      if (selectedClient) {
        const payload = { ...form };
        if (!payload.password) delete payload.password;
        else payload.newPassword = payload.password;
        delete payload.password;
        await api.put(`/admin/clients/${selectedClient._id}`, payload);
        toast.success('Client updated');
      } else {
        if (!form.password) return toast.error('Password is required for new clients');
        await api.post('/admin/clients', form);
        toast.success('Client account created & welcome email sent');
      }
      setShowModal(false);
      fetchClients();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const toggleActive = async (client) => {
    try {
      await api.put(`/admin/clients/${client._id}`, { isActive: !client.isActive });
      toast.success(`Client ${client.isActive ? 'deactivated' : 'activated'}`);
      fetchClients();
    } catch { toast.error('Failed to update status'); }
  };

  const f = (k) => (e) => {
    let val = e.target.value;
    if (k === 'contactName') {
      // Remove any characters that are not letters or spaces
      val = val.replace(/[^A-Za-z\s]/g, '');
    } else if (k === 'phone') {
      // Remove any characters that are not digits or +
      val = val.replace(/[^\d+]/g, '');
      // Limit to 15 characters max
      if (val.length > 15) val = val.substring(0, 15);
    }
    setForm((p) => ({ ...p, [k]: val }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-on-surface font-heading">Client Accounts</h1>
          <p className="text-on-surface-variant text-sm mt-1">Manage portal access for all clients</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-secondary/10 text-secondary px-4 py-2 rounded-lg font-bold text-sm">
            Total: {total}
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-secondary text-white rounded-lg text-sm font-medium hover:bg-secondary/90 transition-colors cursor-pointer"
          >
            <Plus size={16} /> New Client
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-surface border border-outline-variant rounded-xl p-4">
        <div className="relative max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input
            type="text"
            placeholder="Search by business name, contact, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-admin-bg border border-outline-variant rounded-lg pl-9 pr-4 py-2.5 text-sm text-on-surface focus:outline-none focus:border-secondary transition-colors"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface border border-outline-variant rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-7 h-7 border-2 border-secondary/30 border-t-secondary rounded-full animate-spin" />
          </div>
        ) : clients.length === 0 ? (
          <div className="text-center py-16">
            <Users size={40} className="text-outline-variant mx-auto mb-3" />
            <p className="text-on-surface-variant">No clients found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-admin-bg border-b border-outline-variant text-on-surface-variant text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Client ID</th>
                  <th className="px-4 py-3 text-left font-semibold">Business</th>
                  <th className="px-4 py-3 text-left font-semibold">Contact</th>
                  <th className="px-4 py-3 text-left font-semibold hidden md:table-cell">Email</th>
                  <th className="px-4 py-3 text-left font-semibold hidden lg:table-cell">Phone</th>
                  <th className="px-4 py-3 text-center font-semibold">Status</th>
                  <th className="px-4 py-3 text-center font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {clients.map((c) => (
                  <tr key={c._id} className="hover:bg-surface-container-low transition-colors">
                    <td className="px-4 py-3 font-mono text-secondary text-xs">{c.clientId}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-secondary/15 flex items-center justify-center shrink-0">
                          <Building size={14} className="text-secondary" />
                        </div>
                        <span className="text-on-surface font-medium">{c.businessName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">{c.contactName}</td>
                    <td className="px-4 py-3 text-on-surface-variant hidden md:table-cell">{c.email}</td>
                    <td className="px-4 py-3 text-on-surface-variant hidden lg:table-cell">{c.phone || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleActive(c)}
                        className="cursor-pointer"
                        title={c.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {c.isActive
                          ? <ToggleRight size={22} className="text-green-400" />
                          : <ToggleLeft size={22} className="text-on-surface-variant" />
                        }
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openPreview(c)}
                          className="p-1.5 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors cursor-pointer"
                          title="Preview Details"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          onClick={() => openEdit(c)}
                          className="p-1.5 text-secondary hover:bg-secondary/10 rounded-lg transition-colors cursor-pointer"
                          title="Edit"
                        >
                          <Edit2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-outline-variant">
            <p className="text-on-surface-variant text-xs">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className="p-1.5 rounded-lg bg-admin-bg border border-outline-variant text-on-surface-variant hover:text-on-surface disabled:opacity-40 cursor-pointer">
                <ChevronLeft size={14} />
              </button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                className="p-1.5 rounded-lg bg-admin-bg border border-outline-variant text-on-surface-variant hover:text-on-surface disabled:opacity-40 cursor-pointer">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-surface border border-outline-variant rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant">
              <h3 className="text-on-surface font-semibold text-lg">
                {selectedClient ? 'Edit Client' : 'Create Client Account'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-surface-container-low text-on-surface-variant cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { k: 'businessName', label: 'Business Name *', type: 'text', icon: Building },
                  { k: 'contactName', label: 'Contact Name *', type: 'text', icon: UserCheck },
                  { k: 'email', label: 'Email *', type: 'email', icon: Mail },
                  { k: 'phone', label: 'Phone', type: 'tel', icon: Phone },
                ].map(({ k, label, type, icon: Icon }) => (
                  <div key={k}>
                    <label className="block text-on-surface-variant text-xs font-medium mb-1.5">{label}</label>
                    <div className="relative">
                      <Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                      <input
                        type={type}
                        value={form[k]}
                        onChange={f(k)}
                        required={['businessName', 'contactName', 'email'].includes(k)}
                        className="w-full pl-9 pr-4 py-2.5 bg-admin-bg border border-outline-variant rounded-xl text-on-surface text-sm focus:outline-none focus:border-secondary transition-colors"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-on-surface-variant text-xs font-medium mb-1.5">
                  {selectedClient ? 'New Password (leave blank to keep current)' : 'Temporary Password *'}
                </label>
                <input
                  type="text"
                  value={form.password}
                  onChange={f('password')}
                  required={!selectedClient}
                  placeholder={selectedClient ? 'Leave blank to keep current password' : 'Set a temporary password'}
                  className="w-full px-4 py-2.5 bg-admin-bg border border-outline-variant rounded-xl text-on-surface text-sm focus:outline-none focus:border-secondary transition-colors"
                />
              </div>

              <div>
                <label className="block text-on-surface-variant text-xs font-medium mb-1.5">Lead Reference (optional)</label>
                <div className="relative">
                  <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                  <input
                    type="text"
                    value={form.leadRef}
                    onChange={f('leadRef')}
                    placeholder="Lead ObjectId (optional, links lead → client)"
                    className="w-full pl-9 pr-4 py-2.5 bg-admin-bg border border-outline-variant rounded-xl text-on-surface text-sm focus:outline-none focus:border-secondary transition-colors font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-on-surface-variant text-xs font-medium mb-1.5">Internal Notes (never shown to client)</label>
                <textarea
                  value={form.notes}
                  onChange={f('notes')}
                  rows={3}
                  placeholder="Internal notes about this client…"
                  className="w-full px-4 py-2.5 bg-admin-bg border border-outline-variant rounded-xl text-on-surface text-sm focus:outline-none focus:border-secondary transition-colors resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 bg-secondary text-white rounded-xl text-sm font-medium hover:bg-secondary/90 disabled:opacity-60 cursor-pointer"
                >
                  {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={15} />}
                  {selectedClient ? 'Save Changes' : 'Create Account'}
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
      {/* Preview Modal */}
      {previewClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-surface border border-outline-variant rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-secondary/15 flex items-center justify-center shrink-0">
                  <Building size={18} className="text-secondary" />
                </div>
                <div>
                  <h3 className="text-on-surface font-semibold text-lg">{previewClient.businessName}</h3>
                  <p className="text-on-surface-variant text-xs">{previewClient.clientId}</p>
                </div>
              </div>
              <button 
                onClick={() => setPreviewClient(null)} 
                className="p-1.5 rounded-lg hover:bg-surface-container-low text-on-surface-variant cursor-pointer transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Detailed Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-on-surface-variant text-[10px] uppercase font-bold tracking-wider">Contact Person</p>
                  <p className="text-on-surface text-sm font-medium">{previewClient.contactName}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-on-surface-variant text-[10px] uppercase font-bold tracking-wider">Email Address</p>
                  <p className="text-on-surface text-sm font-medium break-all">{previewClient.email}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-on-surface-variant text-[10px] uppercase font-bold tracking-wider">Phone Number</p>
                  <p className="text-on-surface text-sm font-medium">{previewClient.phone || '—'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-on-surface-variant text-[10px] uppercase font-bold tracking-wider">Account Status</p>
                  <div className="pt-0.5">
                    <span className={`inline-flex items-center rounded-full text-[10px] font-bold px-2.5 py-0.5 ${
                      previewClient.isActive 
                        ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                        : 'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}>
                      {previewClient.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-on-surface-variant text-[10px] uppercase font-bold tracking-wider">Password / Security</p>
                  <div className="pt-0.5 flex flex-col gap-1">
                    <span className={`inline-flex self-start items-center rounded-full text-[10px] font-bold px-2.5 py-0.5 ${
                      previewClient.isTemporaryPassword 
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                        : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                    }`}>
                      {previewClient.isTemporaryPassword ? 'Temporary Password Active' : 'Custom Password Set'}
                    </span>
                    {previewClient.isTemporaryPassword && previewClient.temporaryPasswordText && (
                      <p className="text-on-surface text-xs font-mono font-bold mt-1 bg-admin-bg border border-outline-variant px-2.5 py-1.5 rounded-lg select-all">
                        Password: {previewClient.temporaryPasswordText}
                      </p>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-on-surface-variant text-[10px] uppercase font-bold tracking-wider">Creation Date</p>
                  <p className="text-on-surface text-sm font-medium">
                    {new Date(previewClient.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric'
                    })}
                  </p>
                </div>
              </div>

              {/* Lead Link */}
              {previewClient.leadRef && (
                <div className="p-3 bg-secondary/5 border border-secondary/20 rounded-xl">
                  <p className="text-on-surface-variant text-[10px] uppercase font-bold tracking-wider mb-1">Linked Lead Reference</p>
                  <p className="text-secondary text-xs font-mono select-all break-all">
                    {typeof previewClient.leadRef === 'object' ? previewClient.leadRef._id : previewClient.leadRef}
                  </p>
                </div>
              )}

              {/* Internal Notes */}
              <div className="space-y-2 border-t border-outline-variant pt-4">
                <p className="text-on-surface-variant text-[10px] uppercase font-bold tracking-wider">Internal Notes (Admin Only)</p>
                <div className="bg-admin-bg/60 border border-outline-variant rounded-xl p-3.5 min-h-[80px]">
                  <p className="text-on-surface text-xs leading-relaxed whitespace-pre-wrap">
                    {previewClient.notes || 'No internal notes added for this client.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 py-3.5 bg-admin-bg/40 border-t border-outline-variant flex justify-end">
              <button 
                onClick={() => setPreviewClient(null)}
                className="px-5 py-2 bg-admin-bg border border-outline-variant text-on-surface-variant hover:text-on-surface rounded-xl text-sm cursor-pointer transition-colors"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
