import { useEffect, useState } from 'react';
import { Target } from 'lucide-react';
import clientApi from '../../services/clientApi';
import KpiReportTable from '../../shared/KpiReportTable';

/**
 * The client's KPI report (server: GET /client/kpi-report) — budget plan vs spend, targets
 * vs actual, and the qualified leads / verified orders / actions the Vedhunt team entered.
 * View only. Shown only when the team has set up KPIs for at least one platform.
 */
export default function ClientKpiReport() {
  const [frequency, setFrequency] = useState('');
  const [result, setResult] = useState({ key: null, data: null, error: '' });
  const key = frequency;

  useEffect(() => {
    let live = true;
    clientApi.get('/client/kpi-report', { params: frequency ? { frequency } : {} })
      .then(({ data: res }) => { if (live) setResult({ key, data: res.data, error: '' }); })
      .catch((err) => { if (live) setResult({ key, data: null, error: err?.response?.data?.message || 'Could not load your KPI report.' }); });
    return () => { live = false; };
  }, [frequency, key]);

  const { data, error } = result;
  if (!data && !error) return null;
  if (data && !data.tables.length) return null;

  return (
    <section className="space-y-3" aria-label="KPI report">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-white text-base font-semibold flex items-center gap-2"><Target size={16} className="text-primary" /> KPI report</h3>
          <p className="text-[#9CA3AF] text-xs mt-1">Budget plan against spend, results against your targets, and what your team did about them.</p>
        </div>
        <select aria-label="View by" value={frequency} onChange={(e) => setFrequency(e.target.value)}
          className="px-3 py-1.5 bg-bg-surface/50 border border-border-default rounded-lg text-white text-xs cursor-pointer">
          <option value="">As agreed per platform</option>
          {(data?.frequencies || ['Daily', 'Weekly', 'Monthly']).map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>
      {error && <p className="text-[#EF4444] text-sm" role="alert">{error}</p>}
      <div className={`space-y-5 transition-opacity ${result.key !== key ? 'opacity-50' : ''}`}>
        {data?.tables.map((table) => (
          <div key={table.platform} className="space-y-2">
            <p className="text-white text-sm font-semibold">{table.platform} <span className="text-[#9CA3AF] font-normal text-xs">· {table.frequency}</span></p>
            <KpiReportTable table={table} theme="client" />
          </div>
        ))}
      </div>
    </section>
  );
}
