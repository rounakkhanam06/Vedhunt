import { useState } from 'react';
import toast from 'react-hot-toast';
import { X, Loader2, Trash2 } from 'lucide-react';
import { clockToTimeInput } from '../../employee/lib/datetime';
import { fmtDay } from '../../shared/attendanceRegisterUtils';

const STATUSES = ['Present', 'Absent', 'Leave', 'Holiday', 'Weekend'];
const DEFAULT_REASON = 'Migrated from manual attendance register';

// Register statuses → the status options above
const toEditStatus = (s) =>
  ({ 'Half Day': 'Present', 'Weekly Off': 'Weekend', 'Not clocked in': 'Absent', Upcoming: 'Absent' }[s] || (STATUSES.includes(s) ? s : 'Present'));

/**
 * Admin manual attendance entry for one employee and one day (any past date).
 * `day` is a row from the Attendance Register; `employee` is { _id, name }.
 */
export default function EditAttendanceModal({ http, root, employee, day, onClose, onSaved }) {
  const hadRecord = Boolean(day.checkIn) || ['Leave', 'Holiday', 'Weekly Off'].includes(day.status) || day.manualEntry;
  const [status, setStatus] = useState(toEditStatus(day.status));
  const [clockIn, setClockIn] = useState(clockToTimeInput(day.checkIn) || '');
  const [clockOut, setClockOut] = useState(clockToTimeInput(day.checkOut) || '');
  const [reason, setReason] = useState(DEFAULT_REASON);
  const [busy, setBusy] = useState(null); // 'save' | 'remove'

  const url = `${root}/employees/admin/attendance/${employee._id}/day`;

  const save = async (e) => {
    e.preventDefault();
    setBusy('save');
    try {
      const body = { date: day.date, status, reason };
      if (status === 'Present') Object.assign(body, { clockIn, clockOut });
      const res = await http.put(url, body);
      toast.success(res.data?.message || 'Attendance saved');
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save attendance');
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Remove the attendance record for ${employee.name} on ${fmtDay(day.date)}?`)) return;
    setBusy('remove');
    try {
      const res = await http.delete(url, { params: { date: day.date, reason } });
      toast.success(res.data?.message || 'Attendance removed');
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not remove attendance');
    } finally {
      setBusy(null);
    }
  };

  const input =
    'w-full bg-form-input-bg border border-app-border rounded-lg px-3 py-2 text-sm text-app-text focus:outline-none focus:border-primary';
  const label = 'block text-xs font-semibold text-app-text-muted mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <form
        onSubmit={save}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-app-card border border-app-border rounded-xl shadow-2xl p-5 space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-app-text">{hadRecord ? 'Edit attendance' : 'Add attendance'}</h3>
            <p className="text-sm text-app-text-muted">
              {employee.name} · {fmtDay(day.date)} {day.weekday}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-app-text-muted hover:text-app-text cursor-pointer" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div>
          <label className={label}>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={input}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {status === 'Leave' && (
            <p className="text-[11px] text-app-text-muted mt-1">
              Marks the day as leave only — it does not deduct from the employee's leave balance.
            </p>
          )}
        </div>

        {status === 'Present' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Check-in *</label>
              <input type="time" required value={clockIn} onChange={(e) => setClockIn(e.target.value)} className={input} />
            </div>
            <div>
              <label className={label}>Check-out</label>
              <input type="time" value={clockOut} onChange={(e) => setClockOut(e.target.value)} className={input} />
            </div>
          </div>
        )}

        <div>
          <label className={label}>Reason *</label>
          <input required minLength={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} className={input} />
          <p className="text-[11px] text-app-text-muted mt-1">Saved in the audit log along with the previous values.</p>
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          {hadRecord ? (
            <button
              type="button"
              onClick={remove}
              disabled={Boolean(busy)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-500/10 disabled:opacity-50 cursor-pointer"
            >
              {busy === 'remove' ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Remove record
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-app-border text-sm text-app-text cursor-pointer">
              Cancel
            </button>
            <button
              type="submit"
              disabled={Boolean(busy)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#FF6B00] hover:bg-[#e66000] text-white text-sm font-semibold disabled:opacity-50 cursor-pointer"
            >
              {busy === 'save' && <Loader2 size={14} className="animate-spin" />} Save
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
