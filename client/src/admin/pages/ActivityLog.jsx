import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';
import { ShieldCheck, Search, ChevronLeft, ChevronRight, Activity, Calendar, History, Globe, ChevronDown, ChevronUp, UserX } from 'lucide-react';

const inputClass = 'bg-app-bg border border-app-border rounded-lg px-3 py-2 text-sm text-app-text focus:outline-none focus:border-primary transition-colors';

const todayInput = () => {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

/** Employees with no attendance clock-in on one day (panel login does not count). */
function NotClockedIn({ employees }) {
  const [date, setDate] = useState(todayInput);
  const [employeeId, setEmployeeId] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api.get('/audit/not-clocked-in', { params: { date, employeeId: employeeId || undefined } });
        if (live && res.data.success) setReport(res.data.data);
      } catch (err) {
        if (live) setError(err.response?.data?.message || 'Could not load the clock-in report.');
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => { live = false; };
  }, [date, employeeId]);

  const rows = (list, fallbackLabel) => list.map((e) => (
    <tr key={e._id} className="hover:bg-app-bg/50 transition-colors">
      <td className="px-4 py-3 font-medium text-app-text">{e.name}</td>
      <td className="px-4 py-3 text-app-text-muted">{e.employeeId}</td>
      <td className="px-4 py-3 text-app-text-muted">{e.department || '-'}</td>
      <td className="px-4 py-3 text-app-text-muted">{e.designation || '-'}</td>
      <td className="px-4 py-3">
        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium border ${e.reason ? 'bg-slate-500/10 text-slate-400 border-slate-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
          {e.reason || fallbackLabel}
        </span>
      </td>
    </tr>
  ));

  const head = (
    <thead className="bg-app-bg border-b border-app-border text-app-text-muted text-[11px] uppercase tracking-wider">
      <tr>
        <th className="px-4 py-3 font-semibold">Employee</th>
        <th className="px-4 py-3 font-semibold">ID</th>
        <th className="px-4 py-3 font-semibold">Department</th>
        <th className="px-4 py-3 font-semibold">Designation</th>
        <th className="px-4 py-3 font-semibold">Status</th>
      </tr>
    </thead>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input type="date" value={date} max={todayInput()} onChange={(e) => e.target.value && setDate(e.target.value)} className={inputClass} />
        <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={inputClass}>
          <option value="">All employees</option>
          {employees.map((e) => <option key={e._id} value={e._id}>{e.name}</option>)}
        </select>
        <p className="text-xs text-app-text-muted">Based on the attendance clock-in for the selected day (IST). Logging in to the panel does not count.</p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {loading ? (
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
        </div>
      ) : report && (
        <>
          <p className="text-sm text-app-text">
            <strong className="text-red-400">{report.missing.length}</strong> not clocked in
            <span className="text-app-text-muted"> · {report.clockedIn} clocked in · {report.excused.length} excused</span>
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              {head}
              <tbody className="divide-y divide-app-border/70 text-[13px]">
                {report.missing.length === 0
                  ? <tr><td colSpan="5" className="px-4 py-10 text-center text-app-text-muted">Everyone expected has clocked in.</td></tr>
                  : rows(report.missing, 'Not clocked in')}
              </tbody>
            </table>
          </div>
          {report.excused.length > 0 && (
            <div className="overflow-x-auto">
              <h3 className="text-xs font-semibold text-app-text-muted uppercase tracking-wider mb-2">Not expected to clock in</h3>
              <table className="w-full text-left text-sm whitespace-nowrap">
                {head}
                <tbody className="divide-y divide-app-border/70 text-[13px]">{rows(report.excused)}</tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function ActivityLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [expandedRows, setExpandedRows] = useState({});
  const [view, setView] = useState('log');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    api.get('/audit/employees')
      .then((res) => res.data.success && setEmployees(res.data.data))
      .catch((error) => console.error('Error fetching employees:', error));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/audit', {
        params: {
          page: currentPage,
          limit: 15,
          search: debouncedSearch,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          adminId: employees.find((e) => e._id === employeeFilter)?.adminId || undefined
        }
      });
      if (response.data.success) {
        setLogs(response.data.data);
        setTotalPages(response.data.totalPages);
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, debouncedSearch, dateFrom, dateTo, employeeFilter, employees]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const toggleRow = (id) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const formatSnapshot = (snapshot) => {
    if (!snapshot) return 'null';
    try {
      return JSON.stringify(snapshot, null, 2);
    } catch {
      return String(snapshot);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-app-text flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-primary" />
          System Activity & Audit Logs
        </h1>
        <p className="text-sm text-app-text-muted">
          Immutable record of system activities, value changes, and access attempts.
        </p>
      </div>

      <div className="bg-app-card border border-app-border rounded-xl p-4 shadow-sm">
        <div className="flex gap-2 mb-4">
          {[{ key: 'log', label: 'Activity log', icon: Activity }, { key: 'clockin', label: 'Not clocked in', icon: UserX }].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors cursor-pointer ${view === key ? 'bg-primary/10 text-primary border-primary/30' : 'border-app-border text-app-text-muted hover:text-app-text'}`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        {view === 'clockin' ? <NotClockedIn employees={employees} /> : (<>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted w-4 h-4" />
            <input
              type="text"
              placeholder="Search by action, resource, IP..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-app-bg border border-app-border rounded-lg pl-9 pr-4 py-2 text-sm text-app-text focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <label className="flex items-center gap-1.5 text-xs text-app-text-muted">From
            <input type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }} className={inputClass} />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-app-text-muted">To
            <input type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }} className={inputClass} />
          </label>
          <select value={employeeFilter} onChange={(e) => { setEmployeeFilter(e.target.value); setCurrentPage(1); }} className={inputClass}>
            <option value="">All employees</option>
            {employees.map((e) => <option key={e._id} value={e._id}>{e.name}</option>)}
          </select>
          {(dateFrom || dateTo || employeeFilter) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); setEmployeeFilter(''); setCurrentPage(1); }} className="text-xs text-primary hover:underline cursor-pointer">Clear filters</button>
          )}
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
                  <th className="px-4 py-3 font-semibold w-10"></th>
                  <th className="px-4 py-3 font-semibold">Date/Time</th>
                  <th className="px-4 py-3 font-semibold">User</th>
                  <th className="px-4 py-3 font-semibold">Action</th>
                  <th className="px-4 py-3 font-semibold">Resource</th>
                  <th className="px-4 py-3 font-semibold">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border/70 text-[13px]">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-4 py-12 text-center text-app-text-muted">
                      No logs found.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => {
                    const isExpanded = expandedRows[log._id];
                    return (
                      <React.Fragment key={log._id}>
                        <tr 
                          onClick={() => toggleRow(log._id)}
                          className="hover:bg-app-bg/50 transition-colors cursor-pointer group"
                        >
                          <td className="px-4 py-3 text-app-text-muted">
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </td>
                          <td className="px-4 py-3 text-app-text">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-3.5 h-3.5 text-app-text-muted opacity-50" />
                              {new Date(log.createdAt).toLocaleString('en-IN', {
                                day: '2-digit', month: 'short', year: 'numeric',
                                hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
                              })}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-medium text-app-text">
                            {log.adminId ? `${log.adminId.firstName || ''} ${log.adminId.lastName || ''}`.trim() || log.adminId.email : 'System'}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                              {log.action}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-app-text">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
                              <Activity className="w-3 h-3" />
                              {log.resource}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-app-text-muted">
                            <div className="flex items-center gap-1.5">
                              <Globe className="w-3 h-3 opacity-50" />
                              {log.ipAddress || '-'}
                            </div>
                          </td>
                        </tr>
                        
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.tr
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="bg-app-bg/30"
                            >
                              <td colSpan="6" className="px-4 py-4 border-b border-app-border/50">
                                <div className="grid grid-cols-2 gap-6 max-w-5xl mx-auto px-8">
                                  <div>
                                    <h4 className="text-xs font-semibold text-app-text-muted uppercase tracking-wider mb-2 flex items-center gap-2">
                                      <History className="w-3.5 h-3.5" /> Before
                                    </h4>
                                    <pre className="bg-app-card border border-red-500/20 rounded-lg p-3 overflow-x-auto text-xs text-red-400/80 font-mono whitespace-pre-wrap max-h-60 overflow-y-auto">
                                      {formatSnapshot(log.beforeSnapshot)}
                                    </pre>
                                  </div>
                                  <div>
                                    <h4 className="text-xs font-semibold text-app-text-muted uppercase tracking-wider mb-2 flex items-center gap-2">
                                      <Activity className="w-3.5 h-3.5" /> After
                                    </h4>
                                    <pre className="bg-app-card border border-emerald-500/20 rounded-lg p-3 overflow-x-auto text-xs text-emerald-400/80 font-mono whitespace-pre-wrap max-h-60 overflow-y-auto">
                                      {formatSnapshot(log.afterSnapshot)}
                                    </pre>
                                  </div>
                                </div>
                              </td>
                            </motion.tr>
                          )}
                        </AnimatePresence>
                      </React.Fragment>
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
        </>)}
      </div>
    </div>
  );
}
