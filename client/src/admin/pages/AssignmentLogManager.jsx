import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { UserCheck, Search, ChevronLeft, ChevronRight, Calendar, User, ArrowRight, Tag, HelpCircle, LayoutList } from 'lucide-react';
import { useSearchParams, Link } from 'react-router-dom';

export default function AssignmentLogManager() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [bds, setBds] = useState([]);
  
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Filters
  const [userIdFilter, setUserIdFilter] = useState('All');
  const [leadIdFilter, setLeadIdFilter] = useState('');
  const [debouncedLeadId, setDebouncedLeadId] = useState('');

  // Fetch BD roster for the user filter
  useEffect(() => {
    api.get('/admin/assignment/bds')
      .then((res) => setBds(res.data?.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedLeadId(leadIdFilter);
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [leadIdFilter]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/leads/assignments/all', {
        params: {
          page: currentPage,
          limit: 15,
          userId: userIdFilter,
          leadId: debouncedLeadId
        }
      });
      if (response.data.success) {
        setLogs(response.data.data);
        setTotalPages(response.data.totalPages);
      }
    } catch (error) {
      console.error('Error fetching assignment logs:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, userIdFilter, debouncedLeadId]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const displayName = (user) => {
    if (!user) return 'System / Unassigned';
    const name = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    return name || 'Unknown User';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-app-text flex items-center gap-2">
          <UserCheck className="w-6 h-6 text-primary" />
          Lead Assignment Logs
        </h1>
        <p className="text-sm text-app-text-muted">
          Complete trail of all lead assignments, reassignments, and ownership changes.
        </p>
      </div>

      <div className="bg-app-card border border-app-border rounded-xl p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted w-4 h-4" />
            <input
              type="text"
              placeholder="Filter by Lead ID (e.g. L-1002)..."
              value={leadIdFilter}
              onChange={(e) => setLeadIdFilter(e.target.value)}
              className="w-full bg-app-bg border border-app-border rounded-lg pl-9 pr-4 py-2 text-sm text-app-text focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <select
            value={userIdFilter}
            onChange={(e) => {
              setUserIdFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-app-bg border border-app-border rounded-lg px-3 py-2 text-sm text-app-text focus:outline-none focus:border-primary transition-colors min-w-[200px]"
          >
            <option value="All">All Users</option>
            {bds.map(bd => (
              <option key={bd._id} value={bd._id}>{displayName(bd)}</option>
            ))}
          </select>
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
                  <th className="px-4 py-3 font-semibold">Date/Time</th>
                  <th className="px-4 py-3 font-semibold">Lead ID</th>
                  <th className="px-4 py-3 font-semibold">Change</th>
                  <th className="px-4 py-3 font-semibold">Assigned By</th>
                  <th className="px-4 py-3 font-semibold">Mode</th>
                  <th className="px-4 py-3 font-semibold max-w-[200px]">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border/70 text-[13px]">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-4 py-12 text-center text-app-text-muted">
                      No assignment logs found.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log._id} className="hover:bg-app-bg/50 transition-colors">
                      <td className="px-4 py-3 text-app-text">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-app-text-muted opacity-50" />
                          {new Date(log.createdAt).toLocaleString('en-IN', {
                            day: '2-digit', month: 'short', year: 'numeric',
                            hour: '2-digit', minute: '2-digit', hour12: true
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-primary">
                        {log.lead ? (
                          <Link to={`/admin/leads?search=${log.lead.leadId}`} className="hover:underline flex items-center gap-1.5">
                            <Tag className="w-3.5 h-3.5" />
                            {log.lead.leadId || 'Unknown'}
                          </Link>
                        ) : (
                          <span className="text-red-400">Deleted Lead</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-app-text">
                          <span className="px-2 py-1 rounded bg-slate-500/10 text-slate-400 border border-slate-500/20 text-xs">
                            {displayName(log.fromAdmin)}
                          </span>
                          <ArrowRight className="w-3 h-3 text-app-text-muted" />
                          <span className="px-2 py-1 rounded bg-primary/10 text-primary border border-primary/20 text-xs font-medium">
                            {displayName(log.toAdmin)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-app-text flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-app-text-muted opacity-50" />
                        {displayName(log.assignedBy)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${
                          log.mode === 'Auto-RoundRobin' 
                            ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                            : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        }`}>
                          <LayoutList className="w-3 h-3" />
                          {log.mode}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-app-text-muted max-w-[200px] truncate" title={log.reason || '-'}>
                        <div className="flex items-center gap-1.5">
                          <HelpCircle className="w-3.5 h-3.5 opacity-50 flex-shrink-0" />
                          <span className="truncate">{log.reason || '-'}</span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 px-2">
            <div className="text-sm text-app-text-muted">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex items-center gap-1">
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
