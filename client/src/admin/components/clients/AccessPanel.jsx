import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2, KeyRound } from 'lucide-react';

// Client → Access tab: a record of which accounts / assets Vedhunt has access to and when
// (server: /clients/:id/access, services/platformAccess.js). It never holds credentials:
// access is granted through the platform itself (partner / business access).
const STATUS_CLS = {
  Requested: 'text-amber-400 bg-amber-500/10 border-amber-500/25',
  Granted: 'text-blue-400 bg-blue-500/10 border-blue-500/25',
  Verified: 'text-green-400 bg-green-500/10 border-green-500/25',
  Revoked: 'text-on-surface-variant bg-surface-container-low border-outline-variant',
};
const NEXT = { Requested: ['Granted', 'Revoked'], Granted: ['Verified', 'Revoked'], Verified: ['Revoked'], Revoked: [] };
const day = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '');
const today = () => new Date().toLocaleDateString('en-CA');
const field = 'w-full px-3 py-2 bg-admin-bg border border-outline-variant rounded-lg text-on-surface text-xs focus:outline-none focus:border-secondary';
const lbl = 'block text-on-surface-variant text-[10px] uppercase font-bold tracking-wider mb-1';

export default function AccessPanel({ http, base, clientId, canEdit }) {
  const [result, setResult] = useState({ key: null, rows: [], summary: null, options: null });
  const [reload, setReload] = useState(0);
  const [form, setForm] = useState(null); // new request
  const [move, setMove] = useState(null); // { row, to, permissionLevel, revokeReason, date }
  const [busy, setBusy] = useState(false);
  const key = `${clientId}:${reload}`;

  useEffect(() => {
    let live = true;
    http.get(`${base}/clients/${clientId}/access`)
      .then((r) => { if (live) setResult({ key, rows: r.data.data, summary: r.data.summary, options: r.data.options }); })
      .catch(() => { if (live) { toast.error('Could not load platform access'); setResult({ key, rows: [], summary: null, options: null }); } });
    return () => { live = false; };
  }, [http, base, clientId, key]);

  const run = async (fn, ok) => {
    setBusy(true);
    try { await fn(); toast.success(ok); setForm(null); setMove(null); setReload((n) => n + 1); }
    catch (err) { toast.error(err?.response?.data?.message || 'Could not save'); }
    finally { setBusy(false); }
  };

  if (result.key !== key) return <p className="text-sm text-on-surface-variant">Loading…</p>;
  const { rows, summary, options } = result;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-on-surface text-sm font-semibold flex items-center gap-1.5"><KeyRound size={15} className="text-secondary" /> Platform access</h4>
        {canEdit && !form && (
          <button type="button" onClick={() => setForm({ platform: options?.platforms?.[0] || 'Meta Ads', assetName: '', accountId: '', assetOwner: 'Client', notes: '' })}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-secondary/40 text-secondary text-[11px] font-semibold hover:bg-secondary/10 cursor-pointer"><Plus size={12} /> Request access</button>
        )}
      </div>
      <p className="text-[11px] text-on-surface-variant rounded-lg bg-admin-bg/60 border border-outline-variant px-3 py-2">
        A record only. Never ask for or note down passwords or codes — the client grants access through the platform (partner / business access), and it can be revoked there.
      </p>
      {summary && <p className="text-xs text-on-surface-variant">{summary.live} live · {summary.requested} requested · {summary.revoked} revoked</p>}

      {form && (
        <div className="rounded-xl border border-secondary/30 bg-secondary/5 p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block"><span className={lbl}>Platform *</span>
              <select className={field} value={form.platform} onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))}>{options.platforms.map((p) => <option key={p}>{p}</option>)}</select></label>
            <label className="block"><span className={lbl}>Asset owner</span>
              <select className={field} value={form.assetOwner} onChange={(e) => setForm((f) => ({ ...f, assetOwner: e.target.value }))}>{options.owners.map((p) => <option key={p}>{p}</option>)}</select></label>
            <label className="block"><span className={lbl}>Account / page / site name</span>
              <input className={field} value={form.assetName} onChange={(e) => setForm((f) => ({ ...f, assetName: e.target.value }))} /></label>
            <label className="block"><span className={lbl}>Account / business ID</span>
              <input className={`${field} font-mono`} value={form.accountId} onChange={(e) => setForm((f) => ({ ...f, accountId: e.target.value }))} /></label>
            <label className="block sm:col-span-2"><span className={lbl}>Note</span>
              <input className={field} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="e.g. Partner request sent to the owner's email" /></label>
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => run(() => http.post(`${base}/clients/${clientId}/access`, form), 'Access requested')}
              className="px-4 py-1.5 bg-secondary text-white rounded-lg text-xs font-medium hover:bg-secondary/90 disabled:opacity-50 cursor-pointer">Save request</button>
            <button type="button" onClick={() => setForm(null)} className="px-4 py-1.5 border border-outline-variant text-on-surface-variant rounded-lg text-xs cursor-pointer">Cancel</button>
          </div>
        </div>
      )}

      {!rows.length && !form && <p className="text-xs text-on-surface-variant">No platform access recorded yet.</p>}
      <ul className="space-y-2.5">
        {rows.map((r) => (
          <li key={r._id} className="rounded-xl border border-outline-variant bg-admin-bg/40 p-3.5 space-y-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="text-on-surface text-sm font-semibold">{r.platform}{r.assetName && <span className="text-on-surface-variant font-normal"> · {r.assetName}</span>}</p>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_CLS[r.status]}`}>{r.status}</span>
              {r.status === 'Requested' && canEdit && (
                <button type="button" title="Remove this request" onClick={() => run(() => http.delete(`${base}/clients/${clientId}/access/${r._id}`), 'Removed')} className="ml-auto p-1 text-red-400 hover:bg-red-500/10 rounded cursor-pointer"><Trash2 size={13} /></button>
              )}
            </div>
            <p className="text-xs text-on-surface-variant">
              {[r.accountId && `ID ${r.accountId}`, `Owner: ${r.assetOwner}`, r.permissionLevel && `Permission: ${r.permissionLevel}`].filter(Boolean).join(' · ')}
            </p>
            <p className="text-[11px] text-on-surface-variant">
              {[r.requestedAt && `Requested ${day(r.requestedAt)}`, r.grantedAt && `granted ${day(r.grantedAt)}`, r.verifiedAt && `verified ${day(r.verifiedAt)}`, r.revokedAt && `revoked ${day(r.revokedAt)}`].filter(Boolean).join(' · ')}
              {r.updatedByName && ` · by ${r.updatedByName}`}
            </p>
            {r.revokeReason && <p className="text-[11px] text-on-surface-variant">Revoked: {r.revokeReason}</p>}
            {r.notes && <p className="text-[11px] text-on-surface-variant">{r.notes}</p>}

            {canEdit && NEXT[r.status].length > 0 && move?.row !== r._id && (
              <div className="flex flex-wrap gap-2 pt-1">
                {NEXT[r.status].map((to) => (
                  <button key={to} type="button" onClick={() => setMove({ row: r._id, to, permissionLevel: r.permissionLevel || options.permissions[0], revokeReason: '', date: today() })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${to === 'Revoked' ? 'border-red-500/40 text-red-400 hover:bg-red-500/10' : 'border-secondary/40 text-secondary hover:bg-secondary/10'}`}>
                    {to === 'Granted' ? 'Mark granted' : to === 'Verified' ? 'Mark verified (tested)' : 'Revoke'}
                  </button>
                ))}
              </div>
            )}
            {move?.row === r._id && (
              <div className="rounded-lg border border-outline-variant p-3 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="block"><span className={lbl}>Date *</span>
                    <input type="date" max={today()} className={`${field} [color-scheme:dark]`} value={move.date} onChange={(e) => setMove((m) => ({ ...m, date: e.target.value }))} /></label>
                  {move.to === 'Granted' && (
                    <label className="block"><span className={lbl}>Permission level *</span>
                      <select className={field} value={move.permissionLevel} onChange={(e) => setMove((m) => ({ ...m, permissionLevel: e.target.value }))}>{options.permissions.map((p) => <option key={p}>{p}</option>)}</select></label>
                  )}
                  {move.to === 'Revoked' && (
                    <label className="block sm:col-span-2"><span className={lbl}>Why? *</span>
                      <input className={field} value={move.revokeReason} onChange={(e) => setMove((m) => ({ ...m, revokeReason: e.target.value }))} placeholder="e.g. Contract ended — access removed on the platform" /></label>
                  )}
                </div>
                <div className="flex gap-2">
                  <button type="button" disabled={busy} onClick={() => run(() => http.put(`${base}/clients/${clientId}/access/${r._id}`, { status: move.to, date: move.date, permissionLevel: move.to === 'Granted' ? move.permissionLevel : undefined, revokeReason: move.revokeReason }), `Marked ${move.to.toLowerCase()}`)}
                    className="px-4 py-1.5 bg-secondary text-white rounded-lg text-xs font-medium hover:bg-secondary/90 disabled:opacity-50 cursor-pointer">Confirm</button>
                  <button type="button" onClick={() => setMove(null)} className="px-4 py-1.5 border border-outline-variant text-on-surface-variant rounded-lg text-xs cursor-pointer">Cancel</button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
