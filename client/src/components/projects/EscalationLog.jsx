import { useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

const ESCALATION_SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];
const SEVERITY_CLASS = {
  Low: 'bg-gray-500/10 text-app-text-muted border-gray-500/20',
  Medium: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  High: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  Critical: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
};
const when = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
const field = 'w-full text-sm rounded-lg border border-app-border bg-form-input-bg px-3 py-2 text-app-text focus:outline-none focus:border-primary';

/**
 * A project's escalation log, used by the Admin panel and the Employee
 * Portal. API-agnostic: the caller passes `onRaise(body)` / `onResolve(id, text)`
 * (each returning a promise) and refreshes its own data afterwards.
 */
export default function EscalationLog({ escalations = [], canRaise, canResolve, onRaise, onResolve }) {
  const [draft, setDraft] = useState({ note: '', severity: 'Medium', source: 'Client' });
  const [resolving, setResolving] = useState(null); // escalation id
  const [resolution, setResolution] = useState('');
  const [busy, setBusy] = useState(false);
  const sorted = [...escalations].sort((a, b) => (a.status === b.status ? new Date(b.raisedAt) - new Date(a.raisedAt) : a.status === 'Open' ? -1 : 1));

  const run = async (fn, success) => {
    setBusy(true);
    try {
      await fn();
      toast.success(success);
      return true;
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Something went wrong.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const raise = async (e) => {
    e.preventDefault();
    if (!draft.note.trim()) { toast.error('Describe the escalation.'); return; }
    if (await run(() => onRaise(draft), 'Escalation logged')) setDraft({ note: '', severity: 'Medium', source: 'Client' });
  };

  const resolve = async (id) => {
    if (!resolution.trim()) { toast.error('Describe how it was resolved.'); return; }
    if (await run(() => onResolve(id, resolution), 'Escalation resolved')) { setResolving(null); setResolution(''); }
  };

  return (
    <div className="space-y-3">
      {sorted.length === 0 && <p className="text-xs text-app-text-muted">No escalations on this project.</p>}
      {sorted.map((e) => (
        <div key={e._id} className="p-3 rounded-lg border border-app-border bg-form-input-bg/40 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold uppercase ${SEVERITY_CLASS[e.severity]}`}>{e.severity}</span>
            <span className="text-[11px] text-app-text-muted">{e.source} · raised {when(e.raisedAt)}{e.raisedByName ? ` by ${e.raisedByName}` : ''}</span>
            <span className={`ml-auto text-[10px] font-bold uppercase ${e.status === 'Open' ? 'text-rose-400' : 'text-emerald-400'}`}>{e.status}</span>
          </div>
          <p className="mt-1.5 text-app-text whitespace-pre-wrap">{e.note}</p>
          {e.status === 'Resolved' && (
            <p className="mt-1.5 text-xs text-emerald-400"><CheckCircle2 size={12} className="inline mr-1" />{e.resolution} <span className="text-app-text-muted">— {e.resolvedByName}, {when(e.resolvedAt)}</span></p>
          )}
          {e.status === 'Open' && canResolve && (resolving === e._id ? (
            <div className="mt-2 space-y-2">
              <textarea rows={2} className={`${field} resize-none`} placeholder="How was it resolved?" value={resolution} onChange={(ev) => setResolution(ev.target.value)} />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setResolving(null)} className="px-3 py-1 text-xs text-app-text-muted cursor-pointer">Cancel</button>
                <button type="button" disabled={busy} onClick={() => resolve(e._id)} className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs font-bold disabled:opacity-50 cursor-pointer">Mark resolved</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => { setResolving(e._id); setResolution(''); }} className="mt-2 text-xs font-semibold text-primary hover:underline cursor-pointer">Resolve</button>
          ))}
        </div>
      ))}

      {canRaise && (
        <form onSubmit={raise} className="p-3 rounded-lg border border-dashed border-app-border space-y-2">
          <div className="text-xs font-bold text-app-text-muted uppercase tracking-wider flex items-center gap-1"><AlertTriangle size={12} /> Log an escalation</div>
          <textarea rows={2} maxLength={1000} className={`${field} resize-none`} placeholder="What happened? (client complaint, missed deadline, quality issue…)" value={draft.note} onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))} />
          <div className="flex flex-wrap gap-2">
            <select className={`${field} w-auto`} value={draft.severity} onChange={(e) => setDraft((d) => ({ ...d, severity: e.target.value }))} aria-label="Severity">
              {ESCALATION_SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className={`${field} w-auto`} value={draft.source} onChange={(e) => setDraft((d) => ({ ...d, source: e.target.value }))} aria-label="Source">
              <option value="Client">From client</option>
              <option value="Internal">Internal</option>
            </select>
            <button type="submit" disabled={busy} className="ml-auto px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-50 cursor-pointer">Log escalation</button>
          </div>
        </form>
      )}
    </div>
  );
}
