import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { CorrectionRequestModal, CorrectionRequestList } from '../components/CorrectionRequests';
import { essGet, essKeys } from '../lib/ess';
import { toDateInput, fmtTime, fmtMinutes } from '../lib/datetime';

const LOGS_PER_PAGE = 10;
const shiftDay = (date, days) => {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toDateInput(d);
};
const navButton = 'px-3 py-2 bg-app-border/20 hover:bg-app-border/30 text-app-text rounded-lg text-sm transition-colors cursor-pointer border border-app-border disabled:opacity-30 disabled:cursor-not-allowed';

/** Daily productivity from saved timer logs, the activity timeline, and correction requests. */
export default function TimesheetTab() {
  const today = toDateInput();
  const [selectedDate, setSelectedDate] = useState(today);
  const [page, setPage] = useState(1);
  const [correction, setCorrection] = useState(null); // { workLog? }

  const { data: stats } = useQuery({
    queryKey: essKeys.dayStats(selectedDate),
    queryFn: () => essGet('/dashboard-stats', { params: { date: selectedDate } }).then((d) => d.stats),
  });
  const { data: logsData } = useQuery({
    queryKey: essKeys.worklogs(selectedDate, page),
    queryFn: () => essGet('/worklogs', { params: { limit: LOGS_PER_PAGE, page, date: selectedDate } }),
    placeholderData: keepPreviousData,
  });
  const workLogs = logsData?.logs || [];
  const totalPages = logsData?.pagination?.pages || 1;
  const total = logsData?.pagination?.total || 0;

  const changeDate = (date) => {
    if (!date || date > today) return;
    setSelectedDate(date);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="bg-app-card p-4 rounded-xl border border-app-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="text-xs text-app-text-muted uppercase tracking-wider mb-1">Viewing Productivity For</div>
          <div className="text-app-text font-bold text-lg">
            {new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => changeDate(shiftDay(selectedDate, -1))} className={navButton}>← Prev</button>
          <input type="date" value={selectedDate} max={today} onChange={(e) => changeDate(e.target.value)}
            className="bg-form-input-bg border border-app-border text-app-text text-sm rounded-lg px-3 py-2 cursor-pointer" />
          <button onClick={() => changeDate(shiftDay(selectedDate, 1))} disabled={selectedDate >= today} className={navButton}>Next →</button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-app-card p-4 rounded-xl border border-app-border">
            <div className="text-app-text-muted text-xs uppercase tracking-wider mb-1">Total Worked</div>
            <div className="text-2xl font-bold text-app-text font-mono">{stats.totalWorkedHours} <span className="text-sm text-app-text-muted">hrs</span></div>
          </div>
          <div className="bg-app-card p-4 rounded-xl border border-app-border">
            <div className="text-emerald-500 text-xs uppercase tracking-wider mb-1">Productive</div>
            <div className="text-2xl font-bold text-app-text font-mono">{stats.productiveHours} <span className="text-sm text-app-text-muted">hrs</span></div>
          </div>
          <div className="bg-app-card p-4 rounded-xl border border-app-border">
            <div className="text-primary text-xs uppercase tracking-wider mb-1">Non-Productive</div>
            <div className="text-2xl font-bold text-app-text font-mono">{stats.nonProductiveHours} <span className="text-sm text-app-text-muted">hrs</span></div>
          </div>
          <div className="bg-app-card p-4 rounded-xl border border-app-border">
            <div className="text-blue-500 text-xs uppercase tracking-wider mb-1">Productivity %</div>
            <div className="text-2xl font-bold text-app-text font-mono">{stats.productivityPercentage}%</div>
          </div>
        </div>
      )}

      <div className="bg-app-card p-6 rounded-xl border border-app-border space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold">Activity Timeline (Logs)</h2>
          <button type="button" onClick={() => setCorrection({ date: selectedDate })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-app-border text-xs font-semibold text-app-text hover:border-primary/40 cursor-pointer">
            <Plus size={14} /> Add missing entry
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-app-border text-xs text-app-text-muted uppercase">
                <th className="py-3 px-4 w-10">#</th>
                <th className="py-3 px-4">Time</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Project / Task</th>
                <th className="py-3 px-4">Activity</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Correction</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm">
              {workLogs.map((log, idx) => (
                <tr key={log._id} className="hover:bg-white/[0.01]">
                  <td className="py-3 px-4 text-app-text-muted text-xs font-mono">{(page - 1) * LOGS_PER_PAGE + idx + 1}</td>
                  <td className="py-3 px-4 text-app-text font-mono whitespace-nowrap">{fmtTime(log.startTime)} – {log.endTime ? fmtTime(log.endTime) : '…'}</td>
                  <td className="py-3 px-4 font-mono font-bold text-app-text">{fmtMinutes(log.duration)}</td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-app-text">{log.task}</div>
                    <div className="text-xs text-app-text-muted">{log.project}</div>
                  </td>
                  <td className="py-3 px-4 text-app-text"><span className="px-2 py-1 bg-app-border/20 rounded text-xs">{log.activityType}</span></td>
                  <td className="py-3 px-4">
                    {log.isProductive
                      ? <span className="text-emerald-500 text-xs font-bold bg-emerald-500/10 px-2 py-1 rounded">PRODUCTIVE</span>
                      : <span className="text-primary text-xs font-bold bg-primary/10 px-2 py-1 rounded">NON-PRODUCTIVE</span>}
                    {log.corrected && <span className="ml-1.5 text-[10px] font-bold uppercase text-blue-400">Corrected</span>}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button type="button" onClick={() => setCorrection({ workLog: log })} className="text-xs font-semibold text-primary hover:underline cursor-pointer">
                      Request correction
                    </button>
                  </td>
                </tr>
              ))}
              {workLogs.length === 0 && (
                <tr><td colSpan="7" className="text-center py-10 text-app-text-muted">No work logged for this date.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t border-app-border gap-3">
            <div className="text-xs text-app-text-muted">
              Showing <span className="text-app-text font-bold">{(page - 1) * LOGS_PER_PAGE + 1}–{Math.min(page * LOGS_PER_PAGE, total)}</span> of <span className="text-app-text font-bold">{total}</span> entries
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setPage(page - 1)} disabled={page === 1} className={`${navButton} py-1.5 text-xs`}>← Prev</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .reduce((acc, p, idx, arr) => {
                  if (idx > 0 && arr[idx - 1] !== p - 1) acc.push('...');
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) => (p === '...' ? (
                  <span key={`dots-${i}`} className="px-2 text-app-text-muted text-xs">…</span>
                ) : (
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-8 h-8 text-xs rounded-lg border transition-colors cursor-pointer ${page === p ? 'bg-primary border-primary text-white font-bold' : 'bg-app-border/20 border-app-border text-app-text hover:bg-app-border/30'}`}>
                    {p}
                  </button>
                )))}
              <button onClick={() => setPage(page + 1)} disabled={page === totalPages} className={`${navButton} py-1.5 text-xs`}>Next →</button>
            </div>
          </div>
        )}
      </div>

      <CorrectionRequestList kind="Timesheet" />

      {correction && <CorrectionRequestModal kind="Timesheet" initial={correction} onClose={() => setCorrection(null)} />}
    </div>
  );
}
