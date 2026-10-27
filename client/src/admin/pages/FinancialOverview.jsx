import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell,
} from 'recharts';
import {
  Users, UserCheck, UserPlus, IndianRupee, RefreshCw, Wallet, FileWarning, Target, Megaphone, Hourglass,
  ListTodo, AlertTriangle, ArrowUpRight, ArrowDownRight, Calendar, Database, X, Table2, BarChart3,
} from 'lucide-react';
import { useCrm } from '../../shared/crmAccess';
import { useTheme } from '../../context/ThemeContext';

// Categorical series, validated (dataviz validator: light + dark both pass). Fixed order, never
// cycled; "Unassigned" is a neutral gray, not a series hue. Light contrast is under 3:1 for some
// slots, so every chart also shows its values (legend values or a table).
const SERIES = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
};
const NEUTRAL = { light: '#a3a29b', dark: '#6b6a64' };
const UNASSIGNED = 'Unassigned';

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const inr = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
/** ₹9.1L / ₹1.2Cr / ₹45K, for chart axes and tight spaces */
const inrShort = (n) => {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1e7) return `₹${(v / 1e7).toFixed(1)}Cr`;
  if (Math.abs(v) >= 1e5) return `₹${(v / 1e5).toFixed(1)}L`;
  if (Math.abs(v) >= 1e3) return `₹${(v / 1e3).toFixed(0)}K`;
  return `₹${Math.round(v)}`;
};
const fmtDay = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

/** Date range presets → { from, to } */
function presetRange(preset, month) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (preset) {
    case 'lastMonth': return { from: ymd(new Date(y, m - 1, 1)), to: ymd(new Date(y, m, 0)) };
    case 'last3': return { from: ymd(new Date(y, m - 2, 1)), to: ymd(now) };
    case 'fy': { const start = m >= 3 ? y : y - 1; return { from: ymd(new Date(start, 3, 1)), to: ymd(now) }; }
    case 'month': { const [yy, mm] = month.split('-').map(Number); return { from: ymd(new Date(yy, mm - 1, 1)), to: ymd(new Date(yy, mm, 0)) }; }
    default: return { from: ymd(new Date(y, m, 1)), to: ymd(now) };
  }
}

function Change({ value, neutral }) {
  if (value == null) return <span className="text-[11px] text-app-text-muted" title="Nothing in the previous period to compare with">—</span>;
  const up = value >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  const tone = neutral ? 'text-app-text-muted' : up ? 'text-emerald-500' : 'text-rose-500';
  return <span className={`inline-flex items-center text-[11px] font-bold ${tone}`}><Icon size={12} />{Math.abs(value)}%</span>;
}

function Card({ icon: Icon, tint, label, value, sub, change, neutral, to }) {
  const body = (
    <div className="h-full bg-app-card border border-app-border rounded-xl p-4 hover:border-primary/40 transition-colors min-w-0">
      <div className="flex items-center gap-2.5">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${tint}`}><Icon size={17} /></div>
        <div className="text-[11px] font-semibold text-app-text-muted uppercase tracking-wider leading-tight">{label}</div>
      </div>
      <div className="flex items-baseline gap-x-2 mt-2.5 flex-wrap">
        <span className="text-xl font-extrabold text-app-text tabular-nums whitespace-nowrap">{value}</span>
        {change !== undefined && <Change value={change} neutral={neutral} />}
      </div>
      {sub && <div className="text-[11px] text-app-text-muted mt-1 leading-snug">{sub}</div>}
    </div>
  );
  return to ? <Link to={to} className="block">{body}</Link> : body;
}

function Panel({ title, icon: Icon, action, children }) {
  return (
    <section className="bg-app-card border border-app-border rounded-xl p-4 sm:p-5 min-w-0">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-sm font-bold text-app-text flex items-center gap-2">{Icon && <Icon size={15} className="text-primary" />}{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

const STATUS_PILL = {
  Paid: 'bg-emerald-500/10 text-emerald-500', Partial: 'bg-amber-500/10 text-amber-500',
  Unpaid: 'bg-app-border/40 text-app-text-muted', Overdue: 'bg-rose-500/10 text-rose-500',
  Active: 'bg-emerald-500/10 text-emerald-500', Onboarding: 'bg-blue-500/10 text-blue-500',
  Inactive: 'bg-app-border/40 text-app-text-muted', 'At Risk': 'bg-rose-500/10 text-rose-500',
};
const Pill = ({ s }) => <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap ${STATUS_PILL[s] || STATUS_PILL.Unpaid}`}>{s}</span>;

/** Donut with its values listed beside it (identity is never colour alone). */
function Donut({ rows, colorOf, centre, centreLabel, tooltip }) {
  const total = rows.reduce((s, r) => s + r.value, 0);
  if (!total) return <p className="text-sm text-app-text-muted py-10 text-center">Nothing in this period.</p>;
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-44 h-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 240 }}>
          <PieChart>
            <Pie data={rows} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="98%" paddingAngle={1} stroke="var(--color-app-card, transparent)" strokeWidth={2} isAnimationActive={false}>
              {rows.map((r) => <Cell key={r.name} fill={colorOf(r.name)} />)}
            </Pie>
            <Tooltip {...tooltip} formatter={(v, n) => [`${inr(v)} · ${((v / total) * 100).toFixed(1)}%`, n]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-lg font-extrabold text-app-text tabular-nums">{centre}</span>
          <span className="text-[10px] text-app-text-muted uppercase tracking-wider">{centreLabel}</span>
        </div>
      </div>
      <ul className="w-full space-y-1.5 text-xs">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: colorOf(r.name) }} />
            <span className="flex-1 text-app-text truncate">{r.name}</span>
            <span className="tabular-nums text-app-text font-semibold whitespace-nowrap">{inr(r.value)}</span>
            <span className="tabular-nums text-app-text-muted w-12 text-right shrink-0">{((r.value / total) * 100).toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Older invoice lines without a service: choose one per line and save. */
function MapLinesModal({ http, base, onClose, onSaved }) {
  const { data, isLoading } = useQuery({
    queryKey: ['unassigned-lines', base],
    queryFn: () => http.get(`${base}/invoice-lines/unassigned`).then((r) => r.data),
  });
  const [choice, setChoice] = useState({});
  const [saving, setSaving] = useState(false);
  const lines = data?.lines || [];
  const services = data?.services || [];
  const keyOf = (l) => `${l.invoice}|${l.index}`;
  // Suggest the client's one service when it has exactly one in the list
  const suggestion = (l) => (l.clientServices.length === 1 && services.includes(l.clientServices[0]) ? l.clientServices[0] : '');
  const valueOf = (l) => choice[keyOf(l)] ?? suggestion(l);
  const chosen = lines.filter((l) => valueOf(l));

  const save = async () => {
    setSaving(true);
    try {
      const r = await http.put(`${base}/invoice-lines/services`, { items: chosen.map((l) => ({ invoice: l.invoice, index: l.index, service: valueOf(l) })) });
      toast.success(r.data.message);
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label="Map invoice lines to services" className="w-full max-w-4xl max-h-[85vh] flex flex-col bg-app-card border border-app-border rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-app-border">
          <div>
            <h3 className="font-bold text-app-text">Unassigned invoice lines</h3>
            <p className="text-xs text-app-text-muted mt-0.5">Choose the service each line is for. Only the service is saved — amounts and sent documents do not change. Suggested from the client&rsquo;s single service where possible.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-app-bg text-app-text-muted cursor-pointer"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-auto">
          {isLoading && <p className="p-6 text-sm text-app-text-muted">Loading…</p>}
          {!isLoading && lines.length === 0 && <p className="p-6 text-sm text-app-text-muted">Every sent invoice line has a service.</p>}
          {lines.length > 0 && (
            <table className="w-full text-sm min-w-[720px]">
              <thead className="sticky top-0 bg-app-card text-[11px] uppercase text-app-text-muted border-b border-app-border">
                <tr><th className="text-left px-4 py-2">Invoice</th><th className="text-left px-3 py-2">Client</th><th className="text-left px-3 py-2">Line</th><th className="text-right px-3 py-2">Amount</th><th className="text-left px-4 py-2">Service</th></tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {lines.map((l) => (
                  <tr key={keyOf(l)}>
                    <td className="px-4 py-2 font-mono text-xs whitespace-nowrap">{l.invoiceId}<div className="text-[10px] text-app-text-muted font-sans">{fmtDay(l.issueDate)}</div></td>
                    <td className="px-3 py-2 text-app-text">{l.client}</td>
                    <td className="px-3 py-2 text-app-text max-w-[260px]"><span className="line-clamp-2">{l.description}</span>{l.revenueType && <span className="text-[10px] text-app-text-muted">{l.revenueType}</span>}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{inr(l.amount)}</td>
                    <td className="px-4 py-2">
                      <select aria-label={`Service for ${l.invoiceId} line ${l.index + 1}`} value={valueOf(l)} onChange={(e) => setChoice({ ...choice, [keyOf(l)]: e.target.value })}
                        className="w-full bg-app-bg border border-app-border rounded-lg px-2 py-1.5 text-xs text-app-text">
                        <option value="">Leave unassigned</option>
                        {services.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-app-border">
          <span className="text-xs text-app-text-muted">{chosen.length} of {lines.length} line{lines.length === 1 ? '' : 's'} will be mapped</span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-app-border text-sm text-app-text-muted cursor-pointer">Cancel</button>
            <button type="button" onClick={save} disabled={saving || !chosen.length} className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-bold disabled:opacity-50 cursor-pointer">{saving ? 'Saving…' : 'Save mapping'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Admin → Financial Overview: server/services/financialOverview.js computes every figure. */
export default function FinancialOverview() {
  const { http, base } = useCrm();
  const { theme } = useTheme();
  const mode = theme === 'light' ? 'light' : 'dark';
  const queryClient = useQueryClient();
  const [preset, setPreset] = useState('thisMonth');
  const [month, setMonth] = useState(ymd(new Date()).slice(0, 7));
  const [custom, setCustom] = useState(() => presetRange('thisMonth'));
  const [status, setStatus] = useState('all');
  const [service, setService] = useState('all');
  const [client, setClient] = useState('all');
  const [trendTable, setTrendTable] = useState(false);
  const [mapping, setMapping] = useState(false);
  const [showMissing, setShowMissing] = useState(false);

  const range = preset === 'custom' ? custom : presetRange(preset, month);
  const params = { from: range.from, to: range.to, status, service, client };
  const { data, isLoading, error, dataUpdatedAt } = useQuery({
    queryKey: ['financial-overview', base, params],
    queryFn: () => http.get(`${base}/financial-overview`, { params }).then((r) => r.data.data),
    enabled: Boolean(range.from && range.to && range.from <= range.to),
    placeholderData: keepPreviousData,
  });

  const palette = SERIES[mode];
  const tooltip = useMemo(() => ({
    contentStyle: {
      backgroundColor: mode === 'light' ? '#ffffff' : '#1E1E24', border: `1px solid ${mode === 'light' ? '#e5e7eb' : '#374151'}`,
      borderRadius: 8, fontSize: 12, color: mode === 'light' ? '#0b0b0b' : '#F9FAFB', padding: '8px 12px',
    },
    itemStyle: { color: mode === 'light' ? '#0b0b0b' : '#F9FAFB' },
    labelStyle: { color: mode === 'light' ? '#52514e' : '#c3c2b7', fontWeight: 600 },
  }), [mode]);
  const axis = mode === 'light' ? '#52514e' : '#9ca3af';
  const grid = mode === 'light' ? '#e7e6e2' : '#2a2a2e';

  // Colour follows the service / platform name (its place in the admin's list), never its rank
  const serviceColor = (name) => {
    if (name === UNASSIGNED) return NEUTRAL[mode];
    const i = (data?.filterOptions.services || []).indexOf(name);
    return palette[(i < 0 ? 7 : i) % palette.length];
  };
  const PLATFORM_ORDER = ['Meta', 'Google', 'LinkedIn', 'YouTube', 'Other'];
  const platformColor = (name) => palette[Math.max(0, PLATFORM_ORDER.indexOf(name))];
  const TREND = [['invoiced', 'Invoiced', palette[0]], ['collected', 'Collected', palette[2]], ['outstanding', 'Outstanding', palette[1]]];

  const c = data?.cards;
  const select = 'bg-app-card border border-app-border rounded-lg px-3 py-2 text-sm text-app-text';
  const label = 'block text-[10px] font-semibold text-app-text-muted uppercase tracking-wider mb-1';

  return (
    <div className="p-4 sm:p-6 space-y-5 text-app-text">
      <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold">Financial Overview</h1>
          <p className="text-sm text-app-text-muted mt-1">Revenue, collections, clients, ad spend and operational insights</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div><span className={label}>Date range</span>
            <select aria-label="Date range" className={select} value={preset} onChange={(e) => setPreset(e.target.value)}>
              <option value="thisMonth">This Month</option><option value="lastMonth">Last Month</option><option value="last3">Last 3 Months</option>
              <option value="fy">This Financial Year</option><option value="month">Pick a month</option><option value="custom">Custom range</option>
            </select>
          </div>
          {preset === 'month' && (
            <div><span className={label}>Month</span><input type="month" aria-label="Month" className={select} value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} /></div>
          )}
          {preset === 'custom' && (
            <>
              <div><span className={label}>From</span><input type="date" aria-label="From date" className={select} value={custom.from} max={custom.to} onChange={(e) => e.target.value && setCustom({ ...custom, from: e.target.value })} /></div>
              <div><span className={label}>To</span><input type="date" aria-label="To date" className={select} value={custom.to} min={custom.from} onChange={(e) => e.target.value && setCustom({ ...custom, to: e.target.value })} /></div>
            </>
          )}
          <div><span className={label}>Client status</span>
            <select aria-label="Client status" className={select} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">All</option><option value="active">Active</option><option value="onboarding">Onboarding</option><option value="inactive">Inactive</option><option value="at-risk">At Risk</option>
            </select>
          </div>
          <div><span className={label}>Service type</span>
            <select aria-label="Service type" className={select} value={service} onChange={(e) => setService(e.target.value)}>
              <option value="all">All</option>
              {(data?.filterOptions.services || []).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div><span className={label}>Client</span>
            <select aria-label="Client" className={`${select} max-w-[12rem]`} value={client} onChange={(e) => setClient(e.target.value)}>
              <option value="all">All</option>
              {(data?.filterOptions.clients || []).map((cl) => <option key={cl._id} value={cl._id}>{cl.businessName}</option>)}
            </select>
          </div>
        </div>
      </div>

      {error && <p className="p-4 rounded-xl border border-rose-500/30 text-rose-400 text-sm">{error.response?.data?.message || 'Could not load the overview.'}</p>}
      {isLoading && !data && <p className="p-8 text-center text-app-text-muted">Loading…</p>}

      {c && (
        <>
          <p className="text-xs text-app-text-muted -mt-2">
            {fmtDay(data.period.from)} – {fmtDay(data.period.to)} · % change against {fmtDay(data.period.previousFrom)} – {fmtDay(data.period.previousTo)}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-3">
            <Card icon={Users} tint="bg-blue-500/10 text-blue-500" label="Total Clients" value={c.totalClients} sub="Every client except archived" to="/admin/clients" />
            <Card icon={UserCheck} tint="bg-emerald-500/10 text-emerald-500" label="Active Clients" value={c.activeClients} sub="Active, launched and not at risk" />
            <Card icon={UserPlus} tint="bg-amber-500/10 text-amber-500" label="New Clients" value={c.newClients.value} change={c.newClients.change}
              sub={data.missingOnboardingDate.length
                ? <button type="button" onClick={() => setShowMissing((v) => !v)} className="text-amber-500 hover:underline cursor-pointer">{data.missingOnboardingDate.length} without an onboarding date</button>
                : 'By onboarding date'} />
            <Card icon={IndianRupee} tint="bg-violet-500/10 text-violet-500" label="Total Client Revenue" value={inr(c.totalRevenue.value)} change={c.totalRevenue.change} sub="Invoiced, excl. GST (retainers + one-time)" />
            <Card icon={RefreshCw} tint="bg-violet-500/10 text-violet-500" label="Monthly Recurring Revenue" value={inr(c.mrr)} sub="Active monthly retainers only" />
          </div>

          {showMissing && data.missingOnboardingDate.length > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
              <p className="text-sm font-semibold text-amber-500">Clients without an onboarding date — not counted as new clients</p>
              <p className="text-xs text-app-text-muted mt-0.5">Add the date in Client Accounts → client → Profile.</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {data.missingOnboardingDate.map((m) => <span key={m._id} className="px-2.5 py-1 rounded-full text-xs bg-app-card border border-app-border">{m.businessName} <span className="text-app-text-muted">{m.clientId}</span></span>)}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7 gap-3">
            <Card icon={Wallet} tint="bg-emerald-500/10 text-emerald-500" label="Revenue Collected" value={inr(c.collected.value)} change={c.collected.change} sub="Payments received in the period" />
            <Card icon={FileWarning} tint="bg-rose-500/10 text-rose-500" label="Outstanding" value={inr(c.outstanding)} sub={`${inr(c.overdue)} overdue`} to="/admin/invoices" />
            <Card icon={Target} tint="bg-blue-500/10 text-blue-500" label="Ad Spend Managed" value={inr(c.adSpend.value)} change={c.adSpend.change} neutral
              sub={`Planned budget ${inr(c.plannedAdBudget.total)}`} />
            <Card icon={Megaphone} tint="bg-amber-500/10 text-amber-500" label="Campaigns Live" value={c.campaigns.live}
              sub={c.campaigns.needsStatus ? <span className="text-orange-400">{c.campaigns.needsStatus} need a status</span> : 'Marked Active by the team'} />
            <Card icon={Hourglass} tint="bg-rose-500/10 text-rose-500" label="Pending Onboarding" value={c.pendingOnboarding} sub="Not launched yet" to="/admin/clients" />
            <Card icon={ListTodo} tint="bg-blue-500/10 text-blue-500" label="Tasks Overdue" value={c.tasksOverdue} sub="Organization tasks past due" to="/admin/tasks" />
            <Card icon={AlertTriangle} tint="bg-rose-500/10 text-rose-500" label="Clients at Risk" value={c.atRisk} sub="Overdue, KPI or flagged" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <Panel title="Revenue Trend (Last 6 Months)" icon={BarChart3}
              action={<button type="button" onClick={() => setTrendTable((v) => !v)} className="flex items-center gap-1 text-xs text-primary cursor-pointer">{trendTable ? <><BarChart3 size={13} /> Chart</> : <><Table2 size={13} /> Table</>}</button>}>
              <div className="flex flex-wrap gap-3 mb-2 text-xs">
                {TREND.map(([k, n, col]) => <span key={k} className="flex items-center gap-1.5 text-app-text"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: col }} />{n}</span>)}
              </div>
              {trendTable ? (
                <table className="w-full text-xs">
                  <thead><tr className="text-app-text-muted border-b border-app-border"><th className="text-left py-1.5">Month</th>{TREND.map(([k, n]) => <th key={k} className="text-right py-1.5">{n}</th>)}</tr></thead>
                  <tbody className="divide-y divide-app-border">
                    {data.trend.map((t) => <tr key={t.month}><td className="py-1.5">{t.label}</td>{TREND.map(([k]) => <td key={k} className="text-right tabular-nums">{inr(t[k])}</td>)}</tr>)}
                  </tbody>
                </table>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 240 }}>
                    <BarChart data={data.trend} barGap={2} barCategoryGap="16%" margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke={grid} />
                      <XAxis dataKey="label" tickFormatter={(l) => l.split(' ')[0]} tick={{ fill: axis, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={inrShort} tick={{ fill: axis, fontSize: 11 }} axisLine={false} tickLine={false} width={52} />
                      <Tooltip {...tooltip} cursor={{ fill: mode === 'light' ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)' }} formatter={(v, n) => [inr(v), n]} />
                      {TREND.map(([k, n, col]) => <Bar key={k} dataKey={k} name={n} fill={col} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />)}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              <p className="text-[11px] text-app-text-muted mt-2">Invoiced excl. GST · collected incl. GST · outstanding = still unpaid today on that month&rsquo;s invoices.</p>
            </Panel>

            <Panel title="Revenue by Service Type" icon={IndianRupee}
              action={data.unassigned.lines > 0 && <button type="button" onClick={() => setMapping(true)} className="text-xs font-semibold text-amber-500 hover:underline cursor-pointer">Map {data.unassigned.lines} unassigned line{data.unassigned.lines === 1 ? '' : 's'}</button>}>
              <Donut rows={data.revenueByService.map((r) => ({ name: r.service, value: r.amount }))} colorOf={serviceColor}
                centre={inrShort(c.totalRevenue.value)} centreLabel="Total revenue" tooltip={tooltip} />
              {data.unassigned.lines > 0 && (
                <p className="text-[11px] text-amber-500 mt-3">{inr(data.unassigned.amount)} is on invoice lines without a service. Map them so it counts under the right service.</p>
              )}
            </Panel>

            <Panel title="Ad Spend by Platform" icon={Target}>
              <Donut rows={data.adSpendByPlatform.map((r) => ({ name: r.platform, value: r.spend }))} colorOf={platformColor}
                centre={inrShort(c.adSpend.value)} centreLabel="Actual spend" tooltip={tooltip} />
              <div className="mt-3 text-xs text-app-text-muted space-y-0.5">
                <div className="flex justify-between"><span>Planned budget</span><span className="tabular-nums text-app-text font-semibold">{inr(c.plannedAdBudget.total)}</span></div>
                <div className="flex justify-between"><span>Spent vs plan</span><span className="tabular-nums text-app-text font-semibold">{c.plannedAdBudget.total ? `${((c.adSpend.value / c.plannedAdBudget.total) * 100).toFixed(1)}%` : '—'}</span></div>
                {c.plannedAdBudget.clientsUsingProfileBudget > 0 && <p className="text-[11px]">{c.plannedAdBudget.clientsUsingProfileBudget} client{c.plannedAdBudget.clientsUsingProfileBudget === 1 ? ' has' : 's have'} no KPI setup — their profile ad budget is used.</p>}
              </div>
            </Panel>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <Panel title="Top 5 Clients by Revenue" icon={Users}>
              {data.topClients.length === 0 ? <p className="text-sm text-app-text-muted">No invoices in this period.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] table-fixed">
                    <colgroup><col className="w-5" /><col /><col className="w-[4.2rem]" /><col className="w-[4.4rem]" /><col className="w-[4.8rem]" /></colgroup>
                    <thead><tr className="text-app-text-muted border-b border-app-border"><th className="text-left py-1.5">#</th><th className="text-left">Client / status</th><th className="text-right">Revenue</th><th className="text-right">Collected</th><th className="text-right">Outstanding</th></tr></thead>
                    <tbody className="divide-y divide-app-border">
                      {data.topClients.map((t, i) => (
                        <tr key={t._id}><td className="py-2 text-app-text-muted">{i + 1}</td><td className="pr-1 py-1.5 min-w-0"><div className="font-semibold truncate" title={t.businessName}>{t.businessName}</div><Pill s={t.group} /></td>
                          <td className="text-right tabular-nums">{inrShort(t.revenue)}</td><td className="text-right tabular-nums">{inrShort(t.collected)}</td>
                          <td className="text-right tabular-nums">{inrShort(t.outstanding)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <Link to="/admin/clients" className="inline-block mt-3 text-xs font-semibold text-primary hover:underline">View all clients →</Link>
            </Panel>

            <Panel title="Recent Invoices" icon={FileWarning} action={<Link to="/admin/invoices" className="text-xs font-semibold text-primary hover:underline">View all →</Link>}>
              {data.recentInvoices.length === 0 ? <p className="text-sm text-app-text-muted">No sent invoices.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] table-fixed">
                    <colgroup><col /><col className="w-[4.6rem]" /><col className="w-[4.4rem]" /><col className="w-[3.6rem]" /></colgroup>
                    <thead><tr className="text-app-text-muted border-b border-app-border"><th className="text-left py-1.5">Invoice / client</th><th className="text-right">Amount</th><th className="text-right">Status</th><th className="text-right">Due</th></tr></thead>
                    <tbody className="divide-y divide-app-border">
                      {data.recentInvoices.map((inv) => (
                        <tr key={inv._id}>
                          <td className="py-1.5 pr-1 min-w-0"><div className="font-mono text-[10px] text-app-text-muted truncate">{inv.invoiceId}</div><div className="font-semibold truncate" title={inv.client}>{inv.client}</div></td>
                          <td className="text-right tabular-nums">{inr(inv.amount)}</td>
                          <td className="text-right"><Pill s={inv.status} /></td>
                          <td className="text-right whitespace-nowrap text-app-text-muted">{new Date(inv.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            <Panel title="Clients by Status" icon={UserCheck}>
              <table className="w-full text-xs">
                <thead><tr className="text-app-text-muted border-b border-app-border"><th className="text-left py-1.5">Status</th><th className="text-right">Count</th><th className="text-right">%</th><th className="w-2/5" /></tr></thead>
                <tbody className="divide-y divide-app-border">
                  {data.clientsByStatus.map((s, i) => (
                    <tr key={s.status}>
                      <td className="py-2"><Pill s={s.status} /></td>
                      <td className="text-right tabular-nums font-semibold">{s.count}</td>
                      <td className="text-right tabular-nums text-app-text-muted">{s.percent}%</td>
                      <td className="pl-3"><div className="h-2 rounded bg-app-border/40"><div className="h-2 rounded" style={{ width: `${s.percent}%`, background: s.status === 'At Risk' ? '#d03b3b' : s.status === 'Inactive' ? NEUTRAL[mode] : palette[[2, 0][i] ?? 0] }} /></div></td>
                    </tr>
                  ))}
                  <tr className="font-bold"><td className="py-2">Total</td><td className="text-right tabular-nums">{c.totalClients}</td><td className="text-right">100%</td><td /></tr>
                </tbody>
              </table>
              {data.atRiskClients.length > 0 && (
                <div className="mt-4">
                  <p className="text-[11px] font-semibold text-app-text-muted uppercase tracking-wider mb-1.5">Why clients are at risk</p>
                  <ul className="space-y-2 max-h-48 overflow-y-auto">
                    {data.atRiskClients.map((r) => (
                      <li key={r._id} className="text-xs">
                        <span className="font-semibold text-app-text">{r.businessName}</span>
                        <ul className="mt-0.5 space-y-0.5">{r.reasons.map((x, i) => <li key={i} className="text-rose-400 flex gap-1"><AlertTriangle size={11} className="shrink-0 mt-0.5" />{x.text}</li>)}</ul>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Panel>
          </div>

          <footer className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-app-text-muted">
            <span className="flex items-center gap-1.5"><Calendar size={12} /> Last updated {new Date(dataUpdatedAt || data.generatedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            <span className="flex items-center gap-1.5"><Database size={12} /> Data source: Vedhunt CRM</span>
            <span>Tasks overdue covers all organization tasks.</span>
          </footer>
        </>
      )}

      {mapping && (
        <MapLinesModal http={http} base={base} onClose={() => setMapping(false)}
          onSaved={() => { setMapping(false); queryClient.invalidateQueries({ queryKey: ['financial-overview'] }); queryClient.invalidateQueries({ queryKey: ['unassigned-lines'] }); }} />
      )}
    </div>
  );
}
