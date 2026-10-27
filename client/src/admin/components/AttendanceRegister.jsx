import { Fragment, useEffect, useMemo, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ChevronDown, ChevronRight, Download } from 'lucide-react';
import { RangePicker, StatusBadge, Hours, HoursLegend, DayTable, MonthTable } from '../../shared/attendanceRegister';
import { rangeFor, ymd, STATUSES, fmtDay, hoursText, downloadBlob } from '../../shared/attendanceRegisterUtils';

const PAGE = 200;

/**
 * HRMS → Attendance → Register: every employee's date-wise attendance for a day, a month or any
 * From–To range, with an employee summary, a monthly summary and an Excel export.
 * Limited to the employees in the person's scope by the server.
 */
export default function AttendanceRegister({ http, root }) {
  const [range, setRange] = useState(() => ({ mode: 'monthly', month: ymd().slice(0, 7), ...rangeFor('monthly') }));
  const [view, setView] = useState('summary'); // summary | datewise | monthly
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('All');
  const [open, setOpen] = useState(() => new Set());
  const [page, setPage] = useState(0);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const params = { from: range.from, to: range.to, search: query || undefined };
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'attendance-register', range.from, range.to, query],
    queryFn: () => http.get(`${root}/employees/admin/attendance/register`, { params }).then((r) => r.data),
    enabled: Boolean(range.from && range.to && range.from <= range.to),
    placeholderData: keepPreviousData,
  });
  const employees = useMemo(() => data?.employees || [], [data]);
  const singleDay = range.from === range.to;

  // A single day reads best as one row per employee
  const shownView = singleDay && view === 'summary' ? 'datewise' : view;

  const flat = useMemo(() => employees.flatMap((e) => e.days
    .filter((d) => status === 'All' || d.status === status)
    .map((d) => ({ ...d, emp: e }))), [employees, status]);
  const pages = Math.max(1, Math.ceil(flat.length / PAGE));
  const current = Math.min(page, pages - 1); // a new range or filter can leave fewer pages
  const visible = flat.slice(current * PAGE, current * PAGE + PAGE);

  const totals = useMemo(() => employees.reduce((t, e) => {
    for (const k of ['present', 'halfDay', 'absent', 'leave', 'lateDays']) t[k] += e.summary[k];
    return t;
  }, { present: 0, halfDay: 0, absent: 0, leave: 0, lateDays: 0 }), [employees]);

  const toggle = (id) => setOpen((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const exportExcel = async () => {
    setExporting(true);
    try {
      await downloadBlob(http.get(`${root}/employees/admin/attendance/register/export`, { params, responseType: 'blob' }), `attendance-register_${range.from}_to_${range.to}.xlsx`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setExporting(false);
    }
  };

  const select = 'bg-app-card border border-app-border rounded-lg px-3 py-2 text-sm text-app-text';
  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-app-text">Attendance Register</h1>
          <p className="text-sm text-app-text-muted mt-1">
            Date-wise status, check-in / check-out and working hours for {singleDay ? fmtDay(range.from) : `${fmtDay(range.from)} – ${fmtDay(range.to)}`}.
          </p>
        </div>
        <button type="button" onClick={exportExcel} disabled={exporting || !employees.length}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg disabled:opacity-50 cursor-pointer">
          <Download size={16} /> {exporting ? 'Preparing…' : 'Export Excel'}
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <RangePicker value={range} onChange={setRange} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employee name or ID" aria-label="Search employee" className={`${select} w-56`} />
        {shownView === 'datewise' && (
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }} className={select} aria-label="Status">
            <option value="All">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg border border-app-border overflow-hidden" role="tablist" aria-label="View">
          {[['summary', 'Employee summary'], ['datewise', 'Date-wise'], ['monthly', 'Monthly summary']].map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={shownView === id} onClick={() => setView(id)}
              className={`px-3 py-2 text-xs font-bold cursor-pointer ${shownView === id ? 'bg-primary/15 text-primary' : 'bg-app-card text-app-text-muted hover:text-app-text'}`}>
              {label}
            </button>
          ))}
        </div>
        <HoursLegend />
      </div>

      {employees.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-full bg-app-card border border-app-border">{employees.length} employees</span>
          <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500">Present {totals.present}</span>
          <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500">Half Day {totals.halfDay}</span>
          <span className="px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-500">Absent {totals.absent}</span>
          <span className="px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-500">Leave {totals.leave}</span>
          <span className="px-2.5 py-1 rounded-full bg-yellow-500/10 text-yellow-500">Late {totals.lateDays}</span>
        </div>
      )}

      <div className="bg-app-card border border-app-border rounded-xl overflow-hidden">
        {isLoading && <p className="p-8 text-center text-app-text-muted">Loading register…</p>}
        {error && <p className="p-8 text-center text-rose-400">{error.response?.data?.message || 'Could not load the register.'}</p>}
        {!isLoading && !error && employees.length === 0 && <p className="p-8 text-center text-app-text-muted">No employees found.</p>}

        {!isLoading && employees.length > 0 && shownView === 'summary' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[900px]">
              <thead className="bg-app-bg text-[11px] uppercase text-app-text-muted border-b border-app-border">
                <tr>
                  <th className="px-4 py-3">Employee</th><th className="px-3 py-3">Working days</th><th className="px-3 py-3">Present</th>
                  <th className="px-3 py-3">Half Day</th><th className="px-3 py-3">Absent</th><th className="px-3 py-3">Leave</th>
                  <th className="px-3 py-3">Late</th><th className="px-3 py-3">Missed out</th><th className="px-3 py-3">Total hours</th><th className="px-3 py-3">Avg / day</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {employees.map((e) => (
                  <Fragment key={e._id}>
                    <tr className="hover:bg-app-bg/50 cursor-pointer" onClick={() => toggle(e._id)}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {open.has(e._id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          <div>
                            <div className="font-bold text-app-text">{e.name}</div>
                            <div className="text-xs text-app-text-muted">{e.employeeId}{e.department ? ` · ${e.department}` : ''}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 font-mono">{e.summary.workingDays}</td>
                      <td className="px-3 py-3 font-mono text-emerald-500">{e.summary.present}</td>
                      <td className="px-3 py-3 font-mono text-amber-500">{e.summary.halfDay}</td>
                      <td className="px-3 py-3 font-mono text-rose-500">{e.summary.absent}</td>
                      <td className="px-3 py-3 font-mono text-blue-500">{e.summary.leave}</td>
                      <td className="px-3 py-3 font-mono">{e.summary.lateDays}</td>
                      <td className="px-3 py-3 font-mono">{e.summary.missedClockOut}</td>
                      <td className="px-3 py-3 font-mono">{hoursText(e.summary.workedMinutes)}</td>
                      <td className="px-3 py-3"><Hours minutes={e.summary.avgMinutes} /></td>
                    </tr>
                    {open.has(e._id) && (
                      <tr className="bg-app-bg/40">
                        <td colSpan="10" className="px-4 py-3"><DayTable days={e.days} /></td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && employees.length > 0 && shownView === 'datewise' && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[900px]">
                <thead className="bg-app-bg text-[11px] uppercase text-app-text-muted border-b border-app-border">
                  <tr>
                    <th className="px-4 py-3">Employee</th><th className="px-3 py-3">Date</th><th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Check-in</th><th className="px-3 py-3">Check-out</th><th className="px-3 py-3">Working hours</th><th className="px-3 py-3">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border">
                  {visible.length === 0 && <tr><td colSpan="7" className="px-4 py-8 text-center text-app-text-muted">No days match this status.</td></tr>}
                  {visible.map((d) => (
                    <tr key={`${d.emp._id}-${d.date}`} className="hover:bg-app-bg/50">
                      <td className="px-4 py-2.5">
                        <div className="font-semibold text-app-text whitespace-nowrap">{d.emp.name}</div>
                        <div className="text-[11px] text-app-text-muted">{d.emp.employeeId}</div>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap">{fmtDay(d.date)} <span className="text-app-text-muted">{d.weekday}</span></td>
                      <td className="px-3 py-2.5"><StatusBadge status={d.status} /></td>
                      <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap">
                        {d.checkIn || '—'}
                        {d.lateByMins > 0 && <span className="ml-1 text-[10px] text-yellow-500 font-sans">late {d.lateByMins}m</span>}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap">{d.checkOut || (d.missedClockOut ? <span className="text-amber-500 font-sans">Missing</span> : '—')}</td>
                      <td className="px-3 py-2.5"><Hours minutes={d.workedMinutes} band={d.hoursBand} inProgress={d.inProgress} /></td>
                      <td className="px-3 py-2.5 text-xs text-app-text-muted">{d.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-app-border text-xs text-app-text-muted">
                <span>Rows {current * PAGE + 1}–{Math.min(flat.length, (current + 1) * PAGE)} of {flat.length}</span>
                <div className="flex gap-2">
                  <button type="button" disabled={current === 0} onClick={() => setPage(current - 1)} className="px-3 py-1 rounded border border-app-border disabled:opacity-40 cursor-pointer">Previous</button>
                  <button type="button" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} className="px-3 py-1 rounded border border-app-border disabled:opacity-40 cursor-pointer">Next</button>
                </div>
              </div>
            )}
          </>
        )}

        {!isLoading && employees.length > 0 && shownView === 'monthly' && (
          <div className="divide-y divide-app-border">
            {employees.map((e) => (
              <div key={e._id} className="p-4">
                <div className="font-bold text-app-text">{e.name} <span className="text-xs font-normal text-app-text-muted">{e.employeeId}{e.department ? ` · ${e.department}` : ''}</span></div>
                <div className="mt-2"><MonthTable months={e.months} /></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
