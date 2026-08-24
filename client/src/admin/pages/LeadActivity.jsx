import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Filter, ChevronDown, ChevronLeft, ChevronRight, Phone } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

const RESULT_BADGE = {
  'Call connected': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'Call not connected': 'bg-red-500/10 text-red-400 border-red-500/20'
};

function resultLabel(entry) {
  if (entry.status === 'Call connected') return 'Connected';
  return entry.note || 'Not Connected';
}

// firstName/lastName aren't guaranteed on every Admin account (the original
// legacy seed account predates those fields being required) — fall back
// gracefully instead of rendering "undefined undefined".
function displayName(person) {
  if (!person) return '-';
  const name = [person.firstName, person.lastName].filter(Boolean).join(' ').trim();
  return name || person.email || 'Unknown';
}

export default function LeadActivity() {
  const navigate = useNavigate();
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bds, setBds] = useState([]);
  const [bdFilter, setBdFilter] = useState('All');
  const [resultFilter, setResultFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchActivity = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/activity/calls', {
        params: { page: currentPage, limit: 20, by: bdFilter, result: resultFilter }
      });
      if (response.data.success) {
        setActivity(response.data.data);
        setTotalPages(response.data.totalPages);
        setTotal(response.data.total);
      }
    } catch {
      toast.error('Failed to load call activity');
    } finally {
      setLoading(false);
    }
  }, [currentPage, bdFilter, resultFilter]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  useEffect(() => {
    api.get('/admin/assignment/bds')
      .then((res) => setBds(res.data?.data || []))
      .catch(() => { /* filter just stays empty */ });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-app-text font-heading flex items-center gap-2">
          <Activity className="text-primary" size={24} /> Lead Activity
        </h1>
        <p className="text-sm text-app-text-muted mt-1">Every call outcome logged by your BD team, across all leads</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 bg-app-card p-4 rounded-xl border border-app-border">
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
        <div className="relative min-w-[180px]">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted w-4 h-4 pointer-events-none" />
          <select
            value={resultFilter}
            onChange={(e) => { setResultFilter(e.target.value); setCurrentPage(1); }}
            className="w-full bg-app-bg border border-app-border rounded-lg pl-10 pr-10 py-2.5 text-sm text-app-text focus:outline-none focus:border-primary transition-colors appearance-none cursor-pointer"
          >
            <option className="bg-app-bg text-app-text" value="All">All Results</option>
            <option className="bg-app-bg text-app-text" value="Connected">Connected</option>
            <option className="bg-app-bg text-app-text" value="Not Connected">Not Connected</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-app-text-muted w-4 h-4 pointer-events-none" />
        </div>
        <div className="bg-primary/10 text-primary px-4 py-2.5 rounded-lg font-bold text-sm whitespace-nowrap text-center sm:ml-auto">
          Total Calls: {total}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
        </div>
      ) : (
        <div className="bg-app-card border border-app-border rounded-xl overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[700px]">
            <thead className="bg-app-bg text-app-text-muted text-xs uppercase tracking-wider border-b border-app-border">
              <tr>
                <th className="px-4 py-3 font-semibold">Lead</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Result</th>
                <th className="px-4 py-3 font-semibold">By</th>
                <th className="px-4 py-3 font-semibold">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {activity.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-app-text-muted">
                    No call activity yet.
                  </td>
                </tr>
              ) : (
                activity.map((entry, idx) => (
                  <tr key={`${entry.leadId}-${entry.date}-${idx}`} className="hover:bg-app-bg transition-colors">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/admin/leads?leadId=${entry.leadId}`)}
                        className="font-medium text-app-text hover:text-primary hover:underline text-left"
                      >
                        {entry.leadName}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-app-text-muted">
                      <span className="inline-flex items-center gap-1.5">
                        <Phone size={12} /> Call
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider border ${RESULT_BADGE[entry.status] || 'bg-app-bg text-app-text-muted border-app-border'}`}>
                        {resultLabel(entry)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-app-text">
                      {displayName(entry.by)}
                    </td>
                    <td className="px-4 py-3 text-app-text-muted">
                      {new Date(entry.date).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-app-card border border-app-border p-4 rounded-xl">
          <span className="text-sm text-app-text-muted">
            Page <span className="font-bold text-app-text">{currentPage}</span> of <span className="font-bold text-app-text">{totalPages}</span>
          </span>
          <div className="flex items-center gap-2">
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
