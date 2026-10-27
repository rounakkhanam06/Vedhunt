import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Download, Target } from 'lucide-react';
import KpiReportTable from '../../../shared/KpiReportTable';

// Client → KPI tab: the KPI setup per ad platform (approved budget, goal, targets) and the
// KPI report built from the daily ad entries (server/services/kpi.js). Staff enter qualified
// leads, verified orders and the optimization action per period; the client sees the same
// report in their portal, without the gross margin and internal notes.
const inputCls = 'w-full px-3 py-2 bg-admin-bg border border-outline-variant rounded-lg text-on-surface text-xs focus:outline-none focus:border-secondary';
const thisMonth = () => new Date().toLocaleDateString('en-CA').slice(0, 7);
const monthLabel = (m) => new Date(`${m}-01T12:00:00`).toLocaleString('en-IN', { month: 'short', year: 'numeric' });
const emptySetup = (platform) => ({ platform, budgetEffectiveFrom: thisMonth(), businessType: '', reportingFrequency: 'Monthly', monthlyBudget: '', primaryGoal: 'Purchases', targetCpa: '', targetRoas: '', grossMarginPercent: '', accountOwner: '', notes: '' });

function SetupForm({ form, setForm, options, isNew, onSave, onCancel, saving }) {
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const field = (label, el, hint) => (
    <label className="block">
      <span className="block text-on-surface-variant text-[10px] uppercase font-bold tracking-wider mb-1">{label}</span>
      {el}
      {hint && <span className="block text-[10px] text-on-surface-variant mt-0.5">{hint}</span>}
    </label>
  );
  return (
    <div className="rounded-xl border border-secondary/30 bg-secondary/5 p-4 space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {field('Platform', isNew
          ? <select className={inputCls} value={form.platform} onChange={set('platform')}>{options.platforms.map((p) => <option key={p}>{p}</option>)}</select>
          : <p className="text-on-surface text-sm font-semibold py-1.5">{form.platform}</p>)}
        {field('Monthly approved budget (₹) *', <input type="number" min="0" className={inputCls} value={form.monthlyBudget} onChange={set('monthlyBudget')} />, 'For this platform only')}
        {field('Budget applies from', <input type="month" className={`${inputCls} [color-scheme:dark]`} value={form.budgetEffectiveFrom} onChange={set('budgetEffectiveFrom')} />,
          isNew ? 'Months before this use the same budget' : 'Earlier months keep the budget they had')}
        {field('Reporting frequency', <select className={inputCls} value={form.reportingFrequency} onChange={set('reportingFrequency')}>{options.frequencies.map((x) => <option key={x}>{x}</option>)}</select>)}
        {field('Primary goal', <select className={inputCls} value={form.primaryGoal} onChange={set('primaryGoal')}>{options.goals.map((x) => <option key={x}>{x}</option>)}</select>)}
        {field('Target CPA / CPL (₹)', <input type="number" min="0" className={inputCls} value={form.targetCpa} onChange={set('targetCpa')} />)}
        {field('Target ROAS (x)', <input type="number" min="0" step="0.1" className={inputCls} value={form.targetRoas} onChange={set('targetRoas')} />, 'Leave blank for lead generation')}
        {field('Business type', <input className={inputCls} value={form.businessType} onChange={set('businessType')} placeholder="E-commerce / Lead Generation" />)}
        {field('Account owner', <input className={inputCls} value={form.accountOwner} onChange={set('accountOwner')} />)}
        {field('Gross margin % (internal)', <input type="number" min="0" max="100" className={inputCls} value={form.grossMarginPercent} onChange={set('grossMarginPercent')} />, 'Never shown to the client')}
      </div>
      {field('Notes (internal)', <textarea rows={2} className={`${inputCls} resize-none`} value={form.notes} onChange={set('notes')} />)}
      <div className="flex gap-2">
        <button type="button" disabled={saving} onClick={onSave} className="px-4 py-1.5 bg-secondary text-white rounded-lg text-xs font-medium hover:bg-secondary/90 disabled:opacity-50 cursor-pointer">{saving ? 'Saving…' : 'Save'}</button>
        <button type="button" onClick={onCancel} className="px-4 py-1.5 border border-outline-variant text-on-surface-variant rounded-lg text-xs cursor-pointer">Cancel</button>
      </div>
    </div>
  );
}

export default function KpiPanel({ http, base, clientId, canEdit }) {
  const [setups, setSetups] = useState(null);
  const [options, setOptions] = useState({ platforms: [], frequencies: [], goals: [] });
  const [form, setForm] = useState(null); // { ...setup, isNew }
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState({ frequency: '', from: '', to: '' });
  const [report, setReport] = useState({ key: null, data: null, error: '' });
  const [reload, setReload] = useState(0);
  const reportKey = JSON.stringify({ clientId, filters, reload });

  useEffect(() => {
    let cancelled = false;
    http.get(`${base}/clients/${clientId}/kpi-setup`)
      .then((r) => { if (!cancelled) { setSetups(r.data.data || []); setOptions({ platforms: r.data.platforms, frequencies: r.data.frequencies, goals: r.data.goals }); } })
      .catch(() => { if (!cancelled) setSetups([]); });
    return () => { cancelled = true; };
  }, [http, base, clientId, reload]);

  useEffect(() => {
    let cancelled = false;
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    http.get(`${base}/clients/${clientId}/kpi-report`, { params })
      .then((r) => { if (!cancelled) setReport({ key: reportKey, data: r.data.data, error: '' }); })
      .catch((err) => { if (!cancelled) setReport({ key: reportKey, data: null, error: err?.response?.data?.message || 'Could not load the KPI report' }); });
    return () => { cancelled = true; };
  }, [http, base, clientId, filters, reportKey]);

  const saveSetup = async () => {
    setSaving(true);
    try {
      const { platform, ...rest } = form;
      // History is kept by the server; send only what staff edit
      const body = Object.fromEntries(Object.entries(rest).filter(([k]) => !['isNew', 'budgetHistory', '_id', 'client_ref', 'createdAt', 'updatedAt', '__v', 'updatedBy', 'updatedByName'].includes(k)));
      await http.put(`${base}/clients/${clientId}/kpi-setup/${platform}`, body);
      toast.success(`${platform} KPI setup saved`);
      setForm(null);
      setReload((n) => n + 1);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not save the setup');
    } finally { setSaving(false); }
  };
  const removeSetup = async (platform) => {
    if (!window.confirm(`Remove the ${platform} KPI setup? Its report disappears; entered leads and actions are kept if you set it up again.`)) return;
    try {
      await http.delete(`${base}/clients/${clientId}/kpi-setup/${platform}`);
      toast.success('Removed');
      setReload((n) => n + 1);
    } catch (err) { toast.error(err?.response?.data?.message || 'Could not remove it'); }
  };
  const saveEntry = async (body) => {
    try {
      await http.put(`${base}/clients/${clientId}/kpi-entry`, body);
      toast.success('Saved');
      setReload((n) => n + 1);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not save');
      throw err;
    }
  };
  const download = async (platform) => {
    try {
      const params = { ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)), platform };
      const { data } = await http.get(`${base}/clients/${clientId}/kpi-report/export.csv`, { params, responseType: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(data);
      a.download = `KPI-${platform}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 30_000);
    } catch { toast.error('Could not download'); }
  };

  if (!setups) return <p className="text-sm text-on-surface-variant">Loading…</p>;
  const free = options.platforms.filter((p) => !setups.some((s) => s.platform === p));
  const toForm = (s) => ({ ...emptySetup(s.platform), ...Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v ?? ''])), budgetEffectiveFrom: thisMonth(), isNew: false });

  return (
    <div className="space-y-5">
      {/* Setup */}
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-on-surface text-sm font-semibold flex items-center gap-1.5"><Target size={15} className="text-secondary" /> KPI setup per platform</h4>
          {canEdit && !form && free.length > 0 && (
            <button type="button" onClick={() => setForm({ ...emptySetup(free[0]), isNew: true })}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-secondary/40 text-secondary text-[11px] font-semibold hover:bg-secondary/10 cursor-pointer"><Plus size={12} /> Add platform</button>
          )}
        </div>
        {form && <SetupForm form={form} setForm={setForm} options={{ ...options, platforms: form.isNew ? free : options.platforms }} isNew={form.isNew} onSave={saveSetup} onCancel={() => setForm(null)} saving={saving} />}
        {!canEdit && <p className="text-[11px] text-on-surface-variant">View only — changing KPIs needs the “Client KPI” permission in your role.</p>}
        {!setups.length && !form && <p className="text-xs text-on-surface-variant">No KPI setup yet. Add each platform the client advertises on, with its approved monthly budget and targets — the report appears below.</p>}
        {setups.map((s) => (
          <div key={s.platform} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-outline-variant px-3 py-2 text-xs">
            <span className="text-on-surface">
              <strong>{s.platform}</strong> · ₹{Number(s.monthlyBudget).toLocaleString('en-IN')}/month · {s.primaryGoal} · {s.reportingFrequency}
              {s.targetCpa != null && ` · CPA ₹${s.targetCpa}`}{s.targetRoas != null && ` · ROAS ${s.targetRoas}x`}
              {s.budgetHistory?.length > 1 && (
                <span className="block text-[10px] text-on-surface-variant mt-0.5">
                  Budget history: {s.budgetHistory.map((h) => `${h.month === '2000-01' ? 'before' : `from ${monthLabel(h.month)}`} ₹${Number(h.monthlyBudget).toLocaleString('en-IN')}`).join(' · ')}
                </span>
              )}
            </span>
            {canEdit && (
              <span className="flex gap-1">
                <button type="button" onClick={() => setForm(toForm(s))} title="Edit" className="p-1 rounded text-secondary hover:bg-secondary/10 cursor-pointer"><Pencil size={13} /></button>
                <button type="button" onClick={() => removeSetup(s.platform)} title="Remove" className="p-1 rounded text-red-400 hover:bg-red-500/10 cursor-pointer"><Trash2 size={13} /></button>
              </span>
            )}
          </div>
        ))}
      </section>

      {/* Report */}
      {setups.length > 0 && (
        <section className="space-y-3 border-t border-outline-variant pt-4">
          <div className="flex flex-wrap items-end gap-2">
            <h4 className="text-on-surface text-sm font-semibold mr-auto">KPI report</h4>
            <select aria-label="Frequency" value={filters.frequency} onChange={(e) => setFilters((f) => ({ ...f, frequency: e.target.value }))} className={`${inputCls} w-auto`}>
              <option value="">Each platform's frequency</option>
              {options.frequencies.map((x) => <option key={x}>{x}</option>)}
            </select>
            <input type="date" aria-label="From" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} className={`${inputCls} w-auto [color-scheme:dark]`} />
            <input type="date" aria-label="To" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} className={`${inputCls} w-auto [color-scheme:dark]`} />
            {(filters.from || filters.to) && <button type="button" onClick={() => setFilters((f) => ({ ...f, from: '', to: '' }))} className="text-[11px] text-on-surface-variant hover:text-on-surface cursor-pointer">Default period</button>}
          </div>
          {(filters.from && !filters.to) || (!filters.from && filters.to) ? <p className="text-[11px] text-on-surface-variant">Choose both dates.</p> : null}
          {report.key !== reportKey ? <p className="text-xs text-on-surface-variant">Loading…</p>
            : report.error ? <p className="text-xs text-red-400">{report.error}</p>
              : report.data.tables.map((table) => (
                <div key={table.platform} className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-on-surface text-xs font-bold">{table.platform} · {table.frequency} · {table.from} to {table.to}</p>
                    <button type="button" onClick={() => download(table.platform)} className="flex items-center gap-1 text-[11px] text-on-surface-variant hover:text-on-surface cursor-pointer"><Download size={12} /> CSV</button>
                  </div>
                  <KpiReportTable table={table} theme="admin" canEdit={canEdit} onSaveEntry={saveEntry} />
                </div>
              ))}
        </section>
      )}
    </div>
  );
}
