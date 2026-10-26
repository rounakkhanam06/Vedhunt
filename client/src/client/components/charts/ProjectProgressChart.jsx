import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import ChartCard from './ChartCard';
import ChartTooltip from './ChartTooltip';
import { AXIS, FONT, GRID, INK, SERIES, prefersReducedMotion } from './theme';

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '');
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

// Category label, clipped to fit, with the full name on hover
function NameTick({ x, y, payload }) {
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fill={INK.secondary} fontSize={12} fontFamily={FONT}>
      <title>{payload.value}</title>
      {clip(payload.value, 18)}
    </text>
  );
}

/**
 * Where each active project stands: one bar per project on a 0–100% axis, the
 * value at the bar's tip. A single series, so a single colour and no legend.
 * Progress is the share of milestones completed.
 */
export default function ProjectProgressChart({ projects }) {
  const data = projects.map((p) => ({
    id: p._id,
    name: p.status === 'On Hold' ? `${p.projectName} (on hold)` : p.projectName,
    progress: p.progress,
    track: 100,
    done: p.milestonesDone,
    total: p.milestonesTotal,
    next: p.nextMilestone,
  }));
  const rowH = 44;
  const height = data.length * rowH + 36; // plot rows + the x-axis band

  const average = data.length ? Math.round(data.reduce((s, d) => s + d.progress, 0) / data.length) : 0;
  const summary = data.map((d) => `${d.name} ${d.progress}%`).join('; ');

  return (
    <ChartCard
      title="Project progress"
      subtitle={data.length ? `${data.length} active project${data.length > 1 ? 's' : ''} · ${average}% on average` : undefined}
      empty={data.length === 0 ? 'No active projects right now.' : undefined}
      table={{
        columns: [
          { key: 'name', label: 'Project' },
          { key: 'progress', label: 'Progress', align: 'right' },
          { key: 'milestones', label: 'Milestones', align: 'right' },
          { key: 'next', label: 'Next milestone' },
        ],
        rows: data.map((d) => ({
          name: d.name,
          progress: `${d.progress}%`,
          milestones: d.total ? `${d.done} of ${d.total}` : '—',
          next: d.next ? `${d.next.title}${d.next.targetDate ? ` · ${fmtDate(d.next.targetDate)}` : ''}` : (d.total ? 'All complete' : '—'),
        })),
      }}
      chart={(
        <div role="img" aria-label={`Project progress: ${summary}`} style={{ width: '100%', height }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, bottom: 0, left: 0 }} barCategoryGap={14} barGap={-14}>
              <CartesianGrid horizontal={false} stroke={GRID} strokeWidth={1} />
              <XAxis
                type="number" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`}
                tick={{ fill: INK.muted, fontSize: 11, fontFamily: FONT }} axisLine={{ stroke: AXIS }} tickLine={false}
              />
              <YAxis type="category" dataKey="name" width={128} tick={<NameTick />} axisLine={{ stroke: AXIS }} tickLine={false} />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <ChartTooltip
                      title={d.name}
                      rows={[{ color: SERIES.blue, name: 'complete', value: `${d.progress}%` }]}
                      extra={[
                        d.total ? `${d.done} of ${d.total} milestones done` : 'No milestones set yet',
                        d.next ? `Next: ${d.next.title}${d.next.targetDate ? ` · ${fmtDate(d.next.targetDate)}` : ''}` : null,
                      ].filter(Boolean)}
                    />
                  );
                }}
              />
              {/* The track is its own full-width bar underneath (barGap = -barSize overlaps them), so a 0% project still shows its track and label */}
              <Bar dataKey="track" fill={GRID} barSize={14} radius={[0, 4, 4, 0]} isAnimationActive={false} legendType="none">
                {/* Labels ride the full-width track so a 0% project still gets its "0%" (a zero-width bar draws no label) */}
                <LabelList
                  dataKey="track"
                  content={({ x, y, width, height, index }) => (
                    <text x={x + (width * data[index].progress) / 100 + 8} y={y + height / 2 + 4} fill={INK.primary} fontSize={12} fontFamily={FONT}>
                      {data[index].progress}%
                    </text>
                  )}
                />
              </Bar>
              <Bar dataKey="progress" fill={SERIES.blue} barSize={14} radius={[0, 4, 4, 0]} isAnimationActive={!prefersReducedMotion()} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    />
  );
}
