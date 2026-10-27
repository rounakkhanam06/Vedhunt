import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, ClipboardCheck } from 'lucide-react';

// Client → Approvals tab (server: /clients/:id/approvals, services/approvals.js). Staff ask the client
// to approve a strategy / budget / creative; the client answers in their portal, or staff record the
// answer given another way (WhatsApp, email …) with its source and day. A decision is never edited.
const STATUS_CLS = {
  Pending: 'text-amber-400 bg-amber-500/10 border-amber-500/25',
  Approved: 'text-green-400 bg-green-500/10 border-green-500/25',
  Rejected: 'text-red-400 bg-red-500/10 border-red-500/25',
  Cancelled: 'text-on-surface-variant bg-surface-container-low border-outline-variant',
};
const day = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '');
const today = () => new Date().toLocaleDateString('en-CA');
const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
const field = 'w-full px-3 py-2 bg-admin-bg border border-outline-variant rounded-lg text-on-surface text-xs focus:outline-none focus:border-secondary';
const lbl = 'block text-on-surface-variant text-[10px] uppercase font-bold tracking-wider mb-1';

export default function ApprovalsPanel({ http, base, clientId, canEdit }) {
  const [result, setResult] = useState({ key: null, rows: [], options: null });
  const [reload, setReload] = useState(0);
  const [form, setForm] = useState(null); // new request
  const [act, setAct] = useState(null); // { id, mode: 'record' | 'cancel', decision, channel, receivedAt, note }
  const [busy, setBusy] = useState(false);
  const key = `${clientId}:${reload}`;

  useEffect(() => {
    let live = true;
    http.get(`${base}/clients/${clientId}/approvals`)
      .then((r) => { if (live) setResult({ key, rows: r.data.data, options: r.data.options }); })
      .catch(() => { if (live) { toast.error('Could not load approvals'); setResult({ key, rows: [], options: null }); } });
    return () => { live = false; };
  }, [http, base, clientId, key]);

  const run = async (fn, ok) => {
    setBusy(true);
    try { await fn(); toast.success(ok); setForm(null); setAct(null); setReload((n) => n + 1); }
    catch (err) { toast.error(err?.response?.data?.message || 'Could not save'); }
    finally { setBusy(false); }
  };

  if (result.key !== key) return <p className="text-sm text-on-surface-variant">Loading…</p>;
  const { rows, options } = result;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-on-surface text-sm font-semibold flex items-center gap-1.5"><ClipboardCheck size={15} className="text-secondary" /> Client approvals</h4>
        {canEdit && !form && (
          <button type="button" onClick={() => setForm({ kind: 'Strategy', title: '', versionLabel: '', amount: '', details: '', linkUrl: '' })}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-secondary/40 text-secondary text-[11px] font-semibold hover:bg-secondary/10 cursor-pointer"><Plus size={12} /> Ask for approval</button>
        )}
      </div>

      {form && (
        <div className="rounded-xl border border-secondary/30 bg-secondary/5 p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block"><span className={lbl}>What *</span>
              <select className={field} value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}>{options.kinds.map((k) => <option key={k}>{k}</option>)}</select></label>
            <label className="block"><span className={lbl}>Title *</span>
              <input className={field} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Strategy v2 — Meta first" /></label>
            <label className="block"><span className={lbl}>Version</span>
              <input className={field} value={form.versionLabel} onChange={(e) => setForm((f) => ({ ...f, versionLabel: e.target.value }))} placeholder="e.g. v2, Creative set 3" /></label>
            {form.kind === 'Budget' && (
              <label className="block"><span className={lbl}>Monthly budget (₹) *</span>
                <input type="number" min="0" className={field} value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} /></label>
            )}
            <label className="block sm:col-span-2"><span className={lbl}>Link to look at it</span>
              <input className={field} value={form.linkUrl} onChange={(e) => setForm((f) => ({ ...f, linkUrl: e.target.value }))} placeholder="https://…" /></label>
            <label className="block sm:col-span-2"><span className={lbl}>Details (the client sees this)</span>
              <textarea rows={3} maxLength={3000} className={`${field} resize-none`} value={form.details} onChange={(e) => setForm((f) => ({ ...f, details: e.target.value }))} /></label>
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => run(() => http.post(`${base}/clients/${clientId}/approvals`, form), 'Sent to the client for approval')}
              className="px-4 py-1.5 bg-secondary text-white rounded-lg text-xs font-medium hover:bg-secondary/90 disabled:opacity-50 cursor-pointer">Send to client</button>
            <button type="button" onClick={() => setForm(null)} className="px-4 py-1.5 border border-outline-variant text-on-surface-variant rounded-lg text-xs cursor-pointer">Cancel</button>
          </div>
        </div>
      )}

      {!rows.length && !form && <p className="text-xs text-on-surface-variant">Nothing has been sent for approval yet.</p>}
      <ul className="space-y-2.5">
        {rows.map((a) => (
          <li key={a._id} className="rounded-xl border border-outline-variant bg-admin-bg/40 p-3.5 space-y-2">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span className="text-[10px] uppercase tracking-wider font-bold text-on-surface-variant">{a.kind}</span>
              <p className="text-on-surface text-sm font-semibold">{a.title}{a.versionLabel && <span className="text-on-surface-variant font-normal"> · {a.versionLabel}</span>}</p>
              <span className={`ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_CLS[a.status]}`}>{a.status}</span>
            </div>
            {a.amount != null && <p className="text-xs text-on-surface">Budget {inr(a.amount)} / month</p>}
            {a.details && <p className="text-xs text-on-surface-variant whitespace-pre-line">{a.details}</p>}
            <p className="text-[11px] text-on-surface-variant">
              Asked {day(a.requestedAt)}{a.requestedByName && ` by ${a.requestedByName}`}
              {a.status !== 'Pending' && <> · {a.status === 'Cancelled' ? 'withdrawn' : a.status.toLowerCase()} {day(a.decidedAt)}{a.decisionBy === 'client' ? ` by the client (${a.channel})` : ` — recorded by ${a.decidedByName}${a.channel ? ` from ${a.channel}` : ''}${a.receivedAt ? `, answered ${day(a.receivedAt)}` : ''}`}</>}
            </p>
            {a.note && <p className="text-xs text-on-surface">“{a.note}”</p>}

            {canEdit && a.status === 'Pending' && act?.id !== a._id && (
              <div className="flex flex-wrap gap-2 pt-1">
                <button type="button" onClick={() => setAct({ id: a._id, mode: 'record', decision: 'approve', channel: options.channels[0], receivedAt: today(), note: '' })}
                  className="px-3 py-1.5 rounded-lg border border-secondary/40 text-secondary text-xs font-semibold hover:bg-secondary/10 cursor-pointer">Record the client’s answer…</button>
                <button type="button" onClick={() => setAct({ id: a._id, mode: 'cancel', note: '' })}
                  className="px-3 py-1.5 rounded-lg border border-outline-variant text-on-surface-variant text-xs font-semibold hover:text-on-surface cursor-pointer">Withdraw…</button>
              </div>
            )}
            {act?.id === a._id && (
              <div className="rounded-lg border border-outline-variant p-3 space-y-2">
                {act.mode === 'record' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <label className="block"><span className={lbl}>Answer *</span>
                      <select className={field} value={act.decision} onChange={(e) => setAct((x) => ({ ...x, decision: e.target.value }))}><option value="approve">Approved</option><option value="reject">Asked for changes</option></select></label>
                    <label className="block"><span className={lbl}>Came from *</span>
                      <select className={field} value={act.channel} onChange={(e) => setAct((x) => ({ ...x, channel: e.target.value }))}>{options.channels.map((c) => <option key={c}>{c}</option>)}</select></label>
                    <label className="block"><span className={lbl}>Day they answered *</span>
                      <input type="date" max={today()} className={`${field} [color-scheme:dark]`} value={act.receivedAt} onChange={(e) => setAct((x) => ({ ...x, receivedAt: e.target.value }))} /></label>
                  </div>
                ) : null}
                <label className="block"><span className={lbl}>{act.mode === 'cancel' ? 'Why withdrawn? *' : act.decision === 'reject' ? 'What should change? *' : 'Note (optional)'}</span>
                  <input className={field} value={act.note} onChange={(e) => setAct((x) => ({ ...x, note: e.target.value }))} /></label>
                <div className="flex gap-2">
                  <button type="button" disabled={busy}
                    onClick={() => run(() => (act.mode === 'cancel'
                      ? http.put(`${base}/clients/${clientId}/approvals/${a._id}/cancel`, { reason: act.note })
                      : http.put(`${base}/clients/${clientId}/approvals/${a._id}/decision`, { decision: act.decision, channel: act.channel, receivedAt: act.receivedAt, note: act.note })), act.mode === 'cancel' ? 'Withdrawn' : 'Recorded')}
                    className="px-4 py-1.5 bg-secondary text-white rounded-lg text-xs font-medium hover:bg-secondary/90 disabled:opacity-50 cursor-pointer">Confirm</button>
                  <button type="button" onClick={() => setAct(null)} className="px-4 py-1.5 border border-outline-variant text-on-surface-variant rounded-lg text-xs cursor-pointer">Cancel</button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
