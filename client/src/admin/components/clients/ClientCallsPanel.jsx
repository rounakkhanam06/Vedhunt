import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { PhoneCall, PhoneOff, Plus } from 'lucide-react';

// Calls staff made to a client (server: /clients/:id/calls). Unanswered calls logged
// after a client goes on hold feed the automatic In-Active rule (Settings → Client Rules).
const PURPOSES = ['Payment follow-up', 'Account follow-up', 'Other'];
const when = (d) => new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const nowLocal = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const emptyForm = () => ({ connected: null, purpose: PURPOSES[0], note: '', calledAt: nowLocal() });

export default function ClientCallsPanel({ http, base, clientId, canLog }) {
  const [result, setResult] = useState({ key: null, calls: [] });
  const [reload, setReload] = useState(0);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const key = `${clientId}:${reload}`;

  useEffect(() => {
    let cancelled = false;
    http.get(`${base}/clients/${clientId}/calls`)
      .then((r) => { if (!cancelled) setResult({ key, calls: r.data.data || [] }); })
      .catch(() => { if (!cancelled) setResult({ key, calls: [] }); });
    return () => { cancelled = true; };
  }, [http, base, clientId, key]);

  const save = async () => {
    setSaving(true);
    try {
      await http.post(`${base}/clients/${clientId}/calls`, { ...form, calledAt: new Date(form.calledAt).toISOString() });
      toast.success('Call logged');
      setForm(null);
      setReload((n) => n + 1);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not log the call');
    } finally { setSaving(false); }
  };

  const calls = result.calls;
  // Unanswered in a row, newest first — what the In-Active rule looks at
  const streak = calls.findIndex((c) => c.connected);
  const unanswered = streak === -1 ? calls.length : streak;

  return (
    <div className="space-y-3 border-t border-outline-variant pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-on-surface-variant text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5">
          <PhoneCall size={12} /> Calls to the client
          {unanswered > 0 && <span className="normal-case tracking-normal font-semibold text-amber-500">· last {unanswered} not answered</span>}
        </p>
        {canLog && !form && (
          <button type="button" onClick={() => setForm(emptyForm())}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-secondary/40 text-secondary text-[11px] font-semibold hover:bg-secondary/10 cursor-pointer">
            <Plus size={12} /> Log a call
          </button>
        )}
      </div>

      {form && (
        <div className="rounded-xl border border-outline-variant bg-admin-bg/60 p-3 space-y-2.5">
          <div className="flex flex-wrap gap-2">
            {[[true, 'Answered', PhoneCall, 'text-green-400 border-green-500/40 bg-green-500/10'], [false, 'Not answered', PhoneOff, 'text-red-400 border-red-500/40 bg-red-500/10']].map(([value, label, Icon, on]) => (
              <button key={label} type="button" onClick={() => setForm((f) => ({ ...f, connected: value }))}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer ${form.connected === value ? on : 'border-outline-variant text-on-surface-variant'}`}>
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <select value={form.purpose} onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))} aria-label="Purpose"
              className="px-3 py-2 bg-admin-bg border border-outline-variant rounded-lg text-on-surface text-xs focus:outline-none focus:border-secondary">
              {PURPOSES.map((p) => <option key={p}>{p}</option>)}
            </select>
            <input type="datetime-local" value={form.calledAt} max={nowLocal()} onChange={(e) => setForm((f) => ({ ...f, calledAt: e.target.value }))} aria-label="When"
              className="px-3 py-2 bg-admin-bg border border-outline-variant rounded-lg text-on-surface text-xs focus:outline-none focus:border-secondary [color-scheme:dark]" />
          </div>
          <textarea rows={2} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="Note (what was said / promised date to pay)"
            className="w-full px-3 py-2 bg-admin-bg border border-outline-variant rounded-lg text-on-surface text-xs focus:outline-none focus:border-secondary resize-none" />
          <div className="flex gap-2">
            <button type="button" disabled={saving || form.connected === null} onClick={save}
              className="px-4 py-1.5 bg-secondary text-white rounded-lg text-xs font-medium hover:bg-secondary/90 disabled:opacity-50 cursor-pointer">{saving ? 'Saving…' : 'Save call'}</button>
            <button type="button" onClick={() => setForm(null)}
              className="px-4 py-1.5 border border-outline-variant text-on-surface-variant rounded-lg text-xs cursor-pointer">Cancel</button>
          </div>
        </div>
      )}

      {result.key !== key ? (
        <p className="text-xs text-on-surface-variant">Loading…</p>
      ) : !calls.length ? (
        <p className="text-xs text-on-surface-variant">No calls logged yet.</p>
      ) : (
        <ul className="space-y-1.5 max-h-56 overflow-y-auto overscroll-contain">
          {calls.map((c) => (
            <li key={c._id} className="flex items-start gap-2 text-xs">
              {c.connected ? <PhoneCall size={13} className="text-green-400 mt-0.5 shrink-0" /> : <PhoneOff size={13} className="text-red-400 mt-0.5 shrink-0" />}
              <span className="min-w-0">
                <span className="text-on-surface font-medium">{c.connected ? 'Answered' : 'Not answered'}</span>
                <span className="text-on-surface-variant"> · {c.purpose} · {when(c.calledAt)} · {c.calledByName}</span>
                {c.note && <span className="block text-on-surface-variant">{c.note}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
