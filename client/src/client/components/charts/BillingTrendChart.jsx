import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import ChartCard from './ChartCard';
import ChartTooltip from './ChartTooltip';
import { AXIS, FONT, GRID, INK, SERIES, inrCompact, inrFull, prefersReducedMotion } from './theme';

/**
 * Invoiced vs paid, month by month for the last six months. "Paid" is money
 * actually verified as received — not the value of invoices — so the two bars
 * only meet when a month is settled. Two series, so a legend; colour follows
 * the series (Invoiced is always blue, Paid always orange).
 */
export default function BillingTrendChart({ trend }) {
  const data = trend.map((m) => ({ ...m, name: m.label, full: `${m.label} ${m.year}` }));
  const hasData = data.some((m) => m.invoiced > 0 || m.paid > 0);
  const totalInvoiced = data.reduce((s, m) => s + m.invoiced, 0);
  const totalPaid = data.reduce((s, m) => s + m.paid, 0);
  const summary = `Invoiced ${inrFull(totalInvoiced)} and paid ${inrFull(totalPaid)} over the last six months.`;

  return (
    <ChartCard
      title="Invoiced vs paid"
      subtitle={hasData ? `Last 6 months · ${inrFull(totalInvoiced)} invoiced, ${inrFull(totalPaid)} paid` : undefined}
      legend={[{ label: 'Invoiced', color: SERIES.blue }, { label: 'Paid', color: SERIES.orange }]}
      empty={!hasData ? 'No invoices or payments in the last six months.' : undefined}
      table={{
        columns: [
          { key: 'month', label: 'Month' },
          { key: 'invoiced', label: 'Invoiced', align: 'right' },
          { key: 'paid', label: 'Paid', align: 'right' },
        ],
        rows: data.map((m) => ({ month: m.full, invoiced: inrFull(m.invoiced), paid: inrFull(m.paid) })),
      }}
      chart={(
        <div role="img" aria-label={summary} style={{ width: '100%', height: 232 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2} barCategoryGap="28%">
              <CartesianGrid vertical={false} stroke={GRID} strokeWidth={1} />
              <XAxis dataKey="name" tick={{ fill: INK.muted, fontSize: 11, fontFamily: FONT }} axisLine={{ stroke: AXIS }} tickLine={false} />
              <YAxis
                width={52} tickFormatter={inrCompact} allowDecimals={false}
                tick={{ fill: INK.muted, fontSize: 11, fontFamily: FONT }} axisLine={false} tickLine={false}
              />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <ChartTooltip
                      title={d.full}
                      rows={[
                        { color: SERIES.blue, name: 'Invoiced', value: inrFull(d.invoiced) },
                        { color: SERIES.orange, name: 'Paid', value: inrFull(d.paid) },
                      ]}
                    />
                  );
                }}
              />
              <Bar dataKey="invoiced" name="Invoiced" fill={SERIES.blue} barSize={14} radius={[4, 4, 0, 0]} isAnimationActive={!prefersReducedMotion()} />
              <Bar dataKey="paid" name="Paid" fill={SERIES.orange} barSize={14} radius={[4, 4, 0, 0]} isAnimationActive={!prefersReducedMotion()} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    />
  );
}
