import { useEffect, useState } from 'react';
import { X, FileText } from 'lucide-react';
import toast from 'react-hot-toast';

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

/**
 * Bill a finished month's extra retainer hours. The rate and free hours come
 * from the Super Admin's "Client rules"; this only previews and, on click,
 * creates the invoice (once per month).
 */
export default function ExtraHoursModal({ retainer, http, base, onClose, onDone }) {
  const months = (retainer.history || []).filter((m) => !m.partial && m.extra > 0).reverse();
  const [month, setMonth] = useState(months[0]?.key || '');
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadedMonth, setLoadedMonth] = useState(null);

  useEffect(() => {
    if (!month) return undefined;
    let live = true;
    http.get(`${base}/retainers/${retainer._id}/extra-hours`, { params: { month } })
      .then((res) => { if (live) { setPreview(res.data.data); setError(''); } })
      .catch((err) => { if (live) { setPreview(null); setError(err?.response?.data?.message || 'Could not work out the charge.'); } })
      .finally(() => { if (live) setLoadedMonth(month); });
    return () => { live = false; };
  }, [http, base, retainer._id, month]);

  const create = async () => {
    setBusy(true);
    try {
      const res = await http.post(`${base}/retainers/${retainer._id}/extra-hours-invoice`, { month });
      toast.success(res.data.message);
      onDone();
    } catch (err) { toast.error(err?.response?.data?.message || 'Could not create the invoice'); }
    finally { setBusy(false); }
  };

  const loading = month && loadedMonth !== month;
  const canCreate = preview && !preview.alreadyInvoiced && preview.amount > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="extra-hours-title" className="w-full max-w-md bg-surface border border-outline-variant rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant">
          <h3 id="extra-hours-title" className="text-on-surface font-semibold">Bill extra hours — {retainer.client_ref?.businessName || retainer.retainerId}</h3>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-surface-container-low text-on-surface-variant cursor-pointer"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4 text-sm">
          {months.length === 0 ? (
            <p className="text-on-surface-variant">No finished month has extra hours yet. The month in progress can be billed once it ends.</p>
          ) : (
            <>
              <label className="block">
                <span className="block text-on-surface-variant text-xs font-medium mb-1.5">Month</span>
                <select value={month} onChange={(e) => setMonth(e.target.value)} className="w-full px-3 py-2 bg-admin-bg border border-outline-variant rounded-xl text-on-surface text-sm">
                  {months.map((m) => <option key={m.key} value={m.key}>{m.label} — {m.extra}h extra</option>)}
                </select>
              </label>
              {error && <p className="text-amber-400 text-xs rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2" role="alert">{error}</p>}
              {loading && <p className="text-on-surface-variant text-xs">Working it out…</p>}
              {preview && !loading && (
                <dl className="rounded-xl border border-outline-variant divide-y divide-outline-variant">
                  {[['Included hours', `${preview.included}h`], ['Hours worked', `${preview.used}h`], ['Extra hours', `${preview.extraHours}h`],
                    ['Free allowance', `${preview.policy.freeHours}h`], [`Billed (rounded up to ${preview.policy.roundTo}h)`, `${preview.billableHours}h × ${inr(preview.policy.ratePerHour)}`],
                    ['Amount', inr(preview.amount)], [`GST ${preview.policy.gstPercent}%`, inr(preview.gst)]].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3 px-3 py-2"><dt className="text-on-surface-variant">{k}</dt><dd className="text-on-surface tabular-nums">{v}</dd></div>
                  ))}
                  <div className="flex justify-between gap-3 px-3 py-2 font-semibold"><dt className="text-on-surface">Invoice total</dt><dd className="text-on-surface tabular-nums">{inr(preview.total)}</dd></div>
                </dl>
              )}
              {preview?.alreadyInvoiced && <p className="text-xs text-on-surface-variant">Already invoiced as {preview.alreadyInvoiced}.</p>}
              {preview && !preview.alreadyInvoiced && preview.amount <= 0 && <p className="text-xs text-on-surface-variant">Within the free allowance — nothing to bill.</p>}
            </>
          )}
        </div>
        <div className="px-5 py-3.5 bg-admin-bg/40 border-t border-outline-variant flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-outline-variant text-on-surface-variant text-sm cursor-pointer">Close</button>
          {months.length > 0 && (
            <button onClick={create} disabled={!canCreate || busy || loading} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-secondary text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
              <FileText size={14} /> {busy ? 'Creating…' : 'Create invoice'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
