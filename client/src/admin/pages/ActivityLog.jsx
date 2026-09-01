import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';
import { ShieldCheck, Search, ChevronLeft, ChevronRight, Activity, Calendar, History, Smartphone, Globe, ChevronDown, ChevronUp } from 'lucide-react';

export default function ActivityLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [expandedRows, setExpandedRows] = useState({});

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
          search: debouncedSearch
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
  }, [currentPage, debouncedSearch]);

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
    } catch (e) {
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
        <div className="flex items-center justify-between mb-4">
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
