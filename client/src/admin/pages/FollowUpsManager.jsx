import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Clock, Filter, ChevronDown, ChevronLeft, ChevronRight, Phone, AlertTriangle, TrendingUp, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLeadAccess } from '../../shared/crmAccess';
import { formatMinutes } from '../../shared/formatDuration';
import { FOLLOW_UP_TYPES, FOLLOW_UP_TYPE_BADGE } from '../../shared/leadConstants';

const BUCKET_TABS = ['All', 'Overdue', 'Today', 'Upcoming', 'Action Missing'];

const BUCKET_BADGE = {
  Overdue: 'bg-red-500/10 text-red-400 border-red-500/20',
  Today: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  Upcoming: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
};

const EXCEPTION_CATEGORIES = ['All', 'Hot Lead', 'Proposal/Negotiation', 'Other'];

const EXCEPTION_BADGE = {
  'Hot Lead': 'bg-red-500/10 text-red-400 border-red-500/20',
  'Proposal/Negotiation': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  Other: 'bg-amber-500/10 text-amber-400 border-amber-500/20'
};

// firstName/lastName aren't guaranteed on every Admin account (the original
// legacy seed account predates those fields being required) — fall back
// gracefully instead of rendering "undefined undefined".
function displayName(person) {
  if (!person) return '-';
  const name = [person.firstName, person.lastName].filter(Boolean).join(' ').trim();
  return name || person.email || 'Unknown';
}

export default function FollowUpsManager() {
  // Admin panel (role) or Employee Portal (person-wise grant) — shared/crmAccess.js
  const { http, root, leadPath } = useLeadAccess();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [followUps, setFollowUps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bds, setBds] = useState([]);
  // Deep-linkable from the Overview/Management dashboards (?by=<bdId>) — falls
  // back to "All" for a plain page visit.
  const [bdFilter, setBdFilter] = useState(() => searchParams.get('by') || 'All');
  // Deep-linkable from notifications (e.g. the EOD manager digest links here
  // with ?bucket=Overdue) — falls back to "All" for a plain page visit.
  const [bucketFilter, setBucketFilter] = useState(() => {
    const fromUrl = searchParams.get('bucket');
    return BUCKET_TABS.includes(fromUrl) ? fromUrl : 'All';
  });
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [dueFrom, setDueFrom] = useState('');
  const [dueTo, setDueTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [categoryCounts, setCategoryCounts] = useState(null);
  const [pipelineSummary, setPipelineSummary] = useState(null);
  const [bdAccountability, setBdAccountability] = useState([]);

  const isActionMissing = bucketFilter === 'Action Missing';

  const fetchFollowUps = useCallback(async () => {
    setLoading(true);
    try {
      const response = isActionMissing
        ? await http.get(`${root}/admin/activity/action-missing`, { params: { page: currentPage, limit: 20, by: bdFilter, category: categoryFilter } })
        : await http.get(`${root}/admin/activity/followups`, { params: { page: currentPage, limit: 20, by: bdFilter, bucket: bucketFilter, followUpType: typeFilter, dueFrom: dueFrom || undefined, dueTo: dueTo || undefined } });
      if (response.data.success) {
        setFollowUps(response.data.data);
        setTotalPages(response.data.totalPages);
        setTotal(response.data.total);
        setCategoryCounts(response.data.counts || null);
      }
    } catch {
      toast.error(isActionMissing ? 'Failed to load the Action Missing queue' : 'Failed to load follow-ups');
    } finally {
      setLoading(false);
    }
  }, [currentPage, bdFilter, bucketFilter, categoryFilter, typeFilter, dueFrom, dueTo, isActionMissing]);

  useEffect(() => {
    fetchFollowUps();
  }, [fetchFollowUps]);

  useEffect(() => {
    http.get(`${root}/admin/assignment/bds`)
      .then((res) => setBds(res.data?.data || []))
      .catch(() => { /* filter just stays empty */ });
  }, []);

  // Management Visibility — pipeline value/conversion and per-BD accountability,
  // fetched once (not paginated/filtered like the table above).
  useEffect(() => {
    http.get(`${root}/admin/activity/pipeline-summary`).then((res) => {
      if (res.data.success) setPipelineSummary(res.data);
    }).catch(() => {});
    http.get(`${root}/admin/activity/bd-accountability`).then((res) => {
      if (res.data.success) setBdAccountability(res.data.data || []);
    }).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-app-text font-heading flex items-center gap-2">
          <Clock className="text-primary" size={24} /> Follow-ups
        </h1>
        <p className="text-sm text-app-text-muted mt-1">
          {isActionMissing
            ? 'Connected leads with no scheduled next action — the safety net for anything that slipped past the state machine'
            : 'Every lead with a scheduled follow-up, across the whole team'}
        </p>
      </div>

      {/* Management Visibility: pipeline value/conversion + per-BD accountability */}
      {pipelineSummary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-app-card border border-app-border rounded-xl p-4 flex items-center gap-3">
            <TrendingUp className="text-primary shrink-0" size={20} />
            <div>
              <p className="text-xs text-app-text-muted uppercase tracking-wider font-bold">Open Pipeline Value</p>
              <p className="text-lg font-bold text-app-text">₹{(pipelineSummary.pipelineValue || 0).toLocaleString('en-IN')}</p>
            </div>
          </div>
          <div className="bg-app-card border border-app-border rounded-xl p-4 flex items-center gap-3">
            <TrendingUp className="text-emerald-400 shrink-0" size={20} />
            <div>
              <p className="text-xs text-app-text-muted uppercase tracking-wider font-bold">Won Value</p>
              <p className="text-lg font-bold text-app-text">₹{(pipelineSummary.wonValue || 0).toLocaleString('en-IN')}</p>
            </div>
          </div>
          <div className="bg-app-card border border-app-border rounded-xl p-4 flex items-center gap-3">
            <AlertTriangle className="text-amber-400 shrink-0" size={20} />
            <div>
              <p className="text-xs text-app-text-muted uppercase tracking-wider font-bold">Conversion Rate</p>
              <p className="text-lg font-bold text-app-text">{pipelineSummary.conversionRate}%</p>
            </div>
          </div>
        </div>
      )}

      {bdAccountability.length > 0 && (
        <div className="bg-app-card border border-app-border rounded-xl overflow-x-auto">
          <div className="px-4 py-3 border-b border-app-border flex items-center gap-2">
            <Users size={16} className="text-primary" />
            <h2 className="text-sm font-bold text-app-text uppercase tracking-wider">BD Accountability</h2>
          </div>
          <table className="w-full text-left text-sm min-w-[600px]">
            <thead className="bg-app-bg text-app-text-muted text-xs uppercase tracking-wider border-b border-app-border">
              <tr>
                <th className="px-4 py-2 font-semibold">BD</th>
                <th className="px-4 py-2 font-semibold">Assigned</th>
                <th className="px-4 py-2 font-semibold">Calls Made</th>
                <th className="px-4 py-2 font-semibold">Connect Rate</th>
                <th className="px-4 py-2 font-semibold">Avg. Response</th>
                <th className="px-4 py-2 font-semibold">Follow-up Breaches</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {bdAccountability.map((row) => (
                <tr key={row.bd._id} className="hover:bg-app-bg transition-colors">
                  <td className="px-4 py-2 text-app-text font-medium">{displayName(row.bd)}</td>
                  <td className="px-4 py-2 text-app-text-muted">{row.assignedCount}</td>
                  <td className="px-4 py-2 text-app-text-muted">{row.callsMade}</td>
                  <td className="px-4 py-2 text-app-text-muted">{row.connectRate == null ? '—' : `${row.connectRate}%`}</td>
                  <td className="px-4 py-2 text-app-text-muted">{formatMinutes(row.avgResponseMinutes)}</td>
                  <td className="px-4 py-2">
                    <span className={row.breachCount > 0 ? 'text-red-400 font-bold' : 'text-app-text-muted'}>{row.breachCount}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Bucket tabs */}
      <div className="flex bg-app-card border border-app-border p-1 rounded-lg w-max max-w-full overflow-x-auto">
        {BUCKET_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => { setBucketFilter(tab); setCategoryFilter('All'); setCurrentPage(1); }}
            className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${
              bucketFilter === tab ? 'bg-primary text-black' : 'text-app-text-muted hover:text-app-text'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Exception category chips — Action Missing only */}
      {isActionMissing && (
        <div className="flex flex-wrap items-center gap-2">
          {EXCEPTION_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => { setCategoryFilter(cat); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                categoryFilter === cat
                  ? 'bg-primary text-black border-primary'
                  : `bg-app-card text-app-text-muted hover:text-app-text ${cat === 'All' ? 'border-app-border' : EXCEPTION_BADGE[cat]}`
              }`}
            >
              {cat}{categoryCounts && cat !== 'All' ? ` (${categoryCounts[cat] ?? 0})` : ''}
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-4 bg-app-card p-4 rounded-xl border border-app-border">
        <div className="relative min-w-[200px]">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted w-4 h-4 pointer-events-none" />
          <select
            value={bdFilter}
            onChange={(e) => { setBdFilter(e.target.value); setCurrentPage(1); }}
            className="w-full bg-app-bg border border-app-border rounded-lg pl-10 pr-10 py-2.5 text-sm text-app-text focus:outline-none focus:border-primary transition-colors appearance-none cursor-pointer"
          >
            <option className="bg-app-bg text-app-text" value="All">All BDs</option>
            {bds.map((bd) => (
              <option key={bd._id} className="bg-app-bg text-app-text" value={bd._id}>
                {bd.firstName} {bd.lastName}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-app-text-muted w-4 h-4 pointer-events-none" />
        </div>
        {!isActionMissing && (
          <>
            <div className="relative min-w-[200px]">
              <select
                value={typeFilter}
                onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1); }}
                className="w-full bg-app-bg border border-app-border rounded-lg px-3 pr-10 py-2.5 text-sm text-app-text focus:outline-none focus:border-primary transition-colors appearance-none cursor-pointer"
                aria-label="Follow-up type"
              >
                <option className="bg-app-bg text-app-text" value="All">All follow-up types</option>
                {FOLLOW_UP_TYPES.map((t) => <option key={t} className="bg-app-bg text-app-text" value={t}>{t}</option>)}
                <option className="bg-app-bg text-app-text" value="Not set">Type not set</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-app-text-muted w-4 h-4 pointer-events-none" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-app-text-muted whitespace-nowrap">Due</span>
              <input type="date" value={dueFrom} onChange={(e) => { setDueFrom(e.target.value); setCurrentPage(1); }} aria-label="Due from"
                className="bg-app-bg border border-app-border rounded-lg px-3 py-2 text-sm text-app-text focus:outline-none focus:border-primary" style={{ colorScheme: 'dark' }} />
              <span className="text-xs text-app-text-muted">to</span>
              <input type="date" value={dueTo} onChange={(e) => { setDueTo(e.target.value); setCurrentPage(1); }} aria-label="Due to"
                className="bg-app-bg border border-app-border rounded-lg px-3 py-2 text-sm text-app-text focus:outline-none focus:border-primary" style={{ colorScheme: 'dark' }} />
              {(dueFrom || dueTo) && (
                <button onClick={() => { setDueFrom(''); setDueTo(''); setCurrentPage(1); }} className="text-xs text-app-text-muted hover:text-primary underline">Clear</button>
              )}
            </div>
          </>
        )}
        <div className="bg-primary/10 text-primary px-4 py-2.5 rounded-lg font-bold text-sm whitespace-nowrap text-center sm:ml-auto">
          Total: {total}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
        </div>
      ) : (
        !isActionMissing ? <FollowUpTable rows={followUps} bucketFilter={bucketFilter} onOpen={(id) => navigate(leadPath(id))} /> : (
        <div className="bg-app-card border border-app-border rounded-xl overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[800px]">
            <thead className="bg-app-bg text-app-text-muted text-xs uppercase tracking-wider border-b border-app-border">
              <tr>
                <th className="px-4 py-3 font-semibold">Lead</th>
                <th className="px-4 py-3 font-semibold">Service</th>
                <th className="px-4 py-3 font-semibold">Assigned BD</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Interest</th>
                <th className="px-4 py-3 font-semibold">{isActionMissing ? 'Last Call' : 'Due'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {followUps.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-app-text-muted">
                    {isActionMissing ? 'Nothing missing action right now.' : `No follow-ups found${bucketFilter !== 'All' ? ` for "${bucketFilter}"` : ''}.`}
                  </td>
                </tr>
              ) : (
                followUps.map((lead) => (
                  <tr key={lead._id} className="hover:bg-app-bg transition-colors">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(leadPath(lead._id))}
                        className="font-medium text-app-text hover:text-primary hover:underline text-left flex items-center gap-1.5"
                      >
                        <Phone size={12} className="text-app-text-muted" /> {lead.fullName}
                      </button>
                      <p className="text-xs text-app-text-muted mt-0.5">{lead.phone}</p>
                    </td>
                    <td className="px-4 py-3 text-app-text-muted">{lead.service}</td>
                    <td className="px-4 py-3 text-app-text">{displayName(lead.assignedTo)}</td>
                    <td className="px-4 py-3 text-app-text-muted">{lead.status}</td>
                    <td className="px-4 py-3 text-app-text-muted">{lead.interestLevel || '-'}</td>
                    <td className="px-4 py-3">
                      {isActionMissing ? (
                        <div className="flex flex-col gap-1">
                          <span className={`inline-flex w-fit px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider border ${EXCEPTION_BADGE[lead.exceptionType] || EXCEPTION_BADGE.Other}`}>
                            {lead.exceptionType || 'No next action'}
                          </span>
                          <span className="text-xs text-app-text-muted">
                            {lead.callDate ? new Date(lead.callDate).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'}
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <span className={`inline-flex w-fit px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider border ${BUCKET_BADGE[lead.bucket] || 'bg-app-bg text-app-text-muted border-app-border'}`}>
                            {lead.bucket}
                          </span>
                          <span className="text-xs text-app-text-muted">
                            {new Date(lead.nextFollowUpDate).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        )
      )}

      {totalPages > 1 && (
        <div className="flex flex-wrap gap-2 items-center justify-between bg-app-card border border-app-border p-4 rounded-xl">
          <span className="text-sm text-app-text-muted">
            Page <span className="font-bold text-app-text">{currentPage}</span> of <span className="font-bold text-app-text">{totalPages}</span>
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 bg-app-bg border border-app-border rounded-lg text-app-text hover:bg-surface-variant disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 bg-app-bg border border-app-border rounded-lg text-app-text hover:bg-surface-variant disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const fmtWhen = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

/** Follow-ups: due first (overdue on top), type up front, everything needed to act on the row. */
function FollowUpTable({ rows, bucketFilter, onOpen }) {
  return (
    <div className="bg-app-card border border-app-border rounded-xl overflow-x-auto">
      <table className="w-full text-left text-sm min-w-[1100px]">
        <thead className="bg-app-bg text-app-text-muted text-xs uppercase tracking-wider border-b border-app-border">
          <tr>
            <th className="px-4 py-3 font-semibold">Next follow-up</th>
            <th className="px-4 py-3 font-semibold">Type</th>
            <th className="px-4 py-3 font-semibold">Client</th>
            <th className="px-4 py-3 font-semibold">Owner</th>
            <th className="px-4 py-3 font-semibold">Stage</th>
            <th className="px-4 py-3 font-semibold">Last contact</th>
            <th className="px-4 py-3 font-semibold">Latest note</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-app-border">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-app-text-muted">
                No follow-ups found{bucketFilter !== 'All' ? ` for "${bucketFilter}"` : ''}.
              </td>
            </tr>
          ) : rows.map((lead) => {
            const overdue = lead.bucket === 'Overdue';
            return (
              <tr key={lead._id} className={`transition-colors ${overdue ? 'bg-red-500/[0.06] hover:bg-red-500/10 border-l-4 border-l-red-500' : 'hover:bg-app-bg'}`}>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider border ${BUCKET_BADGE[lead.bucket] || 'bg-app-bg text-app-text-muted border-app-border'}`}>
                    {overdue && <AlertTriangle size={11} className="mr-1" />}{lead.bucket}
                  </span>
                  <p className={`text-sm mt-1 ${overdue ? 'text-red-400 font-semibold' : 'text-app-text'}`}>{fmtWhen(lead.nextFollowUpDate)}</p>
                  {lead.nextActionType && <p className="text-[11px] text-app-text-muted">via {lead.nextActionType}</p>}
                </td>
                <td className="px-4 py-3">
                  {lead.followUpType ? (
                    <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-bold border ${FOLLOW_UP_TYPE_BADGE[lead.followUpType] || FOLLOW_UP_TYPE_BADGE.Other}`}>
                      {lead.followUpType}
                    </span>
                  ) : <span className="text-xs text-app-text-muted italic">Type not set</span>}
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => onOpen(lead._id)} className="font-medium text-app-text hover:text-primary hover:underline text-left flex items-center gap-1.5">
                    <Phone size={12} className="text-app-text-muted" /> {lead.fullName}
                  </button>
                  <p className="text-xs text-app-text-muted mt-0.5">{[lead.businessName, lead.phone].filter(Boolean).join(' · ')}</p>
                </td>
                <td className="px-4 py-3 text-app-text whitespace-nowrap">
                  {displayName(lead.assignedTo)}
                  {lead.sharedCount > 0 && <p className="text-[11px] text-purple-400">+{lead.sharedCount} shared</p>}
                </td>
                <td className="px-4 py-3 text-app-text-muted whitespace-nowrap">
                  {lead.status}
                  {lead.interestLevel && <p className="text-[11px]">{lead.interestLevel}</p>}
                </td>
                <td className="px-4 py-3 text-app-text-muted whitespace-nowrap">{fmtWhen(lead.lastContactAt)}</td>
                <td className="px-4 py-3 text-app-text-muted max-w-[260px]">
                  {lead.latestNote ? (
                    <>
                      <p className="text-app-text line-clamp-2" title={lead.latestNote.text}>{lead.latestNote.text}</p>
                      <p className="text-[11px]">{lead.latestNote.source === 'remark' ? 'Remark' : `${lead.latestNote.author} · ${fmtWhen(lead.latestNote.createdAt)}`}</p>
                    </>
                  ) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
