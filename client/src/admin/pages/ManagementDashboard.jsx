import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Gauge, Users, TrendingUp, Clock, AlertTriangle, Flame, Wallet, UserX, PhoneCall
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell
} from 'recharts';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { LEAD_PRIORITY_BADGE_CLASSES } from '../../shared/serviceQualification';

// Canonical pipeline sequence — server/utils/leadStateMachine.js's ALLOWED_TRANSITIONS
// keys, in stage order, for the bottleneck funnel.
const PIPELINE_STAGE_ORDER = ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation', 'Hold', 'Won', 'Lost', 'Dropped'];

const PRIORITY_COLORS = { Hot: '#f87171', Warm: '#fbbf24', Normal: '#60a5fa', Low: '#94a3b8' };
const CHART_COLOR = '#FF6B00';

// firstName/lastName aren't guaranteed on every Admin account — fall back
// gracefully instead of rendering "undefined undefined".
function displayName(person) {
  if (!person) return 'Unassigned';
  const name = [person?.firstName, person?.lastName].filter(Boolean).join(' ').trim();
  return name || person?.email || 'Unknown';
}

function toDateInput(d) {
  return d.toISOString().slice(0, 10);
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

export default function ManagementDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(() => toDateInput(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)));
  const [dateTo, setDateTo] = useState(() => toDateInput(new Date()));

  const [volume, setVolume] = useState(null);
  const [pipeline, setPipeline] = useState(null);
  const [bdAccountability, setBdAccountability] = useState([]);
  const [compliance, setCompliance] = useState(null);
  const [actionMissingCounts, setActionMissingCounts] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [volRes, pipeRes, bdRes, complianceRes, actionRes] = await Promise.all([
        api.get('/admin/activity/lead-volume', { params: { dateFrom, dateTo } }),
        api.get('/admin/activity/pipeline-summary'),
        api.get('/admin/activity/bd-accountability'),
        api.get('/admin/activity/followup-compliance'),
        api.get('/admin/activity/action-missing', { params: { limit: 1 } })
      ]);
      if (volRes.data.success) setVolume(volRes.data);
      if (pipeRes.data.success) setPipeline(pipeRes.data);
      if (bdRes.data.success) setBdAccountability(bdRes.data.data);
      if (complianceRes.data.success) setCompliance(complianceRes.data);
      if (actionRes.data.success) setActionMissingCounts(actionRes.data.counts);
    } catch (error) {
      console.error('Error loading management dashboard:', error);
      toast.error('Failed to load the dashboard');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /** Every drill-down funnels through here — builds the /admin/leads/all URL. */
  const goToLeads = (params) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
    ).toString();
    navigate(`/admin/leads/all${qs ? `?${qs}` : ''}`);
  };

  // Company-wide speed metrics — derived client-side from the per-BD
  // accountability rows already fetched, no new backend endpoint needed.
  const totalAssigned = bdAccountability.reduce((s, r) => s + (r.assignedCount || 0), 0);
  const avgConnectRate = totalAssigned > 0
    ? Math.round(bdAccountability.reduce((s, r) => s + (r.connectRate || 0) * (r.assignedCount || 0), 0) / totalAssigned)
    : 0;
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-app-text font-heading flex items-center gap-2">
            <Gauge className="text-primary" size={24} /> Management Dashboard
          </h1>
          <p className="text-sm text-app-text-muted mt-1">Every number below is clickable — it opens the exact leads behind it.</p>
        </div>
        <div className="flex items-center gap-1.5 bg-app-card border border-app-border rounded-lg px-3 py-2">
          <span className="text-xs text-app-text-muted">New leads from</span>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="bg-transparent text-sm text-app-text focus:outline-none" style={{ colorScheme: 'dark' }} />
          <span className="text-xs text-app-text-muted">to</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="bg-transparent text-sm text-app-text focus:outline-none" style={{ colorScheme: 'dark' }} />
        </div>
      </div>

      {/* Lead Volume & Source */}
      <div className={sectionClass}>
        <h2 className={sectionTitleClass}><TrendingUp size={16} /> Lead Volume &amp; Source</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <StatCard
            icon={TrendingUp}
            label="New Leads (period)"
            value={volume?.totalLeads ?? 0}
            onClick={() => goToLeads({ dateFrom, dateTo })}
          />
          <StatCard
            icon={UserX}
            label="Unassigned Now"
            value={volume?.unassignedCount ?? 0}
            sub={volume?.unassignedSlaBreachedCount ? `${volume.unassignedSlaBreachedCount} past SLA` : undefined}
            accent="text-amber-400"
            onClick={() => goToLeads({ assignedTo: 'Unassigned', stage: 'open' })}
          />
          <StatCard
            icon={Wallet}
            label="Open Pipeline Value"
            value={`₹${(pipeline?.pipelineValue || 0).toLocaleString('en-IN')}`}
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
                <Tooltip contentStyle={{ background: '#16161A', border: '1px solid #2D2D33', fontSize: 12 }} />
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-bold text-app-text-muted uppercase tracking-wider mb-2">By Platform</p>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={volume?.byPlatform || []} layout="vertical" margin={{ left: 8 }}>
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#9CA3AF' }} />
                  <YAxis type="category" dataKey="platform" width={80} tick={{ fontSize: 11, fill: '#9CA3AF' }} />
                  <Tooltip contentStyle={{ background: '#16161A', border: '1px solid #2D2D33', fontSize: 12 }} />
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
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={volume?.byService || []} layout="vertical" margin={{ left: 8 }}>
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#9CA3AF' }} />
                  <YAxis type="category" dataKey="service" width={110} tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                  <Tooltip contentStyle={{ background: '#16161A', border: '1px solid #2D2D33', fontSize: 12 }} />
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

      {/* Ownership & Speed */}
      <div className={sectionClass}>
        <h2 className={sectionTitleClass}><Users size={16} /> Ownership &amp; BD Speed</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <StatCard
            icon={PhoneCall}
            label="Avg. Connect Rate"
            value={`${avgConnectRate}%`}
            sub="Click to see connected leads"
            onClick={() => goToLeads({ connected: 'Yes' })}
          />
          <StatCard
            icon={Clock}
            label="Avg. Response Time"
            value={avgResponseMinutes != null ? `${avgResponseMinutes} min` : '—'}
            sub="Assignment → first call, company-wide"
            onClick={() => goToLeads({ stage: 'open' })}
          />
          <StatCard
            icon={AlertTriangle}
            label="Follow-up Breaches"
            value={totalBreaches}
            accent="text-red-400"
            onClick={() => goToLeads({ followUpBreached: 'true' })}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[640px]">
            <thead className="bg-app-bg text-app-text-muted text-xs uppercase tracking-wider border-b border-app-border">
              <tr>
                <th className="px-4 py-2 font-semibold">BD</th>
                <th className="px-4 py-2 font-semibold">Assigned</th>
                <th className="px-4 py-2 font-semibold">Calls Made</th>
                <th className="px-4 py-2 font-semibold">Connect Rate</th>
                <th className="px-4 py-2 font-semibold">Avg. Response</th>
                <th className="px-4 py-2 font-semibold">Breaches</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {bdAccountability.map((row) => (
                <tr
                  key={row.bd._id}
                  onClick={() => goToLeads({ assignedTo: row.bd._id })}
                  className="hover:bg-app-bg transition-colors cursor-pointer"
                >
                  <td className="px-4 py-2 text-app-text font-medium">{displayName(row.bd)}</td>
                  <td className="px-4 py-2 text-app-text-muted">{row.assignedCount}</td>
                  <td className="px-4 py-2 text-app-text-muted">{row.callsMade}</td>
                  <td className="px-4 py-2 text-app-text-muted">{row.connectRate}%</td>
                  <td className="px-4 py-2 text-app-text-muted">{row.avgResponseMinutes != null ? `${row.avgResponseMinutes} min` : '-'}</td>
                  <td className="px-4 py-2">
                    <span className={row.breachCount > 0 ? 'text-red-400 font-bold' : 'text-app-text-muted'}>{row.breachCount}</span>
                  </td>
                </tr>
              ))}
              {bdAccountability.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-app-text-muted">No assigned leads yet.</td></tr>
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
            label="Overdue Follow-ups"
            value={compliance?.totals?.overdue ?? 0}
            accent="text-red-400"
            onClick={() => navigate('/admin/follow-ups?bucket=Overdue')}
          />
          <StatCard
            icon={AlertTriangle}
            label="Action Missing"
            value={(actionMissingCounts?.['Hot Lead'] || 0) + (actionMissingCounts?.['Proposal/Negotiation'] || 0) + (actionMissingCounts?.Other || 0)}
            sub={actionMissingCounts ? `${actionMissingCounts['Hot Lead'] || 0} Hot · ${actionMissingCounts['Proposal/Negotiation'] || 0} Proposal/Neg` : undefined}
            accent="text-amber-400"
            onClick={() => navigate('/admin/follow-ups?bucket=Action Missing')}
          />
          <StatCard
            icon={Gauge}
            label="On-Track Follow-up %"
            value={`${compliance?.totals?.onTrackPct ?? 0}%`}
            sub="Click for the full follow-up list"
            onClick={() => navigate('/admin/follow-ups')}
          />
        </div>
        <p className="text-xs font-bold text-app-text-muted uppercase tracking-wider mb-2">Pipeline Funnel — count per stage</p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={funnelData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2D2D33" vertical={false} />
              <XAxis dataKey="status" tick={{ fontSize: 10, fill: '#9CA3AF' }} interval={0} angle={-20} textAnchor="end" height={60} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9CA3AF' }} />
              <Tooltip contentStyle={{ background: '#16161A', border: '1px solid #2D2D33', fontSize: 12 }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} style={{ cursor: 'pointer' }} onClick={(data) => goToLeads({ status: data.status })}>
                {funnelData.map((entry) => (
                  <Cell key={entry.status} fill={['Won'].includes(entry.status) ? '#34d399' : ['Lost', 'Dropped'].includes(entry.status) ? '#f87171' : CHART_COLOR} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Likely to Convert */}
      <div className={sectionClass}>
        <h2 className={sectionTitleClass}><Flame size={16} /> Likely to Convert</h2>
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
        <h2 className={sectionTitleClass}><Wallet size={16} /> Pipeline Revenue</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard
            icon={Wallet}
            label="Open Pipeline Value"
            value={`₹${(pipeline?.pipelineValue || 0).toLocaleString('en-IN')}`}
            accent="text-primary"
            onClick={() => goToLeads({ stage: 'open' })}
          />
          <StatCard
            icon={TrendingUp}
            label="Won Value"
            value={`₹${(pipeline?.wonValue || 0).toLocaleString('en-IN')}`}
            accent="text-emerald-400"
            onClick={() => goToLeads({ status: 'Won' })}
          />
          <StatCard
            icon={Gauge}
            label="Conversion Rate"
            value={`${pipeline?.conversionRate ?? 0}%`}
            accent="text-amber-400"
            sub="Click to see the wins behind it"
            onClick={() => goToLeads({ status: 'Won' })}
          />
        </div>
      </div>
    </div>
  );
}
