import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Plus, Save, Trash2, Edit2, EyeOff, Download, X } from 'lucide-react';

const PERIODS = [
  { id: 'this_month', label: 'This month' }, { id: 'last_month', label: 'Last month' },
  { id: 'this_week', label: 'This week' }, { id: 'last_week', label: 'Last week' }, { id: 'last_30_days', label: 'Last 30 days' },
];
const PLATFORMS = ['Meta', 'Google', 'LinkedIn', 'YouTube', 'Other'];
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const EMPTY = { day: today(), platform: 'Meta', campaignName: '', objective: '', resultType: '', creativeName: '', budget: '', spend: '', impressions: '', clicks: '', results: '', revenue: '', notes: '', hidden: false };

const inr = (n) => (n == null ? '--' : `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`);
const num = (n) => (n == null ? '--' : Number(n).toLocaleString('en-IN'));
const inputCls = 'w-full px-3 py-2 bg-admin-bg border border-outline-variant rounded-lg text-on-surface text-sm focus:outline-none focus:border-secondary';

function Field({ label, children, wide }) {
  return (
    <label className={`block ${wide ? 'sm:col-span-2' : ''}`}>
      <span className="block text-on-surface-variant text-[10px] uppercase font-bold tracking-wider mb-1">{label}</span>
      {children}
    </label>
  );
}

/**
 * Manual Daily Tracker entry for one client (Client Portal CRM §5, manual entry
 * as agreed with the client). One row per day + platform + campaign (+ creative).
 * Ratios are calculated by the server from the totals.
 */
export default function AdPerformancePanel({ clientId, http, base, canEdit }) {
  const [period, setPeriod] = useState('this_month');
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null); // null | { ...row, _id? }
  const [saving, setSaving] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let live = true;
    http.get(`${base}/clients/${clientId}/ad-performance`, { params: { period, group: 'day' } })
      .then((res) => { if (live) setData(res.data.data); })
      .catch((err) => toast.error(err?.response?.data?.message || 'Could not load ad data'));
    return () => { live = false; };
  }, [http, base, clientId, period, reload]);

  const refresh = useCallback(() => setReload((n) => n + 1), []);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { _id, ...body } = form;
      const res = _id
        ? await http.put(`${base}/clients/${clientId}/ad-performance/${_id}`, body)
        : await http.post(`${base}/clients/${clientId}/ad-performance`, body);
      toast.success(res.data.message);
      // Keep the date and platform for the next row — staff usually enter several campaigns for one day
      setForm(_id ? null : { ...EMPTY, day: form.day, platform: form.platform });
      refresh();
    } catch (err) { toast.error(err?.response?.data?.message || 'Could not save'); }
    finally { setSaving(false); }
  };

  const remove = async (row) => {
    if (!window.confirm(`Delete the ${row.platform} row for "${row.campaignName}" on ${row.day}?`)) return;
    try {
      await http.delete(`${base}/clients/${clientId}/ad-performance/${row._id}`);
      toast.success('Entry deleted');
      refresh();
    } catch (err) { toast.error(err?.response?.data?.message || 'Could not delete'); }
  };

  const exportCsv = async () => {
    try {
      const res = await http.get(`${base}/clients/${clientId}/ad-performance/export.csv`, { params: { period }, responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ad-performance-${period}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch { toast.error('Could not export'); }
  };

  const edit = (row) => setForm({
    _id: row._id, day: row.day, platform: row.platform, campaignName: row.campaignName, objective: row.objective, resultType: row.resultType,
    creativeName: row.creativeName, budget: row.budget ?? '', spend: row.spend, impressions: row.impressions, clicks: row.clicks,
    results: row.results, revenue: row.revenue ?? '', notes: row.notes, hidden: row.hidden,
  });

  const t = data?.totals;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Period" value={period} onChange={(e) => setPeriod(e.target.value)} className="bg-admin-bg border border-outline-variant rounded-lg px-3 py-1.5 text-xs text-on-surface cursor-pointer">
          {PERIODS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <button type="button" onClick={exportCsv} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-outline-variant text-xs text-on-surface-variant hover:text-on-surface cursor-pointer"><Download size={13} /> CSV</button>
        {canEdit && !form && (
          <button type="button" onClick={() => setForm({ ...EMPTY })} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-white text-xs font-semibold cursor-pointer"><Plus size={13} /> Add day&apos;s entry</button>
        )}
      </div>

      {t && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          {[['Spend', inr(t.spend)], ['Results', num(t.results)], ['Cost / result', inr(t.costPerResult)], ['ROAS', t.roas == null ? '--' : `${t.roas}x`],
            ['Impressions', num(t.impressions)], ['Clicks', num(t.clicks)], ['CTR', t.ctr == null ? '--' : `${t.ctr}%`], ['CPC', inr(t.cpc)]].map(([k, v]) => (
            <div key={k} className="rounded-lg border border-outline-variant bg-admin-bg/40 px-3 py-2">
              <p className="text-on-surface-variant">{k}</p><p className="text-on-surface font-semibold text-sm mt-0.5">{v}</p>
            </div>
          ))}
        </div>
      )}

      {form && (
        <form onSubmit={save} className="rounded-xl border border-outline-variant bg-admin-bg/40 p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-on-surface text-sm font-semibold">{form._id ? 'Edit entry' : 'New entry'}</p>
            <button type="button" onClick={() => setForm(null)} aria-label="Close" className="text-on-surface-variant hover:text-on-surface cursor-pointer"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <Field label="Date *"><input type="date" required max={today()} className={inputCls} value={form.day} onChange={set('day')} /></Field>
            <Field label="Platform *"><select className={inputCls} value={form.platform} onChange={set('platform')}>{PLATFORMS.map((p) => <option key={p}>{p}</option>)}</select></Field>
            <Field label="Campaign *" wide><input required className={inputCls} value={form.campaignName} onChange={set('campaignName')} placeholder="As named in the ad account" /></Field>
            <Field label="Objective"><input className={inputCls} value={form.objective} onChange={set('objective')} placeholder="Sales, Leads…" /></Field>
            <Field label="Result type"><input className={inputCls} value={form.resultType} onChange={set('resultType')} placeholder="Purchases, Leads…" /></Field>
            <Field label="Creative (optional)" wide><input className={inputCls} value={form.creativeName} onChange={set('creativeName')} /></Field>
            <Field label="Spend (₹) *"><input required type="number" min="0" step="0.01" inputMode="decimal" className={inputCls} value={form.spend} onChange={set('spend')} /></Field>
            <Field label="Daily budget (₹)"><input type="number" min="0" step="0.01" className={inputCls} value={form.budget} onChange={set('budget')} /></Field>
            <Field label="Impressions"><input type="number" min="0" step="1" inputMode="numeric" className={inputCls} value={form.impressions} onChange={set('impressions')} /></Field>
            <Field label="Clicks"><input type="number" min="0" step="1" inputMode="numeric" className={inputCls} value={form.clicks} onChange={set('clicks')} /></Field>
            <Field label="Results"><input type="number" min="0" step="1" inputMode="numeric" className={inputCls} value={form.results} onChange={set('results')} /></Field>
            <Field label="Revenue (₹)"><input type="number" min="0" step="0.01" className={inputCls} value={form.revenue} onChange={set('revenue')} placeholder="If reported" /></Field>
            <Field label="Internal note (never shown to the client)" wide><input className={inputCls} value={form.notes} onChange={set('notes')} placeholder="Why it moved, what was changed" /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-on-surface cursor-pointer"><input type="checkbox" checked={form.hidden} onChange={set('hidden')} /> Hide this row from the client (e.g. while checking it)</label>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-secondary text-white text-sm font-semibold disabled:opacity-60 cursor-pointer"><Save size={14} /> {saving ? 'Saving…' : form._id ? 'Save changes' : 'Save & add another'}</button>
            <button type="button" onClick={() => setForm(null)} className="px-4 py-2 rounded-lg border border-outline-variant text-on-surface-variant text-sm cursor-pointer">Cancel</button>
          </div>
        </form>
      )}

      {!data ? (
        <div className="flex justify-center py-6"><div className="w-6 h-6 border-2 border-secondary/30 border-t-secondary rounded-full animate-spin" /></div>
      ) : data.rows.length === 0 ? (
        <p className="text-on-surface-variant text-sm">No entries in this period yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-outline-variant">
          <table className="w-full text-xs">
            <thead className="bg-admin-bg text-on-surface-variant uppercase tracking-wider">
              <tr>
                {['Date', 'Platform', 'Campaign', 'Spend', 'Impr.', 'Clicks', 'Results', 'CPR', 'ROAS', ''].map((h) => <th key={h} className="px-3 py-2 text-left font-semibold whitespace-nowrap">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {data.rows.map((r) => (
                <tr key={r._id} className={r.hidden ? 'opacity-60' : ''}>
                  <td className="px-3 py-2 whitespace-nowrap text-on-surface">{r.day}</td>
                  <td className="px-3 py-2 text-on-surface-variant">{r.platform}</td>
                  <td className="px-3 py-2 text-on-surface">
                    <span className="flex items-center gap-1">{r.hidden && <EyeOff size={12} className="text-amber-400" aria-label="Hidden from client" />}{r.campaignName}</span>
                    {r.notes && <span className="block text-[10px] text-on-surface-variant">{r.notes}</span>}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-on-surface">{inr(r.spend)}</td>
                  <td className="px-3 py-2 tabular-nums text-on-surface-variant">{num(r.impressions)}</td>
                  <td className="px-3 py-2 tabular-nums text-on-surface-variant">{num(r.clicks)}</td>
                  <td className="px-3 py-2 tabular-nums text-on-surface-variant">{num(r.results)}</td>
                  <td className="px-3 py-2 tabular-nums text-on-surface-variant">{inr(r.costPerResult)}</td>
                  <td className="px-3 py-2 tabular-nums text-on-surface-variant">{r.roas == null ? '--' : `${r.roas}x`}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {canEdit && (
                      <span className="flex gap-1">
                        <button type="button" onClick={() => edit(r)} aria-label="Edit" className="p-1 text-secondary hover:bg-secondary/10 rounded cursor-pointer"><Edit2 size={13} /></button>
                        <button type="button" onClick={() => remove(r)} aria-label="Delete" className="p-1 text-red-400 hover:bg-red-500/10 rounded cursor-pointer"><Trash2 size={13} /></button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data?.lastUpdated && <p className="text-[11px] text-on-surface-variant">Last updated {new Date(data.lastUpdated).toLocaleString('en-IN')}</p>}
    </div>
  );
}
