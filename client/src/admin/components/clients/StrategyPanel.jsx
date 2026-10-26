import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Save, History } from 'lucide-react';

const FIELDS = [
  { key: 'objective', label: 'Client objective', rows: 2 },
  { key: 'targetAudience', label: 'Target audience', rows: 3 },
  { key: 'adStrategySummary', label: 'Ad strategy summary', rows: 4 },
  { key: 'keyDifferentiator', label: 'Key differentiator / offer', rows: 2 },
  { key: 'specialInstructions', label: 'Special instructions', rows: 2 },
  { key: 'competitorReference', label: 'Competitor reference', rows: 2, internal: true },
];

const fmt = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
const inputCls = 'w-full px-3 py-2 bg-admin-bg border border-outline-variant rounded-lg text-on-surface text-sm focus:outline-none focus:border-secondary resize-none';
const label = (key) => FIELDS.find((f) => f.key === key)?.label || key;

/**
 * Campaign strategy & targeting notes (Client Portal CRM §3.2). Every save is a
 * new numbered version, so results can be read against the strategy in effect
 * at the time. The client sees a version only after it is approved for sharing;
 * competitor notes are never shown to them.
 */
export default function StrategyPanel({ clientId, http, base, canEdit }) {
  const [versions, setVersions] = useState(null);
  const [form, setForm] = useState(null); // null = not editing
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => (
    http.get(`${base}/clients/${clientId}/strategy`)
      .then((res) => { setVersions(res.data.data); setError(''); })
      .catch((err) => setError(err?.response?.data?.message || 'Could not load the strategy'))
  ), [http, base, clientId]);

  useEffect(() => {
    let live = true;
    http.get(`${base}/clients/${clientId}/strategy`)
      .then((res) => { if (live) setVersions(res.data.data); })
      .catch((err) => { if (live) setError(err?.response?.data?.message || 'Could not load the strategy'); });
    return () => { live = false; };
  }, [http, base, clientId]);

  const startEdit = () => {
    const latest = versions?.[0];
    setForm({ ...Object.fromEntries(FIELDS.map((f) => [f.key, latest?.[f.key] || ''])), changeNote: '' });
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await http.post(`${base}/clients/${clientId}/strategy`, form);
      toast.success(res.data.message);
      setForm(null);
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not save');
    } finally { setSaving(false); }
  };

  const share = async (version, shared) => {
    try {
      const res = await http.put(`${base}/clients/${clientId}/strategy/${version}/share`, { shared });
      toast.success(res.data.message);
      await load();
    } catch (err) { toast.error(err?.response?.data?.message || 'Could not update sharing'); }
  };

  if (error) return <p className="text-red-400 text-sm">{error}</p>;
  if (!versions) return <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-secondary/30 border-t-secondary rounded-full animate-spin" /></div>;

  if (form) {
    return (
      <div className="space-y-4">
        <p className="text-on-surface-variant text-xs">Saving creates version {(versions[0]?.version || 0) + 1}. Earlier versions are kept.</p>
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label className="block text-on-surface-variant text-[10px] uppercase font-bold tracking-wider mb-1">
              {f.label}{f.internal && <span className="text-amber-400 normal-case font-normal"> · internal, never shown to the client</span>}
            </label>
            <textarea rows={f.rows} className={inputCls} value={form[f.key]} onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))} />
          </div>
        ))}
        <div>
          <label className="block text-on-surface-variant text-[10px] uppercase font-bold tracking-wider mb-1">What changed and why (internal)</label>
          <input className={inputCls} maxLength={1000} value={form.changeNote} onChange={(e) => setForm((p) => ({ ...p, changeNote: e.target.value }))} placeholder="e.g. Moved budget to retargeting after CPA rose" />
        </div>
        <div className="flex gap-3">
          <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-secondary text-white rounded-lg text-sm font-medium hover:bg-secondary/90 disabled:opacity-60 cursor-pointer">
            <Save size={14} /> {saving ? 'Saving…' : 'Save as new version'}
          </button>
          <button onClick={() => setForm(null)} className="px-4 py-2 bg-admin-bg border border-outline-variant text-on-surface-variant rounded-lg text-sm cursor-pointer">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-on-surface-variant text-xs">Clients see a version only after you approve it for sharing.</p>
        {canEdit && (
          <button onClick={startEdit} className="px-3 py-1.5 rounded-lg border border-outline-variant text-secondary text-xs font-medium hover:bg-secondary/10 cursor-pointer">
            {versions.length ? 'Edit (new version)' : 'Add strategy'}
          </button>
        )}
      </div>

      {versions.length === 0 && <p className="text-on-surface-variant text-sm">No strategy has been recorded for this client yet.</p>}

      {versions.map((v, i) => (
        <div key={v._id} className="border border-outline-variant rounded-xl bg-admin-bg/40 p-3.5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-on-surface text-sm font-semibold flex items-center gap-2">
                Version {v.version}
                {i === 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary/15 text-secondary">Latest</span>}
                {v.sharedWithClient
                  ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 flex items-center gap-1"><Eye size={10} /> Shared with client</span>
                  : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-container-low text-on-surface-variant flex items-center gap-1"><EyeOff size={10} /> Internal</span>}
              </p>
              <p className="text-on-surface-variant text-[11px] mt-0.5">
                {v.authorName} · {fmt(v.createdAt)}
                {v.sharedWithClient && v.sharedAt && <> · shared by {v.sharedByName} on {fmt(v.sharedAt)}</>}
              </p>
            </div>
            {canEdit && (
              <button onClick={() => share(v.version, !v.sharedWithClient)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer ${v.sharedWithClient ? 'border-outline-variant text-on-surface-variant hover:bg-surface-container-low' : 'border-green-500/30 text-green-400 hover:bg-green-500/10'}`}>
                {v.sharedWithClient ? 'Hide from client' : 'Approve & share with client'}
              </button>
            )}
          </div>
          {v.changeNote && (
            <p className="text-xs text-on-surface-variant flex items-start gap-1.5"><History size={12} className="mt-0.5 shrink-0" />
              <span>{v.changeNote}{v.changedFields?.length ? ` — changed: ${v.changedFields.map(label).join(', ')}` : ''}</span></p>
          )}
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            {FIELDS.filter((f) => v[f.key]).map((f) => (
              <div key={f.key} className={f.key === 'adStrategySummary' ? 'sm:col-span-2' : ''}>
                <dt className="text-on-surface-variant text-[10px] uppercase font-bold tracking-wider">
                  {f.label}{f.internal && <span className="text-amber-400 normal-case font-normal"> · internal</span>}
                </dt>
                <dd className="text-on-surface text-sm whitespace-pre-wrap mt-0.5">{v[f.key]}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}
