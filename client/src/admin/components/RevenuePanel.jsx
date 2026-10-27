import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

// Revenue by type (server: GET /receivables/revenue). Media spend is shown apart on purpose:
// it is the client's ad budget, not Vedhunt's revenue.
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const iso = (d) => d.toLocaleDateString('en-CA');
const monthStart = () => { const d = new Date(); return iso(new Date(d.getFullYear(), d.getMonth(), 1)); };
const field = 'px-3 py-1.5 bg-admin-bg border border-outline-variant rounded-lg text-on-surface text-xs focus:outline-none focus:border-secondary [color-scheme:dark]';

export default function RevenuePanel({ http, base }) {
  const [range, setRange] = useState({ from: monthStart(), to: iso(new Date()) });
  const [result, setResult] = useState({ key: null, data: null });
  const key = `${range.from}:${range.to}`;

  useEffect(() => {
    if (!range.from || !range.to) return undefined;
    let live = true;
    http.get(`${base}/receivables/revenue`, { params: range })
      .then((r) => { if (live) setResult({ key, data: r.data.data }); })
      .catch((err) => { if (live) { toast.error(err?.response?.data?.message || 'Could not load the revenue report'); setResult({ key, data: null }); } });
    return () => { live = false; };
  }, [http, base, range, key]);

  const loading = result.key !== key;
  const d = result.data;
  const card = (label, value, hint, cls = '') => (
    <div className="rounded-xl border border-outline-variant bg-admin-bg/60 px-4 py-3">
      <p className="text-on-surface-variant text-[10px] uppercase font-bold tracking-wider">{label}</p>
      <p className={`text-lg font-bold mt-0.5 ${cls || 'text-on-surface'}`}>{value}</p>
      {hint && <p className="text-[10px] text-on-surface-variant mt-0.5">{hint}</p>}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input type="date" aria-label="From" value={range.from} max={range.to} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} className={field} />
        <span className="text-on-surface-variant text-xs">to</span>
        <input type="date" aria-label="To" value={range.to} min={range.from} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} className={field} />
      </div>

      {!d ? <p className="text-sm text-on-surface-variant">{loading ? 'Loading…' : 'Nothing to show.'}</p> : (
        <div className={`space-y-4 ${loading ? 'opacity-50' : ''}`}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {card('Net revenue', inr(d.netRevenue), 'Invoices sent less credit notes, excl. GST', 'text-green-400')}
            {card('GST', inr(d.gst), 'Tax on those invoices — not revenue')}
            {card('Cash collected', inr(d.collected), 'Received in this period, incl. GST')}
            {card('Invoices sent', d.invoices, d.creditNoteCount ? `${d.creditNoteCount} credit note${d.creditNoteCount === 1 ? '' : 's'}` : '')}
          </div>

          <div className="bg-surface border border-outline-variant rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-admin-bg text-on-surface-variant text-[10px] uppercase tracking-wider">
                <tr><th className="px-4 py-2.5 text-left font-semibold">Revenue type</th><th className="px-4 py-2.5 text-right font-semibold">Lines</th><th className="px-4 py-2.5 text-right font-semibold">Taxable value</th></tr>
              </thead>
              <tbody className="text-on-surface">
                {d.types.map((t) => (
                  <tr key={t.type} className="border-t border-outline-variant">
                    <td className="px-4 py-2.5">{t.type}{t.type === 'Untyped' && <span className="block text-[10px] text-on-surface-variant">Older invoices, before types existed</span>}</td>
                    <td className="px-4 py-2.5 text-right text-on-surface-variant">{t.lines}</td>
                    <td className="px-4 py-2.5 text-right">{inr(t.taxable)}</td>
                  </tr>
                ))}
                <tr className="border-t border-outline-variant text-blue-400"><td className="px-4 py-2.5">Credit notes</td><td className="px-4 py-2.5 text-right">{d.creditNoteCount}</td><td className="px-4 py-2.5 text-right">- {inr(d.creditNotes)}</td></tr>
              </tbody>
              <tfoot className="bg-admin-bg font-bold text-on-surface"><tr><td className="px-4 py-2.5" colSpan={2}>Net revenue</td><td className="px-4 py-2.5 text-right">{inr(d.netRevenue)}</td></tr></tfoot>
            </table>
          </div>

          <div className="rounded-xl border border-dashed border-outline-variant p-4">
            <p className="text-on-surface text-sm font-semibold">Media spend <span className="text-on-surface-variant font-normal text-xs">· not Vedhunt revenue</span></p>
            <p className="text-on-surface text-lg font-bold mt-1">{inr(d.mediaSpend.total)}</p>
            <p className="text-[11px] text-on-surface-variant mt-0.5">The clients’ ad budget as entered in Ad data. It is paid to the ad platforms and is never on a Vedhunt invoice.</p>
            {d.mediaSpend.byPlatform.length > 0 && <p className="text-xs text-on-surface-variant mt-2">{d.mediaSpend.byPlatform.map((p) => `${p.platform} ${inr(p.spend)}`).join(' · ')}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
