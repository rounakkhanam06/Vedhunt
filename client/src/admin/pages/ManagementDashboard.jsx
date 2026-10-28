import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Gauge, Users, TrendingUp, Clock, AlertTriangle, Flame, Wallet, UserX, PhoneCall, Calendar, ChevronDown, X,
  UserCheck, Trophy, XCircle, MinusCircle, CalendarClock, CalendarDays, PhoneOff, ArrowUp, ArrowDown, Filter, PieChart as PieIcon, Award
} from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, PieChart, Pie, Legend
} from 'recharts';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { formatMinutes } from '../../shared/formatDuration';
import { LEAD_PRIORITY_BADGE_CLASSES } from '../../shared/serviceQualification';

// Donut slices, in order — distinct in both themes
const SLICE_COLORS = ['#3b82f6', '#f97316', '#10b981', '#a855f7', '#ef4444', '#06b6d4', '#eab308', '#ec4899', '#64748b', '#84cc16'];
const STAGE_COLORS = {
  New: '#3b82f6', Contacted: '#06b6d4', Qualified: '#10b981', 'Proposal Sent': '#f97316',
  Negotiation: '#a855f7', Won: '#22c55e', Lost: '#ef4444', Dropped: '#64748b', Hold: '#eab308'
};
const INTEREST_COLORS = {
  'Hot Lead': '#ef4444', Warm: '#f97316', Cold: '#3b82f6', Interested: '#10b981',
  'Not Interested': '#64748b', 'Wrong / Junk Lead': '#78350f', 'Not rated': '#a855f7'
};
const STATUS_SUMMARY_COLORS = { Open: '#3b82f6', Won: '#22c55e', Lost: '#ef4444', Dropped: '#f97316', Hold: '#94a3b8' };
const STAGE_BADGE = {
  New: 'bg-blue-500/10 text-blue-400 border-blue-500/30', Contacted: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  Qualified: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', 'Proposal Sent': 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  Negotiation: 'bg-purple-500/10 text-purple-400 border-purple-500/30'
};
const SOURCE_OPTIONS_FALLBACK = ['Website', 'Facebook', 'Instagram', 'Google Ads', 'IndiaMART', 'WhatsApp', 'Referral', 'Manual'];
const STAGE_OPTIONS = ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation', 'Won', 'Lost', 'Dropped', 'Hold'];

const inr = (n) => `₹${(n || 0).toLocaleString('en-IN')}`;
const shortDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

const CHART_TOOLTIP_PROPS = {
  contentStyle: {
    backgroundColor: '#1E1E24',
    border: '1px solid #374151',
    borderRadius: '8px',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
    padding: '8px 12px',
    fontSize: '12px',
    color: '#F9FAFB'
  },
  labelStyle: {
    color: '#F9FAFB',
    fontWeight: '600',
    marginBottom: '4px'
  },
  itemStyle: {
    color: '#E5E7EB',
    padding: 0
  }
};

// firstName/lastName aren't guaranteed on every Admin account — fall back
// gracefully instead of rendering "undefined undefined".
function displayName(person) {
  if (!person) return 'Unassigned';
  const name = [person?.firstName, person?.lastName].filter(Boolean).join(' ').trim();
  return name || person?.email || 'Unknown';
}

function toDateInput(d) {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function getPresetRange(key) {
  const now = new Date();
  const todayStr = toDateInput(now);

  if (key === 'today') {
    return { dateFrom: todayStr, dateTo: todayStr };
  }

  if (key === 'week') {
    const day = now.getDay();
    // Monday as start of the week:
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    return { dateFrom: toDateInput(monday), dateTo: todayStr };
  }

  if (key === 'month') {
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    return { dateFrom: toDateInput(firstDay), dateTo: todayStr };
  }

  return null;
}

function formatRangeBadge(dFrom, dTo) {
  if (!dFrom || !dTo) return '';
  const f = new Date(dFrom);
  const t = new Date(dTo);
  const options = { day: 'numeric', month: 'short' };
  const fromStr = f.toLocaleDateString('en-IN', options);
  const toStr = t.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${fromStr} – ${toStr}`;
}

const sectionClass = 'bg-app-card border border-app-border rounded-xl p-5';
const sectionTitleClass = 'text-sm font-bold text-app-text uppercase tracking-wider mb-4 flex items-center gap-2';

/** A clickable KPI stat card — every number on this page drills into the leads behind it. */
function StatCard({ icon: Icon, label, value, sub, onClick, accent = 'text-primary' }) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`w-full text-left bg-app-bg border border-app-border rounded-xl p-4 flex items-center gap-3 transition-colors ${onClick ? 'hover:border-primary cursor-pointer' : 'cursor-default'}`}
    >
      <Icon className={`${accent} shrink-0`} size={20} />
      <div className="min-w-0">
        <p className="text-xs text-app-text-muted uppercase tracking-wider font-bold">{label}</p>
        <p className="text-lg font-bold text-app-text truncate">{value}</p>
        {sub && <p className="text-[11px] text-app-text-muted mt-0.5">{sub}</p>}
      </div>
    </button>
  );
}

/**
 * Coloured KPI tile with an optional % change vs the previous period.
 * `goodWhenUp` flips the arrow colour for counts where a rise is bad (Lost…).
 */
function KpiTile({ icon: Icon, tone, label, value, changePct, goodWhenUp = true, sub, onClick }) {
  const up = changePct > 0;
  const good = changePct === 0 || up === goodWhenUp;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`w-full text-left bg-app-card border border-app-border rounded-xl p-4 flex items-center gap-3 transition-colors ${onClick ? 'hover:border-primary cursor-pointer' : 'cursor-default'}`}
    >
      <span className={`shrink-0 w-11 h-11 rounded-full flex items-center justify-center ${tone}`}><Icon size={20} /></span>
      <div className="min-w-0">
        <p className="text-[11px] text-app-text-muted uppercase tracking-wider font-bold truncate">{label}</p>
        <p className="flex items-baseline gap-2">
          <span className="text-xl font-bold text-app-text truncate">{value}</span>
          {changePct != null && (
            <span className={`inline-flex items-center text-[11px] font-bold ${good ? 'text-emerald-400' : 'text-red-400'}`}>
              {up ? <ArrowUp size={11} /> : changePct < 0 ? <ArrowDown size={11} /> : null}{Math.abs(changePct)}%
            </span>
          )}
        </p>
        {sub && <p className="text-[11px] text-app-text-muted mt-0.5 truncate">{sub}</p>}
      </div>
    </button>
  );
}

/** Donut with the total in the middle and a clickable legend of count (share). */
function DonutCard({ icon: Icon, title, rows, total, colorOf, onSlice }) {
  const data = rows.filter((r) => r.count > 0);
  return (
    <div className={sectionClass}>
      <h2 className={sectionTitleClass}><Icon size={16} /> {title}</h2>
      {data.length === 0 ? (
        <p className="text-sm text-app-text-muted py-10 text-center">No leads in this period.</p>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="relative w-44 h-44 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="count" nameKey="name" innerRadius="58%" outerRadius="95%" paddingAngle={1} stroke="none"
                  style={{ cursor: 'pointer' }} onClick={(d) => onSlice(d.name)}>
                  {data.map((r, i) => <Cell key={r.name} fill={colorOf(r.name, i)} />)}
                </Pie>
                <Tooltip {...CHART_TOOLTIP_PROPS} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xl font-bold text-app-text">{total}</span>
              <span className="text-[10px] text-app-text-muted uppercase tracking-wider">Total leads</span>
            </div>
          </div>
          <ul className="flex-1 min-w-0 w-full space-y-1.5 text-[13px]">
            {data.map((r, i) => (
              <li key={r.name}>
                <button type="button" onClick={() => onSlice(r.name)} className="w-full flex items-center gap-2 hover:text-primary cursor-pointer text-left">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: colorOf(r.name, i) }} />
                  <span className="truncate text-app-text">{r.name}</span>
                  <span className="ml-auto text-app-text-muted whitespace-nowrap">{r.count} ({r.pct}%)</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const selectClass = 'bg-app-card border border-app-border rounded-lg px-2.5 py-1.5 text-xs text-app-text focus:outline-none focus:border-primary cursor-pointer max-w-[170px]';

/**
 * Cards + BD-wise table over one breakdown (Interest Level / Lead Stage).
 * `data` = { columns, rows: [{ owner, name, unassigned, counts, total }], totals }
 * from services/leadOverview.js. Every count opens the leads behind it.
 */
function BreakdownSection({ icon: Icon, title, basis, data, cardClass, onCount }) {
  const columns = data?.columns || [];
  const rows = data?.rows || [];
  const totals = data?.totals;
  return (
    <div className={sectionClass}>
      <h2 className={sectionTitleClass}>
        <Icon size={16} /> {title} <span className="normal-case font-medium text-app-text-muted">· {basis}</span>
      </h2>
      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
        {columns.map((column) => (
          <button
            key={column}
            type="button"
            onClick={() => onCount({ column })}
            className={`text-left bg-app-bg border border-app-border rounded-lg px-3 py-2.5 hover:border-primary/50 transition-colors cursor-pointer ${cardClass?.(column) || ''}`}
          >
            <p className="text-[11px] text-app-text-muted uppercase tracking-wider font-bold truncate" title={column}>{column}</p>
            <p className="text-xl font-bold text-app-text">{(totals?.[column] ?? 0).toLocaleString('en-IN')}</p>
          </button>
        ))}
      </div>

      <p className="text-xs font-bold text-app-text-muted uppercase tracking-wider mb-2">BD-wise · primary owner</p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-app-bg border-b border-app-border text-app-text-muted text-[11px] uppercase tracking-wider">
            <tr>
              <th className="px-3 py-2 font-semibold">Lead owner</th>
              {columns.map((column) => <th key={column} className="px-3 py-2 font-semibold text-right">{column}</th>)}
              <th className="px-3 py-2 font-semibold text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-app-border/70 text-[13px]">
            {rows.length === 0 ? (
              <tr><td colSpan={columns.length + 2} className="px-3 py-8 text-center text-app-text-muted">No leads received in this period.</td></tr>
            ) : rows.map((row) => (
              <tr key={row.owner} className="hover:bg-app-bg/50 transition-colors">
                <td className="px-3 py-2 font-medium text-app-text">{row.name}</td>
                {columns.map((column) => (
                  <td key={column} className="px-3 py-2 text-right">
                    {row.counts[column] > 0 ? (
                      <button type="button" onClick={() => onCount({ column, row })} className="text-primary hover:underline cursor-pointer">{row.counts[column]}</button>
                    ) : <span className="text-app-text-muted">0</span>}
                  </td>
                ))}
                <td className="px-3 py-2 text-right font-bold text-app-text">{row.total}</td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="border-t border-app-border bg-app-bg/60 font-bold text-app-text text-[13px]">
              <tr>
                <td className="px-3 py-2">Total</td>
                {columns.map((column) => <td key={column} className="px-3 py-2 text-right">{totals?.[column] ?? 0}</td>)}
                <td className="px-3 py-2 text-right">{totals?.total ?? 0}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

export default function ManagementDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activePreset, setActivePreset] = useState('month');
  const [dateFrom, setDateFrom] = useState(() => getPresetRange('month').dateFrom);
  const [dateTo, setDateTo] = useState(() => getPresetRange('month').dateTo);

  // Custom range popover state
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [tempDateFrom, setTempDateFrom] = useState(dateFrom);
  const [tempDateTo, setTempDateTo] = useState(dateTo);

  // Source / Service / BDE / Lead Stage — apply to the overview tiles, charts and lists
  const [filters, setFilters] = useState({ platform: 'All', service: 'All', assignedTo: 'All', status: 'All' });
  const [dash, setDash] = useState(null);
  const [volume, setVolume] = useState(null);
  const [pipeline, setPipeline] = useState(null);
  const [bdAccountability, setBdAccountability] = useState([]);
  const [compliance, setCompliance] = useState(null);
  const [actionMissingCounts, setActionMissingCounts] = useState(null);

  const handlePresetSelect = (key) => {
    if (key === 'custom') {
      setTempDateFrom(dateFrom);
      setTempDateTo(dateTo);
      setShowCustomModal(true);
      return;
    }
    setActivePreset(key);
    setShowCustomModal(false);
    const range = getPresetRange(key);
    if (range) {
      setDateFrom(range.dateFrom);
      setDateTo(range.dateTo);
    }
  };

  const handleApplyCustomRange = (e) => {
    e?.preventDefault();
    if (!tempDateFrom || !tempDateTo) {
      toast.error('Please select both start and end dates');
      return;
    }
    if (tempDateFrom > tempDateTo) {
      toast.error('Start date cannot be after end date');
      return;
    }
    setDateFrom(tempDateFrom);
    setDateTo(tempDateTo);
    setActivePreset('custom');
    setShowCustomModal(false);
    toast.success('Custom date range applied');
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [dashRes, volRes, pipeRes, bdRes, complianceRes, actionRes] = await Promise.all([
        api.get('/admin/activity/lead-dashboard', { params: { dateFrom, dateTo, ...filters } }),
        api.get('/admin/activity/lead-volume', { params: { dateFrom, dateTo } }),
        api.get('/admin/activity/pipeline-summary', { params: { dateFrom, dateTo } }),
        api.get('/admin/activity/bd-accountability', { params: { dateFrom, dateTo } }),
        api.get('/admin/activity/followup-compliance'),
        api.get('/admin/activity/action-missing', { params: { limit: 1 } })
      ]);
      if (dashRes.data.success) setDash(dashRes.data);
      if (volRes.data.success) setVolume(volRes.data);
      if (pipeRes.data.success) setPipeline(pipeRes.data);
      if (bdRes.data.success) setBdAccountability(bdRes.data.data);
      if (complianceRes.data.success) setCompliance(complianceRes.data);
      if (actionRes.data.success) setActionMissingCounts(actionRes.data.counts);
    } catch (error) {
      console.error('Error loading leads overview dashboard:', error);
      toast.error('Failed to load the dashboard');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, filters]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /** Every drill-down funnels through here — builds the /admin/leads/all URL. */
  // Calls Made → the Lead Activity log for that BD and this date range.
  // Lead Activity for the period, optionally one BD / one result
  const goToCalls = (bdId, result) => navigate(`/admin/lead-activity?${new URLSearchParams(
    Object.entries({ by: bdId, result, dateFrom, dateTo }).filter(([, v]) => v)
  )}`);

  const goToLeads = (params) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
    ).toString();
    navigate(`/admin/leads/all${qs ? `?${qs}` : ''}`);
  };

  // Company-wide speed metrics — derived client-side from the per-BD
  // accountability rows already fetched, no new backend endpoint needed.
  // Connected calls ÷ calls made across every BD (not an average of rounded rates)
  const totalCalls = bdAccountability.reduce((s, r) => s + (r.callsMade || 0), 0);
  const totalConnected = bdAccountability.reduce((s, r) => s + (r.connectedCalls || 0), 0);
  const avgConnectRate = totalCalls > 0 ? Math.round((totalConnected / totalCalls) * 100) : null;
  const respondedBds = bdAccountability.filter((r) => r.avgResponseMinutes != null);
  const avgResponseMinutes = respondedBds.length > 0
    ? Math.round(respondedBds.reduce((s, r) => s + r.avgResponseMinutes, 0) / respondedBds.length)
    : null;
  const totalBreaches = bdAccountability.reduce((s, r) => s + (r.breachCount || 0), 0);

  // The header filters, as All Leads params — every overview drill-down keeps them
  const filterParams = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== 'All'));
  const goToCohort = (params = {}) => goToLeads({ ...filterParams, dateFrom, dateTo, ...params });
  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }));

  const k = dash?.kpis;
  const received = k?.received ?? 0;
  const options = dash?.options;
  const maxStage = Math.max(1, ...(dash?.stages || []).map((s) => s.count));

  if (loading && !volume) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-app-text font-heading flex items-center gap-2">
            <Gauge className="text-primary" size={24} /> Leads Overview
          </h1>
          <p className="text-sm text-app-text-muted mt-1 max-w-3xl">
            Every number below is clickable — it opens the exact leads behind it. Sections marked <span className="font-semibold text-app-text">Live</span> always show the current state and ignore the period.
          </p>
        </div>

        {/* Date Presets & Custom Popover */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-start lg:self-center">
          {/* Active Period Indicator */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-app-card border border-app-border text-xs text-app-text-muted">
            <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="font-medium text-app-text">{formatRangeBadge(dateFrom, dateTo)}</span>
          </div>

          {/* Preset Buttons Group */}
          <div className="relative inline-flex bg-app-card border border-app-border p-1 rounded-xl shadow-xs">
            {[
              { key: 'today', label: 'Today' },
              { key: 'week', label: 'This Week' },
              { key: 'month', label: 'This Month' },
              { key: 'custom', label: 'Custom' }
            ].map(({ key, label }) => {
              const isActive = activePreset === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handlePresetSelect(key)}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-primary text-black shadow-xs'
                      : 'text-app-text-muted hover:text-app-text hover:bg-surface-variant/40'
                  }`}
                >
                  <span>{label}</span>
                  {key === 'custom' && (
                    <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${showCustomModal ? 'rotate-180' : ''}`} />
                  )}
                </button>
              );
            })}

            {/* Custom Range Popover */}
            {showCustomModal && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowCustomModal(false)} />
                <div className="absolute right-0 top-full mt-2 w-80 bg-app-card border border-app-border rounded-xl shadow-2xl z-50 p-4 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-app-border">
                    <span className="text-xs font-bold uppercase tracking-wider text-app-text flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-primary" />
                      Select Custom Range
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowCustomModal(false)}
                      className="text-app-text-muted hover:text-app-text p-1 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form onSubmit={handleApplyCustomRange} className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-app-text-muted mb-1">
                        Start Date (From)
                      </label>
                      <input
                        type="date"
                        required
                        max={tempDateTo || undefined}
                        value={tempDateFrom}
                        onChange={(e) => setTempDateFrom(e.target.value)}
                        className="w-full bg-app-bg border border-app-border rounded-lg px-3 py-2 text-sm text-app-text focus:outline-none focus:border-primary transition-colors cursor-pointer"
                        style={{ colorScheme: 'dark' }}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-app-text-muted mb-1">
                        End Date (To)
                      </label>
                      <input
                        type="date"
                        required
                        min={tempDateFrom || undefined}
                        value={tempDateTo}
                        onChange={(e) => setTempDateTo(e.target.value)}
                        className="w-full bg-app-bg border border-app-border rounded-lg px-3 py-2 text-sm text-app-text focus:outline-none focus:border-primary transition-colors cursor-pointer"
                        style={{ colorScheme: 'dark' }}
                      />
                    </div>

                    <div className="pt-2 flex items-center justify-end gap-2 border-t border-app-border">
                      <button
                        type="button"
                        onClick={() => setShowCustomModal(false)}
                        className="px-3 py-1.5 text-xs rounded-lg border border-app-border text-app-text hover:bg-surface-variant transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs rounded-lg bg-primary hover:bg-primary-hover text-black font-bold shadow-xs transition-colors cursor-pointer"
                      >
                        Apply Range
                      </button>
                    </div>
                  </form>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Source / Service / BDE / Lead Stage filters — apply to the overview below */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-app-text-muted uppercase tracking-wider mr-1"><Filter size={14} /> Filters</span>
        <select aria-label="Source" value={filters.platform} onChange={(e) => setFilter('platform', e.target.value)} className={selectClass}>
          <option value="All">All sources</option>
          {(options?.platforms || SOURCE_OPTIONS_FALLBACK).map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select aria-label="Service type" value={filters.service} onChange={(e) => setFilter('service', e.target.value)} className={selectClass}>
          <option value="All">All services</option>
          {(options?.services || []).map((sv) => <option key={sv} value={sv}>{sv}</option>)}
        </select>
        <select aria-label="BDE" value={filters.assignedTo} onChange={(e) => setFilter('assignedTo', e.target.value)} className={selectClass}>
          <option value="All">All BDEs</option>
          <option value="Unassigned">Unassigned</option>
          {(options?.bdes || []).map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
        </select>
        <select aria-label="Lead stage" value={filters.status} onChange={(e) => setFilter('status', e.target.value)} className={selectClass}>
          <option value="All">All stages</option>
          {STAGE_OPTIONS.map((st) => <option key={st} value={st}>{st}</option>)}
        </select>
        {Object.keys(filterParams).length > 0 && (
          <button type="button" onClick={() => setFilters({ platform: 'All', service: 'All', assignedTo: 'All', status: 'All' })} className="text-xs text-primary hover:underline cursor-pointer">Clear filters</button>
        )}
        {loading && <span className="w-4 h-4 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />}
      </div>

      {/* KPI tiles — leads received in the period; arrows compare with the equally long period before */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-3">
        <KpiTile icon={Users} tone="bg-blue-500/15 text-blue-400" label="Total Leads Received" value={received} changePct={k?.receivedChange}
          sub="vs previous period" onClick={() => goToCohort()} />
        <KpiTile icon={UserCheck} tone="bg-emerald-500/15 text-emerald-400" label="Assigned Leads" value={k?.assigned ?? 0} changePct={k?.assignedChange}
          sub={`${k?.assignedPct ?? 0}% of total leads`} onClick={() => goToCohort({ assignedTo: filterParams.assignedTo || 'Assigned' })} />
        <KpiTile icon={UserX} tone="bg-amber-500/15 text-amber-400" label="Unassigned Leads" value={k?.unassigned ?? 0} changePct={k?.unassignedChange} goodWhenUp={false}
          sub={`${k?.unassignedPct ?? 0}% of total leads`} onClick={() => goToCohort({ assignedTo: 'Unassigned' })} />
        <KpiTile icon={Wallet} tone="bg-purple-500/15 text-purple-400" label="Open Pipeline Value" value={inr(k?.openValue)} changePct={k?.openValueChange}
          sub="Estimated value of open leads" onClick={() => goToCohort({ stage: 'open' })} />
        <KpiTile icon={Trophy} tone="bg-green-500/15 text-green-400" label="Converted (Won)" value={k?.won ?? 0} changePct={k?.wonChange}
          sub={`${k?.wonPct ?? 0}% conversion rate`} onClick={() => goToCohort({ status: 'Won' })} />
        <KpiTile icon={XCircle} tone="bg-red-500/15 text-red-400" label="Lost" value={k?.lost ?? 0} changePct={k?.lostChange} goodWhenUp={false}
          sub={`${k?.lostPct ?? 0}% loss rate`} onClick={() => goToCohort({ status: 'Lost' })} />
        <KpiTile icon={MinusCircle} tone="bg-slate-500/15 text-slate-400" label="Dropped" value={k?.dropped ?? 0} changePct={k?.droppedChange} goodWhenUp={false}
          sub={`${k?.droppedPct ?? 0}% drop rate`} onClick={() => goToCohort({ status: 'Dropped' })} />
        <KpiTile icon={Clock} tone="bg-red-500/15 text-red-400" label="Overdue Follow-ups" value={k?.overdueFollowUps ?? 0}
          sub="Pending follow-ups · live" onClick={() => navigate('/admin/follow-ups?bucket=Overdue')} />
        <KpiTile icon={CalendarClock} tone="bg-sky-500/15 text-sky-400" label="Follow-ups Due Today" value={k?.followUpsToday ?? 0}
          sub="Action needed today · live" onClick={() => navigate('/admin/follow-ups?bucket=Today')} />
        <KpiTile icon={CalendarDays} tone="bg-violet-500/15 text-violet-400" label="Follow-ups Upcoming" value={k?.followUpsUpcoming ?? 0}
          sub="Next 7 days · live" onClick={() => navigate('/admin/follow-ups?bucket=Upcoming')} />
        <KpiTile icon={PhoneOff} tone="bg-orange-500/15 text-orange-400" label="Leads Never Contacted" value={k?.neverContacted ?? 0}
          sub={`${k?.neverContactedPct ?? 0}% of total leads`} onClick={() => goToCohort({ neverContacted: 'true' })} />
      </div>

      {/* Trend + Source + Service */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className={sectionClass}>
          <h2 className={sectionTitleClass}><TrendingUp size={16} /> Leads Trend <span className="normal-case font-medium text-app-text-muted">· per day</span></h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dash?.trend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2D2D33" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9CA3AF' }} tickFormatter={(d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} minTickGap={16} />
                <YAxis yAxisId="l" allowDecimals={false} tick={{ fontSize: 11, fill: '#9CA3AF' }} />
                <YAxis yAxisId="r" orientation="right" allowDecimals={false} tick={{ fontSize: 11, fill: '#9CA3AF' }} />
                <Tooltip {...CHART_TOOLTIP_PROPS} cursor={{ fill: 'rgba(255, 255, 255, 0.06)' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="l" dataKey="received" name="New Leads" fill="#3b82f6" radius={[3, 3, 0, 0]} style={{ cursor: 'pointer' }}
                  onClick={(d) => goToLeads({ ...filterParams, dateFrom: d.date, dateTo: d.date })} />
                <Line yAxisId="r" type="monotone" dataKey="won" name="Converted (Won)" stroke="#22c55e" strokeWidth={2} dot={{ r: 2 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
        <DonutCard icon={PieIcon} title="Leads by Source" rows={dash?.bySource || []} total={received}
          colorOf={(_n, i) => SLICE_COLORS[i % SLICE_COLORS.length]} onSlice={(name) => goToCohort({ platform: name })} />
        <DonutCard icon={PieIcon} title="Leads by Service Type" rows={dash?.byService || []} total={received}
          colorOf={(_n, i) => SLICE_COLORS[i % SLICE_COLORS.length]} onSlice={(name) => goToCohort({ service: name })} />
      </div>

      {/* Pipeline stage + Interest + Status */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className={sectionClass}>
          <h2 className={sectionTitleClass}><Filter size={16} /> Pipeline Stage <span className="normal-case font-medium text-app-text-muted">· current stage</span></h2>
          <ul className="space-y-2.5">
            {(dash?.stages || []).map((s) => (
              <li key={s.stage}>
                <button type="button" onClick={() => goToCohort({ status: s.stage })} className="w-full grid grid-cols-[96px_1fr_auto] items-center gap-3 text-[13px] cursor-pointer group">
                  <span className="text-right text-app-text truncate group-hover:text-primary">{s.stage}</span>
                  <span className="h-4 rounded bg-app-bg overflow-hidden">
                    <span className="block h-full rounded" style={{ width: `${(s.count / maxStage) * 100}%`, background: STAGE_COLORS[s.stage] }} />
                  </span>
                  <span className="text-app-text-muted whitespace-nowrap w-20 text-right">{s.count} ({s.pct}%)</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <DonutCard icon={Flame} title="Interest Level" rows={dash?.byInterest || []} total={received}
          colorOf={(n) => INTEREST_COLORS[n]} onSlice={(name) => goToCohort({ interestLevel: name })} />
        <DonutCard icon={Users} title="Lead Status Summary" rows={dash?.statusSummary || []} total={received}
          colorOf={(n) => STATUS_SUMMARY_COLORS[n]}
          onSlice={(name) => goToCohort(name === 'Open' ? { stage: 'open' } : { status: name })} />
      </div>

      {/* Top 10 + Overdue + BDE-wise */}
      <div className="grid grid-cols-1 2xl:grid-cols-3 gap-6">
        <div className={sectionClass}>
          <h2 className={`${sectionTitleClass} justify-between`}>
            <span className="flex items-center gap-2"><Award size={16} /> Top 10 Leads by Score</span>
            <button type="button" onClick={() => goToLeads({ ...filterParams, stage: 'open', sortBy: 'leadScore', sortOrder: 'desc' })} className="normal-case text-xs text-primary hover:underline cursor-pointer">View all →</button>
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px] whitespace-nowrap">
              <thead className="bg-app-bg text-app-text-muted text-[11px] uppercase tracking-wider border-b border-app-border">
                <tr>
                  <th className="px-2 py-2">#</th><th className="px-2 py-2">Lead</th><th className="px-2 py-2">Source</th><th className="px-2 py-2">Service</th>
                  <th className="px-2 py-2 text-right">Score</th><th className="px-2 py-2 text-right">Est. Value</th><th className="px-2 py-2">Stage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {(dash?.topLeads || []).map((lead, i) => (
                  <tr key={lead._id} onClick={() => navigate(`/admin/leads/${lead._id}`)} className="hover:bg-app-bg transition-colors cursor-pointer">
                    <td className="px-2 py-2 text-app-text-muted">{i + 1}</td>
                    <td className="px-2 py-2 text-app-text font-medium max-w-[150px] truncate" title={lead.leadId}>{lead.fullName}</td>
                    <td className="px-2 py-2 text-app-text-muted">{lead.platform || 'Website'}</td>
                    <td className="px-2 py-2 text-app-text-muted max-w-[140px] truncate" title={lead.service}>{lead.service}</td>
                    <td className="px-2 py-2 text-right"><span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-bold">{lead.leadScore ?? 0}</span></td>
                    <td className="px-2 py-2 text-right text-app-text">{inr(lead.dealValue)}</td>
                    <td className="px-2 py-2"><span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold border ${STAGE_BADGE[lead.status] || 'border-app-border text-app-text-muted'}`}>{lead.status}</span></td>
                  </tr>
                ))}
                {(!dash?.topLeads || dash.topLeads.length === 0) && (
                  <tr><td colSpan={7} className="px-2 py-6 text-center text-app-text-muted">No open leads.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className={sectionClass}>
          <h2 className={`${sectionTitleClass} justify-between`}>
            <span className="flex items-center gap-2"><AlertTriangle size={16} className="text-red-400" /> Overdue Follow-ups <span className="normal-case font-medium text-app-text-muted">· live</span></span>
            <button type="button" onClick={() => navigate('/admin/follow-ups?bucket=Overdue')} className="normal-case text-xs text-primary hover:underline cursor-pointer">View all →</button>
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px] whitespace-nowrap">
              <thead className="bg-app-bg text-app-text-muted text-[11px] uppercase tracking-wider border-b border-app-border">
                <tr>
                  <th className="px-2 py-2">#</th><th className="px-2 py-2">Lead</th><th className="px-2 py-2">BDE</th><th className="px-2 py-2">Last Contact</th>
                  <th className="px-2 py-2">Next Follow-up</th><th className="px-2 py-2 text-right">Days Overdue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {(dash?.overdueLeads || []).map((lead, i) => (
                  <tr key={lead._id} onClick={() => navigate(`/admin/leads/${lead._id}`)} className="hover:bg-app-bg transition-colors cursor-pointer">
                    <td className="px-2 py-2 text-app-text-muted">{i + 1}</td>
                    <td className="px-2 py-2 text-app-text font-medium max-w-[150px] truncate" title={lead.leadId}>{lead.fullName}</td>
                    <td className="px-2 py-2 text-app-text-muted">{lead.bde}</td>
                    <td className="px-2 py-2 text-app-text-muted">{shortDate(lead.lastCallAt)}</td>
                    <td className="px-2 py-2 text-app-text-muted">{shortDate(lead.nextFollowUpDate)}</td>
                    <td className="px-2 py-2 text-right"><span className="px-2 py-0.5 rounded bg-red-500/15 text-red-400 font-bold">{lead.daysOverdue}</span></td>
                  </tr>
                ))}
                {(!dash?.overdueLeads || dash.overdueLeads.length === 0) && (
                  <tr><td colSpan={6} className="px-2 py-6 text-center text-app-text-muted">No overdue follow-ups.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className={sectionClass}>
          <h2 className={sectionTitleClass}><UserCheck size={16} /> BDE Wise Lead Summary</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px] whitespace-nowrap">
              <thead className="bg-app-bg text-app-text-muted text-[11px] uppercase tracking-wider border-b border-app-border">
                <tr>
                  <th className="px-2 py-2">BDE</th>
                  <th className="px-2 py-2 text-right">Assigned</th>
                  <th className="px-2 py-2 text-right" title="At least one call logged">Contacted</th>
                  <th className="px-2 py-2 text-right" title="Reached Qualified or later">Qualified</th>
                  <th className="px-2 py-2 text-right" title="Reached Proposal Sent or later">Proposal</th>
                  <th className="px-2 py-2 text-right">Won</th><th className="px-2 py-2 text-right">Lost</th>
                  <th className="px-2 py-2 text-right" title="Won ÷ Assigned">Conv. Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {(dash?.bde?.rows || []).map((r) => (
                  <tr key={r.owner} onClick={() => goToCohort({ assignedTo: r.owner })} className="hover:bg-app-bg transition-colors cursor-pointer">
                    <td className="px-2 py-2 text-app-text font-medium max-w-[140px] truncate">{r.name}</td>
                    <td className="px-2 py-2 text-right text-app-text">{r.assigned}</td>
                    <td className="px-2 py-2 text-right text-app-text-muted">{r.contacted}</td>
                    <td className="px-2 py-2 text-right text-app-text-muted">{r.qualified}</td>
                    <td className="px-2 py-2 text-right text-app-text-muted">{r.proposal}</td>
                    <td className="px-2 py-2 text-right text-app-text-muted">{r.won}</td>
                    <td className="px-2 py-2 text-right text-app-text-muted">{r.lost}</td>
                    <td className="px-2 py-2 text-right"><span className={`px-1.5 py-0.5 rounded font-bold ${r.convRate >= 10 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>{r.convRate}%</span></td>
                  </tr>
                ))}
                {(!dash?.bde?.rows || dash.bde.rows.length === 0) && (
                  <tr><td colSpan={8} className="px-2 py-6 text-center text-app-text-muted">No leads received in this period.</td></tr>
                )}
              </tbody>
              {dash?.bde?.rows?.length > 0 && (
                <tfoot className="border-t border-app-border bg-app-bg/60 font-bold text-app-text">
                  <tr>
                    <td className="px-2 py-2">Total</td>
                    {['assigned', 'contacted', 'qualified', 'proposal', 'won', 'lost'].map((c) => <td key={c} className="px-2 py-2 text-right">{dash.bde.totals[c]}</td>)}
                    <td className="px-2 py-2 text-right">{dash.bde.totals.convRate}%</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>

      <h2 className="text-sm font-bold text-app-text-muted uppercase tracking-wider pt-4 border-t border-app-border">
        BD-wise detail <span className="normal-case font-medium">· the date range applies below; the Source / Service / BDE / Stage filters do not</span>
      </h2>

      {/* Interest Level — leads received in the period, current interest level, by primary owner */}
      <BreakdownSection
        icon={Flame}
        title="Interest Level"
        basis="leads received in the period, by current interest level"
        data={volume?.interest}
        cardClass={(column) => (column === 'Hot Lead' ? 'border-red-500/30' : column === 'Not rated' ? 'opacity-80' : '')}
        onCount={({ column, row }) => goToLeads({
          interestLevel: column,
          assignedTo: row ? (row.unassigned ? 'Unassigned' : row.owner) : undefined,
          dateFrom, dateTo
        })}
      />

      {/* Lead Stage — same cohort, current stage, by primary owner */}
      <BreakdownSection
        icon={Gauge}
        title="Lead Stage"
        basis="leads received in the period, by current stage"
        data={volume?.stages}
        cardClass={(column) => (column === 'Won' ? 'border-emerald-500/30' : column === 'Lost' || column === 'Dropped' ? 'border-red-500/20' : '')}
        onCount={({ column, row }) => goToLeads({
          status: column,
          assignedTo: row ? (row.unassigned ? 'Unassigned' : row.owner) : undefined,
          dateFrom, dateTo
        })}
      />

      {/* Ownership & Speed */}
      <div className={sectionClass}>
        <h2 className={sectionTitleClass}><Users size={16} /> Ownership &amp; BD Speed <span className="normal-case font-medium text-app-text-muted">· every active BD · leads assigned and calls made in the period</span></h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <StatCard
            icon={PhoneCall}
            label="Connect Rate"
            value={avgConnectRate == null ? '—' : `${avgConnectRate}%`}
            sub={`${totalConnected} connected of ${totalCalls} calls · click to see them`}
            onClick={() => goToCalls(undefined, 'Connected')}
          />
          <StatCard
            icon={Clock}
            label="Avg. Response Time"
            value={formatMinutes(avgResponseMinutes)}
            sub="Assignment → first call, company-wide"
            onClick={() => goToLeads({ stage: 'open', dateField: 'assigned', dateFrom, dateTo })}
          />
          <StatCard
            icon={AlertTriangle}
            label="Follow-up Breaches"
            value={totalBreaches}
            accent="text-red-400"
            onClick={() => goToLeads({ followUpBreached: 'true', dateField: 'assigned', dateFrom, dateTo })}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[640px]">
            <thead className="bg-app-bg text-app-text-muted text-xs uppercase tracking-wider border-b border-app-border">
              <tr>
                <th className="px-4 py-2 font-semibold">BD</th>
                <th className="px-4 py-2 font-semibold">Assigned</th>
                <th className="px-4 py-2 font-semibold" title="Calls this BD made in the period (click to see which leads)">Calls Made</th>
                <th className="px-4 py-2 font-semibold" title="Start Call pressed but no outcome saved">No Outcome</th>
                <th className="px-4 py-2 font-semibold" title="Connected calls ÷ calls made in the period, credited to whoever made each call">Connect Rate</th>
                <th className="px-4 py-2 font-semibold">Avg. Response</th>
                <th className="px-4 py-2 font-semibold">Breaches</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {bdAccountability.map((row) => (
                <tr
                  key={row.bd._id}
                  onClick={() => goToLeads({ assignedTo: row.bd._id, dateField: 'assigned', dateFrom, dateTo })}
                  className="hover:bg-app-bg transition-colors cursor-pointer"
                >
                  <td className="px-4 py-2 text-app-text font-medium">{displayName(row.bd)}</td>
                  <td className="px-4 py-2 text-app-text-muted">{row.assignedCount}</td>
                  <td className="px-4 py-2">
                    {row.callsMade > 0 ? (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); goToCalls(row.bd._id); }}
                        className="font-bold text-primary hover:underline cursor-pointer"
                        title="See which leads these calls were made to"
                      >
                        {row.callsMade}
                      </button>
                    ) : <span className="text-app-text-muted">0</span>}
                  </td>
                  <td className="px-4 py-2">
                    <span className={row.noOutcomeCount > 0 ? 'text-amber-500 font-bold' : 'text-app-text-muted'}>{row.noOutcomeCount || 0}</span>
                  </td>
                  <td className="px-4 py-2 text-app-text-muted">
                    {row.connectRate == null ? '—' : `${row.connectRate}%`}
                    {row.callsMade > 0 && <div className="text-[11px]">{row.connectedCalls} of {row.callsMade}</div>}
                  </td>
                  <td className="px-4 py-2 text-app-text-muted">{formatMinutes(row.avgResponseMinutes)}</td>
                  <td className="px-4 py-2">
                    <span className={row.breachCount > 0 ? 'text-red-400 font-bold' : 'text-app-text-muted'}>{row.breachCount}</span>
                  </td>
                </tr>
              ))}
              {bdAccountability.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-app-text-muted">No active BDs found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottlenecks */}
      <div className={sectionClass}>
        <h2 className={sectionTitleClass}><AlertTriangle size={16} /> Bottlenecks</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            icon={UserX}
            label="Unassigned Leads (live)"
            value={volume?.unassignedCount ?? 0}
            sub={volume?.unassignedSlaBreachedCount ? `Open and unassigned now · ${volume.unassignedSlaBreachedCount} past SLA` : 'Open and unassigned now'}
            accent="text-amber-400"
            onClick={() => goToLeads({ assignedTo: 'Unassigned', stage: 'open' })}
          />
          <StatCard
            icon={Clock}
            label="Overdue Follow-ups (live)"
            value={compliance?.totals?.overdue ?? 0}
            accent="text-red-400"
            onClick={() => navigate('/admin/follow-ups?bucket=Overdue')}
          />
          <StatCard
            icon={AlertTriangle}
            label="Action Missing (live)"
            value={(actionMissingCounts?.['Hot Lead'] || 0) + (actionMissingCounts?.['Proposal/Negotiation'] || 0) + (actionMissingCounts?.Other || 0)}
            sub={actionMissingCounts ? `${actionMissingCounts['Hot Lead'] || 0} Hot · ${actionMissingCounts['Proposal/Negotiation'] || 0} Proposal/Neg` : undefined}
            accent="text-amber-400"
            onClick={() => navigate('/admin/follow-ups?bucket=Action Missing')}
          />
          <StatCard
            icon={Gauge}
            label="On-Track Follow-up % (live)"
            value={`${compliance?.totals?.onTrackPct ?? 0}%`}
            sub="Click for the full follow-up list"
            onClick={() => navigate('/admin/follow-ups')}
          />
        </div>
      </div>

      {/* Likely to Convert */}
      <div className={sectionClass}>
        <h2 className={sectionTitleClass}><Flame size={16} /> Likely to Convert <span className="normal-case font-medium text-app-text-muted">· live</span></h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(volume?.byPriority || []).map((tier) => (
            <button
              key={tier.priority}
              onClick={() => goToLeads({ leadPriority: tier.priority, stage: 'open' })}
              className="text-left bg-app-bg border border-app-border rounded-xl p-4 hover:border-primary transition-colors cursor-pointer"
            >
              <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-bold border ${LEAD_PRIORITY_BADGE_CLASSES[tier.priority]}`}>{tier.priority}</span>
              <p className="text-lg font-bold text-app-text mt-2">{tier.count}</p>
              <p className="text-[11px] text-app-text-muted">₹{tier.pipelineValue.toLocaleString('en-IN')} est.</p>
            </button>
          ))}
        </div>

      </div>

      {/* Pipeline Revenue */}
      <div className={sectionClass}>
        <h2 className={sectionTitleClass}><Wallet size={16} /> Pipeline Revenue <span className="normal-case font-medium text-app-text-muted">· leads received in the period</span></h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard
            icon={Wallet}
            label="Current Open Pipeline Value"
            value={`₹${(pipeline?.pipelineValue || 0).toLocaleString('en-IN')}`}
            sub="Snapshot of all open leads right now"
            accent="text-primary"
            onClick={() => goToLeads({ stage: 'open' })}
          />
          <StatCard
            icon={TrendingUp}
            label="Won Value"
            value={`₹${(pipeline?.wonValue || 0).toLocaleString('en-IN')}`}
            accent="text-emerald-400"
            onClick={() => goToLeads({ status: 'Won', dateFrom, dateTo })}
          />
          <StatCard
            icon={Gauge}
            label="Conversion Rate"
            value={`${pipeline?.conversionRate ?? 0}%`}
            accent="text-amber-400"
            sub="Click to see the wins behind it"
            onClick={() => goToLeads({ status: 'Won', dateFrom, dateTo })}
          />
        </div>
      </div>
    </div>
  );
}
