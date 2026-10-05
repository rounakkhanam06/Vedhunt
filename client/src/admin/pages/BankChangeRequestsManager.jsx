import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Landmark, Check, X, RefreshCw } from 'lucide-react';
import api from '../../services/api';

// HR approval queue for employees' salary-account changes. Nothing changes on
// the employee record until a request is approved here.

const TABS = ['Pending', 'Approved', 'Rejected', 'Cancelled'];
const FIELDS = [
  ['accountName', 'Holder'],
  ['bankName', 'Bank'],
  ['accountNumber', 'Account'],
  ['ifscCode', 'IFSC'],
];

const BADGE = {
  Pending: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  Approved: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  Rejected: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
  Cancelled: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
};

const Details = ({ d, compareTo }) => (
  <div className="space-y-0.5 text-xs">
    {FIELDS.map(([k, label]) => {
      const changed = compareTo && String(d?.[k] || '').toLowerCase() !== String(compareTo?.[k] || '').toLowerCase();
      return (
        <div key={k} className="flex gap-2">
          <span className="text-app-text-muted w-14 shrink-0">{label}</span>
          <span className={`${k === 'accountNumber' || k === 'ifscCode' ? 'font-mono' : ''} ${changed ? 'text-amber-500 font-semibold' : 'text-app-text'}`}>
            {d?.[k] || '—'}
          </span>
        </div>
      );
    })}
  </div>
);

export default function BankChangeRequestsManager() {
  const [tab, setTab] = useState('Pending');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [review, setReview] = useState(null); // { request, status }
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/employees/admin/bank-change-requests', { params: { status: tab } });
      setRequests(res.data.requests || []);
    } catch {
      toast.error('Failed to load bank change requests');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const submitReview = async () => {
    if (review.status === 'Rejected' && !comment.trim()) return toast.error('Please give a reason for rejecting.');
    setSaving(true);
    try {
      const res = await api.put(`/employees/admin/bank-change-requests/${review.request._id}/status`, { status: review.status, comment: comment.trim() });
      toast.success(res.data.message);
      setReview(null);
      setComment('');
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Action failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-app-text flex items-center gap-2"><Landmark size={22} className="text-primary" /> Bank Change Requests</h1>
          <p className="text-app-text-muted text-sm mt-1">Employees&apos; salary-account changes apply only after approval here.</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-app-border text-app-text-muted hover:text-app-text text-sm cursor-pointer">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Request status">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border cursor-pointer ${tab === t ? 'bg-primary/10 text-primary border-primary/30' : 'border-app-border text-app-text-muted hover:text-app-text'}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="bg-app-card border border-app-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><div className="w-7 h-7 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>
        ) : requests.length === 0 ? (
          <p className="text-center text-app-text-muted text-sm py-12">No {tab.toLowerCase()} requests.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-app-border text-xs uppercase text-app-text-muted">
                <tr>
                  <th className="text-left px-4 py-3">Employee</th>
                  <th className="text-left px-4 py-3">Current (on file)</th>
                  <th className="text-left px-4 py-3">Requested</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {requests.map((r) => (
                  <tr key={r._id} className="align-top">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-app-text">{r.employee?.name || '—'}</p>
                      <p className="text-xs text-app-text-muted font-mono">{r.employee?.employeeId}</p>
                      <p className="text-xs text-app-text-muted mt-1">Requested {new Date(r.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                    </td>
                    <td className="px-4 py-3"><Details d={r.previous} /></td>
                    <td className="px-4 py-3"><Details d={r.requested} compareTo={r.previous} /></td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold border ${BADGE[r.status]}`}>{r.status}</span>
                      {r.reviewedBy && <p className="text-xs text-app-text-muted mt-1">by {r.reviewedBy}{r.reviewedAt ? `, ${new Date(r.reviewedAt).toLocaleDateString()}` : ''}</p>}
                      {r.reviewComment && <p className="text-xs text-app-text-muted mt-1 italic max-w-[220px]">&ldquo;{r.reviewComment}&rdquo;</p>}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {r.status === 'Pending' && (
                        <div className="flex justify-end gap-2">
                          <button onClick={() => { setReview({ request: r, status: 'Approved' }); setComment(''); }}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 cursor-pointer">
                            <Check size={13} /> Approve
                          </button>
                          <button onClick={() => { setReview({ request: r, status: 'Rejected' }); setComment(''); }}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 cursor-pointer">
                            <X size={13} /> Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {review && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div role="dialog" aria-modal="true" aria-labelledby="bank-review-title" className="w-full max-w-md bg-app-card border border-app-border rounded-2xl shadow-2xl">
            <div className="px-5 py-4 border-b border-app-border">
              <h3 id="bank-review-title" className="font-bold text-app-text">{review.status === 'Approved' ? 'Approve bank change' : 'Reject bank change'}</h3>
              <p className="text-xs text-app-text-muted mt-1">{review.request.employee?.name} ({review.request.employee?.employeeId})</p>
            </div>
            <div className="p-5 space-y-4">
              {review.status === 'Approved' && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-app-text">
                  Future salary payments will go to <strong>{review.request.requested.bankName}</strong>, account{' '}
                  <span className="font-mono">{review.request.requested.accountNumber}</span> ({review.request.requested.ifscCode}).
                  Verify with the employee if anything looks unusual.
                </div>
              )}
              <div>
                <label htmlFor="bank-review-comment" className="block text-xs text-app-text-muted mb-1">
                  {review.status === 'Rejected' ? 'Reason (shown to the employee) *' : 'Note (optional)'}
                </label>
                <textarea id="bank-review-comment" rows={3} maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)}
                  className="w-full bg-app-bg border border-app-border rounded-lg px-3 py-2 text-sm text-app-text focus:outline-none focus:border-primary resize-none" />
              </div>
            </div>
            <div className="px-5 py-3 border-t border-app-border flex justify-end gap-2">
              <button onClick={() => setReview(null)} className="px-4 py-2 rounded-lg border border-app-border text-app-text-muted text-sm cursor-pointer">Cancel</button>
              <button onClick={submitReview} disabled={saving}
                className={`px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50 cursor-pointer ${review.status === 'Approved' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}>
                {saving ? 'Saving…' : review.status === 'Approved' ? 'Approve' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
