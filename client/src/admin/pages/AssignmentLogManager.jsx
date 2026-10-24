import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { UserCheck, Search, ChevronLeft, ChevronRight, Calendar, User, ArrowRight, Tag, HelpCircle, Layers, X } from 'lucide-react';
import { Link } from 'react-router-dom';

// Matches ASSIGNMENT_EVENTS in server/controllers/leadController.js
const EVENTS = [
  { key: 'assigned', label: 'Assigned' },
  { key: 'reassigned', label: 'Reassigned' },
  { key: 'unassigned', label: 'Unassigned' },
  { key: 'cross-assigned', label: 'Cross-assigned' },
  { key: 'access-removed', label: 'Access removed' },
];

const EVENT_BADGE = {
  Assigned: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Reassigned: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  Unassigned: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  'Cross-assigned': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  'Access removed': 'bg-red-500/10 text-red-400 border-red-500/20',
};

const ROLES = [
  { key: 'any', label: 'in any role' },
  { key: 'from', label: 'as previous owner / removed' },
  { key: 'to', label: 'as new owner / collaborator' },
  { key: 'actor', label: 'as the one who made the change' },
];

const toDateInput = (d) => {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};
const PRESETS = [
  { key: 'today', label: 'Today', range: () => ({ dateFrom: toDateInput(new Date()), dateTo: toDateInput(new Date()) }) },
  { key: '7d', label: 'Last 7 days', range: () => ({ dateFrom: toDateInput(new Date(Date.now() - 6 * 864e5)), dateTo: toDateInput(new Date()) }) },
  { key: 'month', label: 'This month', range: () => { const t = new Date(); return { dateFrom: toDateInput(new Date(t.getFullYear(), t.getMonth(), 1)), dateTo: toDateInput(t) }; } },
  { key: 'all', label: 'All time', range: () => ({ dateFrom: '', dateTo: '' }) },
];

const inputClass = 'bg-app-bg border border-app-border rounded-lg px-3 py-2 text-sm text-app-text focus:outline-none focus:border-primary transition-colors';

const displayName = (user, empty = '—') => {
  if (!user) return empty;
  const name = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  return name || user.name || user.email || 'Unknown User';
};

/** Who the change was from / to, worded for its kind of event. */
function changeSides(log) {
  if (log.event === 'Cross-assigned') return { from: null, to: displayName(log.toAdmin), toLabel: 'Collaborator' };
  if (log.event === 'Access removed') return { from: displayName(log.fromAdmin), fromLabel: 'Removed', to: null };
  return { from: displayName(log.fromAdmin, 'Unassigned'), to: displayName(log.toAdmin, 'Unassigned') };
}

export default function AssignmentLogManager() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const [bds, setBds] = useState([]);

  // Filters
  const [employee, setEmployee] = useState('All');
  const [role, setRole] = useState('any');
  const [event, setEvent] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [leadFilter, setLeadFilter] = useState('');
  const [debouncedLead, setDebouncedLead] = useState('');

  // Employee roster for the filter
  useEffect(() => {
    api.get('/admin/assignment/bds')
      .then((res) => setBds(res.data?.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedLead(leadFilter.trim());
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [leadFilter]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/leads/assignments/all', {
        params: {
          page: currentPage,
          limit: 15,
          employee,
          role: employee !== 'All' ? role : undefined,
          event: event !== 'All' ? event : undefined,
          lead: debouncedLead || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        }
      });
      if (response.data.success) {
        setLogs(response.data.data);
        setTotalPages(response.data.totalPages);
        setTotalLogs(response.data.totalLogs);
      }
    } catch (error) {
      console.error('Error fetching assignment logs:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, employee, role, event, debouncedLead, dateFrom, dateTo]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const set = (setter) => (value) => { setter(value); setCurrentPage(1); };
  const activePreset = PRESETS.find((p) => { const r = p.range(); return r.dateFrom === dateFrom && r.dateTo === dateTo; })?.key;
  const filtered = employee !== 'All' || event !== 'All' || dateFrom || dateTo || leadFilter;
  const clearAll = () => {
    setEmployee('All'); setRole('any'); setEvent('All'); setDateFrom(''); setDateTo(''); setLeadFilter(''); setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-app-text flex items-center gap-2">
          <UserCheck className="w-6 h-6 text-primary" />
          Lead Assignment Logs
        </h1>
        <p className="text-sm text-app-text-muted">
          Every assignment, reassignment, cross-assignment and removal of access — who it moved from and to, who did it, when, and why.
        </p>
      </div>

      <div className="bg-app-card border border-app-border rounded-xl p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted w-4 h-4" />
            <input
              type="text"
              placeholder="Lead ID or name…"
              value={leadFilter}
              onChange={(e) => setLeadFilter(e.target.value)}
              className={`${inputClass} w-full pl-9`}
            />
          </div>

          <select value={employee} onChange={(e) => set(setEmployee)(e.target.value)} className={`${inputClass} min-w-[180px]`} aria-label="Employee">
            <option value="All">All employees</option>
            {bds.map((bd) => <option key={bd._id} value={bd._id}>{displayName(bd)}</option>)}
          </select>
          {employee !== 'All' && (
            <select value={role} onChange={(e) => set(setRole)(e.target.value)} className={inputClass} aria-label="Employee's role in the change">
              {ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
          )}

          <select value={event} onChange={(e) => set(setEvent)(e.target.value)} className={inputClass} aria-label="Event">
            <option value="All">All events</option>
            {EVENTS.map((ev) => <option key={ev.key} value={ev.key}>{ev.label}</option>)}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <input type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => set(setDateFrom)(e.target.value)} className={inputClass} aria-label="From date" style={{ colorScheme: 'dark' }} />
          <span className="text-xs text-app-text-muted">to</span>
          <input type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => set(setDateTo)(e.target.value)} className={inputClass} aria-label="To date" style={{ colorScheme: 'dark' }} />
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => { const r = p.range(); setDateFrom(r.dateFrom); setDateTo(r.dateTo); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${activePreset === p.key ? 'bg-primary text-black border-primary' : 'border-app-border text-app-text hover:border-primary'}`}
            >
              {p.label}
            </button>
          ))}
          {filtered && (
            <button type="button" onClick={clearAll} className="flex items-center gap-1 text-xs text-app-text-muted hover:text-primary cursor-pointer ml-1">
              <X size={12} /> Clear filters
            </button>
          )}
          <span className="ml-auto text-sm text-app-text-muted"><span className="font-bold text-app-text">{totalLogs}</span> entr{totalLogs === 1 ? 'y' : 'ies'}</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-app-bg border-b border-app-border text-app-text-muted text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 font-semibold">Date / time</th>
                  <th className="px-4 py-3 font-semibold">Lead</th>
                  <th className="px-4 py-3 font-semibold">Event</th>
                  <th className="px-4 py-3 font-semibold">Change</th>
                  <th className="px-4 py-3 font-semibold">By</th>
                  <th className="px-4 py-3 font-semibold max-w-[220px]">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border/70 text-[13px]">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-4 py-12 text-center text-app-text-muted">
                      No assignment logs found{filtered ? ' for these filters' : ''}.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => {
                    const sides = changeSides(log);
                    return (
                      <tr key={log._id} className="hover:bg-app-bg/50 transition-colors align-top">
                        <td className="px-4 py-3 text-app-text">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-app-text-muted opacity-50" />
                            {new Date(log.createdAt).toLocaleString('en-IN', {
                              day: '2-digit', month: 'short', year: 'numeric',
                              hour: '2-digit', minute: '2-digit', hour12: true
                            })}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {log.lead ? (
                            <Link to={`/admin/leads/${log.lead._id}`} className="hover:underline">
                              <span className="font-mono font-semibold text-primary flex items-center gap-1.5"><Tag className="w-3.5 h-3.5" />{log.lead.leadId || 'Lead'}</span>
                              <span className="block text-[11px] text-app-text-muted">{log.lead.fullName}</span>
                            </Link>
                          ) : (
                            <span className="text-red-400">Deleted lead</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold border ${EVENT_BADGE[log.event] || EVENT_BADGE.Unassigned}`}>{log.event}</span>
                          {log.bulkRun && <div className="text-[11px] text-app-text-muted mt-1 flex items-center gap-1"><Layers className="w-3 h-3" /> Bulk reassignment</div>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 text-app-text">
                            {sides.from && (
                              <span className="px-2 py-1 rounded bg-slate-500/10 text-slate-400 border border-slate-500/20 text-xs">
                                {sides.fromLabel && <span className="opacity-70">{sides.fromLabel}: </span>}{sides.from}
                              </span>
                            )}
                            {sides.from && sides.to && <ArrowRight className="w-3 h-3 text-app-text-muted" />}
                            {sides.to && (
                              <span className="px-2 py-1 rounded bg-primary/10 text-primary border border-primary/20 text-xs font-medium">
                                {sides.toLabel && <span className="opacity-70">{sides.toLabel}: </span>}{sides.to}
                              </span>
                            )}
                          </div>
                          {log.leadOwner && <div className="text-[11px] text-app-text-muted mt-1">Owner: {displayName(log.leadOwner)} (unchanged)</div>}
                        </td>
                        <td className="px-4 py-3 text-app-text">
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-app-text-muted opacity-50" />
                            {log.mode === 'Auto-RoundRobin' ? 'Round-robin (automatic)' : displayName(log.assignedBy, 'System')}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-app-text-muted max-w-[220px] truncate" title={log.reason || ''}>
                          <div className="flex items-center gap-1.5">
                            <HelpCircle className="w-3.5 h-3.5 opacity-50 flex-shrink-0" />
                            <span className="truncate">{log.reason || '—'}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex flex-wrap gap-2 items-center justify-between mt-4 px-2">
            <div className="text-sm text-app-text-muted">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-app-border text-app-text-muted hover:text-app-text hover:bg-app-border/30 disabled:opacity-50 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-app-border text-app-text-muted hover:text-app-text hover:bg-app-border/30 disabled:opacity-50 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
