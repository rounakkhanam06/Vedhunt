import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { ArrowUpRight, ArrowDownRight, Minus, Download, Gauge } from 'lucide-react';
import clientApi from '../../services/clientApi';
import ColumnChart from '../components/charts/ColumnChart';
import ChartCard from '../components/charts/ChartCard';
import { SERIES, inrCompact, inrFull } from '../components/charts/theme';

const PERIODS = [
  { id: 'today', label: 'Today' }, { id: 'yesterday', label: 'Yesterday' }, { id: 'this_week', label: 'This week' }, { id: 'last_week', label: 'Last week' },
  { id: 'this_month', label: 'This month' }, { id: 'last_month', label: 'Last month' }, { id: 'custom', label: 'Custom' },
];
const GROUPS = [{ id: 'day', label: 'Day' }, { id: 'week', label: 'Week' }, { id: 'month', label: 'Month' }];

const n0 = (v) => (v == null ? '--' : Number(v).toLocaleString('en-IN'));
// Small amounts (cost per click, CPM) keep their paise; large ones are whole rupees
const money = (v) => (v == null ? '--' : Math.abs(v) < 100 ? `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : inrFull(v));
const KPIS = [
  { key: 'spend', label: 'Spend', fmt: money },
  { key: 'results', label: 'Results', fmt: n0 },
  { key: 'costPerResult', label: 'Cost per result', fmt: money },
  { key: 'roas', label: 'ROAS', fmt: (v) => (v == null ? '--' : `${v}x`) },
  { key: 'impressions', label: 'Impressions', fmt: n0 },
  { key: 'clicks', label: 'Clicks', fmt: n0 },
  { key: 'ctr', label: 'CTR', fmt: (v) => (v == null ? '--' : `${v}%`) },
  { key: 'cpc', label: 'Cost per click', fmt: money },
];
const fmtDay = (s) => new Date(`${s}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

// Change vs the previous period. The arrow + words carry the meaning; colour only reinforces it.
function Delta({ c }) {
  if (!c || c.current == null || c.previous == null) return <p className="text-[11px] text-[#6B7280] mt-1">No comparison</p>;
  if (c.isNew) return <p className="text-[11px] text-[#9CA3AF] mt-1">New — nothing in the previous period</p>;
  if (c.pct == null || c.change === 0) return <p className="text-[11px] text-[#9CA3AF] mt-1 flex items-center gap-1"><Minus size={11} /> No change</p>;
  const Icon = c.change > 0 ? ArrowUpRight : ArrowDownRight;
  const tone = c.good == null ? 'text-[#9CA3AF]' : c.good ? 'text-[#22C55E]' : 'text-[#EF4444]';
  return (
    <p className={`text-[11px] mt-1 flex items-center gap-1 ${tone}`}>
      <Icon size={12} /> {Math.abs(c.pct)}% {c.change > 0 ? 'up' : 'down'}{c.good != null && <span className="text-[#9CA3AF]">· {c.good ? 'better' : 'worse'}</span>}
    </p>
  );
}

/** The client's campaign results, entered by the Vedhunt team. */
const PerformanceTab = () => {
  const [period, setPeriod] = useState('this_month');
  const [group, setGroup] = useState('day');
  const [platform, setPlatform] = useState('');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [data, setData] = useState(null);
  const [loadedKey, setLoadedKey] = useState(null); // the request whose answer is on screen
  const [error, setError] = useState('');

  const params = { period, group, ...(platform && { platform }), ...(period === 'custom' && custom) };
  const ready = period !== 'custom' || (custom.from && custom.to);
  const key = JSON.stringify(params);
  const loading = ready && loadedKey !== key;

  useEffect(() => {
    if (!ready) return undefined;
    let live = true;
    clientApi.get('/client/performance', { params: JSON.parse(key) })
      .then(({ data: res }) => { if (live) { setData(res.data); setError(''); } })
      .catch((err) => { if (live) setError(err?.response?.data?.message || 'Could not load your results.'); })
      .finally(() => { if (live) setLoadedKey(key); });
    return () => { live = false; };
  }, [key, ready]);

  const exportCsv = async () => {
    try {
      const res = await clientApi.get('/client/performance/export.csv', { params, responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ad-performance-${data?.current.from}-to-${data?.current.to}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch { toast.error('Could not export'); }
  };

  const chip = (active) => `px-3 py-1.5 rounded-full text-xs font-medium border cursor-pointer whitespace-nowrap transition-colors ${active ? 'bg-primary/15 text-primary border-primary/30' : 'bg-bg-surface/40 text-[#9CA3AF] border-border-default hover:text-white'}`;
  const dateCls = 'px-3 py-1.5 bg-bg-surface/50 border border-border-default rounded-lg text-white text-xs [color-scheme:dark]';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-white text-lg font-semibold">Campaign performance</h2>
          <p className="text-[#9CA3AF] text-xs mt-1">Results from your ad accounts, updated by your Vedhunt team.</p>
        </div>
        {data && data.rowCount > 0 && (
          <button type="button" onClick={exportCsv} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-default text-xs text-[#9CA3AF] hover:text-white cursor-pointer"><Download size={13} /> Export CSV</button>
        )}
      </div>

      {/* Filters — one row above everything they scope */}
      <div className="space-y-2">
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" role="group" aria-label="Period">
          {PERIODS.map((p) => <button key={p.id} type="button" aria-pressed={period === p.id} onClick={() => setPeriod(p.id)} className={chip(period === p.id)}>{p.label}</button>)}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {period === 'custom' && (
            <>
              <input type="date" aria-label="From" className={dateCls} value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
              <span className="text-[#9CA3AF] text-xs">to</span>
              <input type="date" aria-label="To" className={dateCls} value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
            </>
          )}
          <div className="flex rounded-lg border border-border-default overflow-hidden" role="group" aria-label="View by">
            {GROUPS.map((g) => <button key={g.id} type="button" aria-pressed={group === g.id} onClick={() => setGroup(g.id)} className={`px-3 py-1.5 text-xs cursor-pointer ${group === g.id ? 'bg-primary/15 text-primary' : 'text-[#9CA3AF] hover:text-white'}`}>{g.label}</button>)}
          </div>
          <select aria-label="Platform" value={platform} onChange={(e) => setPlatform(e.target.value)} className="px-3 py-1.5 bg-bg-surface/50 border border-border-default rounded-lg text-white text-xs cursor-pointer">
            <option value="">All platforms</option>
            {(data?.platforms || ['Meta', 'Google']).map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        {data && (
          <p className="text-[11px] text-[#6B7280]">
            {fmtDay(data.current.from)} – {fmtDay(data.current.to)}{data.current.partial ? ' (so far)' : ''} · compared with {fmtDay(data.previous.from)} – {fmtDay(data.previous.to)}
            {data.lastUpdated && ` · updated ${new Date(data.lastUpdated).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
          </p>
        )}
      </div>

      {error && <p className="text-[#EF4444] text-sm" role="alert">{error}</p>}
      {!data && loading && <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-2 border-primary/30 border-t-[#FF5A1F] rounded-full animate-spin" /></div>}

      {data && (
        // Hold the previous render (dimmed) while a new range loads — no layout jump
        <div className={`space-y-5 transition-opacity ${loading ? 'opacity-50' : ''}`} aria-busy={loading}>
          {data.rowCount === 0 ? (
            <div className="text-center py-14 rounded-xl border border-border-default bg-bg-surface/30">
              <p className="text-white text-sm font-medium">No campaign data for this period yet</p>
              <p className="text-[#9CA3AF] text-xs mt-1">Your team adds results daily — try a different period.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {KPIS.map((k) => (
                  <div key={k.key} className="rounded-xl border border-border-default bg-bg-surface/30 p-3.5">
                    <p className="text-[#9CA3AF] text-[11px] uppercase font-bold tracking-wider">{k.label}</p>
                    <p className="text-white text-xl font-bold mt-1.5">{k.fmt(data.totals[k.key])}</p>
                    <Delta c={data.comparison[k.key]} />
                  </div>
                ))}
              </div>

              {data.budget && (
                <section className="rounded-xl border border-border-default bg-bg-surface/30 p-4" aria-label="Monthly ad budget">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-white text-sm font-semibold flex items-center gap-2"><Gauge size={15} className="text-primary" /> Ad budget this month</p>
                    <p className="text-xs text-[#C3C8D2]">{inrFull(data.budget.spentThisMonth)} of {inrFull(data.budget.monthlyBudget)} · {data.budget.utilisation}% used</p>
                  </div>
                  <div className="h-2 mt-3 bg-white/10 rounded-full overflow-hidden" role="progressbar" aria-valuenow={Math.min(100, data.budget.utilisation)} aria-valuemin={0} aria-valuemax={100} aria-label="Budget used">
                    <div className={`h-full rounded-full ${data.budget.utilisation >= 100 ? 'bg-[#EF4444]' : 'bg-primary'}`} style={{ width: `${Math.min(100, data.budget.utilisation)}%` }} />
                  </div>
                  <p className="text-xs text-[#9CA3AF] mt-2">
                    {data.budget.pacing === 'over' ? 'Spending faster than planned for this point in the month.' : data.budget.pacing === 'under' ? 'Spending slower than planned for this point in the month.' : 'On track for this point in the month.'}
                    {' '}Expected by today: {inrFull(data.budget.expectedByToday)} · remaining {inrFull(data.budget.remaining)}.
                  </p>
                </section>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <ColumnChart
                  title={`Spend by ${group}`} valueLabel="Spend" format={money} axisFormat={inrCompact}
                  data={data.series.map((s) => ({ key: s.key, label: s.label, value: s.spend, partial: s.partial }))}
                  empty="No spend in this period."
                />
                <ColumnChart
                  title={`Results by ${group}`} valueLabel="Results" format={n0} color={SERIES.orange}
                  data={data.series.map((s) => ({ key: s.key, label: s.label, value: s.results, partial: s.partial }))}
                  empty="No results recorded in this period."
                />
              </div>

              <ChartCard
                title="Campaigns"
                subtitle={`${data.byCampaign.length} campaign${data.byCampaign.length === 1 ? '' : 's'} · highest spend first`}
                chart={(
                  <div className="overflow-x-auto -mx-1">
                    <table className="w-full text-sm min-w-[640px]">
                      <thead>
                        <tr className="text-[#9CA3AF] text-[11px] uppercase tracking-wider">
                          {['Campaign', 'Spend', 'Results', 'Cost / result', 'CTR', 'ROAS'].map((h, i) => <th key={h} scope="col" className={`py-1.5 px-2 font-semibold ${i ? 'text-right' : 'text-left'}`}>{h}</th>)}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {data.byCampaign.map((c) => (
                          <tr key={`${c.platform}-${c.campaignName}`} className="text-white">
                            <th scope="row" className="py-2 px-2 text-left font-medium">
                              {c.campaignName}<span className="block text-[11px] text-[#9CA3AF] font-normal">{c.platform}{c.objective ? ` · ${c.objective}` : ''}{c.resultType ? ` · ${c.resultType}` : ''}</span>
                            </th>
                            <td className="py-2 px-2 text-right tabular-nums">{money(c.spend)}</td>
                            <td className="py-2 px-2 text-right tabular-nums">{n0(c.results)}</td>
                            <td className="py-2 px-2 text-right tabular-nums">{money(c.costPerResult)}</td>
                            <td className="py-2 px-2 text-right tabular-nums">{c.ctr == null ? '--' : `${c.ctr}%`}</td>
                            <td className="py-2 px-2 text-right tabular-nums">{c.roas == null ? '--' : `${c.roas}x`}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default PerformanceTab;
