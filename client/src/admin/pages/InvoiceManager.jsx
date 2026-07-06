import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import {
  FileText, Plus, Search, X, Save, IndianRupee,
  ChevronLeft, ChevronRight, Trash2, Edit2, Filter,
} from 'lucide-react';

const STATUS_COLORS = {
  Paid:    'bg-green-500/10 text-green-400 border-green-500/20',
  Unpaid:  'bg-amber-500/10 text-amber-400 border-amber-500/20',
  Overdue: 'bg-red-500/10 text-red-400 border-red-500/20',
};

const emptyForm = () => ({
  client_ref: '', dueDate: '', notes: '',
  lineItems: [{ description: '', qty: 1, unitPrice: '' }],
  taxPercent: 0, paymentStatus: 'Unpaid',
});

export default function InvoiceManager() {
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  // Fetch clients for dropdown
  useEffect(() => {
    api.get('/admin/clients', { params: { limit: 200 } })
      .then(r => setClients(r.data.data || []));
  }, []);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 15 };
      if (statusFilter) params.status = statusFilter;
      const r = await api.get('/admin/invoices', { params });
      setInvoices(r.data.data || []);
      setPagination(r.data.pagination || {});
    } catch { toast.error('Failed to load invoices'); }
    finally { setLoading(false); }
  }, [page, statusFilter]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const computeTotals = (items, taxPercent) => {
    const subtotal = items.reduce((s, i) => s + Number(i.qty || 1) * Number(i.unitPrice || 0), 0);
    const taxAmount = +(subtotal * (taxPercent / 100)).toFixed(2);
    return { subtotal, taxAmount, totalAmount: subtotal + taxAmount };
  };

  const openCreate = () => { setEditTarget(null); setForm(emptyForm()); setShowModal(true); };
  const openEdit = (inv) => {
    setEditTarget(inv);
    setForm({
      client_ref: inv.client_ref?._id || '',
      dueDate: inv.dueDate?.split('T')[0] || '',
      notes: inv.notes || '',
      lineItems: inv.lineItems?.length ? inv.lineItems : [{ description: '', qty: 1, unitPrice: '' }],
      taxPercent: inv.taxPercent || 0,
      paymentStatus: inv.paymentStatus || 'Unpaid',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { subtotal, taxAmount, totalAmount } = computeTotals(form.lineItems, form.taxPercent);
      
      const mappedLineItems = form.lineItems.map(i => ({
        description: i.description,
        qty: Number(i.qty || 1),
        unitPrice: Number(i.unitPrice || 0),
        amount: Number(i.qty || 1) * Number(i.unitPrice || 0)
      }));

      const payload = { ...form, lineItems: mappedLineItems, subtotal, taxAmount, totalAmount };
      if (editTarget) {
        await api.put(`/admin/invoices/${editTarget._id}`, payload);
        toast.success('Invoice updated');
      } else {
        await api.post('/admin/invoices', payload);
        toast.success('Invoice created');
      }
      setShowModal(false);
      fetchInvoices();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const deleteInvoice = async (id) => {
    if (!window.confirm('Delete this invoice?')) return;
    try {
      await api.delete(`/admin/invoices/${id}`);
      toast.success('Invoice deleted');
      fetchInvoices();
    } catch { toast.error('Failed to delete'); }
  };

  const updateLineItem = (i, k, v) =>
    setForm(p => {
      const items = [...p.lineItems];
      let val = v;
      if (['qty', 'unitPrice'].includes(k)) {
        if (val.length > 1 && val.startsWith('0') && !val.startsWith('0.')) {
          val = val.replace(/^0+/, '');
        }
      }
      items[i] = { ...items[i], [k]: val };
      return { ...p, lineItems: items };
    });

  const addLineItem = () => setForm(p => ({ ...p, lineItems: [...p.lineItems, { description: '', qty: 1, unitPrice: '' }] }));
  const removeLineItem = (i) => setForm(p => ({ ...p, lineItems: p.lineItems.filter((_, idx) => idx !== i) }));

  const { subtotal, taxAmount, totalAmount } = computeTotals(form.lineItems, form.taxPercent);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-on-surface font-heading">Invoice Manager</h1>
          <p className="text-on-surface-variant text-sm mt-1">Create and manage client invoices</p>
        </div>
        <div className="flex gap-3">
          <div className="bg-secondary/10 text-secondary px-4 py-2 rounded-lg font-bold text-sm">
            {pagination.total} Invoices
          </div>
          <button onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-secondary text-white rounded-lg text-sm font-medium hover:bg-secondary/90 cursor-pointer">
            <Plus size={15} /> New Invoice
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 items-center">
        <Filter size={14} className="text-on-surface-variant" />
        {['', 'Paid', 'Unpaid', 'Overdue'].map(s => (
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
        ) : invoices.length === 0 ? (
          <div className="text-center py-16">
            <FileText size={36} className="text-outline-variant mx-auto mb-3" />
            <p className="text-on-surface-variant">No invoices found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-admin-bg border-b border-outline-variant text-on-surface-variant text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left">Invoice ID</th>
                  <th className="px-4 py-3 text-left">Client</th>
                  <th className="px-4 py-3 text-left hidden md:table-cell">Issue Date</th>
                  <th className="px-4 py-3 text-left hidden md:table-cell">Due Date</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {invoices.map(inv => (
                  <tr key={inv._id} className="hover:bg-surface-container-low transition-colors">
                    <td className="px-4 py-3 font-mono text-secondary text-xs">{inv.invoiceId}</td>
                    <td className="px-4 py-3">
                      <p className="text-on-surface font-medium text-xs">{inv.client_ref?.businessName || '—'}</p>
                      <p className="text-on-surface-variant text-[10px]">{inv.client_ref?.clientId}</p>
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant text-xs hidden md:table-cell">
                      {new Date(inv.issueDate).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant text-xs hidden md:table-cell">
                      {new Date(inv.dueDate).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-on-surface font-semibold">
                        ₹{(inv.totalAmount || 0).toLocaleString('en-IN')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center border rounded-full text-[10px] font-medium px-2.5 py-0.5 ${STATUS_COLORS[inv.paymentStatus] || 'bg-gray-500/10 text-gray-400 border-gray-500/20'}`}>
                        {inv.paymentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => openEdit(inv)} title="Edit"
                          className="p-1.5 text-secondary hover:bg-secondary/10 rounded-lg cursor-pointer">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => deleteInvoice(inv._id)} title="Delete"
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
          <div className="w-full max-w-2xl bg-surface border border-outline-variant rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant">
              <h3 className="text-on-surface font-semibold">{editTarget ? 'Edit Invoice' : 'Create Invoice'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-surface-container-low text-on-surface-variant cursor-pointer"><X size={16} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-on-surface-variant text-xs font-medium mb-1.5">Client *</label>
                  <select value={form.client_ref} onChange={e => setForm(p => ({ ...p, client_ref: e.target.value }))} required
                    className="w-full px-3 py-2.5 bg-admin-bg border border-outline-variant rounded-xl text-on-surface text-sm focus:outline-none focus:border-secondary">
                    <option value="">Select client…</option>
                    {clients.map(c => <option key={c._id} value={c._id}>{c.businessName} — {c.clientId}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-on-surface-variant text-xs font-medium mb-1.5">Due Date *</label>
                  <input type="date" required value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-admin-bg border border-outline-variant rounded-xl text-on-surface text-sm focus:outline-none focus:border-secondary [color-scheme:dark]" />
                </div>
              </div>

              {/* Line Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-on-surface-variant text-xs font-medium">Line Items</label>
                  <button type="button" onClick={addLineItem}
                    className="text-xs text-secondary hover:underline cursor-pointer flex items-center gap-1">
                    <Plus size={12} /> Add Row
                  </button>
                </div>
                <div className="space-y-2">
                  {form.lineItems.map((item, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <input type="text" value={item.description} placeholder="Description" required
                        onChange={e => updateLineItem(i, 'description', e.target.value)}
                        className="col-span-6 px-3 py-2 bg-admin-bg border border-outline-variant rounded-lg text-on-surface text-xs focus:outline-none focus:border-secondary" />
                      <input type="number" value={item.qty} min={1} placeholder="Qty"
                        onChange={e => updateLineItem(i, 'qty', e.target.value)}
                        className="col-span-2 px-2 py-2 bg-admin-bg border border-outline-variant rounded-lg text-on-surface text-xs focus:outline-none focus:border-secondary text-center" />
                      <input type="number" value={item.unitPrice} min={0} placeholder="₹ Unit Price" required
                        onChange={e => updateLineItem(i, 'unitPrice', e.target.value)}
                        className="col-span-3 px-2 py-2 bg-admin-bg border border-outline-variant rounded-lg text-on-surface text-xs focus:outline-none focus:border-secondary" />
                      {form.lineItems.length > 1 && (
                        <button type="button" onClick={() => removeLineItem(i)} className="col-span-1 text-red-400 hover:text-red-300 cursor-pointer flex justify-center">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-on-surface-variant text-xs font-medium mb-1.5">Tax %</label>
                  <input type="number" min={0} max={100} value={form.taxPercent}
                    onChange={e => {
                      let val = e.target.value;
                      if (val.length > 1 && val.startsWith('0') && !val.startsWith('0.')) {
                        val = val.replace(/^0+/, '');
                      }
                      setForm(p => ({ ...p, taxPercent: val === '' ? '' : Number(val) }));
                    }}
                    className="w-full px-3 py-2.5 bg-admin-bg border border-outline-variant rounded-xl text-on-surface text-sm focus:outline-none focus:border-secondary" />
                </div>
                <div>
                  <label className="block text-on-surface-variant text-xs font-medium mb-1.5">Status</label>
                  <select value={form.paymentStatus} onChange={e => setForm(p => ({ ...p, paymentStatus: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-admin-bg border border-outline-variant rounded-xl text-on-surface text-sm focus:outline-none focus:border-secondary">
                    {['Unpaid', 'Paid', 'Overdue'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="bg-secondary/5 border border-secondary/20 rounded-xl px-3 py-2.5 flex flex-col justify-center">
                  <p className="text-on-surface-variant text-xs">Total</p>
                  <p className="text-secondary font-bold text-lg">₹{totalAmount.toLocaleString('en-IN')}</p>
                  {form.taxPercent > 0 && <p className="text-on-surface-variant text-[10px]">Tax: ₹{taxAmount.toLocaleString('en-IN')}</p>}
                </div>
              </div>

              <div>
                <label className="block text-on-surface-variant text-xs font-medium mb-1.5">Notes (internal)</label>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2}
                  className="w-full px-3 py-2 bg-admin-bg border border-outline-variant rounded-xl text-on-surface text-sm focus:outline-none focus:border-secondary resize-none" />
              </div>

              <div className="flex gap-3">
                <button type="submit" disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 bg-secondary text-white rounded-xl text-sm font-medium hover:bg-secondary/90 disabled:opacity-60 cursor-pointer">
                  {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={14} />}
                  {editTarget ? 'Update' : 'Create Invoice'}
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
