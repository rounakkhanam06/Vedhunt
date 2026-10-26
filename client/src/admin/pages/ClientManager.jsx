import { useState, useEffect, useCallback } from 'react';
import { useCrm } from '../../shared/crmAccess';
import toast from 'react-hot-toast';
import {
  Users, Plus, Search, Eye, X, Edit2,
  Mail, Phone, Building, UserCheck, Link2, ChevronLeft, ChevronRight, Save,
  Ban, RotateCcw, Trash2, AlertTriangle, ArchiveRestore, PauseCircle, PlayCircle,
} from 'lucide-react';
import { usePermissions } from '../hooks/usePermissions';
import PortfolioKpis from '../components/clients/PortfolioKpis';
import { inr, pct } from '../components/clients/format';
import ClientProfilePanel from '../components/clients/ClientProfilePanel';
import OnboardingPanel from '../components/clients/OnboardingPanel';
import StrategyPanel from '../components/clients/StrategyPanel';
import KycPanel from '../components/clients/KycPanel';
import BillingSchedulePanel from '../components/clients/BillingSchedulePanel';
import ClientCreationIssuesPanel from '../components/clients/ClientCreationIssuesPanel';
import AdPerformancePanel from '../components/clients/AdPerformancePanel';

const STATUS_TABS = [
  { id: '', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'hold', label: 'On hold' },
  { id: 'inactive', label: 'Inactive (suspended)' },
  { id: 'archived', label: 'Deleted' },
];

const SORT_OPTIONS = [
  { id: 'fee', label: 'Highest monthly fee' },
  { id: 'outstanding', label: 'Highest outstanding' },
  { id: 'overdue', label: 'Most days overdue' },
  { id: 'newest', label: 'Newest first' },
  { id: 'name', label: 'Name A–Z' },
];

// Portfolio rows carry `state` (active | inactive | archived); detail records carry the raw flags
const clientStatus = (c) => {
  if (c.state) return c.state === 'inactive' ? 'suspended' : c.state;
  if (c.deletedAt) return 'archived';
  if (!c.isActive) return 'suspended';
  return c.serviceStatus === 'Hold' ? 'hold' : 'active';
};

const PREVIEW_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'profile', label: 'Profile' },
  { id: 'strategy', label: 'Strategy' },
  { id: 'kyc', label: 'KYC' },
  { id: 'billing', label: 'Billing' },
  { id: 'ads', label: 'Ad data' },
  { id: 'onboarding', label: 'Onboarding' },
];

const STATUS_BADGE = {
  active: { label: 'Active', cls: 'bg-green-500/10 text-green-400 border-green-500/20' },
  hold: { label: 'On hold', cls: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  suspended: { label: 'Suspended', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  archived: { label: 'Deleted', cls: 'bg-red-500/10 text-red-400 border-red-500/20' },
};

const fmtDate = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

const EMPTY_FORM = {
  businessName: '', contactName: '', email: '', phone: '',
  password: '', notes: '', leadRef: '',
};

export default function ClientManager() {
  // Admin panel (full access) or Employee Portal (person-wise grants) — shared/crmAccess.js
  const { http, base, can: canCrm, full } = useCrm();
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
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [previewClient, setPreviewClient] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [billingFilter, setBillingFilter] = useState('');
  const [sort, setSort] = useState('fee');
  const [sectorFilter, setSectorFilter] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [portfolio, setPortfolio] = useState({ kpis: null, topByRevenue: [], revenuePeriod: null, filterOptions: { sectors: [], services: [] } });
  const [previewTab, setPreviewTab] = useState('overview');
  const [issueCount, setIssueCount] = useState(0);
  const [showIssues, setShowIssues] = useState(false);
  // { type: 'suspend' | 'archive' | 'permanent', client }
  const [action, setAction] = useState(null);
  const [actionReason, setActionReason] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [linked, setLinked] = useState(null);
  const [acting, setActing] = useState(false);
  const { can } = usePermissions();
  const isSuperAdmin = full && can('*');

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDSearch(search); setPage(1); }, 500);
    return () => clearTimeout(t);
  }, [search]);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const res = await http.get(`${base}/portfolio`, {
        params: {
          page, limit: 15, search: dSearch, sort,
          ...(statusFilter && { status: statusFilter }),
          ...(billingFilter && { billing: billingFilter }),
          ...(sectorFilter && { sector: sectorFilter }),
          ...(serviceFilter && { service: serviceFilter }),
        },
      });
      setClients(res.data.data || []);
      setTotal(res.data.pagination?.total || 0);
      setTotalPages(res.data.pagination?.totalPages || 1);
      setPortfolio({
        kpis: res.data.kpis || null,
        topByRevenue: res.data.topByRevenue || [],
        revenuePeriod: res.data.revenuePeriod || null,
        filterOptions: res.data.filterOptions || { sectors: [], services: [] },
      });
    } catch { toast.error('Failed to load clients'); }
    finally { setLoading(false); }
  }, [http, base, page, dSearch, statusFilter, billingFilter, sort, sectorFilter, serviceFilter]);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  // Won leads with no client account (only people with access to every client see this)
  const loadIssueCount = useCallback(() => {
    if (!full) return;
    http.get(`${base}/client-creation-issues`, { params: { status: 'Open' } }).then((r) => setIssueCount(r.data.openCount || 0)).catch(() => {});
  }, [http, base, full]);
  useEffect(() => { loadIssueCount(); }, [loadIssueCount]);

  // Lock scroll when modal or preview is open
  useEffect(() => {
    if (showModal || previewClient || action) {
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
  }, [showModal, previewClient, action]);

  const openCreate = () => { setSelectedClient(null); setForm(EMPTY_FORM); setErrors({}); setShowModal(true); };

  // The portfolio row doesn't carry notes or the lead link, so load the full record first
  const openEdit = async (row) => {
    let client = row;
    try {
      const res = await http.get(`${base}/clients/${row._id}`);
      if (res.data.success) client = res.data.data;
    } catch { /* fall back to the row's own fields */ }
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
    setErrors({});
    setShowModal(true);
  };
  // Client 360: the list row doesn't carry the linked lead's pre-sale
  // timeline, so preview fetches the full detail endpoint (which populates
  // leadRef's pipelineHistory/callLogs + its assignment history).
  const openPreview = async (client, tab = 'overview') => {
    setPreviewClient(client);
    setPreviewTab(tab);
    await refreshPreview(client._id);
  };
  const refreshPreview = async (id) => {
    try {
      const res = await http.get(`${base}/clients/${id}`);
      if (res.data.success) setPreviewClient(res.data.data);
    } catch {
      // Preview still shows the row's own fields even if the detail fetch fails.
    }
  };
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Frontend Validation
    const newErrors = {};
    if (form.businessName.length < 2 || form.businessName.length > 100) {
      newErrors.businessName = 'Business name must be between 2 and 100 characters';
    }
    if (form.contactName.length < 2 || form.contactName.length > 50) {
      newErrors.contactName = 'Contact name must be between 2 and 50 characters';
    } else if (!/^[\p{L}][\p{L}\s.'’-]*$/u.test(form.contactName)) {
      newErrors.contactName = 'Contact name can only contain letters, spaces, dots, hyphens and apostrophes';
    }
    if (form.phone && !/^\+?[1-9]\d{9,14}$/.test(form.phone)) {
      newErrors.phone = 'Please enter a valid phone number (10-15 digits)';
    }
    if (!/^\S+@\S+\.\S+$/.test(form.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return toast.error('Please fix the errors in the form');
    }
    setErrors({});

    setSaving(true);
    try {
      if (selectedClient) {
        const payload = { ...form };
        if (!payload.password) delete payload.password;
        else payload.newPassword = payload.password;
        delete payload.password;
        await http.put(`${base}/clients/${selectedClient._id}`, payload);
        toast.success('Client updated');
      } else {
        if (!form.password) return toast.error('Password is required for new clients');
        await http.post(`${base}/clients`, form);
        toast.success('Client account created & welcome email sent');
      }
      setShowModal(false);
      fetchClients();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const openAction = async (type, client) => {
    setAction({ type, client });
    setActionReason('');
    setConfirmText('');
    setLinked(null);
    if (type === 'archive' || type === 'permanent') {
      try {
        const res = await http.get(`${base}/clients/${client._id}/linked-records`);
        setLinked(res.data.data);
      } catch { setLinked({ error: true }); }
    }
  };

  const runAction = async () => {
    if (!action) return;
    const { type, client } = action;
    setActing(true);
    try {
      let res;
      if (type === 'suspend') res = await http.post(`${base}/clients/${client._id}/suspend`, { reason: actionReason });
      if (type === 'hold') res = await http.post(`${base}/clients/${client._id}/hold`, { reason: actionReason });
      if (type === 'archive') res = await http.delete(`${base}/clients/${client._id}`, { data: { reason: actionReason } });
      if (type === 'permanent') res = await http.delete(`${base}/clients/${client._id}/permanent`, { data: { confirm: confirmText.trim() } });
      toast.success(res.data.message);
      setAction(null);
      setPreviewClient(null);
      fetchClients();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Action failed');
    } finally {
      setActing(false);
    }
  };

  // One-click, non-destructive actions
  const quickAction = async (path, client) => {
    try {
      const res = await http.post(`${base}/clients/${client._id}/${path}`);
      toast.success(res.data.message);
      setPreviewClient(null);
      fetchClients();
    } catch (err) { toast.error(err?.response?.data?.message || 'Action failed'); }
  };

  const f = (k) => (e) => {
    let val = e.target.value;
    if (k === 'contactName') {
      // Remove digits and symbols; letters (any script), spaces, dots, hyphens and apostrophes stay
      val = val.replace(/[^\p{L}\s.'’-]/gu, '');
    } else if (k === 'phone') {
      // Remove any characters that are not digits or +
      val = val.replace(/[^\d+]/g, '');
      // Limit to 15 characters max
      if (val.length > 15) val = val.substring(0, 15);
    }
    setForm((p) => ({ ...p, [k]: val }));
    if (errors[k]) setErrors((p) => ({ ...p, [k]: null }));
  };

  // Money columns only when the API sent them (invoice access)
  const showMoney = clients.length === 0 ? portfolio.kpis?.monthlyRecurringRevenue !== undefined : clients.some((c) => c.finance);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-on-surface font-heading">Client Accounts</h1>
          <p className="text-on-surface-variant text-sm mt-1">Client portfolio — accounts, fees, collections and onboarding</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-secondary/10 text-secondary px-4 py-2 rounded-lg font-bold text-sm">
            Showing: {total}
          </div>
          {full && canCrm('clients', 'create') && (<button
            onClick={() => setShowIssues(true)}
            title="Find Won leads that never got a client account and see why"
            className="flex items-center gap-2 px-3 py-2 border border-outline-variant text-on-surface-variant hover:text-on-surface rounded-lg text-sm font-medium transition-colors cursor-pointer"
          >
            <AlertTriangle size={15} /> Check Won leads
          </button>)}
          {canCrm('clients', 'create') && (<button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-secondary text-white rounded-lg text-sm font-medium hover:bg-secondary/90 transition-colors cursor-pointer"
          >
            <Plus size={16} /> New Client
          </button>)}
        </div>
      </div>

      {full && (issueCount > 0 || showIssues) && (
        <button type="button" onClick={() => setShowIssues(true)} className="w-full flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-left cursor-pointer hover:bg-amber-500/15 transition-colors">
          <AlertTriangle size={18} className="text-amber-400 shrink-0" />
          <span className="flex-1 min-w-0">
            <span className="block text-on-surface text-sm font-semibold">{issueCount} Won lead{issueCount === 1 ? '' : 's'} {issueCount === 1 ? 'has' : 'have'} no client account</span>
            <span className="block text-on-surface-variant text-xs mt-0.5">See why each one failed and fix it.</span>
          </span>
          <span className="text-amber-400 text-sm font-medium shrink-0">Review</span>
        </button>
      )}
      {showIssues && <ClientCreationIssuesPanel http={http} base={base} onClose={() => setShowIssues(false)} onChanged={() => { loadIssueCount(); fetchClients(); }} />}

      <PortfolioKpis
        kpis={portfolio.kpis}
        topByRevenue={portfolio.topByRevenue}
        revenuePeriod={portfolio.revenuePeriod}
        status={statusFilter}
        billing={billingFilter}
        onPick={({ status, billing }) => { setStatusFilter(status); setBillingFilter(billing); setPage(1); }}
      />

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
        <div className="flex flex-wrap gap-2 mt-3" role="tablist" aria-label="Filter by account status">
          {STATUS_TABS.map((t) => (
            <button
              key={t.id || 'all'}
              role="tab"
              aria-selected={statusFilter === t.id}
              onClick={() => { setStatusFilter(t.id); setPage(1); }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                statusFilter === t.id
                  ? 'bg-secondary/15 text-secondary border-secondary/30'
                  : 'bg-admin-bg text-on-surface-variant border-outline-variant hover:text-on-surface'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {[
            { label: 'Sector', value: sectorFilter, set: setSectorFilter, opts: portfolio.filterOptions.sectors.map((x) => ({ id: x, label: x })), all: 'All sectors' },
            { label: 'Service', value: serviceFilter, set: setServiceFilter, opts: portfolio.filterOptions.services.map((x) => ({ id: x, label: x })), all: 'All services' },
            ...(portfolio.kpis?.monthlyRecurringRevenue !== undefined ? [{
              label: 'Billing', value: billingFilter, set: setBillingFilter, all: 'Any billing status',
              opts: [{ id: 'overdue', label: 'Overdue (defaulters)' }, { id: 'outstanding', label: 'Has outstanding balance' }, { id: 'clear', label: 'Fully paid up' }],
            }] : []),
          ].map((flt) => (
            <select key={flt.label} aria-label={flt.label} value={flt.value}
              onChange={(e) => { flt.set(e.target.value); setPage(1); }}
              className="bg-admin-bg border border-outline-variant rounded-lg px-3 py-1.5 text-xs text-on-surface-variant focus:outline-none focus:border-secondary cursor-pointer">
              <option value="">{flt.all}</option>
              {flt.opts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          ))}
          <label className="flex items-center gap-2 text-xs text-on-surface-variant ml-auto">
            Sort
            <select aria-label="Sort" value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}
              className="bg-admin-bg border border-outline-variant rounded-lg px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:border-secondary cursor-pointer">
              {SORT_OPTIONS.filter((o) => portfolio.kpis?.monthlyRecurringRevenue !== undefined || ['newest', 'name'].includes(o.id)).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </label>
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
                  <th className="px-4 py-3 text-left font-semibold hidden md:table-cell">Account manager</th>
                  {showMoney && <th className="px-4 py-3 text-right font-semibold">Monthly fee</th>}
                  {showMoney && <th className="px-4 py-3 text-right font-semibold hidden lg:table-cell">Outstanding</th>}
                  {showMoney && <th className="px-4 py-3 text-right font-semibold hidden xl:table-cell">Collection</th>}
                  <th className="px-4 py-3 text-center font-semibold">Status</th>
                  <th className="px-4 py-3 text-center font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {clients.map((c) => (
                  <tr key={c._id} className="hover:bg-surface-container-low transition-colors">
                    <td className="px-4 py-3 font-mono text-secondary text-xs">{c.clientId}</td>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => openPreview(c)} className="flex items-center gap-2 text-left cursor-pointer" title="Open client overview">
                        {c.profile?.logoUrl ? (
                          <img src={c.profile.logoUrl} alt="" className="w-8 h-8 rounded-lg object-contain bg-white p-0.5 shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-secondary/15 flex items-center justify-center shrink-0">
                            <Building size={14} className="text-secondary" />
                          </div>
                        )}
                        <span>
                          <span className="block text-on-surface font-medium">{c.businessName}</span>
                          <span className="block text-on-surface-variant text-[11px]">
                            {[c.profile?.domains?.[0], ...(c.profile?.services || []).slice(0, 2)].filter(Boolean).join(' · ') || c.contactName}
                          </span>
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant hidden md:table-cell">{c.accountManagerName || '—'}</td>
                    {showMoney && <td className="px-4 py-3 text-right text-on-surface font-medium">{inr(c.monthlyRecurringFee)}</td>}
                    {showMoney && (
                      <td className="px-4 py-3 text-right hidden lg:table-cell">
                        <span className="text-on-surface">{inr(c.finance?.outstanding)}</span>
                        {c.isDefaulter && (
                          <span className="block text-[10px] font-bold text-red-400">{c.finance.daysOverdue}d overdue · {inr(c.finance.overdueAmount)}</span>
                        )}
                      </td>
                    )}
                    {showMoney && <td className="px-4 py-3 text-right text-on-surface-variant hidden xl:table-cell">{pct(c.finance?.collectionPercent)}</td>}
                    <td className="px-4 py-3 text-center">
                      <span
                        title={c.holdReason || c.suspensionReason || c.deletionReason || ''}
                        className={`inline-flex items-center rounded-full text-[10px] font-bold px-2.5 py-0.5 border ${STATUS_BADGE[clientStatus(c)].cls}`}
                      >
                        {STATUS_BADGE[clientStatus(c)].label}
                      </span>
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
                        {canCrm('clients', 'edit') && (<button
                          onClick={() => openEdit(c)}
                          className="p-1.5 text-secondary hover:bg-secondary/10 rounded-lg transition-colors cursor-pointer"
                          title="Edit"
                        >
                          <Edit2 size={15} />
                        </button>)}
                        {canCrm('clients', 'edit') && clientStatus(c) === 'active' && (
                          <button onClick={() => openAction('hold', c)} title="Put on hold (service paused, client can still log in and pay)"
                            className="p-1.5 text-orange-400 hover:bg-orange-500/10 rounded-lg transition-colors cursor-pointer">
                            <PauseCircle size={15} />
                          </button>
                        )}
                        {canCrm('clients', 'edit') && clientStatus(c) === 'hold' && (
                          <button onClick={() => quickAction('release', c)} title="Take off hold"
                            className="p-1.5 text-green-400 hover:bg-green-500/10 rounded-lg transition-colors cursor-pointer">
                            <PlayCircle size={15} />
                          </button>
                        )}
                        {full && clientStatus(c) === 'active' && (
                          <button onClick={() => openAction('suspend', c)} title="Suspend account"
                            className="p-1.5 text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors cursor-pointer">
                            <Ban size={15} />
                          </button>
                        )}
                        {full && clientStatus(c) === 'suspended' && (
                          <button onClick={() => quickAction('reactivate', c)} title="Reactivate account"
                            className="p-1.5 text-green-400 hover:bg-green-500/10 rounded-lg transition-colors cursor-pointer">
                            <RotateCcw size={15} />
                          </button>
                        )}
                        {isSuperAdmin && clientStatus(c) !== 'archived' && (
                          <button onClick={() => openAction('archive', c)} title="Delete account"
                            className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer">
                            <Trash2 size={15} />
                          </button>
                        )}
                        {isSuperAdmin && clientStatus(c) === 'archived' && (
                          <>
                            <button onClick={() => quickAction('restore', c)} title="Restore account"
                              className="p-1.5 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors cursor-pointer">
                              <ArchiveRestore size={15} />
                            </button>
                            <button onClick={() => openAction('permanent', c)} title="Delete permanently"
                              className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer">
                              <AlertTriangle size={15} />
                            </button>
                          </>
                        )}
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
          <div className="flex flex-wrap gap-2 items-center justify-between px-4 py-3 border-t border-outline-variant">
            <p className="text-on-surface-variant text-xs">Page {page} of {totalPages}</p>
            <div className="flex flex-wrap gap-2">
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

            <form onSubmit={handleSubmit} noValidate className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
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
                      <Icon size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${errors[k] ? 'text-red-500' : 'text-on-surface-variant'}`} />
                      <input
                        type={type}
                        value={form[k]}
                        onChange={f(k)}
                        required={['businessName', 'contactName', 'email'].includes(k)}
                        className={`w-full pl-9 pr-4 py-2.5 bg-admin-bg border ${errors[k] ? 'border-red-500/50 focus:border-red-500' : 'border-outline-variant focus:border-secondary'} rounded-xl text-on-surface text-sm focus:outline-none transition-colors`}
                      />
                    </div>
                    {errors[k] && <p className="text-red-500 text-[10px] mt-1">{errors[k]}</p>}
                  </div>
                ))}
              </div>

              {/* Portal passwords stay with full CRM access (the API ignores them otherwise) */}
              {(full || !selectedClient) && (
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
              )}

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
          <div className="w-full max-w-3xl max-h-[85vh] flex flex-col bg-surface border border-outline-variant rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up">
            <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-outline-variant">
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

            <div role="tablist" aria-label="Client sections" className="shrink-0 flex gap-1 px-4 sm:px-6 border-b border-outline-variant overflow-x-auto">
              {PREVIEW_TABS.map((t) => (
                <button key={t.id} role="tab" aria-selected={previewTab === t.id} onClick={() => setPreviewTab(t.id)}
                  className={`px-3 sm:px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px cursor-pointer transition-colors ${
                    previewTab === t.id ? 'border-secondary text-secondary' : 'border-transparent text-on-surface-variant hover:text-on-surface'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>

            <div className="p-6 space-y-6 flex-1 min-h-0 overflow-y-auto overscroll-contain">
              {previewTab === 'profile' && (
                <ClientProfilePanel
                  client={previewClient}
                  http={http}
                  base={base}
                  canEdit={canCrm('clients', 'edit')}
                  onSaved={() => { refreshPreview(previewClient._id); fetchClients(); }}
                />
              )}
              {previewTab === 'strategy' && (
                <StrategyPanel clientId={previewClient._id} http={http} base={base} canEdit={canCrm('clients', 'edit')} />
              )}
              {previewTab === 'billing' && (
                <BillingSchedulePanel clientId={previewClient._id} http={http} base={base} canEdit={canCrm('invoices', 'edit')} />
              )}
              {previewTab === 'ads' && (
                <AdPerformancePanel clientId={previewClient._id} http={http} base={base} canEdit={canCrm('clients', 'edit')} />
              )}
              {previewTab === 'kyc' && (
                <KycPanel clientId={previewClient._id} http={http} base={base} canReview={canCrm('clients', 'edit')} />
              )}
              {previewTab === 'onboarding' && (
                <OnboardingPanel
                  clientId={previewClient._id}
                  http={http}
                  base={base}
                  canEdit={canCrm('clients', 'edit')}
                  canException={canCrm('clients', 'edit')}
                />
              )}
              {previewTab === 'overview' && (<>
              {/* Detailed Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
                    <span className={`inline-flex items-center rounded-full text-[10px] font-bold px-2.5 py-0.5 border ${STATUS_BADGE[clientStatus(previewClient)].cls}`}>
                      {STATUS_BADGE[clientStatus(previewClient)].label}
                    </span>
                    {clientStatus(previewClient) === 'suspended' && previewClient.suspendedAt && (
                      <p className="text-on-surface-variant text-[11px] mt-1">
                        Since {fmtDate(previewClient.suspendedAt)}{previewClient.suspensionReason ? ` — ${previewClient.suspensionReason}` : ''}
                      </p>
                    )}
                    {clientStatus(previewClient) === 'archived' && (
                      <p className="text-on-surface-variant text-[11px] mt-1">
                        Deleted {fmtDate(previewClient.deletedAt)}{previewClient.deletionReason ? ` — ${previewClient.deletionReason}` : ''}
                      </p>
                    )}
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

              {/* Client 360 — Pre-Sale Timeline: everything that happened on
                  the lead this client converted from, so nothing is lost
                  once a lead becomes a client record. */}
              {previewClient.preSaleTimeline && (
                <div className="space-y-2 border-t border-outline-variant pt-4">
                  <p className="text-on-surface-variant text-[10px] uppercase font-bold tracking-wider">Pre-Sale Timeline</p>
                  <div className="bg-admin-bg/60 border border-outline-variant rounded-xl p-3.5 max-h-52 overflow-y-auto overscroll-contain space-y-3">
                    {[
                      ...(previewClient.preSaleTimeline.pipelineHistory || []).map((e) => ({ date: e.date, label: e.status, note: e.note })),
                      ...(previewClient.preSaleTimeline.callLogs || []).map((c) => ({ date: c.callDate, label: `Call #${c.touchNumber} — ${c.connected === 'Yes' ? `Connected (${c.interestLevel || '-'})` : `Not Connected (${c.notConnectedReason || '-'})`}`, note: c.remark })),
                      ...(previewClient.preSaleTimeline.assignmentHistory || []).map((a) => ({ date: a.createdAt, label: `Assigned to ${a.toAdmin ? [a.toAdmin.firstName, a.toAdmin.lastName].filter(Boolean).join(' ') : 'Unassigned'}`, note: a.reason }))
                    ]
                      .filter((e) => e.date)
                      .sort((a, b) => new Date(b.date) - new Date(a.date))
                      .map((event, idx) => (
                        <div key={idx} className="flex gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                          <div>
                            <p className="text-on-surface text-xs font-medium">{event.label}</p>
                            {event.note && <p className="text-on-surface-variant text-[11px] mt-0.5">{event.note}</p>}
                            <p className="text-on-surface-variant text-[10px] mt-0.5">
                              {new Date(event.date).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      ))}
                    {[...(previewClient.preSaleTimeline.pipelineHistory || []), ...(previewClient.preSaleTimeline.callLogs || [])].length === 0 && (
                      <p className="text-on-surface-variant text-xs">No pre-sale activity recorded.</p>
                    )}
                  </div>
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
              </>)}
            </div>

            <div className="shrink-0 px-6 py-3.5 bg-admin-bg/40 border-t border-outline-variant flex justify-end">
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

      {/* Suspend / Delete / Delete permanently dialog */}
      {action && (
        <div className="fixed inset-0 overflow-y-auto z-[60] flex items-center-safe justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="client-action-title" className="w-full max-w-md bg-surface border border-outline-variant rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant">
              <h3 id="client-action-title" className="text-on-surface font-semibold text-lg">
                {action.type === 'suspend' && 'Suspend account'}
                {action.type === 'hold' && 'Put client on hold'}
                {action.type === 'archive' && 'Delete account'}
                {action.type === 'permanent' && 'Delete permanently'}
              </h3>
              <button onClick={() => setAction(null)} aria-label="Close" className="p-1.5 rounded-lg hover:bg-surface-container-low text-on-surface-variant cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm">
              <p className="text-on-surface">
                <span className="font-semibold">{action.client.businessName}</span>{' '}
                <span className="text-on-surface-variant font-mono text-xs">({action.client.clientId})</span>
              </p>

              {action.type === 'hold' && (
                <ul className="list-disc pl-5 text-on-surface-variant space-y-1 text-xs">
                  <li>The client's service is paused — for example for an unpaid invoice.</li>
                  <li>They can still log in to see why and to pay; they are notified with your reason.</li>
                  <li>Take them off hold at any time from this list.</li>
                </ul>
              )}

              {action.type === 'suspend' && (
                <ul className="list-disc pl-5 text-on-surface-variant space-y-1 text-xs">
                  <li>The client is signed out immediately and cannot log in.</li>
                  <li>All invoices, projects and tickets stay as they are.</li>
                  <li>They will not receive portal notifications while suspended.</li>
                  <li>You can reactivate the account at any time.</li>
                </ul>
              )}

              {action.type === 'archive' && (
                <>
                  <ul className="list-disc pl-5 text-on-surface-variant space-y-1 text-xs">
                    <li>The client is signed out and can no longer log in.</li>
                    <li>The account is hidden from client lists and pickers.</li>
                    <li>Invoices, payments, projects and tickets are <strong>kept</strong> for your records.</li>
                    <li>A Super Admin can restore it from the <em>Deleted</em> tab.</li>
                  </ul>
                  {linked && !linked.error && (
                    <p className="text-on-surface-variant text-xs">
                      Linked records: {linked.invoices} invoices · {linked.payments} payments · {linked.projects} projects · {linked.retainers} retainers · {linked.tickets} tickets
                    </p>
                  )}
                </>
              )}

              {(action.type === 'suspend' || action.type === 'archive' || action.type === 'hold') && (
                <div>
                  <label htmlFor="client-action-reason" className="block text-on-surface-variant text-xs font-medium mb-1.5">{action.type === 'hold' ? 'Reason (shown to the client)' : 'Reason (internal, not shown to the client)'}</label>
                  <textarea
                    id="client-action-reason"
                    rows={3}
                    maxLength={500}
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    placeholder={action.type === 'suspend' ? 'e.g. Payment overdue by 60 days' : 'e.g. Contract ended'}
                    className="w-full px-3 py-2 bg-admin-bg border border-outline-variant rounded-xl text-on-surface text-sm focus:outline-none focus:border-secondary resize-none"
                  />
                </div>
              )}

              {action.type === 'permanent' && (
                !linked ? (
                  <div className="flex justify-center py-4"><div className="w-6 h-6 border-2 border-secondary/30 border-t-secondary rounded-full animate-spin" /></div>
                ) : linked.error ? (
                  <p className="text-red-400 text-xs">Could not check linked records. Please try again.</p>
                ) : linked.total > 0 ? (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300 space-y-1">
                    <p className="font-semibold">This client cannot be permanently deleted.</p>
                    <p>It has {linked.invoices} invoices, {linked.payments} payments, {linked.projects} projects, {linked.retainers} retainers and {linked.tickets} tickets. These records must be kept, so the account stays deleted (archived).</p>
                  </div>
                ) : (
                  <>
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                      This removes the account forever. It cannot be undone.
                    </div>
                    <div>
                      <label htmlFor="client-action-confirm" className="block text-on-surface-variant text-xs font-medium mb-1.5">
                        Type <span className="font-mono text-on-surface">{action.client.clientId}</span> to confirm
                      </label>
                      <input
                        id="client-action-confirm"
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        autoComplete="off"
                        className="w-full px-3 py-2 bg-admin-bg border border-outline-variant rounded-xl text-on-surface text-sm font-mono focus:outline-none focus:border-red-500"
                      />
                    </div>
                  </>
                )
              )}
            </div>

            <div className="px-6 py-3.5 bg-admin-bg/40 border-t border-outline-variant flex flex-wrap justify-end gap-2">
              <button onClick={() => setAction(null)} className="px-4 py-2 bg-admin-bg border border-outline-variant text-on-surface-variant hover:text-on-surface rounded-xl text-sm cursor-pointer">
                Cancel
              </button>
              <button
                onClick={runAction}
                disabled={
                  acting ||
                  (action.type === 'permanent' && (!linked || linked.error || linked.total > 0 || confirmText.trim() !== action.client.clientId)) ||
                  (action.type === 'hold' && actionReason.trim().length < 5)
                }
                className={`px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
                  action.type === 'suspend' || action.type === 'hold' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {acting ? 'Working…' : action.type === 'hold' ? 'Put on hold' : action.type === 'suspend' ? 'Suspend account' : action.type === 'archive' ? 'Delete account' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
