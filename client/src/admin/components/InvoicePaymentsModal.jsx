import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { X, Plus, FileText, Receipt, MinusCircle } from 'lucide-react';
import { openPdf } from '../../employee/lib/ess';

// One invoice's money: what has been paid (with receipts) and credited, and — with edit access —
// recording a payment received outside the portal and issuing a credit note.
// Server: services/receivables.js.
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const day = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const today = () => new Date().toLocaleDateString('en-CA');
const field = 'w-full px-3 py-2 bg-admin-bg border border-outline-variant rounded-lg text-on-surface text-sm focus:outline-none focus:border-secondary';
const label = 'block text-on-surface-variant text-[10px] uppercase font-bold tracking-wider mb-1';
const STATUS_CLS = { Approved: 'text-green-400', Pending: 'text-amber-400', Rejected: 'text-red-400' };

export default function InvoicePaymentsModal({ invoice, http, base, canEdit, onClose, onChanged }) {
  const [result, setResult] = useState({ key: null, data: null });
  const [reload, setReload] = useState(0);
  const [form, setForm] = useState(null); // { kind: 'payment' | 'credit', ... }
  const [saving, setSaving] = useState(false);
  const key = `${invoice._id}:${reload}`;

  useEffect(() => {
    let live = true;
    http.get(`${base}/invoices/${invoice._id}/payments`)
      .then((r) => { if (live) setResult({ key, data: r.data.data }); })
      .catch(() => { if (live) { toast.error('Could not load the payments'); setResult({ key, data: null }); } });
    return () => { live = false; };
  }, [http, base, invoice._id, key]);

  const data = result.data;
  const loading = result.key !== key;
  const inv = data?.invoice || invoice;
  const balance = inv.balance ?? Math.max(0, (inv.totalAmount || 0) - (inv.creditedAmount || 0) - (inv.paidAmount || 0));

  const open = (path, name) => openPdf(`${base}/invoices/${invoice._id}/${path}`, { http, filename: name }).catch(() => toast.error('Could not open the PDF'));

  const submit = async () => {
    setSaving(true);
    try {
      const isPayment = form.kind === 'payment';
      const body = isPayment
        ? { amount: form.amount, date: form.date, method: form.method, reference: form.reference, note: form.note }
        : { amount: form.amount, date: form.date, reason: form.reason };
      const res = await http.post(`${base}/invoices/${invoice._id}/${isPayment ? 'payments' : 'credit-notes'}`, body);
      toast.success(res.data.message);
      setForm(null);
      setReload((n) => n + 1);
      onChanged?.();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not save');
    } finally { setSaving(false); }
  };

  const taxPercent = Number(inv.taxPercent) || 0;
  const creditGross = form?.kind === 'credit' ? Math.round((Number(form.amount) || 0) * (100 + taxPercent)) / 100 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[88vh] flex flex-col bg-surface border border-outline-variant rounded-2xl shadow-2xl overflow-hidden">
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-outline-variant">
          <div>
            <h3 className="text-on-surface font-semibold">Payments · {invoice.invoiceId}</h3>
            <p className="text-on-surface-variant text-xs mt-0.5">{invoice.client_ref?.businessName}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-container-low text-on-surface-variant cursor-pointer"><X size={16} /></button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto overscroll-contain">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              ['Invoice total', inr(inv.totalAmount)],
              ['Credit notes', inv.creditedAmount > 0 ? `- ${inr(inv.creditedAmount)}` : '—'],
              ['Paid', inr(inv.paidAmount)],
              ['Balance', inr(balance), balance > 0 && inv.isOverdue ? 'text-red-400' : ''],
            ].map(([k, v, cls]) => (
              <div key={k} className="rounded-xl border border-outline-variant bg-admin-bg/60 px-3 py-2.5">
                <p className="text-on-surface-variant text-[10px] uppercase font-bold tracking-wider">{k}</p>
                <p className={`text-base font-bold mt-0.5 ${cls || 'text-on-surface'}`}>{v}</p>
              </div>
            ))}
          </div>

          {canEdit && !form && balance > 0 && (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setForm({ kind: 'payment', amount: '', date: today(), method: 'UPI', reference: '', note: '' })}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-secondary text-white text-sm font-semibold hover:bg-secondary/90 cursor-pointer"><Plus size={14} /> Record payment</button>
              <button type="button" onClick={() => setForm({ kind: 'credit', amount: '', date: today(), reason: '' })}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-outline-variant text-on-surface-variant hover:text-on-surface text-sm font-semibold cursor-pointer"><MinusCircle size={14} /> Issue credit note</button>
            </div>
          )}

          {form && (
            <div className="rounded-xl border border-secondary/30 bg-secondary/5 p-4 space-y-3">
              <p className="text-on-surface text-sm font-semibold">{form.kind === 'payment' ? 'Record a payment received' : 'Issue a credit note'}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className={label}>{form.kind === 'payment' ? 'Amount received (₹) *' : 'Amount to credit, before GST (₹) *'}</span>
                  <input type="number" min="0" step="0.01" className={field} value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
                  {form.kind === 'credit' && Number(form.amount) > 0 && <span className="block text-[10px] text-on-surface-variant mt-1">+ {taxPercent}% GST = {inr(creditGross)} off the balance of {inr(balance)}</span>}
                  {form.kind === 'payment' && <span className="block text-[10px] text-on-surface-variant mt-1">Up to the balance of {inr(balance)}</span>}
                </label>
                <label className="block">
                  <span className={label}>{form.kind === 'payment' ? 'Date received *' : 'Credit note date *'}</span>
                  <input type="date" max={today()} className={`${field} [color-scheme:dark]`} value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
                </label>
                {form.kind === 'payment' ? (<>
                  <label className="block">
                    <span className={label}>Method *</span>
                    <select className={field} value={form.method} onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))}>{(data?.methods || ['UPI', 'Bank Transfer', 'Cash', 'Cheque', 'Card', 'Other']).map((m) => <option key={m}>{m}</option>)}</select>
                  </label>
                  <label className="block">
                    <span className={label}>Reference (UTR / cheque no.){form.method === 'Cash' ? '' : ' *'}</span>
                    <input className={`${field} font-mono`} value={form.reference} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className={label}>Note (internal)</span>
                    <input className={field} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
                  </label>
                </>) : (
                  <label className="block sm:col-span-2">
                    <span className={label}>Reason * (the client sees this)</span>
                    <textarea rows={2} maxLength={500} className={`${field} resize-none`} value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder="e.g. Discount agreed for the delayed start" />
                  </label>
                )}
              </div>
              <div className="flex gap-2">
                <button type="button" disabled={saving || !(Number(form.amount) > 0)} onClick={submit}
                  className="px-4 py-2 bg-secondary text-white rounded-lg text-sm font-medium hover:bg-secondary/90 disabled:opacity-50 cursor-pointer">{saving ? 'Saving…' : form.kind === 'payment' ? 'Record payment' : 'Issue credit note'}</button>
                <button type="button" onClick={() => setForm(null)} className="px-4 py-2 border border-outline-variant text-on-surface-variant rounded-lg text-sm cursor-pointer">Cancel</button>
              </div>
            </div>
          )}

          <section className="space-y-2">
            <h4 className="text-on-surface-variant text-[10px] uppercase font-bold tracking-wider">Payments</h4>
            {loading ? <p className="text-xs text-on-surface-variant">Loading…</p>
              : !data?.payments?.length ? <p className="text-xs text-on-surface-variant">No payments yet.</p>
                : (
                  <ul className="divide-y divide-outline-variant rounded-xl border border-outline-variant">
                    {data.payments.map((p) => (
                      <li key={p._id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5 text-xs">
                        <span className="font-semibold text-on-surface w-24">{inr(p.amountPaid)}</span>
                        <span className="text-on-surface-variant">{day(p.paymentDate)}</span>
                        <span className="text-on-surface">{p.method || '—'}</span>
                        <span className="font-mono text-on-surface-variant">{p.utrNumber || ''}</span>
                        <span className={STATUS_CLS[p.status]}>{p.status}{p.source === 'staff' ? ' · recorded by staff' : ''}</span>
                        {p.status === 'Approved' && p.receiptNumber && (
                          <button type="button" onClick={() => open(`payments/${p._id}/receipt`, `Receipt-${p.receiptNumber}.pdf`)}
                            className="ml-auto flex items-center gap-1 text-secondary font-medium hover:underline cursor-pointer"><Receipt size={13} /> Receipt #{p.receiptNumber}</button>
                        )}
                        {p.note && <span className="basis-full text-on-surface-variant">{p.note}</span>}
                      </li>
                    ))}
                  </ul>
                )}
          </section>

          {data?.creditNotes?.length > 0 && (
            <section className="space-y-2">
              <h4 className="text-on-surface-variant text-[10px] uppercase font-bold tracking-wider">Credit notes</h4>
              <ul className="divide-y divide-outline-variant rounded-xl border border-outline-variant">
                {data.creditNotes.map((n) => (
                  <li key={n._id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5 text-xs">
                    <span className="font-semibold text-on-surface w-24">- {inr(n.totalAmount)}</span>
                    <span className="text-on-surface-variant">{day(n.date)}</span>
                    <span className="text-on-surface">{n.reason}</span>
                    <button type="button" onClick={() => open(`credit-notes/${n._id}/pdf`, `Credit-Note-${n.number}.pdf`)}
                      className="ml-auto flex items-center gap-1 text-secondary font-medium hover:underline cursor-pointer"><FileText size={13} /> CN-{n.number}</button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
