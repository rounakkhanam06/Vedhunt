import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  UserPlus, Activity, TrendingUp, IndianRupee, Clock, Briefcase, AlertTriangle,
  Wallet, UserX, Gauge
} from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Tooltip, XAxis, YAxis } from 'recharts';
import analyticsService from '../../services/analyticsService';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { usePermissions } from '../hooks/usePermissions';
import { downloadLeadsCsv } from '../utils/leadExport';

// firstName/lastName aren't guaranteed on every Admin account (the original
// legacy seed account predates those fields being required) — fall back
// gracefully instead of rendering "undefined undefined".
function displayName(person) {
  if (!person) return 'Unknown';
  const name = [person.firstName, person.lastName].filter(Boolean).join(' ').trim();
  return name || person.email || 'Unknown';
}

const STATUS_BADGE_CLASSES = {
  Won: 'bg-emerald-500/10 text-emerald-400',
  Lost: 'bg-red-500/10 text-red-400',
  Dropped: 'bg-red-500/10 text-red-400',
  New: 'bg-[#FFB800]/10 text-[#FFB800]',
  Hold: 'bg-slate-500/10 text-slate-400'
};

const PIE_COLORS = ['#FF6B00', '#60a5fa', '#34d399', '#f87171', '#fbbf24', '#a78bfa', '#94a3b8'];

const Dashboard = () => {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canSeeCompliance = can('leads.assign');
  const isSuperAdmin = can('*');

  const [financialData, setFinancialData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [compliance, setCompliance] = useState(null);
  const [complianceLoading, setComplianceLoading] = useState(true);

  // Super-Admin-only real leads section — replaces what used to be hardcoded
  // placeholder numbers/charts/table.
  const [volume, setVolume] = useState(null);
  const [pipeline, setPipeline] = useState(null);
  const [recentLeads, setRecentLeads] = useState([]);
  const [leadsLoading, setLeadsLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await analyticsService.getEarningsOverview();
        if (res.success) {
          setFinancialData(res.data);
        }
      } catch {
        toast.error('Failed to load financial analytics');
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  useEffect(() => {
    if (!canSeeCompliance) {
      setComplianceLoading(false);
      return;
    }
    api.get('/admin/activity/followup-compliance')
      .then((res) => { if (res.data.success) setCompliance(res.data); })
      .catch(() => toast.error('Failed to load follow-up compliance'))
      .finally(() => setComplianceLoading(false));
  }, [canSeeCompliance]);

  const fetchLeadsOverview = useCallback(async () => {
    if (!isSuperAdmin) {
      setLeadsLoading(false);
      return;
    }
    setLeadsLoading(true);
    try {
      const [volRes, pipeRes, recentRes] = await Promise.all([
        api.get('/admin/activity/lead-volume'),
        api.get('/admin/activity/pipeline-summary'),
        api.get('/leads', { params: { limit: 8, sortBy: 'createdAt', sortOrder: 'desc' } })
      ]);
      if (volRes.data.success) setVolume(volRes.data);
      if (pipeRes.data.success) setPipeline(pipeRes.data);
      if (recentRes.data.success) setRecentLeads(recentRes.data.data);
    } catch (error) {
      console.error('Error loading leads overview:', error);
      toast.error('Failed to load leads overview');
    } finally {
      setLeadsLoading(false);
    }
  }, [isSuperAdmin]);

  useEffect(() => { fetchLeadsOverview(); }, [fetchLeadsOverview]);

  const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n || 0);

  const goToLeads = (params) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
    ).toString();
    navigate(`/admin/leads/all${qs ? `?${qs}` : ''}`);
  };

  const handleExportRecent = () => {
    if (recentLeads.length === 0) {
      toast.error('No leads to export');
      return;
    }
    downloadLeadsCsv(recentLeads, 'recent_leads_export');
  };

  return (
    <div className="space-y-8">
      {/* Financial Overview */}
      <section>
        <h2 className="text-xl font-bold text-white mb-4">Financial Overview</h2>
        {loading ? (
          <div className="flex items-center justify-center h-24 bg-admin-glass border border-white/5 rounded-xl">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : financialData && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Link to="/admin/invoices" className="bg-admin-glass border border-white/5 p-6 rounded-xl transition-transform duration-300 hover:scale-[1.02] group">
              <div className="flex justify-between items-start mb-4">
                <span className="text-sm font-medium text-on-primary-container">Total Earnings</span>
                <IndianRupee className="w-5 h-5 text-[#22C55E] group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-3xl font-bold mb-1 text-[#22C55E]">{fmt(financialData.overview.totalRevenue)}</div>
              <div className="flex items-center gap-1 text-[10px] font-medium text-[#9CA3AF]">
                From {financialData.overview.totalInvoices} invoices
              </div>
            </Link>

            <Link to="/admin/invoices" className="bg-admin-glass border border-white/5 p-6 rounded-xl transition-transform duration-300 hover:scale-[1.02] group">
              <div className="flex justify-between items-start mb-4">
                <span className="text-sm font-medium text-on-primary-container">Total Pending</span>
                <Clock className="w-5 h-5 text-yellow-500 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-3xl font-bold mb-1 text-yellow-500">{fmt(financialData.overview.totalPending)}</div>
              <div className="flex items-center gap-1 text-[10px] font-medium text-[#9CA3AF]">
                Requires follow-up
              </div>
            </Link>

            <Link to="/admin/projects" className="bg-admin-glass border border-white/5 p-6 rounded-xl transition-transform duration-300 hover:scale-[1.02] group">
              <div className="flex justify-between items-start mb-4">
                <span className="text-sm font-medium text-on-primary-container">Active Projects</span>
                <Briefcase className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-3xl font-bold mb-1 text-white">{financialData.overview.totalProjects}</div>
              <div className="flex items-center gap-1 text-[10px] font-medium text-[#9CA3AF]">
                Across all clients
              </div>
            </Link>
          </div>
        )}
      </section>

      {/* Follow-up Compliance — Manager/CEO view, gated to those who can assign leads */}
      {canSeeCompliance && (
        <section className="bg-admin-glass border border-white/5 rounded-xl overflow-hidden">
          <div className="p-6 border-b border-white/5 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-secondary" /> Follow-up Compliance
              </h3>
              <p className="text-xs text-on-primary-container mt-1">Live snapshot across the BD team — click any number to see the leads behind it</p>
            </div>
            {compliance && compliance.totals.total > 0 && (
              <div className="text-right">
                <div className="text-2xl font-bold text-white">{compliance.totals.onTrackPct}%</div>
                <div className="text-[10px] text-on-primary-container uppercase tracking-wider">On Track</div>
              </div>
            )}
          </div>

          {complianceLoading ? (
            <div className="flex items-center justify-center h-24">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : !compliance || compliance.totals.total === 0 ? (
            <div className="p-6 text-center text-on-primary-container text-sm">No active follow-ups scheduled right now.</div>
          ) : (
            <>
              <div className="grid grid-cols-3 divide-x divide-white/5 border-b border-white/5">
                <button onClick={() => navigate('/admin/follow-ups?bucket=Overdue')} className="p-4 text-center hover:bg-white/[0.03] transition-colors cursor-pointer">
                  <div className="text-2xl font-bold text-red-400">{compliance.totals.overdue}</div>
                  <div className="text-[10px] text-on-primary-container uppercase tracking-wider mt-1">Overdue</div>
                </button>
                <button onClick={() => navigate('/admin/follow-ups?bucket=Today')} className="p-4 text-center hover:bg-white/[0.03] transition-colors cursor-pointer">
                  <div className="text-2xl font-bold text-orange-400">{compliance.totals.dueToday}</div>
                  <div className="text-[10px] text-on-primary-container uppercase tracking-wider mt-1">Due Today</div>
                </button>
                <button onClick={() => navigate('/admin/follow-ups?bucket=Upcoming')} className="p-4 text-center hover:bg-white/[0.03] transition-colors cursor-pointer">
                  <div className="text-2xl font-bold text-emerald-400">{compliance.totals.upcoming}</div>
                  <div className="text-[10px] text-on-primary-container uppercase tracking-wider mt-1">Upcoming</div>
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/5 text-xs text-[#9CA3AF] uppercase tracking-wider">
                      <th className="px-6 py-3 font-medium">BD</th>
                      <th className="px-6 py-3 font-medium text-center">Overdue</th>
                      <th className="px-6 py-3 font-medium text-center">Due Today</th>
                      <th className="px-6 py-3 font-medium text-center">Upcoming</th>
                      <th className="px-6 py-3 font-medium text-right">On Track</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {compliance.byBd.map((row) => (
                      <tr
                        key={row.bd._id}
                        onClick={() => navigate(`/admin/follow-ups?by=${row.bd._id}`)}
                        className="hover:bg-white/[0.02] transition-colors cursor-pointer"
                      >
                        <td className="px-6 py-3 text-sm text-white font-medium">{displayName(row.bd)}</td>
                        <td className="px-6 py-3 text-sm text-center text-red-400 font-bold">{row.overdue}</td>
                        <td className="px-6 py-3 text-sm text-center text-orange-400 font-bold">{row.dueToday}</td>
                        <td className="px-6 py-3 text-sm text-center text-emerald-400 font-bold">{row.upcoming}</td>
                        <td className="px-6 py-3 text-sm text-right font-semibold text-white">{row.onTrackPct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}

      {/* Project-Level Earnings */}
      {financialData?.projectStats?.length > 0 && (
        <section className="bg-admin-glass border border-white/5 rounded-xl overflow-hidden">
          <div className="p-6 border-b border-white/5">
            <h3 className="text-lg font-semibold text-white">Project-Level Earnings</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/5 text-xs text-[#9CA3AF] uppercase tracking-wider">
                  <th className="px-6 py-4 font-medium">Project ID</th>
                  <th className="px-6 py-4 font-medium">Project Name</th>
                  <th className="px-6 py-4 font-medium">Client</th>
                  <th className="px-6 py-4 font-medium text-right">Total Price</th>
                  <th className="px-6 py-4 font-medium text-right">Earned</th>
                  <th className="px-6 py-4 font-medium text-right">Pending</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {financialData.projectStats.map((proj) => (
                  <tr key={proj._id} onClick={() => navigate('/admin/projects')} className="hover:bg-white/[0.02] transition-colors cursor-pointer">
                    <td className="px-6 py-4 text-sm font-mono text-[#9CA3AF]">{proj.projectId}</td>
                    <td className="px-6 py-4 text-sm text-white font-medium">{proj.projectName}</td>
                    <td className="px-6 py-4 text-sm text-[#9CA3AF]">{proj.clientName}</td>
                    <td className="px-6 py-4 text-sm text-white text-right font-semibold">{fmt(proj.totalPrice)}</td>
                    <td className="px-6 py-4 text-sm text-[#22C55E] text-right font-bold">{fmt(proj.paidAmount)}</td>
                    <td className="px-6 py-4 text-sm text-yellow-500 text-right font-bold">{fmt(proj.pendingAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Leads Overview — Super Admin only, fully real, fully clickable.
          For the deeper drill-down/funnel/BD breakdown, see Management Dashboard. */}
      {isSuperAdmin && (
        <>
          {leadsLoading ? (
            <div className="flex items-center justify-center h-24 bg-admin-glass border border-white/5 rounded-xl">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <>
              <section className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Leads Overview <span className="text-xs font-normal text-on-primary-container">(last 30 days)</span></h2>
                <Link to="/admin/management-dashboard" className="flex items-center gap-1.5 text-xs font-semibold text-secondary hover:opacity-80">
                  <Gauge size={14} /> Full Management Dashboard
                </Link>
              </section>

              {/* KPI Top Row — real numbers, every card clickable */}
              <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <button
                  onClick={() => goToLeads({})}
                  className="text-left bg-admin-glass border border-white/5 p-6 rounded-xl transition-transform duration-300 hover:scale-[1.02] group"
                >
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-sm font-medium text-on-primary-container">New Leads</span>
                    <UserPlus className="w-5 h-5 text-secondary group-hover:scale-110 transition-transform" />
                  </div>
                  <div className="text-3xl font-bold mb-1 text-white">{volume?.totalLeads ?? 0}</div>
                  <div className="text-[10px] font-medium text-[#9CA3AF]">Last 30 days</div>
                </button>

                <button
                  onClick={() => goToLeads({ stage: 'open' })}
                  className="text-left bg-admin-glass border border-white/5 p-6 rounded-xl transition-transform duration-300 hover:scale-[1.02] group"
                >
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-sm font-medium text-on-primary-container">Open Pipeline Value</span>
                    <Wallet className="w-5 h-5 text-secondary group-hover:scale-110 transition-transform" />
                  </div>
                  <div className="text-3xl font-bold mb-1 text-white">₹{(pipeline?.pipelineValue || 0).toLocaleString('en-IN')}</div>
                  <div className="text-[10px] font-medium text-[#9CA3AF]">Active, non-terminal leads</div>
                </button>

                <button
                  onClick={() => goToLeads({ assignedTo: 'Unassigned', stage: 'open' })}
                  className="text-left bg-admin-glass border border-white/5 p-6 rounded-xl transition-transform duration-300 hover:scale-[1.02] group"
                >
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-sm font-medium text-on-primary-container">Unassigned Leads</span>
                    <UserX className="w-5 h-5 text-yellow-500 group-hover:scale-110 transition-transform" />
                  </div>
                  <div className="text-3xl font-bold mb-1 text-white">{volume?.unassignedCount ?? 0}</div>
                  <div className="text-[10px] font-medium text-[#9CA3AF]">
                    {volume?.unassignedSlaBreachedCount ? `${volume.unassignedSlaBreachedCount} past SLA` : 'Within SLA'}
                  </div>
                </button>

                <button
                  onClick={() => goToLeads({ status: 'Won' })}
                  className="text-left bg-admin-glass border border-white/5 p-6 rounded-xl transition-transform duration-300 hover:scale-[1.02] group"
                >
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-sm font-medium text-on-primary-container">Conversion Rate</span>
                    <Activity className="w-5 h-5 text-secondary group-hover:scale-110 transition-transform" />
                  </div>
                  <div className="text-3xl font-bold mb-1 text-white">{pipeline?.conversionRate ?? 0}%</div>
                  <div className="flex items-center gap-1 text-[10px] font-medium text-[#00FF94]">
                    <TrendingUp className="w-3 h-3" /> Click to see wins
                  </div>
                </button>
              </section>

              {/* Trend + Service Mix — real charts */}
              <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-admin-glass border border-white/5 p-6 rounded-xl">
                  <h3 className="text-xl font-semibold text-on-surface mb-6 border-b border-outline-variant pb-4">Lead Flow — Past 30 Days</h3>
                  {volume?.trend?.length > 0 ? (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={volume.trend}>
                          <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9CA3AF' }} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9CA3AF' }} />
                          <Tooltip contentStyle={{ background: '#16161A', border: '1px solid #2D2D33', fontSize: 12 }} />
                          <Line
                            type="monotone"
                            dataKey="count"
                            stroke="#FF6B00"
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
                  ) : (
                    <p className="text-sm text-on-primary-container text-center py-16">No leads in this window yet.</p>
                  )}
                </div>

                <div className="bg-admin-glass border border-white/5 p-6 rounded-xl flex flex-col">
                  <h3 className="text-xl font-semibold text-on-surface mb-6 border-b border-outline-variant pb-4">Leads by Service</h3>
                  {volume?.byService?.length > 0 ? (
                    <>
                      <div className="flex-1 flex items-center justify-center" style={{ minHeight: 180 }}>
                        <ResponsiveContainer width="100%" height={180}>
                          <PieChart>
                            <Pie
                              data={volume.byService}
                              dataKey="count"
                              nameKey="service"
                              innerRadius={50}
                              outerRadius={80}
                              style={{ cursor: 'pointer' }}
                              onClick={(entry) => goToLeads({ service: entry.service, dateFrom: undefined, dateTo: undefined })}
                            >
                              {volume.byService.map((entry, i) => (
                                <Cell key={entry.service} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={{ background: '#16161A', border: '1px solid #2D2D33', fontSize: 12 }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="space-y-2 mt-auto">
                        {volume.byService.slice(0, 5).map((s, i) => (
                          <button
                            key={s.service}
                            onClick={() => goToLeads({ service: s.service })}
                            className="w-full flex justify-between items-center text-xs font-medium hover:text-secondary transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-3 h-3 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}></span>
                              <span className="truncate text-on-surface">{s.service}</span>
                            </div>
                            <span className="text-on-surface-variant shrink-0 ml-2">{s.count}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-on-primary-container text-center py-16">No leads in this window yet.</p>
                  )}
                </div>
              </section>

              {/* Recent Leads — real, clickable, exportable */}
              <section className="bg-admin-glass border border-white/5 rounded-xl overflow-hidden">
                <div className="p-6 border-b border-outline-variant flex justify-between items-center">
                  <h3 className="text-xl font-semibold text-on-surface">Recent Leads</h3>
                  <div className="flex items-center gap-3">
                    <button onClick={handleExportRecent} className="bg-[#121215] border border-[#2D2D33] px-4 py-2 rounded-lg text-xs font-medium hover:border-secondary transition-all text-on-surface">
                      Export CSV
                    </button>
                    <Link to="/admin/leads/all" className="text-xs font-semibold text-secondary hover:opacity-80">View All →</Link>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-surface-container-high/50 text-xs font-medium text-on-primary-container">
                        <th className="px-6 py-4 font-medium">NAME</th>
                        <th className="px-6 py-4 font-medium">CONTACT</th>
                        <th className="px-6 py-4 font-medium">SERVICE</th>
                        <th className="px-6 py-4 font-medium">SOURCE</th>
                        <th className="px-6 py-4 font-medium">STATUS</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-outline-variant/30 text-on-surface-variant">
                      {recentLeads.length === 0 ? (
                        <tr><td colSpan={5} className="px-6 py-8 text-center text-on-primary-container">No leads yet.</td></tr>
                      ) : recentLeads.map((lead) => (
                        <tr
                          key={lead._id}
                          onClick={() => navigate(`/admin/leads/${lead._id}`)}
                          className="hover:bg-surface-variant/20 transition-colors cursor-pointer"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3 text-on-surface">
                              <div className="w-8 h-8 rounded-full bg-secondary-container/20 text-secondary flex items-center justify-center font-bold text-xs shrink-0">
                                {(lead.fullName || '?').slice(0, 2).toUpperCase()}
                              </div>
                              <span className="truncate">{lead.fullName}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">{lead.phone || lead.email}</td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-1 bg-surface-variant text-on-surface rounded text-[11px] font-medium">{lead.service}</span>
                          </td>
                          <td className="px-6 py-4 truncate max-w-[160px]">{lead.platform || 'Website'}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${STATUS_BADGE_CLASSES[lead.status] || 'bg-blue-500/10 text-blue-400'}`}>
                              <span className="w-1 h-1 rounded-full bg-current mr-2"></span>
                              {lead.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default Dashboard;
