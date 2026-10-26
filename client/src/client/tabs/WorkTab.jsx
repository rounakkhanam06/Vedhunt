import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import clientApi from '../../services/clientApi';

const PERIODS = [
  { id: 'this_week', label: 'This week' }, { id: 'this_month', label: 'This month' },
  { id: 'last_month', label: 'Last month' }, { id: 'last_3_months', label: 'Last 3 months' },
];
const h = (hours) => `${Number(hours).toLocaleString('en-IN', { maximumFractionDigits: 2 })}h`;
const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

// One series of horizontal bars: the hours are written beside each bar, so nothing needs hovering
function Bars({ rows, color = '#3987e5' }) {
  const max = Math.max(...rows.map((r) => r.hours), 0.01);
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.name}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-white truncate">{r.name}</span>
            <span className="text-white font-semibold tabular-nums shrink-0">{h(r.hours)} <span className="text-[#9CA3AF] font-normal text-xs">· {r.share}%</span></span>
          </div>
          <div className="h-2 mt-1.5 rounded-full bg-white/5 overflow-hidden" aria-hidden="true">
            <div className="h-full rounded-full" style={{ width: `${(r.hours / max) * 100}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** What the Vedhunt team worked on for this client, and how long — by activity and by project. */
const WorkTab = () => {
  const [period, setPeriod] = useState('this_month');
  const [data, setData] = useState(null);
  const [loadedPeriod, setLoadedPeriod] = useState(null);
  const [failed, setFailed] = useState(false);
  const loading = loadedPeriod !== period;

  useEffect(() => {
    let live = true;
    clientApi.get('/client/work', { params: { period } })
      .then(({ data: res }) => { if (live) { setData(res.data); setFailed(false); } })
      .catch(() => { if (live) setFailed(true); })
      .finally(() => { if (live) setLoadedPeriod(period); });
    return () => { live = false; };
  }, [period]);

  const card = 'rounded-xl border border-border-default bg-bg-surface/30 p-4';

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-white text-lg font-semibold">Work log</h2>
        <p className="text-[#9CA3AF] text-xs mt-1">Time your Vedhunt team spent on your account, by activity and project.</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" role="group" aria-label="Period">
        {PERIODS.map((p) => (
          <button key={p.id} type="button" aria-pressed={period === p.id} onClick={() => setPeriod(p.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border cursor-pointer whitespace-nowrap ${period === p.id ? 'bg-primary/15 text-primary border-primary/30' : 'bg-bg-surface/40 text-[#9CA3AF] border-border-default hover:text-white'}`}>
            {p.label}
          </button>
        ))}
      </div>

      {failed && <p className="text-[#9CA3AF] text-sm">We couldn&apos;t load your work log just now.</p>}
      {!data && loading && <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-2 border-primary/30 border-t-[#FF5A1F] rounded-full animate-spin" /></div>}

      {data && (
        <div className={`space-y-5 transition-opacity ${loading ? 'opacity-50' : ''}`} aria-busy={loading}>
          <div className={`${card} flex items-center gap-4`}>
            <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Clock size={20} /></div>
            <div>
              <p className="text-[#9CA3AF] text-[11px] uppercase font-bold tracking-wider">Total time{data.range.partial ? ' so far' : ''}</p>
              <p className="text-white text-2xl font-bold">{h(data.totalHours)}</p>
            </div>
          </div>

          {data.totalMinutes === 0 ? (
            <p className="text-[#9CA3AF] text-sm text-center py-8">No time logged for this period.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <section className={card} aria-label="Time by activity">
                  <h3 className="text-white text-sm font-semibold mb-3">By activity</h3>
                  <Bars rows={data.byActivity} />
                </section>
                <section className={card} aria-label="Time by project">
                  <h3 className="text-white text-sm font-semibold mb-3">By project</h3>
                  <Bars rows={data.byProject} color="#d95926" />
                </section>
              </div>

              <section className={card} aria-label="Recent work">
                <h3 className="text-white text-sm font-semibold mb-3">Recent work{data.entryCount > data.entries.length ? ` (latest ${data.entries.length} of ${data.entryCount})` : ''}</h3>
                <ul className="divide-y divide-white/5">
                  {data.entries.map((e, i) => (
                    <li key={i} className="py-2.5 flex items-start gap-3 text-sm">
                      <span className="text-[#9CA3AF] text-xs w-14 shrink-0 pt-0.5">{fmtDate(e.date)}</span>
                      <span className="flex-1 min-w-0">
                        <span className="text-white">{e.activity}</span>
                        <span className="text-[#9CA3AF]"> · {e.project}</span>
                        {e.outcome && <span className="block text-xs text-[#C3C8D2] mt-0.5">{e.outcome}</span>}
                      </span>
                      <span className="text-white font-semibold tabular-nums shrink-0">{h(e.hours)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default WorkTab;
