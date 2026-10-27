import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Download } from 'lucide-react';

// Receivables ageing (server: GET /receivables/ageing): what each client still owes, net of credit
// notes and payments, by how long it has been overdue.
const inr = (n) => (n ? `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—');

export default function AgeingPanel({ http, base }) {
  const [result, setResult] = useState({ done: false, data: null });

  useEffect(() => {
    let live = true;
    http.get(`${base}/receivables/ageing`)
      .then((r) => { if (live) setResult({ done: true, data: r.data.data }); })
      .catch(() => { if (live) { toast.error('Could not load the ageing report'); setResult({ done: true, data: null }); } });
    return () => { live = false; };
  }, [http, base]);

  const download = async () => {
    try {
      const { data } = await http.get(`${base}/receivables/ageing`, { params: { format: 'csv' }, responseType: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(data);
      a.download = `receivables-ageing-${new Date().toLocaleDateString('en-CA')}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 30_000);
    } catch { toast.error('Could not download'); }
  };

  if (!result.done) return <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-secondary/30 border-t-secondary rounded-full animate-spin" /></div>;
  const report = result.data;
  if (!report) return null;

  const th = 'px-3 py-2.5 font-semibold whitespace-nowrap text-right';
  const td = 'px-3 py-2.5 whitespace-nowrap text-right border-b border-outline-variant';
  return (
    <div className="bg-surface border border-outline-variant rounded-xl overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-outline-variant">
        <p className="text-on-surface text-sm font-semibold">Receivables ageing <span className="text-on-surface-variant font-normal text-xs">· as on {new Date(report.asOf).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span></p>
        <button type="button" onClick={download} disabled={!report.rows.length}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-outline-variant text-on-surface-variant hover:text-on-surface text-xs font-medium cursor-pointer disabled:opacity-40"><Download size={14} /> Download (Excel / CSV)</button>
      </div>
      {!report.rows.length ? (
        <p className="text-center py-14 text-on-surface-variant text-sm">Nothing is outstanding.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="text-xs min-w-full">
            <thead className="bg-admin-bg text-on-surface-variant uppercase tracking-wider text-[10px]">
              <tr>
                <th className={`${th} text-left`}>Client</th>
                {report.buckets.map((b) => <th key={b.key} className={`${th} ${b.key === 'd90plus' ? 'text-red-400' : ''}`}>{b.label}</th>)}
                <th className={th}>Total owed</th>
                <th className={th}>Invoices</th>
              </tr>
            </thead>
            <tbody className="text-on-surface">
              {report.rows.map((r) => (
                <tr key={r.clientRef} className="hover:bg-surface-container-low">
                  <td className={`${td} text-left`}><span className="font-medium">{r.businessName}</span><span className="block text-[10px] text-on-surface-variant font-mono">{r.clientId}</span></td>
                  {report.buckets.map((b) => <td key={b.key} className={`${td} ${r[b.key] && b.key !== 'notDue' ? 'text-amber-400' : ''} ${r[b.key] && b.key === 'd90plus' ? '!text-red-400 font-semibold' : ''}`}>{inr(r[b.key])}</td>)}
                  <td className={`${td} font-semibold`}>{inr(r.total)}</td>
                  <td className={`${td} text-on-surface-variant`}>{r.invoices}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-admin-bg font-bold text-on-surface">
              <tr>
                <td className="px-3 py-2.5 text-left">Total</td>
                {report.buckets.map((b) => <td key={b.key} className="px-3 py-2.5 text-right whitespace-nowrap">{inr(report.totals[b.key])}</td>)}
                <td className="px-3 py-2.5 text-right">{inr(report.totals.total)}</td>
                <td className="px-3 py-2.5 text-right">{report.totals.invoices}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <p className="px-4 py-2.5 text-[11px] text-on-surface-variant border-t border-outline-variant">Counts only invoices already sent to the client. Each amount is what is still owed after payments and credit notes.</p>
    </div>
  );
}
