import { useMemo, useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Activity, Filter, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useLeadAccess } from '../../shared/crmAccess';
import RemarkCell from '../../components/common/RemarkCell';
import employeeApi from '../../services/employeeApi';
import { FOLLOW_UP_TYPE_BADGE } from '../../shared/leadConstants';

const STAGES = ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation', 'Hold', 'Won', 'Lost', 'Dropped'];

// firstName/lastName aren't guaranteed on every Admin account (the original
// legacy seed account predates those fields being required) — fall back
// gracefully instead of rendering "undefined undefined".
function displayName(person) {
  if (!person || (!person.firstName && !person.lastName && !person.email && !person.name)) return 'Deleted user';
  const name = person.name || [person.firstName, person.lastName].filter(Boolean).join(' ').trim();
  return name || person.email || 'Unknown';
}

const toDateInput = (d) => {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

function presetRange(key) {
  const today = new Date();
  if (key === 'today') return { dateFrom: toDateInput(today), dateTo: toDateInput(today) };
  if (key === '7d') return { dateFrom: toDateInput(new Date(Date.now() - 6 * 86400000)), dateTo: toDateInput(today) };
  if (key === 'month') return { dateFrom: toDateInput(new Date(today.getFullYear(), today.getMonth(), 1)), dateTo: toDateInput(today) };
  return { dateFrom: '', dateTo: '' };
}

const PRESETS = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: 'Last 7 days' },
  { key: 'month', label: 'This month' },
  { key: 'all', label: 'All time' },
];

const selectClass = 'w-full bg-app-bg border border-app-border rounded-lg pl-10 pr-10 py-2.5 text-sm text-app-text focus:outline-none focus:border-primary transition-colors appearance-none cursor-pointer';
const dateClass = 'bg-app-bg border border-app-border rounded-lg px-3 py-2.5 text-sm text-app-text focus:outline-none focus:border-primary';
const fmtWhen = (d) => new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/**
 * Every call logged on the leads the viewer can see (from each lead's call
 * log, credited to whoever made the call), filterable by caller, result,
 * stage, client and date. Filters live in the URL so the Management
 * Dashboard's "Calls Made" links straight to one BD's calls.
 *
 * `portal`: the BD's own Lead Activity tab in the Employee Portal — calls on
 * their assigned and cross-assigned leads (server: /ess/lead-activity).
 */
export default function LeadActivity({ portal = false }) {
  // Admin panel (role) or Employee Portal (person-wise grant) — shared/crmAccess.js
  const access = useLeadAccess();
  const http = portal ? employeeApi : access.http;
  const endpoint = portal ? '/employee-portal/ess/lead-activity' : `${access.root}/admin/activity/calls`;
  const leadPath = portal ? (id) => `/employee/leads/${id}` : access.leadPath;
  const root = access.root;
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const by = params.get('by') || 'All';
  const result = params.get('result') || 'All';
  const stage = params.get('stage') || 'All';
  const client = params.get('client') || '';
  const [clientInput, setClientInput] = useState(client);
  const dateFrom = params.get('dateFrom') || '';
  const dateTo = params.get('dateTo') || '';
  const page = Math.max(Number(params.get('page')) || 1, 1);

  const update = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries({ page: '', ...changes }).forEach(([k, v]) => {
      if (v && v !== 'All') next.set(k, v); else next.delete(k);
    });
    setParams(next, { replace: true });
  };

  // Client search: applied once typing pauses
  useEffect(() => {
    if (clientInput === client) return undefined;
    const t = setTimeout(() => update({ client: clientInput.trim() }), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientInput]);

  const query = { page, limit: 20, by, result, stage, client: client || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined };
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: [portal ? 'ess' : 'admin', 'call-activity', query],
    queryFn: () => http.get(endpoint, { params: query }).then((r) => r.data),
    placeholderData: keepPreviousData,
  });

  // BD roster for the filter: everyone who logged a call in this range, plus
  // the assignable BD list when the viewer may read it.
  const { data: roster = [] } = useQuery({
    queryKey: ['admin', 'assignable-bds'],
    queryFn: () => http.get(`${root}/admin/assignment/bds`).then((r) => r.data?.data || []),
    retry: false,
    enabled: !portal,
  });
  const perBd = data?.perBd;
  const bdOptions = useMemo(() => {
    const map = new Map();
    (perBd || []).forEach((r) => map.set(String(r.bdId), displayName(r)));
    roster.forEach((bd) => { if (!map.has(String(bd._id))) map.set(String(bd._id), displayName(bd)); });
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [perBd, roster]);

  const activity = data?.data || [];
  const totalPages = data?.totalPages || 1;
  const selectedName = by !== 'All' ? (bdOptions.find(([id]) => id === by)?.[1] || 'Selected BD') : null;
  const activePreset = PRESETS.find((p) => {
    const r = presetRange(p.key);
    return r.dateFrom === dateFrom && r.dateTo === dateTo;
  })?.key;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-app-text font-heading flex items-center gap-2">
          <Activity className="text-primary" size={24} /> Lead Activity
        </h1>
        <p className="text-sm text-app-text-muted mt-1">
          {portal
            ? 'Every call logged on your assigned and shared leads, by whoever made it.'
            : 'Every call logged on your leads, credited to whoever made it. Filter by caller, result, stage, client and date.'}
        </p>
      </div>

      {/* Filters */}
      <div className="bg-app-card p-4 rounded-xl border border-app-border space-y-3">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative min-w-[200px]">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted w-4 h-4 pointer-events-none" />
            <select value={by} onChange={(e) => update({ by: e.target.value })} className={selectClass}>
              <option className="bg-app-bg text-app-text" value="All">{portal ? 'Anyone' : 'All BDs'}</option>
              {bdOptions.map(([id, name]) => (
                <option key={id} className="bg-app-bg text-app-text" value={id}>{name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-app-text-muted w-4 h-4 pointer-events-none" />
          </div>
          <div className="relative min-w-[180px]">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted w-4 h-4 pointer-events-none" />
            <select value={result} onChange={(e) => update({ result: e.target.value })} className={selectClass}>
              <option className="bg-app-bg text-app-text" value="All">All Results</option>
              <option className="bg-app-bg text-app-text" value="Connected">Connected</option>
              <option className="bg-app-bg text-app-text" value="Not Connected">Not Connected</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-app-text-muted w-4 h-4 pointer-events-none" />
          </div>
          <div className="relative min-w-[170px]">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted w-4 h-4 pointer-events-none" />
            <select value={stage} onChange={(e) => update({ stage: e.target.value })} className={selectClass} aria-label="Lead stage">
              <option className="bg-app-bg text-app-text" value="All">All Stages</option>
              {STAGES.map((s) => <option key={s} className="bg-app-bg text-app-text" value={s}>{s}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-app-text-muted w-4 h-4 pointer-events-none" />
          </div>
          <input
            type="search"
            value={clientInput}
            onChange={(e) => setClientInput(e.target.value)}
            placeholder="Client name, phone or lead ID"
            className="min-w-[220px] bg-app-bg border border-app-border rounded-lg px-3 py-2.5 text-sm text-app-text focus:outline-none focus:border-primary"
            aria-label="Client"
          />
          <div className="flex items-center gap-2">
            <input type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => update({ dateFrom: e.target.value })} className={dateClass} aria-label="From date" />
            <span className="text-xs text-app-text-muted">to</span>
            <input type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => update({ dateTo: e.target.value })} className={dateClass} aria-label="To date" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => update(presetRange(p.key))}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${activePreset === p.key ? 'bg-primary text-black border-primary' : 'border-app-border text-app-text hover:border-primary'}`}
            >
              {p.label}
            </button>
          ))}
          {(by !== 'All' || result !== 'All' || stage !== 'All' || client || dateFrom || dateTo) && (
            <button type="button" onClick={() => { setClientInput(''); update({ by: '', result: '', stage: '', client: '', dateFrom: '', dateTo: '' }); }} className="flex items-center gap-1 text-xs text-app-text-muted hover:text-primary cursor-pointer ml-1">
              <X size={12} /> Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Summary: how many calls, to how many leads, and who made them */}
      {data && (
        <div className="bg-app-card p-4 rounded-xl border border-app-border space-y-3">
          <div className="text-sm text-app-text">
            <span className="text-2xl font-extrabold text-primary">{data.total}</span>{' '}
            call{data.total === 1 ? '' : 's'} to <span className="font-bold">{data.leadCount}</span> lead{data.leadCount === 1 ? '' : 's'}
            {selectedName && <> by <span className="font-bold">{selectedName}</span></>}
            {isFetching && <span className="text-xs text-app-text-muted ml-2">updating…</span>}
          </div>
          {perBd?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {perBd.map((r) => {
                const id = String(r.bdId);
                const active = by === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => update({ by: active ? '' : id })}
                    className={`px-3 py-1.5 rounded-lg text-xs border transition-colors cursor-pointer ${active ? 'bg-primary/15 border-primary text-primary' : 'border-app-border text-app-text hover:border-primary'}`}
                    title={`${r.connected} connected · ${r.leads} leads`}
                  >
                    <span className="font-semibold">{displayName(r)}</span> · {r.calls} call{r.calls === 1 ? '' : 's'} · {r.leads} lead{r.leads === 1 ? '' : 's'}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {error && <div className="text-sm text-red-400">{error.response?.data?.message || 'Failed to load call activity'}</div>}

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
        </div>
      ) : (
        <div className="bg-app-card border border-app-border rounded-xl overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[1100px]">
            <thead className="bg-app-bg text-app-text-muted text-xs uppercase tracking-wider border-b border-app-border">
              <tr>
                <th className="px-4 py-3 font-semibold">Calling date / time</th>
                <th className="px-4 py-3 font-semibold">Called by</th>
                <th className="px-4 py-3 font-semibold">Client name</th>
                <th className="px-4 py-3 font-semibold">Call / contact status</th>
                <th className="px-4 py-3 font-semibold">Next action</th>
                <th className="px-4 py-3 font-semibold">Lead stage</th>
                <th className="px-4 py-3 font-semibold text-right">Call duration</th>
                <th className="px-4 py-3 font-semibold">Remark / note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {activity.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-app-text-muted">No calls match these filters.</td>
                </tr>
              ) : (
                activity.map((entry, idx) => (
                  <tr key={`${entry.leadId}-${entry.touchNumber}-${idx}`} className="hover:bg-app-bg transition-colors align-top">
                    <td className="px-4 py-3 text-app-text-muted whitespace-nowrap">
                      {fmtWhen(entry.date)}
                      {entry.touchNumber != null && <div className="text-[11px]">Touch #{entry.touchNumber}{entry.callType ? ` · ${entry.callType}` : ''}</div>}
                    </td>
                    <td className="px-4 py-3 text-app-text font-medium">{displayName(entry.by)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(leadPath(entry.leadId))}
                        className="font-medium text-app-text hover:text-primary hover:underline text-left cursor-pointer"
                      >
                        {entry.leadName || '—'}
                      </button>
                      <div className="text-[11px] text-app-text-muted">{[entry.businessName, entry.leadDisplayId, entry.leadPhone].filter(Boolean).join(' · ')}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider border ${entry.outcome === 'Connected' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                        {entry.outcome}
                      </span>
                      <div className="text-[11px] text-app-text-muted mt-1">{entry.outcomeDetail}</div>
                    </td>
                    <td className="px-4 py-3 text-app-text-muted whitespace-nowrap">
                      {entry.nextAction ? (
                        <>
                          {entry.nextAction.followUpType && (
                            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold border ${FOLLOW_UP_TYPE_BADGE[entry.nextAction.followUpType] || FOLLOW_UP_TYPE_BADGE.Other}`}>{entry.nextAction.followUpType}</span>
                          )}
                          <div className="text-xs mt-0.5">{fmtWhen(entry.nextAction.date)}</div>
                          {entry.nextAction.actionType && <div className="text-[11px]">via {entry.nextAction.actionType}</div>}
                        </>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-app-text-muted">
                      {entry.leadStage || '—'}
                      {entry.currentStage && entry.currentStage !== entry.leadStage && <div className="text-[11px]">now {entry.currentStage}</div>}
                    </td>
                    <td className="px-4 py-3 text-app-text-muted text-right" title={entry.duration ? '' : 'Call timer not used for this call'}>{entry.duration ? `${entry.duration} min` : 'Not timed'}</td>
                    <td className="px-4 py-3 w-[280px] min-w-[220px] max-w-[280px]"><RemarkCell text={entry.remark} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex flex-wrap gap-2 items-center justify-between bg-app-card border border-app-border p-4 rounded-xl">
          <span className="text-sm text-app-text-muted">
            Page <span className="font-bold text-app-text">{page}</span> of <span className="font-bold text-app-text">{totalPages}</span>
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => update({ page: String(Math.max(1, page - 1)) })}
              disabled={page === 1}
              className="p-2 bg-app-bg border border-app-border rounded-lg text-app-text hover:bg-surface-variant disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => update({ page: String(Math.min(totalPages, page + 1)) })}
              disabled={page === totalPages}
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
