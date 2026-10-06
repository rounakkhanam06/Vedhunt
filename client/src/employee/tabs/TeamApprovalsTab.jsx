import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import Modal from '../../components/ui/Modal';
import { Spinner, EmptyCard, TabHeader, ApprovalBadge } from '../components/PortalUI';
import { essGet, essPut, essKeys, apiError } from '../lib/ess';
import { fmtDate, fmtTime } from '../lib/datetime';

const LEAVE_LABEL = { CL: 'Casual Leave', SL: 'Sick Leave', PL: 'Paid Leave', EL: 'Emergency Leave' };
const CORRECTION_LABEL = { Backdated: 'Backdated attendance', MissedClockOut: 'Missed clock-out', Correction: 'Correction', TimeEntry: 'Missing time entry' };

const nameOf = (e) => (e ? `${e.firstName} ${e.lastName}` : 'Employee');

/** One pending/decided request row, normalised across leave and corrections. */
function toRows(data) {
  const leave = (data?.leaveRequests || []).map((r) => ({
    id: r._id, kind: 'leave', employee: r.employeeId, status: r.status, createdAt: r.createdAt, reason: r.reason, comment: r.adminComment,
    title: `${LEAVE_LABEL[r.leaveType] || r.leaveType}`,
    detail: `${fmtDate(r.startDate)} – ${fmtDate(r.endDate)}`,
  }));
  const corrections = (data?.corrections || []).map((r) => ({
    id: r._id, kind: 'correction', employee: r.employee, status: r.status, createdAt: r.createdAt, reason: r.reason, comment: r.reviewComment, proofUrl: r.proofUrl,
    title: `${r.kind} · ${CORRECTION_LABEL[r.type] || r.type}`,
    detail: r.kind === 'Attendance'
      ? `${fmtDate(r.date)} · ${r.requested?.clockIn} – ${r.requested?.clockOut}${r.original ? ` (was ${r.original.clockIn || '--'} – ${r.original.clockOut || '--'})` : ''}`
      : `${fmtDate(r.date)} · ${fmtTime(r.requested?.startTime)} – ${fmtTime(r.requested?.endTime)} · ${r.requested?.task}`,
  }));
  return [...leave, ...corrections].sort((a, b) => (a.status === 'Pending') === (b.status === 'Pending')
    ? new Date(b.createdAt) - new Date(a.createdAt)
    : a.status === 'Pending' ? -1 : 1);
}

/** Reporting manager's queue for their direct reports' leave and correction requests. */
export default function TeamApprovalsTab() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: essKeys.team, queryFn: () => essGet('/team') });
  const [action, setAction] = useState(null); // { row, status }
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const rows = toRows(data);
  const pending = rows.filter((r) => r.status === 'Pending');

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const path = action.row.kind === 'leave' ? `/team/leave/${action.row.id}/status` : `/team/corrections/${action.row.id}/status`;
      const res = await essPut(path, { status: action.status, comment });
      toast.success(res.message || `Request ${action.status.toLowerCase()}`);
      setAction(null);
      queryClient.invalidateQueries({ queryKey: essKeys.team });
    } catch (err) {
      toast.error(apiError(err, 'Could not update the request.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <TabHeader
        title="Team Approvals"
        subtitle={`Leave and attendance/timesheet corrections from your ${data?.reports?.length || 0} direct report${data?.reports?.length === 1 ? '' : 's'}. HR can also act on these from the Admin panel.`}
      />
      {isLoading ? <Spinner /> : rows.length === 0 ? <EmptyCard>No requests from your team right now.</EmptyCard> : (
        <div className="bg-app-card rounded-xl border border-app-border overflow-x-auto">
          <div className="px-5 py-3 border-b border-app-border text-sm font-bold">{pending.length} pending</div>
          <table className="w-full text-left min-w-[760px]">
            <thead>
              <tr className="border-b border-app-border text-xs text-app-text-muted uppercase">
                <th className="py-3 px-4">Employee</th><th className="py-3 px-4">Request</th>
                <th className="py-3 px-4">Reason</th><th className="py-3 px-4 text-right">Decision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border text-sm">
              {rows.map((row) => (
                <tr key={`${row.kind}-${row.id}`} className="align-top">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-app-text">{nameOf(row.employee)}</div>
                    <div className="text-xs text-app-text-muted">{row.employee?.employeeId}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-app-text">{row.title}</div>
                    <div className="text-xs text-app-text-muted">{row.detail}</div>
                  </td>
                  <td className="py-3 px-4 max-w-[240px]">
                    <div className="text-xs whitespace-pre-wrap">{row.reason}</div>
                    {row.proofUrl && <a href={row.proofUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">View proof</a>}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    {row.status === 'Pending' ? (
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => { setAction({ row, status: 'Approved' }); setComment(''); }}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded cursor-pointer">Approve</button>
                        <button type="button" onClick={() => { setAction({ row, status: 'Rejected' }); setComment(''); }}
                          className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded cursor-pointer">Reject</button>
                      </div>
                    ) : (
                      <div>
                        <ApprovalBadge status={row.status} />
                        {row.comment && <div className="text-[11px] text-app-text-muted italic mt-1 max-w-[200px] whitespace-normal">{row.comment}</div>}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {action && (
        <Modal title={`${action.status === 'Approved' ? 'Approve' : 'Reject'} request`} subtitle={`${nameOf(action.row.employee)} · ${action.row.title}`} onClose={() => setAction(null)}>
          <form onSubmit={submit} className="space-y-4">
            <p className="text-sm text-app-text">{action.row.detail}</p>
            <div>
              <label className="block text-xs text-app-text-muted mb-1">Comment {action.status === 'Rejected' && action.row.kind === 'correction' ? '(required)' : '(optional)'}</label>
              <textarea rows={3} maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)}
                className="w-full text-sm rounded-lg border border-app-border bg-form-input-bg px-3 py-2 text-app-text resize-none focus:outline-none focus:border-primary" />
            </div>
            <button type="submit" disabled={saving}
              className={`w-full py-2.5 text-white rounded-lg text-sm font-bold disabled:opacity-50 cursor-pointer ${action.status === 'Approved' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}>
              {saving ? 'Saving…' : `Confirm ${action.status}`}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
