import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import Modal from '../../components/ui/Modal';
import { ApprovalBadge } from './PortalUI';
import { essPost, essPut, essKeys, apiError, useActivityTypes, useCorrections } from '../lib/ess';
import { toDateInput, toTimeInput, clockToTimeInput, fmtDate, fmtTime } from '../lib/datetime';

const field = 'w-full text-sm rounded-lg border border-app-border bg-form-input-bg px-3 py-2 text-app-text focus:outline-none focus:border-primary';
const label = 'block text-xs text-app-text-muted mb-1';

const TYPE_LABEL = { Backdated: 'Backdated attendance', MissedClockOut: 'Missed clock-out', Correction: 'Correction', TimeEntry: 'Missing time entry' };

/**
 * Request an attendance regularization or a timesheet correction. Nothing
 * changes until a manager approves it; the original record is kept.
 *   kind="Attendance": initial = { date, clockIn, clockOut } (attendance strings)
 *   kind="Timesheet":  initial = { workLog } to correct one, or {} to add a missing entry
 */
export function CorrectionRequestModal({ kind, initial = {}, onClose }) {
  const queryClient = useQueryClient();
  const { data: activityTypes = [] } = useActivityTypes();
  const log = initial.workLog;
  const [form, setForm] = useState(() => (kind === 'Attendance'
    ? { date: initial.date ? toDateInput(initial.date) : '', clockIn: clockToTimeInput(initial.clockIn), clockOut: clockToTimeInput(initial.clockOut), reason: '' }
    : {
      date: toDateInput(log?.startTime || initial.date || new Date()),
      start: log ? toTimeInput(log.startTime) : '',
      end: log?.endTime ? toTimeInput(log.endTime) : '',
      project: log?.project || '', task: log?.task || '', activityType: log?.activityType || '',
      isProductive: log ? log.isProductive : true, reason: '',
    }));
  const [proof, setProof] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const required = kind === 'Attendance'
      ? [['date', 'date'], ['clockIn', 'check-in'], ['clockOut', 'check-out'], ['reason', 'reason']]
      : [['date', 'date'], ['start', 'start time'], ['end', 'end time'], ['project', 'project'], ['task', 'task'], ['activityType', 'activity type'], ['reason', 'reason']];
    const missing = required.filter(([key]) => !String(form[key] ?? '').trim()).map(([, name]) => name);
    if (missing.length) { setError(`Please add: ${missing.join(', ')}.`); return; }

    setSaving(true);
    try {
      if (kind === 'Attendance') {
        const body = new FormData();
        Object.entries(form).forEach(([k, v]) => body.append(k, v));
        if (proof) body.append('proof', proof);
        await essPost('/corrections/attendance', body, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        await essPost('/corrections/timesheet', {
          workLogId: log?._id,
          startTime: new Date(`${form.date}T${form.start}`).toISOString(),
          endTime: new Date(`${form.date}T${form.end}`).toISOString(),
          project: form.project, task: form.task, activityType: form.activityType,
          isProductive: form.isProductive, reason: form.reason,
        });
      }
      toast.success('Request submitted for manager approval');
      queryClient.invalidateQueries({ queryKey: essKeys.corrections });
      onClose();
    } catch (err) {
      setError(apiError(err, 'Could not submit the request.'));
    } finally {
      setSaving(false);
    }
  };

  const title = kind === 'Attendance' ? 'Attendance Regularization' : log ? 'Correct Time Entry' : 'Add Missing Time Entry';
  return (
    <Modal title={title} subtitle="Goes to your manager for approval — your original record is kept." onClose={onClose}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <div>
          <label className={label}>Date</label>
          <input type="date" max={toDateInput()} value={form.date} onChange={set('date')} className={field} />
        </div>
        {kind === 'Attendance' ? (
          <div className="grid grid-cols-2 gap-3">
            <div><label className={label}>Check-in</label><input type="time" value={form.clockIn} onChange={set('clockIn')} className={field} /></div>
            <div><label className={label}>Check-out</label><input type="time" value={form.clockOut} onChange={set('clockOut')} className={field} /></div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={label}>Start time</label><input type="time" value={form.start} onChange={set('start')} className={field} /></div>
              <div><label className={label}>End time</label><input type="time" value={form.end} onChange={set('end')} className={field} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={label}>Project</label><input value={form.project} onChange={set('project')} className={field} /></div>
              <div><label className={label}>Task</label><input value={form.task} onChange={set('task')} className={field} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <label className={label}>Activity type</label>
                <select value={form.activityType} className={field}
                  onChange={(e) => {
                    const master = activityTypes.find((a) => a.name === e.target.value);
                    setForm((f) => ({ ...f, activityType: e.target.value, isProductive: master ? master.productive : f.isProductive }));
                  }}>
                  <option value="">Select…</option>
                  {activityTypes.map((a) => <option key={a.name} value={a.name}>{a.name}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-app-text pb-2 cursor-pointer">
                <input type="checkbox" checked={form.isProductive} onChange={set('isProductive')} /> Productive
              </label>
            </div>
          </>
        )}
        <div>
          <label className={label}>Reason</label>
          <textarea rows={3} maxLength={500} value={form.reason} onChange={set('reason')} placeholder={kind === 'Attendance' ? 'e.g. Forgot to clock out' : 'e.g. Timer was not started for the client call'} className={`${field} resize-none`} />
        </div>
        {kind === 'Attendance' && (
          <div>
            <label className={label}>Proof (optional — PDF/JPG/PNG, max 5MB)</label>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(e) => setProof(e.target.files?.[0] || null)} className="text-xs text-app-text-muted" />
          </div>
        )}
        {error && <p className="text-xs text-rose-400" role="alert">{error}</p>}
        <button type="submit" disabled={saving} className="w-full py-2.5 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-bold disabled:opacity-50 cursor-pointer">
          {saving ? 'Submitting…' : 'Submit for Approval'}
        </button>
      </form>
    </Modal>
  );
}

const describe = (r) => (r.kind === 'Attendance'
  ? `${r.requested?.clockIn} – ${r.requested?.clockOut}${r.original ? ` (was ${r.original.clockIn || '--'} – ${r.original.clockOut || '--'})` : ''}`
  : `${fmtTime(r.requested?.startTime)} – ${fmtTime(r.requested?.endTime)} · ${r.requested?.task}${r.original ? ` (was ${fmtTime(r.original.startTime)} – ${fmtTime(r.original.endTime)})` : ''}`);

/** My requests of one kind, with status, manager comment and Cancel while pending. */
export function CorrectionRequestList({ kind }) {
  const queryClient = useQueryClient();
  const { data: requests = [] } = useCorrections();
  const [cancelling, setCancelling] = useState(null);
  const mine = requests.filter((r) => r.kind === kind);
  if (!mine.length) return null;

  const cancel = async (r) => {
    if (!window.confirm('Cancel this request?')) return;
    setCancelling(r._id);
    try {
      await essPut(`/corrections/${r._id}/cancel`);
      queryClient.invalidateQueries({ queryKey: essKeys.corrections });
    } catch (err) {
      toast.error(apiError(err, 'Could not cancel the request.'));
    } finally {
      setCancelling(null);
    }
  };

  return (
    <div className="bg-app-card p-6 rounded-xl border border-app-border space-y-4">
      <h2 className="text-lg font-bold">{kind === 'Attendance' ? 'Regularization Requests' : 'Time Correction Requests'}</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-app-border text-xs text-app-text-muted uppercase">
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4">Type</th>
              <th className="py-3 px-4">Requested</th>
              <th className="py-3 px-4">Reason</th>
              <th className="py-3 px-4">Manager Comment</th>
              <th className="py-3 px-4 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-app-border text-sm">
            {mine.map((r) => (
              <tr key={r._id}>
                <td className="py-3 px-4 font-mono whitespace-nowrap">{fmtDate(r.date)}</td>
                <td className="py-3 px-4 whitespace-nowrap">{TYPE_LABEL[r.type] || r.type}</td>
                <td className="py-3 px-4 text-xs">{describe(r)}</td>
                <td className="py-3 px-4 max-w-[200px] truncate" title={r.reason}>{r.reason}</td>
                <td className="py-3 px-4 text-xs text-app-text-muted italic max-w-[200px] truncate" title={r.reviewComment}>{r.reviewComment || '--'}</td>
                <td className="py-3 px-4 text-right whitespace-nowrap">
                  <ApprovalBadge status={r.status} />
                  {r.status === 'Pending' && (
                    <button type="button" onClick={() => cancel(r)} disabled={cancelling === r._id} className="ml-2 text-xs font-semibold text-rose-400 hover:underline disabled:opacity-50 cursor-pointer">
                      Cancel
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
