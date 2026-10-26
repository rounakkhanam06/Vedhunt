import { Area, AreaChart, CartesianGrid, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import ChartCard from './ChartCard';
import ChartTooltip from './ChartTooltip';
import { AXIS, FONT, GRID, INK, SERIES, SURFACE, prefersReducedMotion } from './theme';

const monthLabel = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-IN', { month: 'short' });

/**
 * Retainer pacing: hours used so far this month as a running total, against a
 * solid reference line at the hours included in the plan. One series (the
 * total), so one colour and no legend; the included-hours line is labelled
 * directly. The x axis spans the whole month so the empty days ahead are
 * visible.
 */
export default function HoursPacingChart({ trend, retainer }) {
  const days = trend?.days || [];
  const included = trend?.included ?? retainer?.included ?? 0;
  const last = days.at(-1);
  const used = last?.cumulative ?? 0;
  const over = Math.max(0, +(used - included).toFixed(2));

  const top = Math.max(included, ...days.map((d) => d.cumulative), 1);
  const month = days[0] ? monthLabel(days[0].date) : '';
  const totalDays = trend?.totalDays || 30;
  const ticks = [...new Set([1, 8, 15, 22, totalDays])].filter((d) => d <= totalDays);

  let subtitle;
  if (days.length) {
    subtitle = over > 0 ? `${used}h used of ${included}h included · ${over}h over` : `${used}h used of ${included}h included · ${+(included - used).toFixed(2)}h left`;
  }

  const summary = days.length
    ? `Hours used this month: ${used} of ${included} included as of day ${last.day}.`
    : '';

  return (
    <ChartCard
      title="Retainer hours this month"
      subtitle={subtitle}
      empty={!days.length ? 'A daily chart appears once your team’s billable time is logged against your account.' : undefined}
      table={{
        columns: [
          { key: 'date', label: 'Day' },
          { key: 'hours', label: 'Hours that day', align: 'right' },
          { key: 'cumulative', label: 'Total so far', align: 'right' },
        ],
        rows: days.map((d) => ({ date: `${d.day} ${month}`, hours: d.hours, cumulative: d.cumulative })),
      }}
      chart={(
        <div role="img" aria-label={summary} style={{ width: '100%', height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={days} margin={{ top: 12, right: 36, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID} strokeWidth={1} />
              <XAxis
                dataKey="day" type="number" domain={[1, totalDays]} ticks={ticks} allowDecimals={false}
                tickFormatter={(d) => `${d} ${month}`}
                tick={{ fill: INK.muted, fontSize: 11, fontFamily: FONT }} axisLine={{ stroke: AXIS }} tickLine={false}
              />
              <YAxis
                domain={[0, Math.ceil(top * 1.15)]} allowDecimals={false} width={36}
                tickFormatter={(v) => `${v}h`} tick={{ fill: INK.muted, fontSize: 11, fontFamily: FONT }} axisLine={false} tickLine={false}
              />
              <ReferenceLine
                y={included} stroke={INK.muted} strokeWidth={1}
                label={{ value: `Included ${included}h`, position: 'insideTopLeft', fill: INK.secondary, fontSize: 11, fontFamily: FONT, dy: -12 }}
              />
              <Tooltip
                cursor={{ stroke: INK.muted, strokeWidth: 1 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <ChartTooltip
                      title={`${d.day} ${month}`}
                      rows={[{ color: SERIES.blue, name: 'used so far', value: `${d.cumulative}h` }]}
                      extra={[`${d.hours}h logged that day`]}
                    />
                  );
                }}
              />
              <Area
                type="linear" dataKey="cumulative" stroke={SERIES.blue} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"
                fill={SERIES.blue} fillOpacity={0.1} isAnimationActive={!prefersReducedMotion()}
                dot={({ cx, cy, index, key }) => (index === days.length - 1
                  ? <circle key={key} cx={cx} cy={cy} r={4} fill={SERIES.blue} stroke={SURFACE} strokeWidth={2} />
                  : <g key={key} />)}
                activeDot={{ r: 4, fill: SERIES.blue, stroke: SURFACE, strokeWidth: 2 }}
              >
                <LabelList
                  dataKey="cumulative"
                  content={({ x, y, value, index }) => (index === days.length - 1
                    ? <text key="end" x={x + 8} y={y + 4} fill={INK.primary} fontSize={12} fontFamily={FONT}>{value}h</text>
                    : null)}
                />
              </Area>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    />
  );
}
