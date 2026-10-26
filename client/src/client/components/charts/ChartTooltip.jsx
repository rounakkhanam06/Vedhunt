import { INK, SURFACE } from './theme';

/**
 * One tooltip for every chart: a heading, then a row per series with a short
 * line key in the series colour, the value as the strong element and the
 * series name secondary. All text is inserted as React text nodes, never HTML.
 *
 * rows: [{ color, name, value }]   extra: optional lines of secondary text
 */
export default function ChartTooltip({ title, rows = [], extra = [] }) {
  return (
    <div
      className="rounded-lg border px-3 py-2 shadow-xl text-xs"
      style={{ background: SURFACE, borderColor: 'rgba(255,255,255,0.12)', minWidth: 140 }}
    >
      {title && <p className="font-semibold mb-1.5" style={{ color: INK.primary }}>{title}</p>}
      {rows.map((r) => (
        <div key={r.name} className="flex items-center gap-2 py-0.5">
          <span className="inline-block w-3 h-[2px] rounded-full shrink-0" style={{ background: r.color }} aria-hidden="true" />
          <span className="font-semibold tabular-nums" style={{ color: INK.primary }}>{r.value}</span>
          <span style={{ color: INK.secondary }}>{r.name}</span>
        </div>
      ))}
      {extra.map((line) => <p key={line} className="mt-1" style={{ color: INK.secondary }}>{line}</p>)}
    </div>
  );
}
