import { useState } from 'react';
import { Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../../components/ui/Modal';
import { CorrectionRequestModal, CorrectionRequestList } from '../components/CorrectionRequests';
import { essPost, essPut, apiError, useEssLeave } from '../lib/ess';
import { toDateInput } from '../lib/datetime';
import { formatDuration } from '../../utils/formatDuration';

const LEAVE_TYPES = [
  { value: 'CL', label: 'Casual Leave (CL)' },
  { value: 'SL', label: 'Sick Leave (SL)' },
  { value: 'PL', label: 'Paid Leave (PL)' },
];

const STATUS_CLASS = {
  Present: 'bg-emerald-500/10 text-emerald-400',
  Leave: 'bg-blue-500/10 text-blue-400',
  Weekend: 'bg-purple-500/10 text-purple-400',
  Holiday: 'bg-teal-500/10 text-teal-400',
};

/** Leave balances, leave requests, attendance log and attendance regularization. */
export default function AttendanceTab({ employee }) {
  const { data: leave, refetch: refetchLeave } = useEssLeave();
  const leaveRequests = leave?.leaveRequests || [];
  const leaveBalances = leave?.leaveBalances || { CL: 0, SL: 0, PL: 0 };
  const leavesUsed = leave?.leavesUsed || { CL: 0, SL: 0, PL: 0 };
  const leavesPending = leave?.leavesPending || {};
  // Days the employee can still apply for = allowance − used − held by pending requests
  const availableLeave = (type) => Math.max(0, (leaveBalances[type] || 0) - (leavesUsed[type] || 0) - (leavesPending[type] || 0));

  const onProbation = employee.employmentStatus === 'Probation' && employee.probation?.isApplicable;
  const availableLeaveTypes = onProbation ? [{ value: 'EL', label: 'Emergency Leave (EL)' }] : LEAVE_TYPES;

  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ leaveType: 'CL', startDate: '', endDate: '', reason: '' });
  const [cancellingLeaveId, setCancellingLeaveId] = useState(null);
  const [regularize, setRegularize] = useState(null); // initial values for the regularization modal

  const openLeaveModal = () => {
    setLeaveForm((f) => ({ ...f, leaveType: availableLeaveTypes.some((lt) => lt.value === f.leaveType) ? f.leaveType : availableLeaveTypes[0].value }));
    setShowLeaveModal(true);
  };

  const handleRequestLeave = async (e) => {
    e.preventDefault();
    try {
      const res = await essPost('/leave-requests', leaveForm);
      toast.success(res.message);
      setShowLeaveModal(false);
      setLeaveForm((f) => ({ ...f, startDate: '', endDate: '', reason: '' }));
      refetchLeave();
    } catch (error) {
      toast.error(apiError(error, 'Failed to submit leave request.'));
    }
  };

  const handleCancelLeave = async (req) => {
    if (!window.confirm(`Cancel your ${req.leaveType} request for ${new Date(req.startDate).toLocaleDateString()} – ${new Date(req.endDate).toLocaleDateString()}?`)) return;
    setCancellingLeaveId(req._id);
    try {
      const res = await essPut(`/leave-requests/${req._id}/cancel`);
      toast.success(res.message || 'Leave request cancelled.');
      refetchLeave();
    } catch (error) {
      toast.error(apiError(error, 'Could not cancel the request.'));
    } finally {
      setCancellingLeaveId(null);
    }
  };

  const attendance = [...(employee.attendance || [])].sort((a, b) => new Date(b.date) - new Date(a.date));
  const today = toDateInput();

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-app-text">Leave Balances (Per {leave?.leaveBalancePeriod || 'Year'})</h2>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {onProbation ? (
          <div className="bg-app-card p-4 rounded-xl border border-blue-500/20 flex flex-col justify-between items-center text-center">
            <div className="text-blue-400 text-xs font-bold uppercase">Emergency Leave (EL)</div>
            <div className="text-2xl font-black text-blue-500 font-mono mt-2">
              {availableLeave('EL')} <span className="text-sm text-blue-400/60 font-normal">/ {leaveBalances.EL || 0}</span>
            </div>
          </div>
        ) : LEAVE_TYPES.map((lt) => (
          <div key={lt.value} className="bg-app-card p-4 rounded-xl border border-app-border flex flex-col justify-between items-center text-center">
            <div className="text-app-text-muted text-xs font-bold uppercase">{lt.label}</div>
            <div className="text-2xl font-black text-primary font-mono mt-2">
              {availableLeave(lt.value)} <span className="text-sm text-app-text-muted font-normal">/ {leaveBalances[lt.value] || 0}</span>
            </div>
          </div>
        ))}
        <div className="bg-app-card p-4 rounded-xl border border-app-border flex flex-col gap-2 items-stretch justify-center">
          <button onClick={openLeaveModal} className="w-full py-2.5 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-bold transition-all cursor-pointer shadow-lg">
            Request Leave
          </button>
          <button onClick={() => setRegularize({})} className="w-full py-2.5 border border-app-border hover:border-primary/40 text-app-text rounded-lg text-sm font-bold transition-all cursor-pointer">
            Regularize Attendance
          </button>
        </div>
      </div>

      <div className="bg-app-card p-6 rounded-xl border border-app-border space-y-6">
        <div className="flex justify-between items-center border-b border-app-border pb-4">
          <h2 className="text-xl font-bold">My Leave Requests</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-app-border text-xs text-app-text-muted uppercase">
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Start Date</th>
                <th className="py-3 px-4">End Date</th>
                <th className="py-3 px-4">Reason</th>
                <th className="py-3 px-4">Vedhunt Comment</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm">
              {leaveRequests.map((req) => (
                <tr key={req._id} className="hover:bg-white/[0.01]">
                  <td className="py-3 px-4 font-bold">{req.leaveType || 'PL'}</td>
                  <td className="py-3 px-4 font-mono">{new Date(req.startDate).toLocaleDateString()}</td>
                  <td className="py-3 px-4 font-mono">{new Date(req.endDate).toLocaleDateString()}</td>
                  <td className="py-3 px-4 max-w-[200px] truncate" title={req.reason}>{req.reason}</td>
                  <td className="py-3 px-4 text-app-text-muted text-xs italic max-w-[200px] truncate">{req.adminComment || '--'}</td>
                  <td className="py-3 px-4 text-right">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                      req.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-400' :
                      req.status === 'Rejected' ? 'bg-rose-500/10 text-rose-400' :
                      req.status === 'Cancelled' ? 'bg-gray-500/10 text-app-text-muted' :
                      'bg-primary/10 text-primary'
                    }`}>
                      {req.status}
                    </span>
                    {req.status === 'Pending' && (
                      <button type="button" onClick={() => handleCancelLeave(req)} disabled={cancellingLeaveId === req._id}
                        className="ml-2 text-xs font-semibold text-rose-400 hover:underline disabled:opacity-50 cursor-pointer">
                        {cancellingLeaveId === req._id ? 'Cancelling…' : 'Cancel'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {leaveRequests.length === 0 && (
                <tr><td colSpan="6" className="text-center py-6 text-app-text-muted">No leave requests submitted yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CorrectionRequestList kind="Attendance" />

      <div className="bg-app-card p-6 rounded-xl border border-app-border space-y-6">
        <div className="flex justify-between items-center border-b border-app-border pb-4">
          <h2 className="text-xl font-bold">Attendance Log</h2>
          <div className="text-sm text-app-text-muted">Total days present: {attendance.filter((a) => a.status === 'Present').length}</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-app-border text-xs text-app-text-muted uppercase">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Clock In</th>
                <th className="py-3 px-4">Clock Out</th>
                <th className="py-3 px-4 text-right">Status</th>
                <th className="py-3 px-4 text-right">Correction</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm">
              {attendance.map((log) => {
                const isToday = toDateInput(log.date) === today;
                const canRegularize = log.status !== 'Leave' && !(isToday && !log.clockOut);
                return (
                  <tr key={log._id || log.date} className="hover:bg-white/[0.01]">
                    <td className="py-3 px-4">{new Date(log.date).toLocaleDateString()}</td>
                    <td className="py-3 px-4 font-mono text-app-text">
                      {log.clockIn || '--'}
                      {log.lateByMins > 0 && (
                        <span className="ml-2 text-[10px] bg-rose-500/10 text-rose-500 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider inline-flex items-center gap-1 border border-rose-500/20">
                          Late by {formatDuration(log.lateByMins)}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-app-text">
                      {log.clockOut || '--'}
                      {log.missedClockOut && !log.clockOut && (
                        <span className="ml-2 text-[10px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider border border-amber-500/20">
                          Clock-out missing
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`px-2 py-0.5 rounded text-xs ${STATUS_CLASS[log.status] || 'bg-rose-500/10 text-rose-400'}`}>{log.status}</span>
                      {log.regularized && <span className="ml-1.5 text-[10px] font-bold uppercase text-blue-400">Regularized</span>}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {canRegularize && (
                        <button type="button" onClick={() => setRegularize({ date: log.date, clockIn: log.clockIn, clockOut: log.clockOut })}
                          className={`text-xs font-semibold hover:underline cursor-pointer ${log.missedClockOut && !log.clockOut ? 'text-amber-500' : 'text-primary'}`}>
                          {log.missedClockOut && !log.clockOut ? 'Add clock-out' : 'Request correction'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {attendance.length === 0 && (
                <tr><td colSpan="5" className="text-center py-6 text-app-text-muted">No attendance entries recorded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {regularize && <CorrectionRequestModal kind="Attendance" initial={regularize} onClose={() => setRegularize(null)} />}

      {showLeaveModal && (
        <Modal title="Submit Leave Request" onClose={() => setShowLeaveModal(false)}>
          {onProbation && (
            <div className="mb-4 flex items-start gap-2 text-xs text-blue-400 bg-blue-500/5 border border-blue-500/15 rounded-lg p-3">
              <Clock size={13} className="flex-shrink-0 mt-0.5" />
              <span>You are on probation — only <strong>Emergency Leave (EL)</strong> is available. Remaining: <strong>{availableLeave('EL')}</strong></span>
            </div>
          )}
          <form onSubmit={handleRequestLeave} className="space-y-4">
            <div>
              <label className="block text-xs text-app-text-muted mb-1">Leave Type</label>
              <select value={leaveForm.leaveType} onChange={(e) => setLeaveForm((f) => ({ ...f, leaveType: e.target.value }))}
                className="w-full text-sm rounded-lg border border-app-border bg-form-input-bg px-4 py-2 text-app-text outline-none focus:border-primary">
                {availableLeaveTypes.map((lt) => <option key={lt.value} value={lt.value}>{lt.label}</option>)}
              </select>
              <p className={`text-xs mt-1 ${availableLeave(leaveForm.leaveType) === 0 ? 'text-rose-400' : 'text-app-text-muted'}`}>
                Available: <strong>{availableLeave(leaveForm.leaveType)}</strong> day{availableLeave(leaveForm.leaveType) === 1 ? '' : 's'}
                {leavesPending[leaveForm.leaveType] ? ` (${leavesPending[leaveForm.leaveType]} pending approval)` : ''} · Sundays and holidays are not counted
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-app-text-muted mb-1">Start Date</label>
                <input type="date" required min={today} value={leaveForm.startDate} onChange={(e) => setLeaveForm((f) => ({ ...f, startDate: e.target.value }))}
                  className="w-full text-sm rounded-lg border border-app-border bg-form-input-bg px-4 py-2 text-app-text" />
              </div>
              <div>
                <label className="block text-xs text-app-text-muted mb-1">End Date</label>
                <input type="date" required min={leaveForm.startDate || today} value={leaveForm.endDate} onChange={(e) => setLeaveForm((f) => ({ ...f, endDate: e.target.value }))}
                  className="w-full text-sm rounded-lg border border-app-border bg-form-input-bg px-4 py-2 text-app-text" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-app-text-muted mb-1">Reason for Leave</label>
              <textarea required rows={3} placeholder="Please provide a brief reason..." value={leaveForm.reason} onChange={(e) => setLeaveForm((f) => ({ ...f, reason: e.target.value }))}
                className="w-full text-sm rounded-lg border border-app-border bg-form-input-bg px-4 py-2 text-app-text resize-none" />
            </div>
            <button type="submit" className="w-full py-2.5 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-bold transition-all cursor-pointer">
              Submit Request
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
