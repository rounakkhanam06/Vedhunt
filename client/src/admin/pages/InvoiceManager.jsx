import { useState, useEffect, useCallback } from 'react';
import { useCrm } from '../../shared/crmAccess';
import InvoiceDraftsPanel from '../components/InvoiceDraftsPanel';
import InvoicePaymentsModal from '../components/InvoicePaymentsModal';
import AgeingPanel from '../components/AgeingPanel';
import { openPdf } from '../../employee/lib/ess';
import { openPortalPreview } from '../../shared/portalPreview';
import { usePermissions } from '../hooks/usePermissions';
import toast from 'react-hot-toast';
import {
  FileText, Plus, Search, X, Save, IndianRupee,
  ChevronLeft, ChevronRight, Trash2, Edit2, Filter, Eye, Send, MonitorSmartphone, Wallet,
} from 'lucide-react';

const DOC_TYPES = ['Tax Invoice', 'Proforma Invoice'];
const today = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
const emptyBilling = () => ({ name: '', address: '', phone: '', gstin: '', pan: '', placeOfSupply: '' });
const inputCls = 'w-full px-3 py-2.5 bg-admin-bg border border-outline-variant rounded-xl text-on-surface text-sm focus:outline-none focus:border-secondary';

const STATUS_COLORS = {
  Paid:    'bg-green-500/10 text-green-400 border-green-500/20',
  Unpaid:  'bg-amber-500/10 text-amber-400 border-amber-500/20',
  Overdue: 'bg-red-500/10 text-red-400 border-red-500/20',
};

const emptyForm = () => ({
  client_ref: '', issueDate: today(), dueDate: '', notes: '',
  lineItems: [{ description: '', qty: 1, unitPrice: '', sac: '' }],
  taxPercent: 18, paymentStatus: 'Unpaid',
  billing: emptyBilling(),
});

export default function InvoiceManager() {
  // Admin panel (full access) or Employee Portal (person-wise grants) — shared/crmAccess.js
  const { http, base, can: canCrm, full } = useCrm();
  // Super Admin (Admin panel): open the client's own portal, read-only, to see what they got
  const { can } = usePermissions();
  const canPreviewPortal = full && can('*');
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [view, setView] = useState('invoices'); // 'invoices' | 'drafts'
  const [openDrafts, setOpenDrafts] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [docInfo, setDocInfo] = useState({ states: [], next: {} }); // GST states + next proforma / tax invoice numbers
  const [paymentsFor, setPaymentsFor] = useState(null); // the invoice whose payments / credit notes are open
  const [sendTarget, setSendTarget] = useState(null);
  const [sendForm, setSendForm] = useState({ type: 'Tax Invoice', date: today() });
  const [sending, setSending] = useState(false);

  // Fetch clients for dropdown
  useEffect(() => {
    http.get(`${base}/client-options`, { params: { page: 'invoices' } })
      .then(r => setClients(r.data.data || []));
  }, [http, base]);

  const refreshDocInfo = useCallback(() => {
    http.get(`${base}/invoice-documents/info`).then((r) => setDocInfo(r.data.data)).catch(() => {});
  }, [http, base]);
  useEffect(() => { refreshDocInfo(); }, [refreshDocInfo]);

  // Billing details for a client: their last invoice, else the client record / KYC GSTIN
  const loadBillingDefaults = async (clientId) => {
    if (!clientId) return;
    try {
      const r = await http.get(`${base}/invoice-documents/billing-defaults/${clientId}`);
      setForm((p) => (p.client_ref === clientId ? { ...p, billing: { ...emptyBilling(), ...r.data.data } } : p));
    } catch { /* the fields stay empty to type in */ }
  };

  const setBilling = (k, v) => setForm((p) => {
    const billing = { ...p.billing, [k]: v };
    // The first two digits of a GSTIN are the state code
    if (k === 'gstin' && !p.billing.placeOfSupply) {
      const state = docInfo.states.find((s) => s.code === v.trim().slice(0, 2));
      if (state) billing.placeOfSupply = state.name;
    }
    return { ...p, billing };
  });

  const viewDocument = (inv, type) => {
    const sent = inv.documents?.[inv.documents.length - 1];
    const docType = type || sent?.type || 'Tax Invoice';
    openPdf(`${base}/invoices/${inv._id}/document?type=${encodeURIComponent(docType)}`, { http })
      .catch(() => toast.error('Could not open the invoice PDF'));
  };

  const openSend = (inv) => {
    setSendTarget(inv);
    setSendForm({ type: inv.documents?.[0]?.type || 'Tax Invoice', date: (inv.issueDate || '').split('T')[0] || today() });
  };

  const sendInvoice = async () => {
    setSending(true);
    try {
      const r = await http.post(`${base}/invoices/${sendTarget._id}/send`, sendForm);
      toast.success(r.data.message);
      setSendTarget(null);
      fetchInvoices();
      refreshDocInfo();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not send the invoice');
    } finally { setSending(false); }
  };

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 15 };
      if (statusFilter) params.status = statusFilter;
      const r = await http.get(`${base}/invoices`, { params });
      setInvoices(r.data.data || []);
      setPagination(r.data.pagination || {});
    } catch { toast.error('Failed to load invoices'); }
    finally { setLoading(false); }
  }, [http, base, page, statusFilter]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  // How many scheduled invoices are waiting — for the badge on the tab
  const refreshDraftCount = useCallback(() => {
    http.get(`${base}/invoice-drafts`, { params: { status: 'open' } }).then((r) => setOpenDrafts(r.data.openCount)).catch(() => {});
  }, [http, base]);
  useEffect(() => { refreshDraftCount(); }, [refreshDraftCount, view]);

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

  const computeTotals = (items, taxPercent) => {
    const subtotal = items.reduce((s, i) => s + Number(i.qty || 1) * Number(i.unitPrice || 0), 0);
    const taxAmount = +(subtotal * (taxPercent / 100)).toFixed(2);
    return { subtotal, taxAmount, totalAmount: subtotal + taxAmount };
  };

  const openCreate = () => { setEditTarget(null); setForm(emptyForm()); setShowModal(true); };
  const openEdit = (inv) => {
    setEditTarget(inv);
    const clientId = inv.client_ref?._id || '';
    setForm({
      client_ref: clientId,
      issueDate: inv.issueDate?.split('T')[0] || today(),
      dueDate: inv.dueDate?.split('T')[0] || '',
      notes: inv.notes || '',
      lineItems: inv.lineItems?.length ? inv.lineItems.map((i) => ({ ...i, sac: i.sac || '' })) : [{ description: '', qty: 1, unitPrice: '', sac: '' }],
      taxPercent: inv.taxPercent || 0,
      // Overdue is worked out from the due date and balance, so it is never an editable status
      paymentStatus: inv.paymentStatus === 'Paid' ? 'Paid' : 'Unpaid',
      billing: { ...emptyBilling(), ...(inv.billing || {}) },
    });
    setShowModal(true);
    // e.g. an invoice approved from a billing schedule has no billing details yet
    if (!inv.billing) loadBillingDefaults(clientId);
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
        amount: Number(i.qty || 1) * Number(i.unitPrice || 0),
        sac: (i.sac || '').trim(),
      }));

      const payload = { ...form, lineItems: mappedLineItems, subtotal, taxAmount, totalAmount };
      if (editTarget) {
        await http.put(`${base}/invoices/${editTarget._id}`, payload);
        toast.success('Invoice updated');
      } else {
        await http.post(`${base}/invoices`, payload);
        toast.success('Invoice saved. View it, then Send it to the client.');
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
      await http.delete(`${base}/invoices/${id}`);
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

  const addLineItem = () => setForm(p => ({ ...p, lineItems: [...p.lineItems, { description: '', qty: 1, unitPrice: '', sac: '' }] }));
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
          {canCrm('invoices', 'create') && (<button onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-secondary text-white rounded-lg text-sm font-medium hover:bg-secondary/90 cursor-pointer">
            <Plus size={15} /> New Invoice
          </button>)}
        </div>
      </div>

      <div className="flex gap-2 border-b border-outline-variant" role="tablist" aria-label="Invoice views">
        {[['invoices', 'Invoices'], ['drafts', 'Awaiting approval'], ['ageing', 'Ageing']].map(([id, label]) => (
          <button key={id} role="tab" aria-selected={view === id} onClick={() => setView(id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px cursor-pointer transition-colors flex items-center gap-2 ${view === id ? 'border-secondary text-secondary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}>
            {label}
            {id === 'drafts' && openDrafts > 0 && <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-secondary text-white text-[10px] font-bold flex items-center justify-center">{openDrafts}</span>}
          </button>
        ))}
      </div>

      {view === 'ageing' && <AgeingPanel http={http} base={base} />}

      {view === 'drafts' && (
        <InvoiceDraftsPanel http={http} base={base} canApprove={canCrm('invoices', 'create')} canEdit={canCrm('invoices', 'edit')}
          onChanged={() => { fetchInvoices(); refreshDraftCount(); }} />
      )}

      {view === 'invoices' && (<>
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
                    <td className="px-4 py-3">
                      <p className="font-mono text-secondary text-xs">{inv.invoiceId}</p>
                      {inv.unsent ? (
                        <span className="inline-block mt-0.5 text-[10px] font-semibold text-amber-500">Not sent yet</span>
                      ) : (inv.documents || []).map((d) => (
                        <button key={d.type} type="button" onClick={() => viewDocument(inv, d.type)}
                          className="block mt-0.5 text-[10px] text-on-surface-variant hover:text-secondary cursor-pointer">
                          {d.type} #{d.number}
                        </button>
                      ))}
                    </td>
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
                      {inv.balance > 0 && inv.balance < inv.totalAmount && (
                        <span className="block text-[10px] text-on-surface-variant">Balance ₹{inv.balance.toLocaleString('en-IN')}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center border rounded-full text-[10px] font-medium px-2.5 py-0.5 ${STATUS_COLORS[inv.paymentStatus] || 'bg-gray-500/10 text-gray-400 border-gray-500/20'}`}>
                        {inv.paymentStatus}
                      </span>
                      {inv.daysOverdue > 0 && <span className="block text-[10px] font-bold text-red-400 mt-0.5">{inv.daysOverdue}d overdue</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => viewDocument(inv)} title="View PDF"
                          className="p-1.5 text-on-surface-variant hover:bg-surface-container-low rounded-lg cursor-pointer">
                          <Eye size={14} />
                        </button>
                        {canPreviewPortal && !inv.unsent && inv.client_ref?._id && (
                          <button title="See it in the client's portal (read-only)"
                            onClick={() => openPortalPreview(http, 'client', inv.client_ref._id, '/client/dashboard?tab=billing')
                              .catch((err) => toast.error(err?.response?.data?.message || 'Could not open the preview'))}
                            className="p-1.5 text-on-surface-variant hover:bg-surface-container-low rounded-lg cursor-pointer">
                            <MonitorSmartphone size={14} />
                          </button>
                        )}
                        {!inv.unsent && (<button onClick={() => setPaymentsFor(inv)} title="Payments, receipts and credit notes"
                          className="p-1.5 text-on-surface-variant hover:bg-surface-container-low rounded-lg cursor-pointer">
                          <Wallet size={14} />
                        </button>)}
                        {canCrm('invoices', 'edit') && (<button onClick={() => openSend(inv)} title={inv.unsent ? 'Send to client' : 'Send again / as another type'}
                          className={`p-1.5 rounded-lg cursor-pointer ${inv.unsent ? 'text-white bg-secondary hover:bg-secondary/90' : 'text-secondary hover:bg-secondary/10'}`}>
                          <Send size={14} />
                        </button>)}
                        {canCrm('invoices', 'edit') && (<button onClick={() => openEdit(inv)} title="Edit"
                          className="p-1.5 text-secondary hover:bg-secondary/10 rounded-lg cursor-pointer">
                          <Edit2 size={14} />
                        </button>)}
                        {canCrm('invoices', 'delete') && (<button onClick={() => deleteInvoice(inv._id)} title="Delete"
                          className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg cursor-pointer">
                          <Trash2 size={14} />
                        </button>)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination.totalPages > 1 && (
          <div className="flex flex-wrap gap-2 items-center justify-between px-4 py-3 border-t border-outline-variant">
            <p className="text-on-surface-variant text-xs">Page {pagination.page} of {pagination.totalPages}</p>
            <div className="flex flex-wrap gap-2">
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
      </>)}

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
                  <select value={form.client_ref} disabled={!!editTarget} required
                    onChange={e => { const id = e.target.value; setForm(p => ({ ...p, client_ref: id, billing: emptyBilling() })); loadBillingDefaults(id); }}
                    className="w-full px-3 py-2.5 bg-admin-bg border border-outline-variant rounded-xl text-on-surface text-sm focus:outline-none focus:border-secondary">
                    <option value="">Select client…</option>
                    {clients.map(c => <option key={c._id} value={c._id}>{c.businessName} — {c.clientId}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-on-surface-variant text-xs font-medium mb-1.5">Invoice Date *</label>
                    <input type="date" required value={form.issueDate} onChange={e => setForm(p => ({ ...p, issueDate: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-admin-bg border border-outline-variant rounded-xl text-on-surface text-sm focus:outline-none focus:border-secondary [color-scheme:dark]" />
                  </div>
                  <div>
                    <label className="block text-on-surface-variant text-xs font-medium mb-1.5">Due Date *</label>
                    <input type="date" required value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-admin-bg border border-outline-variant rounded-xl text-on-surface text-sm focus:outline-none focus:border-secondary [color-scheme:dark]" />
                  </div>
                </div>
              </div>

              {/* Billed to — printed in "Customer Detail" on the proforma / tax invoice */}
              <fieldset className="border border-outline-variant rounded-xl p-4 space-y-3">
                <legend className="px-1 text-on-surface-variant text-xs font-medium">Billing details (printed on the invoice)</legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input value={form.billing.name} onChange={(e) => setBilling('name', e.target.value)} placeholder="Name (billed to)" className={inputCls} />
                  <input value={form.billing.phone} onChange={(e) => setBilling('phone', e.target.value)} placeholder="Phone" className={inputCls} />
                </div>
                <textarea value={form.billing.address} onChange={(e) => setBilling('address', e.target.value)} rows={2} placeholder="Billing address (needed to send)"
                  className={`${inputCls} resize-none`} />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input value={form.billing.gstin} onChange={(e) => setBilling('gstin', e.target.value.toUpperCase())} maxLength={15} placeholder="GSTIN (optional)" className={`${inputCls} font-mono`} />
                  <input value={form.billing.pan} onChange={(e) => setBilling('pan', e.target.value.toUpperCase())} maxLength={10} placeholder="PAN (optional)" className={`${inputCls} font-mono`} />
                  <select value={form.billing.placeOfSupply} onChange={(e) => setBilling('placeOfSupply', e.target.value)} className={inputCls}>
                    <option value="">Place of supply…</option>
                    {docInfo.states.map((s) => <option key={s.code} value={s.name}>{s.name} ({s.code})</option>)}
                  </select>
                </div>
                <p className="text-[11px] text-on-surface-variant">Maharashtra → CGST + SGST; any other state → IGST.</p>
              </fieldset>

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
                    <div key={i} className="grid grid-cols-12 gap-2 items-start">
                      <textarea value={item.description} rows={2} required
                        placeholder={'Service (first line, bold)\nDetails, one per line'}
                        onChange={e => updateLineItem(i, 'description', e.target.value)}
                        className="col-span-12 sm:col-span-5 px-3 py-2 bg-admin-bg border border-outline-variant rounded-lg text-on-surface text-xs focus:outline-none focus:border-secondary resize-y" />
                      <input type="text" value={item.sac || ''} maxLength={12} placeholder="HSN/SAC"
                        onChange={e => updateLineItem(i, 'sac', e.target.value)}
                        className="col-span-3 sm:col-span-2 px-2 py-2 bg-admin-bg border border-outline-variant rounded-lg text-on-surface text-xs focus:outline-none focus:border-secondary font-mono" />
                      <input type="number" value={item.qty} min={1} placeholder="Qty"
                        onChange={e => updateLineItem(i, 'qty', e.target.value)}
                        className="col-span-3 sm:col-span-2 px-2 py-2 bg-admin-bg border border-outline-variant rounded-lg text-on-surface text-xs focus:outline-none focus:border-secondary text-center" />
                      <input type="number" value={item.unitPrice} min={0} placeholder="₹ Rate" required
                        onChange={e => updateLineItem(i, 'unitPrice', e.target.value)}
                        className="col-span-5 sm:col-span-2 px-2 py-2 bg-admin-bg border border-outline-variant rounded-lg text-on-surface text-xs focus:outline-none focus:border-secondary" />
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
                    {['Unpaid', 'Paid'].map(s => <option key={s} value={s}>{s}</option>)}
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
                  {editTarget ? 'Update' : 'Save Invoice'}
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

      {paymentsFor && (
        <InvoicePaymentsModal invoice={paymentsFor} http={http} base={base} canEdit={canCrm('invoices', 'edit')}
          onClose={() => setPaymentsFor(null)} onChanged={fetchInvoices} />
      )}

      {/* Send as Proforma / Tax Invoice */}
      {sendTarget && (() => {
        const already = (sendTarget.documents || []).find((d) => d.type === sendForm.type);
        const nextNo = sendForm.type === 'Tax Invoice' ? docInfo.next.taxInvoice : docInfo.next.proforma;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-md bg-surface border border-outline-variant rounded-2xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant">
                <h3 className="text-on-surface font-semibold">Send {sendTarget.invoiceId}</h3>
                <button onClick={() => setSendTarget(null)} className="p-1.5 rounded-lg hover:bg-surface-container-low text-on-surface-variant cursor-pointer"><X size={16} /></button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <p className="text-on-surface-variant text-xs font-medium mb-1.5">Send as</p>
                  <div className="grid grid-cols-2 gap-2">
                    {DOC_TYPES.map((t) => (
                      <button key={t} type="button" onClick={() => setSendForm((p) => ({ ...p, type: t }))}
                        className={`px-3 py-2.5 rounded-xl text-sm font-medium border cursor-pointer ${sendForm.type === t ? 'bg-secondary/15 text-secondary border-secondary/40' : 'bg-admin-bg text-on-surface-variant border-outline-variant'}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-on-surface-variant text-xs font-medium mb-1.5">{sendForm.type === 'Tax Invoice' ? 'Invoice Date' : 'Proforma Date'} *</label>
                  <input type="date" required value={sendForm.date} onChange={(e) => setSendForm((p) => ({ ...p, date: e.target.value }))}
                    className={`${inputCls} [color-scheme:dark]`} />
                </div>
                <p className="text-xs text-on-surface-variant">
                  {already
                    ? <>Already sent as {already.type} #{already.number}. Sending again keeps the number, uses this date and notifies the client again.</>
                    : <>This will be {sendForm.type} <strong className="text-on-surface">#{nextNo ?? '…'}</strong>. The number can&apos;t be changed after sending.</>}
                </p>
                <div className="flex flex-wrap gap-3">
                  <button type="button" disabled={sending || !sendForm.date} onClick={sendInvoice}
                    className="flex items-center gap-2 px-5 py-2.5 bg-secondary text-white rounded-xl text-sm font-medium hover:bg-secondary/90 disabled:opacity-60 cursor-pointer">
                    <Send size={14} /> {sending ? 'Sending…' : 'Send to client'}
                  </button>
                  <button type="button" onClick={() => openPdf(`${base}/invoices/${sendTarget._id}/document?type=${encodeURIComponent(sendForm.type)}&date=${sendForm.date}`, { http }).catch(() => toast.error('Could not open the invoice PDF'))}
                    className="flex items-center gap-2 px-5 py-2.5 bg-admin-bg border border-outline-variant text-on-surface-variant hover:text-on-surface rounded-xl text-sm cursor-pointer">
                    <Eye size={14} /> Preview
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
