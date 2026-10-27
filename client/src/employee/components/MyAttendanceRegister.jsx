import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Download } from 'lucide-react';
import employeeApi from '../../services/employeeApi';
import { essGet } from '../lib/ess';
import { RangePicker, HoursLegend, TotalsTiles, DayTable, MonthTable } from '../../shared/attendanceRegister';
import { rangeFor, ymd, fmtDay, downloadBlob } from '../../shared/attendanceRegisterUtils';

/** The employee's own attendance for a day, a month or a From–To range, with an Excel download. */
export default function MyAttendanceRegister() {
  const [range, setRange] = useState(() => ({ mode: 'monthly', month: ymd().slice(0, 7), ...rangeFor('monthly') }));
  const [exporting, setExporting] = useState(false);
  const params = { from: range.from, to: range.to };

  const { data, isLoading, error } = useQuery({
    queryKey: ['ess', 'attendance-register', range.from, range.to],
    queryFn: () => essGet('/attendance/register', { params }),
    enabled: Boolean(range.from && range.to && range.from <= range.to),
    placeholderData: keepPreviousData,
  });
  const record = data?.record;

  const exportExcel = async () => {
    setExporting(true);
    try {
      await downloadBlob(employeeApi.get('/employee-portal/ess/attendance/register/export', { params, responseType: 'blob' }), `my-attendance_${range.from}_to_${range.to}.xlsx`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="bg-app-card p-4 sm:p-6 rounded-xl border border-app-border space-y-4">
      <div className="flex flex-wrap justify-between items-start gap-3 border-b border-app-border pb-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold">My Attendance</h2>
          <p className="text-xs text-app-text-muted mt-1">
            {range.from === range.to ? fmtDay(range.from) : `${fmtDay(range.from)} – ${fmtDay(range.to)}`} · status, check-in / check-out and working hours
          </p>
        </div>
        <button type="button" onClick={exportExcel} disabled={exporting || !record}
          className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg disabled:opacity-50 cursor-pointer">
          <Download size={14} /> {exporting ? 'Preparing…' : 'Export Excel'}
        </button>
      </div>

      <RangePicker value={range} onChange={setRange} />
      <HoursLegend />

      {isLoading && <p className="text-sm text-app-text-muted py-4">Loading…</p>}
      {error && <p className="text-sm text-rose-400 py-4">{error.response?.data?.message || 'Could not load your attendance.'}</p>}
      {record && (
        <>
          <TotalsTiles t={record.summary} />
          {record.months.length > 1 && (
            <div>
              <h3 className="text-sm font-bold text-app-text mb-2">Monthly summary</h3>
              <MonthTable months={record.months} />
            </div>
          )}
          <DayTable days={[...record.days].reverse()} />
        </>
      )}
    </div>
  );
}
