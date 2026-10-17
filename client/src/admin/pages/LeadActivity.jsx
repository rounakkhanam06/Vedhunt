import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Activity, Filter, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useLeadAccess } from '../../shared/crmAccess';
import RemarkCell from '../../components/common/RemarkCell';

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
 * Every call any BD logged (from each lead's call log, credited to whoever
 * made the call), filterable by BD, result and date. Filters live in the URL
 * so the Management Dashboard's "Calls Made" links straight to one BD's calls.
 */
export default function LeadActivity() {
  // Admin panel (role) or Employee Portal (person-wise grant) — shared/crmAccess.js
  const { http, root, leadPath } = useLeadAccess();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const by = params.get('by') || 'All';
  const result = params.get('result') || 'All';
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

  const query = { page, limit: 20, by, result, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined };
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['admin', 'call-activity', query],
    queryFn: () => http.get(`${root}/admin/activity/calls`, { params: query }).then((r) => r.data),
    placeholderData: keepPreviousData,
  });

  // BD roster for the filter: everyone who logged a call in this range, plus
  // the assignable BD list when the viewer may read it.
  const { data: roster = [] } = useQuery({
    queryKey: ['admin', 'assignable-bds'],
    queryFn: () => http.get(`${root}/admin/assignment/bds`).then((r) => r.data?.data || []),
    retry: false,
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
        <p className="text-sm text-app-text-muted mt-1">Every call your BD team logged, credited to whoever made it. Pick a BD and a date range to see exactly which leads they called.</p>
      </div>

      {/* Filters */}
      <div className="bg-app-card p-4 rounded-xl border border-app-border space-y-3">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative min-w-[200px]">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted w-4 h-4 pointer-events-none" />
            <select value={by} onChange={(e) => update({ by: e.target.value })} className={selectClass}>
              <option className="bg-app-bg text-app-text" value="All">All BDs</option>
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
          {(by !== 'All' || result !== 'All' || dateFrom || dateTo) && (
            <button type="button" onClick={() => setParams({}, { replace: true })} className="flex items-center gap-1 text-xs text-app-text-muted hover:text-primary cursor-pointer ml-1">
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
          <table className="w-full text-left text-sm min-w-[980px]">
            <thead className="bg-app-bg text-app-text-muted text-xs uppercase tracking-wider border-b border-app-border">
              <tr>
                <th className="px-4 py-3 font-semibold">When</th>
                <th className="px-4 py-3 font-semibold">Called by</th>
                <th className="px-4 py-3 font-semibold">Lead</th>
                <th className="px-4 py-3 font-semibold">Result</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Stage after</th>
                <th className="px-4 py-3 font-semibold text-right">Duration</th>
                <th className="px-4 py-3 font-semibold">Remark</th>
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
                      {entry.touchNumber != null && <div className="text-[11px]">Touch #{entry.touchNumber}</div>}
                    </td>
                    <td className="px-4 py-3 text-app-text font-medium">{displayName(entry.by)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(leadPath(entry.leadId))}
                        className="font-medium text-app-text hover:text-primary hover:underline text-left cursor-pointer"
                      >
                        {entry.leadName || '—'}
                      </button>
                      <div className="text-[11px] text-app-text-muted">{[entry.leadDisplayId, entry.leadPhone].filter(Boolean).join(' · ')}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider border ${entry.connected === 'Yes' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                        {entry.connected === 'Yes' ? 'Connected' : 'Not connected'}
                      </span>
                      <div className="text-[11px] text-app-text-muted mt-1">{entry.connected === 'Yes' ? entry.interestLevel : entry.notConnectedReason}</div>
                    </td>
                    <td className="px-4 py-3 text-app-text-muted">{entry.callType || 'Call'}</td>
                    <td className="px-4 py-3 text-app-text-muted">{entry.leadStage || '—'}</td>
                    <td className="px-4 py-3 text-app-text-muted text-right">{entry.duration ? `${entry.duration} min` : '—'}</td>
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
