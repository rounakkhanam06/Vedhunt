// Shared by the Admin Attendance Register and the employee's "My Attendance"
// (server/services/attendanceRegister.js computes every value shown here).
import { STATUS_CLASS, HOURS_CLASS, rangeFor, ymd, hoursText, bandOf, fmtDay } from './attendanceRegisterUtils';

export function StatusBadge({ status }) {
  return <span className={`px-2 py-0.5 rounded border text-[11px] font-bold whitespace-nowrap ${STATUS_CLASS[status] || STATUS_CLASS.Upcoming}`}>{status}</span>;
}

export function Hours({ minutes, band, inProgress }) {
  if (inProgress) return <span className="text-xs text-app-text-muted italic">In progress</span>;
  if (minutes == null) return <span className="text-app-text-muted">—</span>;
  return <span className={`px-2 py-0.5 rounded font-mono text-xs font-bold whitespace-nowrap ${HOURS_CLASS[band || bandOf(minutes)]}`}>{hoursText(minutes)}</span>;
}

export function HoursLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-[11px] text-app-text-muted">
      <span className="font-semibold uppercase tracking-wider">Working hours:</span>
      <span className={`px-2 py-0.5 rounded font-bold ${HOURS_CLASS.over}`}>More than 8h</span>
      <span className={`px-2 py-0.5 rounded font-bold ${HOURS_CLASS.exact}`}>Exactly 8h</span>
      <span className={`px-2 py-0.5 rounded font-bold ${HOURS_CLASS.under}`}>Less than 8h</span>
    </div>
  );
}

const input = 'bg-app-card border border-app-border rounded-lg px-3 py-2 text-sm text-app-text outline-none focus:border-primary';

/**
 * Daily / Monthly / Custom (From–To) picker.
 * value = { mode, from, to, month }; onChange(next)
 */
export function RangePicker({ value, onChange }) {
  const { mode, from, to, month } = value;
  const setMode = (m) => {
    const mo = month || ymd().slice(0, 7);
    onChange({ mode: m, month: mo, ...rangeFor(m, mo) });
  };
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex rounded-lg border border-app-border overflow-hidden" role="tablist" aria-label="Range">
        {[['daily', 'Daily'], ['monthly', 'Monthly'], ['range', 'From – To']].map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={mode === id} onClick={() => setMode(id)}
            className={`px-3 py-2 text-xs font-bold cursor-pointer ${mode === id ? 'bg-primary text-white' : 'bg-app-card text-app-text-muted hover:text-app-text'}`}>
            {label}
          </button>
        ))}
      </div>
      {mode === 'daily' && (
        <input type="date" aria-label="Date" value={from} onChange={(e) => e.target.value && onChange({ ...value, from: e.target.value, to: e.target.value })} className={input} />
      )}
      {mode === 'monthly' && (
        <input type="month" aria-label="Month" value={month} onChange={(e) => e.target.value && onChange({ ...value, month: e.target.value, ...rangeFor('monthly', e.target.value) })} className={input} />
      )}
      {mode === 'range' && (
        <>
          <label className="text-xs text-app-text-muted">
            <span className="block mb-1">From date</span>
            <input type="date" value={from} max={to || undefined} onChange={(e) => e.target.value && onChange({ ...value, from: e.target.value })} className={input} />
          </label>
          <label className="text-xs text-app-text-muted">
            <span className="block mb-1">To date</span>
            <input type="date" value={to} min={from || undefined} onChange={(e) => e.target.value && onChange({ ...value, to: e.target.value })} className={input} />
          </label>
        </>
      )}
    </div>
  );
}

/** Totals as small stat tiles (one employee's range or month). */
export function TotalsTiles({ t }) {
  const tiles = [
    ['Present', t.present, 'text-emerald-500'],
    ['Half Day', t.halfDay, 'text-amber-500'],
    ['Absent', t.absent, 'text-rose-500'],
    ['Leave', t.leave, 'text-blue-500'],
    ['Holidays', t.holiday, 'text-purple-400'],
    ['Weekly offs', t.weeklyOff, 'text-app-text-muted'],
    ['Late days', t.lateDays, 'text-yellow-500'],
    ['Total hours', hoursText(t.workedMinutes), 'text-app-text'],
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
      {tiles.map(([label, v, cls]) => (
        <div key={label} className="bg-app-card border border-app-border rounded-xl p-3">
          <div className={`text-xl font-bold font-mono ${cls}`}>{v}</div>
          <div className="text-[11px] text-app-text-muted uppercase tracking-wider font-semibold">{label}</div>
        </div>
      ))}
    </div>
  );
}

/** One employee's days: Date, Status, Check-in, Check-out, Working hours, Note. */
export function DayTable({ days }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm min-w-[640px]">
        <thead>
          <tr className="border-b border-app-border text-[11px] text-app-text-muted uppercase">
            <th className="py-2 px-3">Date</th><th className="py-2 px-3">Status</th><th className="py-2 px-3">Check-in</th>
            <th className="py-2 px-3">Check-out</th><th className="py-2 px-3">Working hours</th><th className="py-2 px-3">Note</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-app-border">
          {days.map((d) => (
            <tr key={d.date}>
              <td className="py-2 px-3 whitespace-nowrap font-mono text-xs">{fmtDay(d.date)} <span className="text-app-text-muted">{d.weekday}</span></td>
              <td className="py-2 px-3"><StatusBadge status={d.status} /></td>
              <td className="py-2 px-3 font-mono text-xs whitespace-nowrap">
                {d.checkIn || '—'}
                {d.lateByMins > 0 && <span className="ml-1 text-[10px] text-yellow-500 font-sans">late {d.lateByMins}m</span>}
              </td>
              <td className="py-2 px-3 font-mono text-xs whitespace-nowrap">
                {d.checkOut || (d.missedClockOut ? <span className="text-amber-500 font-sans">Missing</span> : '—')}
              </td>
              <td className="py-2 px-3"><Hours minutes={d.workedMinutes} band={d.hoursBand} inProgress={d.inProgress} /></td>
              <td className="py-2 px-3 text-xs text-app-text-muted">{d.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Per-month summary rows for one employee. */
export function MonthTable({ months }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm min-w-[720px]">
        <thead>
          <tr className="border-b border-app-border text-[11px] text-app-text-muted uppercase">
            <th className="py-2 px-3">Month</th><th className="py-2 px-3">Working days</th><th className="py-2 px-3">Present</th>
            <th className="py-2 px-3">Half Day</th><th className="py-2 px-3">Absent</th><th className="py-2 px-3">Leave</th>
            <th className="py-2 px-3">Late</th><th className="py-2 px-3">Total hours</th><th className="py-2 px-3">Avg / day</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-app-border">
          {months.map((m) => (
            <tr key={m.month}>
              <td className="py-2 px-3 font-semibold whitespace-nowrap">{m.label}</td>
              <td className="py-2 px-3 font-mono">{m.workingDays}</td>
              <td className="py-2 px-3 font-mono text-emerald-500">{m.present}</td>
              <td className="py-2 px-3 font-mono text-amber-500">{m.halfDay}</td>
              <td className="py-2 px-3 font-mono text-rose-500">{m.absent}</td>
              <td className="py-2 px-3 font-mono text-blue-500">{m.leave}</td>
              <td className="py-2 px-3 font-mono">{m.lateDays}</td>
              <td className="py-2 px-3 font-mono">{hoursText(m.workedMinutes)}</td>
              <td className="py-2 px-3"><Hours minutes={m.avgMinutes} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
