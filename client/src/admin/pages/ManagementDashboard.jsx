import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Gauge, Users, TrendingUp, Clock, AlertTriangle, Flame, Wallet, UserX, PhoneCall, Calendar, ChevronDown, X
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell
} from 'recharts';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { formatMinutes } from '../../shared/formatDuration';
import { LEAD_PRIORITY_BADGE_CLASSES } from '../../shared/serviceQualification';

// Canonical pipeline sequence — server/utils/leadStateMachine.js's ALLOWED_TRANSITIONS
// keys, in stage order, for the bottleneck funnel.
const PIPELINE_STAGE_ORDER = ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation', 'Hold', 'Won', 'Lost', 'Dropped'];

const CHART_COLOR = '#FF6B00';

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
      const [volRes, pipeRes, bdRes, complianceRes, actionRes] = await Promise.all([
        api.get('/admin/activity/lead-volume', { params: { dateFrom, dateTo } }),
        api.get('/admin/activity/pipeline-summary', { params: { dateFrom, dateTo } }),
        api.get('/admin/activity/bd-accountability', { params: { dateFrom, dateTo } }),
        api.get('/admin/activity/followup-compliance'),
        api.get('/admin/activity/action-missing', { params: { limit: 1 } })
      ]);
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
  }, [dateFrom, dateTo]);

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

  const funnelData = PIPELINE_STAGE_ORDER.map((status) => ({
    status,
    count: pipeline?.byStatus?.[status]?.count || 0
  }));

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

      {/* Lead Volume & Source */}
      <div className={sectionClass}>
        <h2 className={sectionTitleClass}><TrendingUp size={16} /> Lead Volume &amp; Source</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <StatCard
            icon={TrendingUp}
            label="Leads Received"
            value={volume?.totalLeads ?? 0}
            sub="Created in the selected period"
            onClick={() => goToLeads({ dateFrom, dateTo })}
          />
          <StatCard
            icon={Users}
            label="Assigned Leads"
            value={volume?.assignedLeads ?? 0}
            sub="Assigned to a BD in the selected period"
            accent="text-sky-400"
            onClick={() => goToLeads({ dateField: 'assigned', dateFrom, dateTo })}
          />
          <StatCard
            icon={UserX}
            label="Unassigned Leads (now)"
            value={volume?.unassignedCount ?? 0}
            sub={volume?.unassignedSlaBreachedCount ? `Open and unassigned right now · ${volume.unassignedSlaBreachedCount} past SLA` : 'Open and unassigned right now'}
            accent="text-amber-400"
            onClick={() => goToLeads({ assignedTo: 'Unassigned', stage: 'open' })}
          />
          <StatCard
            icon={Wallet}
            label="Current Open Pipeline Value"
            value={`₹${(pipeline?.pipelineValue || 0).toLocaleString('en-IN')}`}
            sub="Snapshot of all open leads right now, not limited to the period"
            accent="text-emerald-400"
            onClick={() => goToLeads({ stage: 'open' })}
          />
        </div>

        {volume?.trend?.length > 0 && (
          <div className="h-56 mb-5">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={volume.trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2D2D33" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9CA3AF' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9CA3AF' }} />
                <Tooltip {...CHART_TOOLTIP_PROPS} />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke={CHART_COLOR}
                  strokeWidth={2}
                  activeDot={{
                    r: 5,
                    style: { cursor: 'pointer' },
                    onClick: (_e, payload) => goToLeads({ dateFrom: payload.payload.date, dateTo: payload.payload.date })
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <div>
            <p className="text-xs font-bold text-app-text-muted uppercase tracking-wider mb-2">By Platform</p>
            <div className="max-h-[450px] overflow-y-auto pr-1" style={{ minHeight: '220px', height: `${Math.max(220, (volume?.byPlatform?.length || 0) * 36)}px` }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={volume?.byPlatform || []} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#9CA3AF' }} />
                  <YAxis
                    type="category"
                    dataKey="platform"
                    width={90}
                    interval={0}
                    tick={{ fontSize: 11, fill: '#9CA3AF' }}
                    tickFormatter={(val) => {
                      if (!val) return '—';
                      return val.length > 14 ? `${val.slice(0, 12)}…` : val;
                    }}
                  />
                  <Tooltip {...CHART_TOOLTIP_PROPS} cursor={{ fill: 'rgba(255, 255, 255, 0.06)' }} />
                  <Bar
                    dataKey="count"
                    fill={CHART_COLOR}
                    radius={[0, 4, 4, 0]}
                    style={{ cursor: 'pointer' }}
                    onClick={(data) => goToLeads({ platform: data.platform, dateFrom, dateTo })}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-app-text-muted uppercase tracking-wider mb-2">By Service</p>
            <div className="max-h-[450px] overflow-y-auto pr-1" style={{ minHeight: '220px', height: `${Math.max(220, (volume?.byService?.length || 0) * 36)}px` }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={volume?.byService || []} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#9CA3AF' }} />
                  <YAxis
                    type="category"
                    dataKey="service"
                    width={140}
                    interval={0}
                    tick={{ fontSize: 10, fill: '#9CA3AF' }}
                    tickFormatter={(val) => {
                      if (!val) return '—';
                      return val.length > 20 ? `${val.slice(0, 18)}…` : val;
                    }}
                  />
                  <Tooltip
                    {...CHART_TOOLTIP_PROPS}
                    cursor={{ fill: 'rgba(255, 255, 255, 0.06)' }}
                    formatter={(value, _name, item) => [value, item?.payload?.service || 'Leads']}
                  />
                  <Bar
                    dataKey="count"
                    fill="#60a5fa"
                    radius={[0, 4, 4, 0]}
                    style={{ cursor: 'pointer' }}
                    onClick={(data) => goToLeads({ service: data.service, dateFrom, dateTo })}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

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

      {/* Pipeline Funnel — a snapshot of the same cohort's current stage, not a conversion funnel */}
      <div className={sectionClass}>
        <h2 className={sectionTitleClass}>
          <TrendingUp size={16} /> Pipeline Funnel <span className="normal-case font-medium text-app-text-muted">· current stage of leads received in the period (a snapshot, not stage-to-stage conversion)</span>
        </h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={funnelData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2D2D33" vertical={false} />
              <XAxis dataKey="status" tick={{ fontSize: 10, fill: '#9CA3AF' }} interval={0} angle={-20} textAnchor="end" height={60} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9CA3AF' }} />
              <Tooltip {...CHART_TOOLTIP_PROPS} cursor={{ fill: 'rgba(255, 255, 255, 0.06)' }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} style={{ cursor: 'pointer' }} onClick={(data) => goToLeads({ status: data.status, dateFrom, dateTo })}>
                {funnelData.map((entry) => (
                  <Cell key={entry.status} fill={['Won'].includes(entry.status) ? '#34d399' : ['Lost', 'Dropped'].includes(entry.status) ? '#f87171' : CHART_COLOR} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
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

        <p className="text-xs font-bold text-app-text-muted uppercase tracking-wider mb-2">Top 10 Scored Leads (open pipeline)</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[560px]">
            <thead className="bg-app-bg text-app-text-muted text-xs uppercase tracking-wider border-b border-app-border">
              <tr>
                <th className="px-4 py-2 font-semibold">Lead</th>
                <th className="px-4 py-2 font-semibold">Status</th>
                <th className="px-4 py-2 font-semibold">Priority</th>
                <th className="px-4 py-2 font-semibold">Score</th>
                <th className="px-4 py-2 font-semibold">BD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {(volume?.topScoredLeads || []).map((lead) => (
                <tr key={lead._id} onClick={() => navigate(`/admin/leads/${lead._id}`)} className="hover:bg-app-bg transition-colors cursor-pointer">
                  <td className="px-4 py-2 text-app-text font-medium">{lead.fullName} <span className="text-app-text-muted text-xs">({lead.leadId})</span></td>
                  <td className="px-4 py-2 text-app-text-muted">{lead.status}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold border ${LEAD_PRIORITY_BADGE_CLASSES[lead.leadPriority] || LEAD_PRIORITY_BADGE_CLASSES.Normal}`}>{lead.leadPriority}</span>
                  </td>
                  <td className="px-4 py-2 text-app-text-muted">{lead.leadScore}/100</td>
                  <td className="px-4 py-2 text-app-text-muted">{displayName(lead.assignedTo)}</td>
                </tr>
              ))}
              {(!volume?.topScoredLeads || volume.topScoredLeads.length === 0) && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-app-text-muted">No open leads yet.</td></tr>
              )}
            </tbody>
          </table>
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
