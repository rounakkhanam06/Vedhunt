import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import ChartCard from './ChartCard';
import ChartTooltip from './ChartTooltip';
import { AXIS, FONT, GRID, INK, SERIES, prefersReducedMotion } from './theme';

/**
 * One series of columns over time (spend per day / week / month …). A single
 * series needs no legend — the title names it. The current, unfinished period
 * is drawn lighter and labelled "partial" in the tooltip and table.
 *
 * data: [{ key, label, value, partial }]   format: value → display string   axisFormat: tick formatter
 */
export default function ColumnChart({ title, subtitle, data, format, axisFormat, color = SERIES.blue, valueLabel, empty }) {
  const hasData = data.some((d) => (d.value || 0) > 0);
  const many = data.length > 16;
  const summary = `${title}: ${data.map((d) => `${d.label} ${format(d.value)}`).join('; ')}`;
  return (
    <ChartCard
      title={title}
      subtitle={subtitle}
      empty={!hasData ? empty : undefined}
      table={{
        columns: [{ key: 'label', label: 'Period' }, { key: 'value', label: valueLabel || title, align: 'right' }],
        rows: data.map((d) => ({ label: d.partial ? `${d.label} (partial)` : d.label, value: format(d.value) })),
      }}
      chart={(
        <div role="img" aria-label={summary} style={{ width: '100%', height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={many ? 2 : '25%'}>
              <CartesianGrid vertical={false} stroke={GRID} strokeWidth={1} />
              <XAxis dataKey="label" tick={{ fill: INK.muted, fontSize: 11, fontFamily: FONT }} axisLine={{ stroke: AXIS }} tickLine={false}
                interval={many ? Math.ceil(data.length / 7) - 1 : 0} minTickGap={8} />
              <YAxis width={52} tickFormatter={axisFormat || format} allowDecimals={false} tick={{ fill: INK.muted, fontSize: 11, fontFamily: FONT }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return <ChartTooltip title={d.partial ? `${d.label} (so far)` : d.label} rows={[{ color, name: valueLabel || title, value: format(d.value) }]} />;
                }}
              />
              <Bar dataKey="value" fill={color} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={!prefersReducedMotion()}>
                {data.map((d) => <Cell key={d.key} fillOpacity={d.partial ? 0.5 : 1} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    />
  );
}
