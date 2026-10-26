import { useId, useState } from 'react';
import { Table2, BarChart3 } from 'lucide-react';

/**
 * Card around a chart: title + one-line takeaway, a legend for two or more
 * series (a single series needs none — the title says what it is), and a
 * "Table" toggle that swaps the chart for an accessible table of the same
 * numbers, so no value is only reachable by hovering.
 *
 * props: title, subtitle, legend [{ label, color }], table { columns:[{key,label,align}], rows:[{...}] },
 *        chart (node), empty (node shown instead of the chart when there is nothing to plot)
 */
export default function ChartCard({ title, subtitle, legend = [], table, chart, empty }) {
  const [asTable, setAsTable] = useState(false);
  const tableId = useId();
  const showTable = asTable && table && !empty;

  return (
    <section className="rounded-xl border border-border-default bg-bg-surface/30 p-4" aria-label={title}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-white text-sm font-semibold">{title}</h3>
          {subtitle && <p className="text-[#9CA3AF] text-xs mt-0.5">{subtitle}</p>}
        </div>
        {table && !empty && (
          <button
            type="button"
            onClick={() => setAsTable((v) => !v)}
            aria-pressed={asTable}
            aria-controls={tableId}
            className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border-default text-[#9CA3AF] hover:text-white text-xs cursor-pointer transition-colors"
          >
            {asTable ? <BarChart3 size={13} /> : <Table2 size={13} />}
            {asTable ? 'Chart' : 'Table'}
          </button>
        )}
      </div>

      {legend.length >= 2 && !showTable && !empty && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 mt-3" aria-label="Legend">
          {legend.map((l) => (
            <li key={l.label} className="flex items-center gap-1.5 text-xs text-[#C3C8D2]">
              <span className="inline-block w-2.5 h-2.5 rounded-[2px]" style={{ background: l.color }} aria-hidden="true" />
              {l.label}
            </li>
          ))}
        </ul>
      )}

      <div id={tableId} className="mt-3">
        {empty ? (
          <p className="text-[#9CA3AF] text-sm py-6 text-center">{empty}</p>
        ) : showTable ? (
          <div className="overflow-auto max-h-72">
            <table className="w-full text-sm">
              <caption className="sr-only">{title}</caption>
              <thead>
                <tr className="text-[#9CA3AF] text-[11px] uppercase tracking-wider">
                  {table.columns.map((c) => (
                    <th key={c.key} scope="col" className={`py-1.5 px-2 font-semibold ${c.align === 'right' ? 'text-right' : 'text-left'}`}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {table.rows.map((r, i) => (
                  <tr key={i} className="text-white">
                    {table.columns.map((c, j) => (
                      j === 0
                        ? <th key={c.key} scope="row" className="py-1.5 px-2 text-left font-medium">{r[c.key]}</th>
                        : <td key={c.key} className={`py-1.5 px-2 ${c.align === 'right' ? 'text-right tabular-nums' : ''}`}>{r[c.key]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : chart}
      </div>
    </section>
  );
}
