import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../services/api';
import Modal from '../../components/ui/Modal';

const TYPE_LABEL = { Backdated: 'Backdated attendance', MissedClockOut: 'Missed clock-out', Correction: 'Correction', TimeEntry: 'Missing time entry' };
const STATUS_CLASS = {
  Approved: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  Rejected: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
  Cancelled: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  Pending: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
};
const fmtDay = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const fmtTime = (d) => (d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--');

function RequestDetails({ r }) {
  if (r.kind === 'Attendance') {
    return (
      <div className="text-xs space-y-0.5">
        <div><span className="text-app-text-muted">Requested:</span> <span className="font-semibold">{r.requested?.clockIn} – {r.requested?.clockOut}</span></div>
        <div className="text-app-text-muted">System record: {r.original ? `${r.original.clockIn || '--'} – ${r.original.clockOut || '--'} (${r.original.status})` : 'none (no attendance that day)'}</div>
      </div>
    );
  }
  const q = r.requested || {};
  return (
    <div className="text-xs space-y-0.5">
      <div><span className="text-app-text-muted">Requested:</span> <span className="font-semibold">{fmtTime(q.startTime)} – {fmtTime(q.endTime)}</span> · {q.project} / {q.task} · {q.activityType} · {q.isProductive ? 'Productive' : 'Non-productive'}</div>
      <div className="text-app-text-muted">
        System record: {r.original ? `${fmtTime(r.original.startTime)} – ${fmtTime(r.original.endTime)} · ${r.original.task} · ${r.original.activityType}` : 'none (new entry)'}
      </div>
    </div>
  );
}

/** HRMS → Correction Requests: approve/reject attendance regularizations and timesheet corrections. */
export default function CorrectionRequestsManager() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('Pending');
  const [kind, setKind] = useState('All');
  const [action, setAction] = useState(null); // { request, status }
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['admin', 'corrections', status, kind],
    queryFn: () => api.get('/corrections', { params: { status: status === 'All' ? undefined : status, kind: kind === 'All' ? undefined : kind } }).then((r) => r.data.requests || []),
  });

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.put(`/corrections/${action.request._id}/status`, { status: action.status, comment });
      toast.success(res.data.message);
      setAction(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'corrections'] });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update the request.');
    } finally {
      setSaving(false);
    }
  };

  const select = 'bg-app-card border border-app-border rounded-lg px-3 py-2 text-sm text-app-text';
  return (
    <div className="p-6 text-app-text space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 border-b border-app-border pb-4">
        <div>
          <h1 className="text-2xl font-bold">Correction Requests</h1>
          <p className="text-sm text-app-text-muted mt-1">Attendance regularization and timesheet corrections. Approved requests become the official record; the original stays in the request and audit log.</p>
        </div>
        <div className="flex gap-2">
          <select value={kind} onChange={(e) => setKind(e.target.value)} className={select} aria-label="Type">
            <option value="All">All types</option><option value="Attendance">Attendance</option><option value="Timesheet">Timesheet</option>
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={select} aria-label="Status">
            {['Pending', 'Approved', 'Rejected', 'Cancelled', 'All'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-app-card rounded-xl border border-app-border overflow-x-auto">
        <table className="w-full text-left min-w-[900px]">
          <thead>
            <tr className="border-b border-app-border text-xs text-app-text-muted uppercase">
              <th className="py-3 px-4">Employee</th><th className="py-3 px-4">Date</th><th className="py-3 px-4">Type</th>
              <th className="py-3 px-4">Details</th><th className="py-3 px-4">Reason</th><th className="py-3 px-4 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-app-border text-sm">
            {isLoading && <tr><td colSpan="6" className="text-center py-8 text-app-text-muted">Loading…</td></tr>}
            {!isLoading && requests.length === 0 && <tr><td colSpan="6" className="text-center py-8 text-app-text-muted">No requests found.</td></tr>}
            {requests.map((r) => (
              <tr key={r._id} className="align-top">
                <td className="py-3 px-4">
                  <div className="font-bold">{r.employee?.firstName} {r.employee?.lastName}</div>
                  <div className="text-xs text-app-text-muted">{r.employee?.employeeId} · {r.employee?.roleDept}</div>
                </td>
                <td className="py-3 px-4 font-mono whitespace-nowrap">{fmtDay(r.date)}</td>
                <td className="py-3 px-4 whitespace-nowrap">{r.kind}<div className="text-xs text-app-text-muted">{TYPE_LABEL[r.type]}</div></td>
                <td className="py-3 px-4"><RequestDetails r={r} /></td>
                <td className="py-3 px-4 max-w-[220px]">
                  <div className="text-xs whitespace-pre-wrap">{r.reason}</div>
                  {r.proofUrl && <a href={r.proofUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">View proof</a>}
                </td>
                <td className="py-3 px-4 text-right whitespace-nowrap">
                  {r.status === 'Pending' ? (
                    <div className="flex justify-end gap-2">
                      <button onClick={() => { setAction({ request: r, status: 'Approved' }); setComment(''); }} className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded cursor-pointer">Approve</button>
                      <button onClick={() => { setAction({ request: r, status: 'Rejected' }); setComment(''); }} className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded cursor-pointer">Reject</button>
                    </div>
                  ) : (
                    <div>
                      <span className={`px-2 py-0.5 rounded text-xs font-bold border ${STATUS_CLASS[r.status]}`}>{r.status}</span>
                      {r.reviewedBy && <div className="text-[11px] text-app-text-muted mt-1">by {r.reviewedBy.firstName} {r.reviewedBy.lastName}{r.reviewedAt ? ` · ${fmtDay(r.reviewedAt)}` : ''}</div>}
                      {r.reviewComment && <div className="text-[11px] text-app-text-muted italic max-w-[200px] whitespace-normal">{r.reviewComment}</div>}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {action && (
        <Modal title={`${action.status === 'Approved' ? 'Approve' : 'Reject'} request`} subtitle={`${action.request.employee?.firstName} ${action.request.employee?.lastName} · ${fmtDay(action.request.date)}`} onClose={() => setAction(null)}>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-xs text-app-text-muted mb-1">Comment {action.status === 'Rejected' ? '(required)' : '(optional)'}</label>
              <textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500}
                className="w-full text-sm rounded-lg border border-app-border bg-app-bg px-4 py-2 text-app-text resize-none outline-none focus:border-primary" />
            </div>
            <button type="submit" disabled={saving || (action.status === 'Rejected' && !comment.trim())}
              className={`w-full py-2.5 text-white rounded-lg text-sm font-bold cursor-pointer disabled:opacity-50 ${action.status === 'Approved' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}>
              {saving ? 'Saving…' : `Confirm ${action.status}`}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
