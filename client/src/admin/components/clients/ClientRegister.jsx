import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Download, Eye, Edit2, Table2, UserMinus, UserCheck, X } from 'lucide-react';

// Spreadsheet view of the client list (server/services/clientRegister.js) — the
// columns of the client's "Client list View" sample: one row per client with
// package / GST / total, received, balance and money received each month of a
// financial year. Uses the same filters as the client table above it.

const money = (n) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }));
const day = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const STATUS_CLS = {
  Active: 'bg-green-500/10 text-green-400 border-green-500/20',
  'In-Active': 'bg-gray-500/10 text-on-surface-variant border-gray-500/20',
  'On hold': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
};

/** The current financial year (Apr–Mar) by its starting year. */
const currentFy = () => { const d = new Date(); return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; };

const BOM = String.fromCharCode(0xfeff); // so Excel reads ₹ and names correctly
const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

const Item = ({ label, children }) => (
  <div className="space-y-1">
    <p className="text-on-surface-variant text-[10px] uppercase font-bold tracking-wider">{label}</p>
    <div className="text-on-surface text-sm font-medium">{children}</div>
  </div>
);

/**
 * One client's register row, for the client's Overview tab: the same figures as the
 * register table (same API), laid out as cards plus the month-wise received strip.
 */
export function ClientRegisterSummary({ http, base, client }) {
  const [fy, setFy] = useState(currentFy());
  const [result, setResult] = useState({ key: null, data: null, row: null });
  const key = `${client._id}:${fy}`;

  useEffect(() => {
    let cancelled = false;
    http.get(`${base}/client-register`, { params: { fy, status: 'all', search: client.clientId || client.businessName } })
      .then((r) => {
        if (cancelled) return;
        const data = r.data.data;
        setResult({ key, data, row: data.rows.find((x) => String(x._id) === String(client._id)) || null });
      })
      .catch(() => { if (!cancelled) setResult({ key, data: null, row: null }); });
    return () => { cancelled = true; };
  }, [http, base, client._id, client.clientId, client.businessName, fy, key]);

  if (result.key !== key) return <div className="h-20 flex items-center justify-center"><div className="w-5 h-5 border-2 border-secondary/30 border-t-secondary rounded-full animate-spin" /></div>;
  const { data, row: r } = result;
  if (!r) return null;

  const years = [currentFy() + 1, currentFy(), currentFy() - 1, currentFy() - 2];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Item label="Client status">
          <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${STATUS_CLS[r.serviceStatus] || STATUS_CLS['In-Active']}`}>{r.serviceStatus}</span>
          {r.offboardedAt && <p className="text-on-surface-variant text-[11px] mt-1">Offboarded {day(r.offboardedAt)}{r.offboardReason ? ` — ${r.offboardReason}` : ''}</p>}
        </Item>
        <Item label="Stage">{r.stage}{r.stageReason && <span className="block text-[11px] text-on-surface-variant font-normal">{r.stageReason}</span>}</Item>
        <Item label="Domain(s)">{r.domains.length ? r.domains.map((d) => <span key={d} className="block break-all">{d}</span>) : '—'}</Item>
        <Item label="Onboarding date">{day(r.onboardingDate)}</Item>
        <Item label="Billing">{r.billingType || '—'}{r.packageNames?.length ? <span className="block text-[11px] text-on-surface-variant">{r.packageNames.join(', ')}</span> : null}</Item>
        <Item label="Account manager">{r.accountManagerName || '—'}</Item>
      </div>

      {r.months && (<>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            ['Package', r.packageAmount],
            [`GST @${data.gstPercent}%`, r.gstAmount],
            ['Total', r.totalAmount],
            ['Received', r.received, 'text-green-400'],
            ['Balance', r.balance, r.overdueAmount > 0 ? 'text-red-400' : ''],
            [`Last month (${data.lastMonthLabel})`, r.lastMonth],
          ].map(([label, value, cls]) => (
            <div key={label} className="rounded-xl border border-outline-variant bg-admin-bg/60 px-3 py-2.5">
              <p className="text-on-surface-variant text-[10px] uppercase font-bold tracking-wider">{label}</p>
              <p className={`text-base font-bold mt-0.5 ${cls || 'text-on-surface'}`}>{value === null || value === undefined ? '—' : `₹${money(value)}`}</p>
              {label === 'Balance' && r.overdueAmount > 0 && <p className="text-[10px] text-red-400">₹{money(r.overdueAmount)} overdue</p>}
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-outline-variant overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-admin-bg/60 border-b border-outline-variant">
            <p className="text-on-surface-variant text-[10px] uppercase font-bold tracking-wider">Received by month</p>
            <select value={fy} onChange={(e) => setFy(Number(e.target.value))} aria-label="Financial year"
              className="bg-admin-bg border border-outline-variant rounded-lg px-2 py-1 text-[11px] text-on-surface focus:outline-none cursor-pointer">
              {years.map((y) => <option key={y} value={y}>FY {y}-{String(y + 1).slice(-2)}</option>)}
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="text-[11px] min-w-full">
              <thead className="text-on-surface-variant">
                <tr>{data.months.map((m) => <th key={m.key} className="px-2.5 py-1.5 font-semibold text-right whitespace-nowrap">{m.label}</th>)}<th className="px-2.5 py-1.5 font-semibold text-right">Total</th></tr>
              </thead>
              <tbody>
                <tr>{r.months.map((v, i) => <td key={data.months[i].key} className={`px-2.5 py-1.5 text-right ${v ? 'text-on-surface' : 'text-on-surface-variant/50'}`}>{money(v)}</td>)}<td className="px-2.5 py-1.5 text-right font-bold text-on-surface">{money(r.fyTotal)}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </>)}
    </div>
  );
}

// canOffboard: Super Admin only (the server refuses everyone else)
export default function ClientRegister({ http, base, filters, onView, onEdit, canEdit, canOffboard }) {
  const [fy, setFy] = useState(currentFy());
  const [reload, setReload] = useState(0);
  const [offboard, setOffboard] = useState(null); // the row being offboarded
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  // { key, data } — the answer and what it was loaded for; loading until the current request has answered
  const requestKey = JSON.stringify({ fy, filters, reload });
  const [result, setResult] = useState({ key: null, data: null });
  const loading = result.key !== requestKey;
  const data = result.data;

  useEffect(() => {
    let cancelled = false;
    http.get(`${base}/client-register`, { params: { fy, ...filters } })
      .then((r) => { if (!cancelled) setResult({ key: requestKey, data: r.data.data }); })
      .catch(() => {
        if (cancelled) return;
        toast.error('Could not load the client register');
        setResult((prev) => ({ key: requestKey, data: prev.data }));
      });
    return () => { cancelled = true; };
  }, [http, base, fy, filters, reload, requestKey]);

  // Offboard = the engagement ended ("In-Active"); login stays open
  const submitOffboard = async () => {
    setBusy(true);
    try {
      const r = await http.post(`${base}/clients/${offboard._id}/offboard`, { reason });
      if (r.data.activeRetainers) toast(r.data.message, { icon: '⚠️', duration: 8000 });
      else toast.success(r.data.message);
      setOffboard(null);
      setReload((n) => n + 1);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not offboard the client');
    } finally { setBusy(false); }
  };
  const onboardAgain = async (row) => {
    if (!window.confirm(`Mark ${row.businessName} as Active again?`)) return;
    try {
      const r = await http.post(`${base}/clients/${row._id}/onboard-again`);
      toast.success(r.data.message);
      setReload((n) => n + 1);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not update the client');
    }
  };

  const showMoney = Boolean(data?.totals) || Boolean(data?.rows?.some((r) => r.months));
  const years = useMemo(() => { const now = currentFy(); return [now + 1, now, now - 1, now - 2]; }, []);

  const download = () => {
    if (!data) return;
    const head = ['Client ID', 'Business', 'Party / Contact', 'Domain', 'Onboarding Date', 'Billing', 'Client Status', 'Stage', 'Account Manager',
      ...(showMoney ? ['Package (₹)', `GST @${data.gstPercent}% (₹)`, 'Total (₹)', 'Received (₹)', 'Balance (₹)', ...data.months.map((m) => m.label), `Overall Payment ${data.fyLabel}`, `Revenue Last Month (${data.lastMonthLabel})`] : [])];
    const line = (r) => [r.clientId, r.businessName, r.party, r.domains.join(' | '), r.onboardingDate ? new Date(r.onboardingDate).toLocaleDateString('en-CA') : '',
      r.billingType || '', r.serviceStatus, r.stage || '', r.accountManagerName || '',
      ...(showMoney ? (r.months ? [r.packageAmount, r.gstAmount, r.totalAmount, r.received, r.balance, ...r.months, r.fyTotal, r.lastMonth] : Array(7 + data.months.length).fill('')) : [])];
    const rows = [head, ...data.rows.map(line)];
    if (showMoney && data.totals) {
      const t = data.totals;
      rows.push(['Total', '', '', '', '', '', '', '', '', t.packageAmount, t.gstAmount, t.totalAmount, t.received, t.balance, ...t.months, t.fyTotal, t.lastMonth]);
    }
    const blob = new Blob([`${BOM}${rows.map((r) => r.map(csvCell).join(',')).join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Client-Register-${data.fyLabel.replace(/\s/g, '-')}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 30_000);
  };

  const th = 'px-3 py-2.5 font-semibold whitespace-nowrap';
  const td = 'px-3 py-2 whitespace-nowrap';
  // First two columns stay put while scrolling sideways
  const stick1 = 'sticky left-0 z-10 bg-surface';
  const stick2 = 'sticky left-[150px] z-10 bg-surface';

  return (
    <div className="bg-surface border border-outline-variant rounded-xl overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-outline-variant">
        <div className="flex items-center gap-2 text-on-surface text-sm font-semibold">
          <Table2 size={16} className="text-secondary" /> Client register
          {data && <span className="text-on-surface-variant font-normal text-xs">· {data.rows.length} clients</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showMoney && (
            <label className="flex items-center gap-2 text-xs text-on-surface-variant">
              Financial year
              <select value={fy} onChange={(e) => setFy(Number(e.target.value))}
                className="bg-admin-bg border border-outline-variant rounded-lg px-3 py-1.5 text-xs text-on-surface focus:outline-none focus:border-secondary cursor-pointer">
                {years.map((y) => <option key={y} value={y}>FY {y}-{String(y + 1).slice(-2)} (Apr–Mar)</option>)}
              </select>
            </label>
          )}
          <button type="button" onClick={download} disabled={!data?.rows?.length}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-outline-variant text-on-surface-variant hover:text-on-surface text-xs font-medium cursor-pointer disabled:opacity-40">
            <Download size={14} /> Download (Excel / CSV)
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="w-7 h-7 border-2 border-secondary/30 border-t-secondary rounded-full animate-spin" /></div>
      ) : !data?.rows?.length ? (
        <p className="text-center py-16 text-on-surface-variant">No clients found</p>
      ) : (
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="text-xs border-separate border-spacing-0 min-w-full">
            <thead className="sticky top-0 z-20 bg-admin-bg text-on-surface-variant uppercase tracking-wider text-[10px]">
              <tr>
                <th className={`${th} ${stick1} bg-admin-bg text-left w-[150px] min-w-[150px]`}>Client ID</th>
                <th className={`${th} ${stick2} bg-admin-bg text-left border-r border-outline-variant`}>Party / Business</th>
                <th className={`${th} text-left`}>Domain</th>
                <th className={`${th} text-left`}>Onboarding</th>
                <th className={`${th} text-left`}>Billing</th>
                <th className={`${th} text-center`}>Client Status</th>
                <th className={`${th} text-left`}>Stage</th>
                {showMoney && (<>
                  <th className={`${th} text-right`}>Package ₹</th>
                  <th className={`${th} text-right`}>GST @{data.gstPercent}% ₹</th>
                  <th className={`${th} text-right`}>Total ₹</th>
                  <th className={`${th} text-right`}>Received ₹</th>
                  <th className={`${th} text-right`}>Balance ₹</th>
                  {data.months.map((m) => <th key={m.key} className={`${th} text-right bg-secondary/5`}>{m.label}</th>)}
                  <th className={`${th} text-right`}>Overall {data.fyLabel}</th>
                  <th className={`${th} text-right`}>Last month ({data.lastMonthLabel})</th>
                </>)}
                <th className={`${th} text-center`}>Actions</th>
              </tr>
            </thead>
            <tbody className="text-on-surface">
              {data.rows.map((r) => (
                <tr key={r._id} className="hover:bg-surface-container-low">
                  <td className={`${td} ${stick1} font-mono text-secondary border-b border-outline-variant`}>{r.clientId}</td>
                  <td className={`${td} ${stick2} border-b border-r border-outline-variant max-w-[220px]`}>
                    <span className="block font-medium truncate">{r.party || '—'}</span>
                    <span className="block text-on-surface-variant text-[10px] truncate">{r.businessName}</span>
                  </td>
                  <td className={`${td} border-b border-outline-variant`}>
                    {r.domains.length ? r.domains.map((d) => <span key={d} className="block">{d}</span>) : '—'}
                  </td>
                  <td className={`${td} border-b border-outline-variant`}>{day(r.onboardingDate)}</td>
                  <td className={`${td} border-b border-outline-variant`}>
                    {r.billingType || '—'}
                    {r.packageNames?.length > 1 && <span className="block text-[10px] text-on-surface-variant">{r.packageNames.length} retainers</span>}
                  </td>
                  <td className={`${td} text-center border-b border-outline-variant`}>
                    <span title={r.offboardReason ? `Offboarded ${day(r.offboardedAt)}: ${r.offboardReason}` : undefined}
                      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${STATUS_CLS[r.serviceStatus] || STATUS_CLS['In-Active']}`}>{r.serviceStatus}</span>
                    {r.offboardedAt && <span className="block text-[10px] text-on-surface-variant mt-0.5">{r.offboardSource === 'auto' ? 'auto · ' : ''}since {day(r.offboardedAt)}</span>}
                    {r.state === 'inactive' && <span className="block text-[10px] text-red-400 mt-0.5">login suspended</span>}
                  </td>
                  <td className={`${td} border-b border-outline-variant`} title={r.stageReason}>{r.stage}</td>
                  {showMoney && (r.months ? (<>
                    <td className={`${td} text-right border-b border-outline-variant`}>{money(r.packageAmount)}</td>
                    <td className={`${td} text-right border-b border-outline-variant`}>{money(r.gstAmount)}</td>
                    <td className={`${td} text-right font-semibold border-b border-outline-variant`}>{money(r.totalAmount)}</td>
                    <td className={`${td} text-right text-green-400 border-b border-outline-variant`}>{money(r.received)}</td>
                    <td className={`${td} text-right border-b border-outline-variant ${r.overdueAmount > 0 ? 'text-red-400 font-semibold' : ''}`}
                      title={r.overdueAmount > 0 ? `₹${money(r.overdueAmount)} overdue` : undefined}>{money(r.balance)}</td>
                    {r.months.map((v, i) => <td key={data.months[i].key} className={`${td} text-right border-b border-outline-variant bg-secondary/5 ${v ? '' : 'text-on-surface-variant/50'}`}>{money(v)}</td>)}
                    <td className={`${td} text-right font-semibold border-b border-outline-variant`}>{money(r.fyTotal)}</td>
                    <td className={`${td} text-right border-b border-outline-variant`}>{money(r.lastMonth)}</td>
                  </>) : (
                    <td colSpan={7 + data.months.length} className={`${td} text-center text-on-surface-variant border-b border-outline-variant`}>No invoice access for this client</td>
                  ))}
                  <td className={`${td} border-b border-outline-variant`}>
                    <div className="flex items-center justify-center gap-1">
                      <button type="button" onClick={() => onView(r)} title="Open client" className="p-1.5 text-blue-400 hover:bg-blue-500/10 rounded-lg cursor-pointer"><Eye size={14} /></button>
                      {canEdit && <button type="button" onClick={() => onEdit(r)} title="Edit" className="p-1.5 text-secondary hover:bg-secondary/10 rounded-lg cursor-pointer"><Edit2 size={14} /></button>}
                      {canOffboard && (r.offboardedAt
                        ? <button type="button" onClick={() => onboardAgain(r)} title="Onboard again (Active)" className="p-1.5 text-green-400 hover:bg-green-500/10 rounded-lg cursor-pointer"><UserCheck size={14} /></button>
                        : <button type="button" onClick={() => { setOffboard(r); setReason(''); }} title="Offboard (In-Active)" className="p-1.5 text-on-surface-variant hover:bg-surface-container-low rounded-lg cursor-pointer"><UserMinus size={14} /></button>)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {showMoney && data.totals && (
              <tfoot className="sticky bottom-0 z-20 bg-admin-bg font-bold text-on-surface">
                <tr>
                  <td className={`${td} ${stick1} bg-admin-bg`}>Total</td>
                  <td className={`${td} ${stick2} bg-admin-bg border-r border-outline-variant`} />
                  <td colSpan={4} className={td} />
                  <td className={`${td} text-right`}>{money(data.totals.packageAmount)}</td>
                  <td className={`${td} text-right`}>{money(data.totals.gstAmount)}</td>
                  <td className={`${td} text-right`}>{money(data.totals.totalAmount)}</td>
                  <td className={`${td} text-right text-green-400`}>{money(data.totals.received)}</td>
                  <td className={`${td} text-right`}>{money(data.totals.balance)}</td>
                  {data.totals.months.map((v, i) => <td key={data.months[i].key} className={`${td} text-right`}>{money(v)}</td>)}
                  <td className={`${td} text-right`}>{money(data.totals.fyTotal)}</td>
                  <td className={`${td} text-right`}>{money(data.totals.lastMonth)}</td>
                  <td className={td} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
      {offboard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-surface border border-outline-variant rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant">
              <h3 className="text-on-surface font-semibold">Offboard {offboard.businessName}</h3>
              <button type="button" onClick={() => setOffboard(null)} className="p-1.5 rounded-lg hover:bg-surface-container-low text-on-surface-variant cursor-pointer"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-3">
              <p className="text-xs text-on-surface-variant">The client becomes <strong>In-Active</strong>. Their login stays open so they can still see and pay invoices, and all history is kept. You can mark them Active again later.</p>
              <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (e.g. contract ended on 30 Sep)"
                className="w-full px-3 py-2 bg-admin-bg border border-outline-variant rounded-xl text-on-surface text-sm focus:outline-none focus:border-secondary resize-none" />
              <div className="flex gap-3">
                <button type="button" disabled={busy || reason.trim().length < 5} onClick={submitOffboard}
                  className="px-5 py-2.5 bg-secondary text-white rounded-xl text-sm font-medium hover:bg-secondary/90 disabled:opacity-50 cursor-pointer">
                  {busy ? 'Saving…' : 'Offboard'}
                </button>
                <button type="button" onClick={() => setOffboard(null)}
                  className="px-5 py-2.5 bg-admin-bg border border-outline-variant text-on-surface-variant hover:text-on-surface rounded-xl text-sm cursor-pointer">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <p className="px-4 py-2.5 text-[11px] text-on-surface-variant border-t border-outline-variant">
        Package = active retainers per billing cycle (excl. GST); a client without one shows its one-time invoices. Received = paid against sent invoices; months show when the money came in, and add up to Received across all years. In-Active = offboarded.
      </p>
    </div>
  );
}
