import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Filter, ChevronDown, ChevronLeft, ChevronRight, Phone } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

const BUCKET_TABS = ['All', 'Overdue', 'Today', 'Upcoming'];

const BUCKET_BADGE = {
  Overdue: 'bg-red-500/10 text-red-400 border-red-500/20',
  Today: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  Upcoming: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
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
  const navigate = useNavigate();
  const [followUps, setFollowUps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bds, setBds] = useState([]);
  const [bdFilter, setBdFilter] = useState('All');
  const [bucketFilter, setBucketFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchFollowUps = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/activity/followups', {
        params: { page: currentPage, limit: 20, by: bdFilter, bucket: bucketFilter }
      });
      if (response.data.success) {
        setFollowUps(response.data.data);
        setTotalPages(response.data.totalPages);
        setTotal(response.data.total);
      }
    } catch {
      toast.error('Failed to load follow-ups');
    } finally {
      setLoading(false);
    }
  }, [currentPage, bdFilter, bucketFilter]);

  useEffect(() => {
    fetchFollowUps();
  }, [fetchFollowUps]);

  useEffect(() => {
    api.get('/admin/assignment/bds')
      .then((res) => setBds(res.data?.data || []))
      .catch(() => { /* filter just stays empty */ });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-app-text font-heading flex items-center gap-2">
          <Clock className="text-primary" size={24} /> Follow-ups
        </h1>
        <p className="text-sm text-app-text-muted mt-1">Every lead with a scheduled follow-up, across the whole team</p>
      </div>

      {/* Bucket tabs */}
      <div className="flex bg-app-card border border-app-border p-1 rounded-lg w-max">
        {BUCKET_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => { setBucketFilter(tab); setCurrentPage(1); }}
            className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${
              bucketFilter === tab ? 'bg-primary text-black' : 'text-app-text-muted hover:text-app-text'
            }`}
          >
            {tab}
          </button>
        ))}
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
        <div className="bg-primary/10 text-primary px-4 py-2.5 rounded-lg font-bold text-sm whitespace-nowrap text-center sm:ml-auto">
          Total: {total}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
        </div>
      ) : (
        <div className="bg-app-card border border-app-border rounded-xl overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[800px]">
            <thead className="bg-app-bg text-app-text-muted text-xs uppercase tracking-wider border-b border-app-border">
              <tr>
                <th className="px-4 py-3 font-semibold">Lead</th>
                <th className="px-4 py-3 font-semibold">Service</th>
                <th className="px-4 py-3 font-semibold">Assigned BD</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Interest</th>
                <th className="px-4 py-3 font-semibold">Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {followUps.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-app-text-muted">
                    No follow-ups found{bucketFilter !== 'All' ? ` for "${bucketFilter}"` : ''}.
                  </td>
                </tr>
              ) : (
                followUps.map((lead) => (
                  <tr key={lead._id} className="hover:bg-app-bg transition-colors">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/admin/leads?leadId=${lead._id}`)}
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
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex w-fit px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider border ${BUCKET_BADGE[lead.bucket] || 'bg-app-bg text-app-text-muted border-app-border'}`}>
                          {lead.bucket}
                        </span>
                        <span className="text-xs text-app-text-muted">
                          {new Date(lead.nextFollowUpDate).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
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
