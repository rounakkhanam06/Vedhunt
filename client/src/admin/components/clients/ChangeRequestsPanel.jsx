import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, GitPullRequestArrow } from 'lucide-react';

// Client → Changes tab (server: /clients/:id/change-requests, services/changeRequests.js):
// work outside the signed scope. Quote it → the client approves it (in their Approvals tab) →
// start the work → bill it as its own invoice. Work and invoice are blocked until approval.
const STAGE_CLS = {
  'Awaiting client approval': 'text-amber-400 bg-amber-500/10 border-amber-500/25',
  'Rejected by client': 'text-red-400 bg-red-500/10 border-red-500/25',
  Withdrawn: 'text-on-surface-variant bg-surface-container-low border-outline-variant',
  'Approved — ready to start': 'text-blue-400 bg-blue-500/10 border-blue-500/25',
  'In progress': 'text-violet-400 bg-violet-500/10 border-violet-500/25',
  'Done — not invoiced yet': 'text-amber-400 bg-amber-500/10 border-amber-500/25',
  'Done and invoiced': 'text-green-400 bg-green-500/10 border-green-500/25',
};
const inr = (n) => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const day = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '');
const field = 'w-full px-3 py-2 bg-admin-bg border border-outline-variant rounded-lg text-on-surface text-xs focus:outline-none focus:border-secondary';
const lbl = 'block text-on-surface-variant text-[10px] uppercase font-bold tracking-wider mb-1';
const btn = 'px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer disabled:opacity-50';

export default function ChangeRequestsPanel({ http, base, clientId, canEdit, canInvoice }) {
  const [result, setResult] = useState({ key: null, rows: [] });
  const [reload, setReload] = useState(0);
  const [form, setForm] = useState(null);
  const [withdraw, setWithdraw] = useState(null); // { id, reason }
  const [busy, setBusy] = useState(false);
  const key = `${clientId}:${reload}`;

  useEffect(() => {
    let live = true;
    http.get(`${base}/clients/${clientId}/change-requests`)
      .then((r) => { if (live) setResult({ key, rows: r.data.data }); })
      .catch(() => { if (live) { toast.error('Could not load change requests'); setResult({ key, rows: [] }); } });
    return () => { live = false; };
  }, [http, base, clientId, key]);

  const run = async (fn, okMessage) => {
    setBusy(true);
    try { const res = await fn(); toast.success(okMessage || res?.data?.message || 'Saved'); setForm(null); setWithdraw(null); setReload((n) => n + 1); }
    catch (err) { toast.error(err?.response?.data?.message || 'Could not save'); }
    finally { setBusy(false); }
  };
  const work = (id, status) => run(() => http.put(`${base}/clients/${clientId}/change-requests/${id}/work`, { status }), status === 'Done' ? 'Marked done' : 'Work started');

  if (result.key !== key) return <p className="text-sm text-on-surface-variant">Loading…</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-on-surface text-sm font-semibold flex items-center gap-1.5"><GitPullRequestArrow size={15} className="text-secondary" /> Change requests</h4>
        {canEdit && !form && (
          <button type="button" onClick={() => setForm({ title: '', description: '', quoteAmount: '', estimatedDays: '', assessment: '' })}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-secondary/40 text-secondary text-[11px] font-semibold hover:bg-secondary/10 cursor-pointer"><Plus size={12} /> New change request</button>
        )}
      </div>
      <p className="text-[11px] text-on-surface-variant rounded-lg bg-admin-bg/60 border border-outline-variant px-3 py-2">
        For work outside the signed scope. The client approves the quote in their portal first — work can’t start, and it can’t be invoiced, until they do. It is billed as its own invoice.
      </p>

      {form && (
        <div className="rounded-xl border border-secondary/30 bg-secondary/5 p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block sm:col-span-2"><span className={lbl}>Title *</span>
              <input className={field} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Diwali landing page" /></label>
            <label className="block sm:col-span-2"><span className={lbl}>What is being asked for * (the client sees this)</span>
              <textarea rows={3} maxLength={3000} className={`${field} resize-none`} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></label>
            <label className="block"><span className={lbl}>Fee quoted, before GST (₹) *</span>
              <input type="number" min="0" className={field} value={form.quoteAmount} onChange={(e) => setForm((f) => ({ ...f, quoteAmount: e.target.value }))} /></label>
            <label className="block"><span className={lbl}>Estimated working days</span>
              <input type="number" min="0" step="1" className={field} value={form.estimatedDays} onChange={(e) => setForm((f) => ({ ...f, estimatedDays: e.target.value }))} /></label>
            <label className="block sm:col-span-2"><span className={lbl}>Effort / impact assessment (internal)</span>
              <textarea rows={2} maxLength={1500} className={`${field} resize-none`} value={form.assessment} onChange={(e) => setForm((f) => ({ ...f, assessment: e.target.value }))} /></label>
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => run(() => http.post(`${base}/clients/${clientId}/change-requests`, form), 'Sent to the client for approval')}
              className="px-4 py-1.5 bg-secondary text-white rounded-lg text-xs font-medium hover:bg-secondary/90 disabled:opacity-50 cursor-pointer">Send quote to client</button>
            <button type="button" onClick={() => setForm(null)} className="px-4 py-1.5 border border-outline-variant text-on-surface-variant rounded-lg text-xs cursor-pointer">Cancel</button>
          </div>
        </div>
      )}

      {!result.rows.length && !form && <p className="text-xs text-on-surface-variant">No change requests yet.</p>}
      <ul className="space-y-2.5">
        {result.rows.map((r) => (
          <li key={r._id} className="rounded-xl border border-outline-variant bg-admin-bg/40 p-3.5 space-y-2">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span className="text-[10px] font-mono font-bold text-on-surface-variant">CR-{r.number}</span>
              <p className="text-on-surface text-sm font-semibold">{r.title}</p>
              <span className={`ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full border ${STAGE_CLS[r.stage] || STAGE_CLS.Withdrawn}`}>{r.stage}</span>
            </div>
            <p className="text-xs text-on-surface-variant whitespace-pre-line">{r.description}</p>
            <p className="text-xs text-on-surface">{inr(r.quoteAmount)} + GST{r.estimatedDays ? ` · ${r.estimatedDays} working day${r.estimatedDays === 1 ? '' : 's'}` : ''}</p>
            {r.assessment && <p className="text-[11px] text-on-surface-variant">Assessment: {r.assessment}</p>}
            <p className="text-[11px] text-on-surface-variant">
              Raised {day(r.createdAt)}{r.createdByName && ` by ${r.createdByName}`}
              {r.approval && r.approval.status !== 'Pending' && ` · client ${r.approval.status === 'Approved' ? 'approved' : r.approval.status === 'Rejected' ? 'rejected' : 'was told it is withdrawn'} ${day(r.approval.decidedAt)}`}
              {r.startedAt && ` · started ${day(r.startedAt)}`}{r.doneAt && ` · done ${day(r.doneAt)}`}
              {r.invoice && ` · invoice ${r.invoice.invoiceId}${r.invoice.unsent ? ' (not sent yet — add billing details and send it from Invoices)' : ''}`}
            </p>
            {r.approval?.status === 'Rejected' && r.approval.note && <p className="text-xs text-on-surface">Client said: “{r.approval.note}”</p>}

            {canEdit && withdraw?.id !== r._id && (
              <div className="flex flex-wrap gap-2 pt-1">
                {r.stage === 'Awaiting client approval' && <button type="button" onClick={() => setWithdraw({ id: r._id, reason: '' })} className={`${btn} border-outline-variant text-on-surface-variant hover:text-on-surface`}>Withdraw…</button>}
                {r.stage === 'Approved — ready to start' && <button type="button" disabled={busy} onClick={() => work(r._id, 'In progress')} className={`${btn} border-secondary/40 text-secondary hover:bg-secondary/10`}>Start work</button>}
                {['Approved — ready to start', 'In progress'].includes(r.stage) && <button type="button" disabled={busy} onClick={() => work(r._id, 'Done')} className={`${btn} border-green-500/40 text-green-400 hover:bg-green-500/10`}>Mark done</button>}
                {canInvoice && r.approval?.status === 'Approved' && !r.invoice_ref && (
                  <button type="button" disabled={busy} onClick={() => run(() => http.post(`${base}/clients/${clientId}/change-requests/${r._id}/invoice`))} className={`${btn} border-secondary/40 text-secondary hover:bg-secondary/10`}>Create invoice</button>
                )}
              </div>
            )}
            {withdraw?.id === r._id && (
              <div className="rounded-lg border border-outline-variant p-3 space-y-2">
                <label className="block"><span className={lbl}>Why withdrawn? *</span>
                  <input className={field} value={withdraw.reason} onChange={(e) => setWithdraw((w) => ({ ...w, reason: e.target.value }))} /></label>
                <div className="flex gap-2">
                  <button type="button" disabled={busy} onClick={() => run(() => http.put(`${base}/clients/${clientId}/change-requests/${r._id}/cancel`, { reason: withdraw.reason }), 'Withdrawn')} className="px-4 py-1.5 bg-secondary text-white rounded-lg text-xs font-medium disabled:opacity-50 cursor-pointer">Confirm</button>
                  <button type="button" onClick={() => setWithdraw(null)} className="px-4 py-1.5 border border-outline-variant text-on-surface-variant rounded-lg text-xs cursor-pointer">Cancel</button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
