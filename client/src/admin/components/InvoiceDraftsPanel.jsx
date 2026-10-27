import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import useBodyScrollLock from '../hooks/useBodyScrollLock';
import { useServiceList } from '../../shared/useServiceList';
import { CheckCircle2, AlertTriangle, Edit2, SkipForward, RefreshCcw, Plus, Trash2, X, Save } from 'lucide-react';

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const fmt = (d) => (d ? new Date(d.length === 10 ? `${d}T12:00:00` : d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const toDay = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
const inputCls = 'w-full px-3 py-2 bg-admin-bg border border-outline-variant rounded-lg text-on-surface text-sm focus:outline-none focus:border-secondary';

const STATUS = {
  'Pending Approval': 'text-blue-400 bg-blue-500/10 border-blue-500/25',
  'Needs Attention': 'text-amber-400 bg-amber-500/10 border-amber-500/25',
  Approved: 'text-green-400 bg-green-500/10 border-green-500/25',
  Skipped: 'text-on-surface-variant bg-surface-container-low border-outline-variant',
};

function EditDraft({ draft, http, base, onClose, onSaved }) {
  useBodyScrollLock(onClose);
  // Revenue type and service travel with each line, so a correction keeps them
  const [items, setItems] = useState(draft.lineItems.length
    ? draft.lineItems.map((i) => ({ description: i.description, qty: i.qty, unitPrice: i.unitPrice, revenueType: i.revenueType, service: i.service || '' }))
    : [{ description: '', qty: 1, unitPrice: '', service: '' }]);
  const services = useServiceList(http, base);
  const [dueDate, setDueDate] = useState(toDay(draft.dueDate));
  const [taxPercent, setTaxPercent] = useState(draft.taxPercent);
  const [note, setNote] = useState(draft.note || '');
  const [saving, setSaving] = useState(false);

  const subtotal = items.reduce((s, i) => s + (Number(i.unitPrice) || 0) * (Number(i.qty) || 0), 0);
  const tax = (subtotal * (Number(taxPercent) || 0)) / 100;
  const set = (idx, k) => (e) => setItems((l) => l.map((it, j) => (j === idx ? { ...it, [k]: e.target.value } : it)));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await http.put(`${base}/invoice-drafts/${draft._id}`, { lineItems: items, dueDate, taxPercent: Number(taxPercent), note });
      toast.success(res.data.message);
      onSaved();
    } catch (err) { toast.error(err?.response?.data?.message || 'Could not save'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form onSubmit={save} role="dialog" aria-modal="true" aria-label="Correct scheduled invoice" className="w-full max-w-2xl bg-surface border border-outline-variant rounded-2xl shadow-2xl my-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant">
          <h3 className="text-on-surface font-semibold">Correct invoice — {draft.client?.businessName}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-surface-container-low text-on-surface-variant cursor-pointer"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-on-surface-variant">Covers {fmt(draft.periodStart)} to {fmt(draft.periodEnd)}. Nothing reaches the client until you approve it and then send it from Invoices.</p>
          <div className="space-y-2">
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-[1fr_4.5rem_7rem_auto] gap-2 items-start">
                <select aria-label="Service" value={it.service || ''} onChange={set(i, 'service')} className={`${inputCls} col-span-4 ${it.service ? '' : 'text-amber-400'}`}>
                  <option value="">Service: Unassigned</option>
                  {[...new Set([...services, ...(it.service ? [it.service] : [])])].map((sv) => <option key={sv} value={sv}>{sv}</option>)}
                </select>
                <input aria-label="Description" className={inputCls} placeholder="Description" value={it.description} onChange={set(i, 'description')} required />
                <input aria-label="Quantity" type="number" min="1" step="1" className={inputCls} value={it.qty} onChange={set(i, 'qty')} required />
                <input aria-label="Price (₹)" type="number" min="0" step="0.01" className={inputCls} placeholder="₹" value={it.unitPrice} onChange={set(i, 'unitPrice')} required />
                <button type="button" aria-label="Remove line" onClick={() => setItems((l) => l.filter((_, j) => j !== i))} disabled={items.length === 1} className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg disabled:opacity-30 cursor-pointer"><Trash2 size={15} /></button>
              </div>
            ))}
            <button type="button" onClick={() => setItems((l) => [...l, { description: '', qty: 1, unitPrice: '', service: '' }])} className="flex items-center gap-1.5 text-secondary text-xs font-medium cursor-pointer"><Plus size={13} /> Add a line</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="block text-on-surface-variant text-[10px] uppercase font-bold tracking-wider mb-1">Due date</span>
              <input type="date" className={inputCls} value={dueDate} min={draft.invoiceDate} onChange={(e) => setDueDate(e.target.value)} required /></label>
            <label className="block"><span className="block text-on-surface-variant text-[10px] uppercase font-bold tracking-wider mb-1">GST (%)</span>
              <input type="number" min="0" max="28" step="1" className={inputCls} value={taxPercent} onChange={(e) => setTaxPercent(e.target.value)} /></label>
          </div>
          <label className="block"><span className="block text-on-surface-variant text-[10px] uppercase font-bold tracking-wider mb-1">Why you changed it (internal)</span>
            <input className={inputCls} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} /></label>
          <dl className="rounded-xl border border-outline-variant text-sm divide-y divide-outline-variant">
            <div className="flex justify-between px-3 py-2"><dt className="text-on-surface-variant">Subtotal</dt><dd className="tabular-nums text-on-surface">{inr(subtotal)}</dd></div>
            <div className="flex justify-between px-3 py-2"><dt className="text-on-surface-variant">GST</dt><dd className="tabular-nums text-on-surface">{inr(tax)}</dd></div>
            <div className="flex justify-between px-3 py-2 font-semibold"><dt className="text-on-surface">Total</dt><dd className="tabular-nums text-on-surface">{inr(subtotal + tax)}</dd></div>
          </dl>
        </div>
        <div className="px-5 py-3.5 bg-admin-bg/40 border-t border-outline-variant flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-outline-variant text-on-surface-variant text-sm cursor-pointer">Cancel</button>
          <button type="submit" disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-secondary text-white text-sm font-semibold disabled:opacity-60 cursor-pointer"><Save size={14} /> {saving ? 'Saving…' : 'Save correction'}</button>
        </div>
      </form>
    </div>
  );
}

/**
 * Scheduled invoices waiting for an admin. Nothing here has reached the client:
 * correct a draft if it is wrong, then approve it to create and send the invoice.
 */
export default function InvoiceDraftsPanel({ http, base, canApprove, canEdit, onChanged }) {
  const [data, setData] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let live = true;
    http.get(`${base}/invoice-drafts`, { params: { status: showAll ? '' : 'open' } })
      .then((res) => { if (live) setData(res.data.data); })
      .catch(() => toast.error('Could not load the scheduled invoices'));
    return () => { live = false; };
  }, [http, base, showAll, reload]);

  const refresh = useCallback(() => { setReload((n) => n + 1); onChanged?.(); }, [onChanged]);

  const act = async (id, kind, body) => {
    setBusy(id + kind);
    try {
      const res = await http.post(`${base}/invoice-drafts/${id}/${kind}`, body);
      toast.success(res.data.message);
      refresh();
    } catch (err) { toast.error(err?.response?.data?.message || 'That did not work'); }
    finally { setBusy(''); }
  };

  const skip = (d) => {
    const reason = window.prompt(`Skip the ${fmt(d.invoiceDate)} invoice for ${d.client?.businessName}? Say why:`);
    if (reason !== null) act(d._id, 'skip', { reason });
  };
  const approve = (d) => {
    if (window.confirm(`Create the ${inr(d.totalAmount)} invoice for ${d.client?.businessName}? It is saved, not sent: add the billing details and Send it from Invoices.`)) act(d._id, 'approve');
  };

  if (!data) return <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-secondary/30 border-t-secondary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-on-surface-variant max-w-xl">These invoices were created from the clients&apos; billing schedules. The client sees nothing until you approve and send it as a Proforma or Tax Invoice. Correct any that look wrong first.</p>
        <label className="flex items-center gap-2 text-xs text-on-surface-variant cursor-pointer"><input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Show approved and skipped</label>
      </div>

      {data.length === 0 ? (
        <div className="text-center py-14 rounded-xl border border-outline-variant bg-surface"><CheckCircle2 size={32} className="text-green-400 mx-auto mb-2" /><p className="text-on-surface-variant text-sm">Nothing is waiting for approval.</p></div>
      ) : (
        <ul className="space-y-3">
          {data.map((d) => {
            const open = d.status === 'Pending Approval' || d.status === 'Needs Attention';
            return (
              <li key={d._id} className="rounded-xl border border-outline-variant bg-surface p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-on-surface font-semibold">{d.client?.businessName} <span className="text-on-surface-variant font-mono text-xs font-normal">{d.client?.clientId}</span></p>
                    <p className="text-on-surface-variant text-xs mt-0.5">Invoice date {fmt(d.invoiceDate)} · covers {fmt(d.periodStart)} – {fmt(d.periodEnd)} · due {fmt(d.dueDate)}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${STATUS[d.status]}`}>{d.status}{d.corrected && d.status !== 'Skipped' ? ' · corrected' : ''}</span>
                </div>

                {d.problems.length > 0 && (
                  <ul className="space-y-1">{d.problems.map((p) => (
                    <li key={p} className="flex items-start gap-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2"><AlertTriangle size={14} className="shrink-0 mt-0.5" /> {p}</li>
                  ))}</ul>
                )}

                {d.lineItems.length > 0 && (
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-outline-variant">
                      {d.lineItems.map((i, k) => <tr key={k}><td className="py-1.5 pr-3 text-on-surface">{i.description}</td><td className="py-1.5 text-right tabular-nums text-on-surface">{inr(i.amount)}</td></tr>)}
                      <tr><td className="py-1.5 pr-3 text-on-surface-variant">GST {d.taxPercent}%</td><td className="py-1.5 text-right tabular-nums text-on-surface-variant">{inr(d.taxAmount)}</td></tr>
                      <tr className="font-semibold"><td className="py-1.5 pr-3 text-on-surface">Total</td><td className="py-1.5 text-right tabular-nums text-on-surface">{inr(d.totalAmount)}</td></tr>
                    </tbody>
                  </table>
                )}
                {d.note && <p className="text-xs text-on-surface-variant">Note: {d.note}</p>}
                {d.status === 'Skipped' && <p className="text-xs text-on-surface-variant">Skipped by {d.decidedByName}: {d.skipReason}</p>}
                {d.status === 'Approved' && <p className="text-xs text-on-surface-variant">Approved by {d.decidedByName} on {fmt(d.decidedAt)}.</p>}

                {open && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {canApprove && <button type="button" disabled={!!busy || d.status !== 'Pending Approval'} onClick={() => approve(d)} title={d.status !== 'Pending Approval' ? 'Fix the problems first' : ''} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"><CheckCircle2 size={14} /> Approve &amp; send</button>}
                    {canEdit && <button type="button" onClick={() => setEditing(d)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-outline-variant text-on-surface text-sm cursor-pointer hover:bg-surface-container-low"><Edit2 size={14} /> Correct</button>}
                    {canEdit && <button type="button" disabled={!!busy} onClick={() => act(d._id, 'rebuild')} title="Recalculate from the client's current retainers" className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-outline-variant text-on-surface-variant text-sm cursor-pointer hover:bg-surface-container-low disabled:opacity-50"><RefreshCcw size={14} /> Rebuild</button>}
                    {canEdit && <button type="button" disabled={!!busy} onClick={() => skip(d)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-outline-variant text-on-surface-variant text-sm cursor-pointer hover:bg-surface-container-low disabled:opacity-50"><SkipForward size={14} /> Skip</button>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {editing && <EditDraft draft={editing} http={http} base={base} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />}
    </div>
  );
}
