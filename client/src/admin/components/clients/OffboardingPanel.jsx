import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { CheckCircle2, Circle, UserMinus } from 'lucide-react';

// Client → Offboarding tab (server: /clients/:id/offboarding, services/offboarding.js): the checklist
// that has to be done before a client is marked Offboarded. The invoice and access steps work
// themselves out from the records; staff confirm the rest. Only a Super Admin approves the closure
// and can offboard with steps still open (and must say why).
const day = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '');
const today = () => new Date().toLocaleDateString('en-CA');
const iso = (d) => (d ? new Date(d).toLocaleDateString('en-CA') : '');
const field = 'w-full px-3 py-2 bg-admin-bg border border-outline-variant rounded-lg text-on-surface text-xs focus:outline-none focus:border-secondary';
const lbl = 'block text-on-surface-variant text-[10px] uppercase font-bold tracking-wider mb-1';
const MANUAL = ['handover', 'retention', 'closure'];

export default function OffboardingPanel({ http, base, clientId, canEdit, isSuperAdmin, offboarded, onChanged }) {
  const [result, setResult] = useState({ key: null, data: null });
  const [reload, setReload] = useState(0);
  const [dates, setDates] = useState(null);
  const [confirming, setConfirming] = useState(null); // { key, note }
  const [finish, setFinish] = useState(null); // { reason, bypassReason }
  const [busy, setBusy] = useState(false);
  const key = `${clientId}:${reload}`;

  useEffect(() => {
    let live = true;
    http.get(`${base}/clients/${clientId}/offboarding`)
      .then((r) => { if (live) { setResult({ key, data: r.data.data }); } })
      .catch(() => { if (live) { toast.error('Could not load the offboarding checklist'); setResult({ key, data: null }); } });
    return () => { live = false; };
  }, [http, base, clientId, key]);

  const run = async (fn, ok) => {
    setBusy(true);
    try { await fn(); toast.success(ok); setConfirming(null); setFinish(null); setDates(null); setReload((n) => n + 1); onChanged?.(); }
    catch (err) { toast.error(err?.response?.data?.message || 'Could not save'); }
    finally { setBusy(false); }
  };
  const put = (body) => http.put(`${base}/clients/${clientId}/offboarding`, body);

  if (result.key !== key) return <p className="text-sm text-on-surface-variant">Loading…</p>;
  const d = result.data;
  if (!d) return null;
  const closureOnly = (k) => k === 'closure' && !isSuperAdmin;

  return (
    <div className="space-y-4">
      <h4 className="text-on-surface text-sm font-semibold flex items-center gap-1.5"><UserMinus size={15} className="text-secondary" /> Offboarding checklist</h4>
      <p className="text-[11px] text-on-surface-variant rounded-lg bg-admin-bg/60 border border-outline-variant px-3 py-2">
        A client is marked Offboarded only when every step is done. A Super Admin can offboard with steps still open, but must say why — it is kept in the audit log.
      </p>
      {offboarded && <p className="text-xs text-green-400">This client is offboarded.</p>}

      <ul className="space-y-2">
        {d.items.map((i) => (
          <li key={i.key} className="rounded-xl border border-outline-variant bg-admin-bg/40 p-3 space-y-1.5">
            <div className="flex items-start gap-2">
              {i.done ? <CheckCircle2 size={16} className="text-green-400 mt-0.5 shrink-0" /> : <Circle size={16} className="text-on-surface-variant mt-0.5 shrink-0" />}
              <div className="min-w-0 flex-1">
                <p className="text-on-surface text-sm font-medium">{i.label}{i.auto && <span className="ml-2 text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">checked automatically</span>}</p>
                <p className="text-[11px] text-on-surface-variant">{i.detail || (i.done ? [i.note, i.doneByName && `by ${i.doneByName}`, i.doneAt && day(i.doneAt)].filter(Boolean).join(' · ') : 'Not done yet')}</p>
                {i.detail && i.note && <p className="text-[11px] text-on-surface-variant">{i.note}</p>}
              </div>
              {canEdit && !offboarded && MANUAL.includes(i.key) && confirming?.key !== i.key && (
                closureOnly(i.key)
                  ? <span className="text-[10px] text-on-surface-variant shrink-0">Super Admin only</span>
                  : i.done
                    ? <button type="button" disabled={busy} onClick={() => run(() => put({ item: i.key, done: false }), 'Marked not done')} className="text-[11px] text-on-surface-variant hover:text-on-surface shrink-0 cursor-pointer">Undo</button>
                    : <button type="button" onClick={() => setConfirming({ key: i.key, note: '' })} className="px-2.5 py-1 rounded-lg border border-secondary/40 text-secondary text-[11px] font-semibold hover:bg-secondary/10 shrink-0 cursor-pointer">Mark done…</button>
              )}
            </div>
            {confirming?.key === i.key && (
              <div className="flex flex-wrap gap-2 items-end pl-6">
                <label className="block flex-1 min-w-[14rem]"><span className={lbl}>What was done? *</span>
                  <input className={field} value={confirming.note} onChange={(e) => setConfirming((c) => ({ ...c, note: e.target.value }))} placeholder={i.key === 'handover' ? 'e.g. Final report and creative files emailed' : i.key === 'retention' ? 'e.g. KYC files deleted after 30 days' : 'e.g. Approved by the owner'} /></label>
                <button type="button" disabled={busy || confirming.note.trim().length < 3} onClick={() => run(() => put({ item: i.key, done: true, note: confirming.note }), 'Marked done')} className="px-3 py-1.5 bg-secondary text-white rounded-lg text-xs font-medium disabled:opacity-50 cursor-pointer">Save</button>
                <button type="button" onClick={() => setConfirming(null)} className="px-3 py-1.5 border border-outline-variant text-on-surface-variant rounded-lg text-xs cursor-pointer">Cancel</button>
              </div>
            )}
            {i.key === 'notice' && canEdit && !offboarded && (
              dates ? (
                <div className="flex flex-wrap gap-2 items-end pl-6">
                  <label className="block"><span className={lbl}>Notice given *</span><input type="date" max={today()} className={`${field} [color-scheme:dark]`} value={dates.noticeDate} onChange={(e) => setDates((x) => ({ ...x, noticeDate: e.target.value }))} /></label>
                  <label className="block"><span className={lbl}>Last day of service *</span><input type="date" min={dates.noticeDate} className={`${field} [color-scheme:dark]`} value={dates.effectiveDate} onChange={(e) => setDates((x) => ({ ...x, effectiveDate: e.target.value }))} /></label>
                  <button type="button" disabled={busy || !dates.noticeDate || !dates.effectiveDate} onClick={() => run(() => put(dates), 'Dates saved')} className="px-3 py-1.5 bg-secondary text-white rounded-lg text-xs font-medium disabled:opacity-50 cursor-pointer">Save</button>
                  <button type="button" onClick={() => setDates(null)} className="px-3 py-1.5 border border-outline-variant text-on-surface-variant rounded-lg text-xs cursor-pointer">Cancel</button>
                </div>
              ) : (
                <div className="pl-6"><button type="button" onClick={() => setDates({ noticeDate: iso(d.noticeDate), effectiveDate: iso(d.effectiveDate) })} className="px-2.5 py-1 rounded-lg border border-secondary/40 text-secondary text-[11px] font-semibold hover:bg-secondary/10 cursor-pointer">{d.noticeDate ? 'Change dates' : 'Record notice…'}</button></div>
              )
            )}
          </li>
        ))}
      </ul>

      {isSuperAdmin && !offboarded && (
        finish ? (
          <div className="rounded-xl border border-secondary/30 bg-secondary/5 p-4 space-y-3">
            <label className="block"><span className={lbl}>Reason for offboarding *</span>
              <input className={field} value={finish.reason} onChange={(e) => setFinish((f) => ({ ...f, reason: e.target.value }))} placeholder="e.g. Contract ended on 31 Oct" /></label>
            {!d.complete && (
              <label className="block"><span className={lbl}>Steps still open — why offboard anyway? *</span>
                <input className={field} value={finish.bypassReason} onChange={(e) => setFinish((f) => ({ ...f, bypassReason: e.target.value }))} placeholder="At least 10 characters — kept in the audit log" />
                <span className="block text-[10px] text-amber-400 mt-1">Open: {d.open.join('; ')}</span></label>
            )}
            <div className="flex gap-2">
              <button type="button" disabled={busy || finish.reason.trim().length < 5 || (!d.complete && finish.bypassReason.trim().length < 10)}
                onClick={() => run(() => http.post(`${base}/clients/${clientId}/offboard`, { reason: finish.reason, bypassReason: d.complete ? undefined : finish.bypassReason }), 'Client offboarded')}
                className="px-4 py-1.5 bg-secondary text-white rounded-lg text-xs font-medium disabled:opacity-50 cursor-pointer">{d.complete ? 'Offboard client' : 'Offboard anyway'}</button>
              <button type="button" onClick={() => setFinish(null)} className="px-4 py-1.5 border border-outline-variant text-on-surface-variant rounded-lg text-xs cursor-pointer">Cancel</button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setFinish({ reason: '', bypassReason: '' })} className="px-4 py-2 rounded-lg border border-secondary/40 text-secondary text-sm font-semibold hover:bg-secondary/10 cursor-pointer">
            {d.complete ? 'Offboard client…' : `Offboard client… (${d.open.length} step${d.open.length === 1 ? '' : 's'} open)`}
          </button>
        )
      )}
    </div>
  );
}
