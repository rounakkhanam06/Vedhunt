import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { CheckCircle2, XCircle, Eye, AlertTriangle, ShieldCheck, Clock, CircleDashed } from 'lucide-react';

const STATUS = {
  'Not Submitted': { label: 'Not submitted', icon: CircleDashed, cls: 'text-on-surface-variant bg-surface-container-low border-outline-variant' },
  Submitted: { label: 'Awaiting review', icon: Clock, cls: 'text-blue-400 bg-blue-500/10 border-blue-500/25' },
  Verified: { label: 'Verified', icon: CheckCircle2, cls: 'text-green-400 bg-green-500/10 border-green-500/25' },
  Rejected: { label: 'Rejected', icon: XCircle, cls: 'text-red-400 bg-red-500/10 border-red-500/25' },
};
const OVERALL_CLS = {
  verified: 'text-green-400 bg-green-500/10 border-green-500/25',
  in_review: 'text-blue-400 bg-blue-500/10 border-blue-500/25',
  action_needed: 'text-red-400 bg-red-500/10 border-red-500/25',
  incomplete: 'text-amber-400 bg-amber-500/10 border-amber-500/25',
  not_started: 'text-on-surface-variant bg-surface-container-low border-outline-variant',
};

const fmt = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
const size = (b) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round((b || 0) / 1024))} KB`);

function Row({ item, clientId, http, base, canReview, onChanged }) {
  const s = STATUS[item.status] || STATUS['Not Submitted'];
  const Icon = s.icon;
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const decide = async (decision) => {
    setBusy(true);
    try {
      const res = await http.put(`${base}/clients/${clientId}/kyc/${item.key}/review`, { decision, reason });
      toast.success(res.data.message);
      setRejecting(false); setReason('');
      onChanged(res.data.data);
    } catch (err) { toast.error(err?.response?.data?.message || 'Could not save the decision'); }
    finally { setBusy(false); }
  };

  const view = async () => {
    const w = window.open('about:blank', '_blank');
    try {
      const res = await http.get(`${base}/clients/${clientId}/kyc/${item.key}/file`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      if (w) w.location.href = url; else window.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      if (w) w.close();
      toast.error(err?.response?.status === 403 ? 'You need edit access to view identity documents.' : 'Could not open the document.');
    }
  };

  return (
    <li className="border border-outline-variant rounded-xl bg-admin-bg/40 p-3.5 space-y-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-on-surface text-sm font-semibold">{item.label}{!item.required && <span className="text-on-surface-variant text-[10px] uppercase font-bold tracking-wider ml-2">Optional</span>}</p>
        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${s.cls}`}><Icon size={12} /> {s.label}</span>
        {item.attempts > 1 && <span className="text-[11px] text-on-surface-variant">{item.attempts} submissions</span>}
      </div>

      {item.status === 'Not Submitted' ? (
        <p className="text-on-surface-variant text-xs">The client has not submitted this yet.</p>
      ) : (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
          {(item.fullValue || item.displayValue) && (
            <div>
              <dt className="text-on-surface-variant text-[10px] uppercase font-bold tracking-wider">{item.number?.label}</dt>
              <dd className="text-on-surface font-mono select-all">{item.fullValue || item.displayValue}{item.holderType && <span className="text-on-surface-variant font-sans text-xs"> · {item.holderType}</span>}</dd>
            </div>
          )}
          <div>
            <dt className="text-on-surface-variant text-[10px] uppercase font-bold tracking-wider">Document</dt>
            <dd className="text-on-surface text-xs flex flex-wrap items-center gap-x-3">
              <span className="truncate max-w-[14rem]">{item.fileName}</span>
              <span className="text-on-surface-variant">{item.fileMime?.split('/')[1]?.toUpperCase()} · {size(item.fileSize)}</span>
              {canReview && <button type="button" onClick={view} className="flex items-center gap-1 text-secondary font-medium cursor-pointer hover:underline"><Eye size={13} /> View</button>}
            </dd>
          </div>
          <div className="sm:col-span-2 text-xs text-on-surface-variant">
            Submitted {fmt(item.submittedAt)}
            {item.reviewedAt && <> · {item.status === 'Verified' ? 'verified' : 'rejected'} by {item.reviewerName || 'staff'} on {fmt(item.reviewedAt)}</>}
          </div>
        </dl>
      )}

      {item.status === 'Rejected' && item.rejectionReason && (
        <p className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">Reason given to the client: {item.rejectionReason}</p>
      )}

      {canReview && item.status === 'Submitted' && !rejecting && (
        <div className="flex flex-wrap gap-2 pt-1">
          <button type="button" disabled={busy} onClick={() => decide('verify')} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-60 cursor-pointer"><CheckCircle2 size={14} /> Verify</button>
          <button type="button" disabled={busy} onClick={() => setRejecting(true)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-red-500/40 text-red-400 text-sm font-semibold hover:bg-red-500/10 cursor-pointer"><XCircle size={14} /> Reject…</button>
        </div>
      )}
      {canReview && rejecting && (
        <div className="space-y-2 pt-1">
          <label className="block text-on-surface-variant text-[10px] uppercase font-bold tracking-wider" htmlFor={`kyc-reject-${item.key}`}>What should the client fix? (they will see this)</label>
          <textarea id={`kyc-reject-${item.key}`} rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. The PAN card photo is blurred — please upload a clear copy"
            className="w-full px-3 py-2 bg-admin-bg border border-outline-variant rounded-lg text-on-surface text-sm focus:outline-none focus:border-secondary resize-none" />
          <div className="flex gap-2">
            <button type="button" disabled={busy || reason.trim().length < 5} onClick={() => decide('reject')} className="px-3.5 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 cursor-pointer">Reject &amp; notify client</button>
            <button type="button" onClick={() => { setRejecting(false); setReason(''); }} className="px-3.5 py-2 rounded-lg border border-outline-variant text-on-surface-variant text-sm cursor-pointer">Cancel</button>
          </div>
        </div>
      )}
    </li>
  );
}

/**
 * Staff review of a client's KYC: each item is verified or rejected on its own.
 * The PAN is shown in full, the Aadhaar only as its last 4 digits; opening a
 * document is an audited action and needs edit access to the client.
 */
export default function KycPanel({ clientId, http, base, canReview }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    http.get(`${base}/clients/${clientId}/kyc`)
      .then((res) => { if (live) setData(res.data.data); })
      .catch((err) => { if (live) setError(err?.response?.data?.message || 'Could not load KYC'); });
    return () => { live = false; };
  }, [http, base, clientId]);

  if (error) return <p className="text-red-400 text-sm">{error}</p>;
  if (!data) return <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-secondary/30 border-t-secondary rounded-full animate-spin" /></div>;

  const o = data.overall;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${OVERALL_CLS[o.status]}`}><ShieldCheck size={13} /> KYC: {o.label}</span>
        <span className="text-xs text-on-surface-variant">{o.requiredVerified} of {o.requiredTotal} required items verified{o.pending.length ? ` · ${o.pending.length} awaiting review` : ''}</span>
      </div>

      {data.flags.length > 0 && (
        <ul className="space-y-1.5">
          {data.flags.map((f) => (
            <li key={f.key} className="flex items-start gap-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" /> {f.message}
            </li>
          ))}
        </ul>
      )}

      <ul className="space-y-3">
        {data.items.map((item) => <Row key={item.key} item={item} clientId={clientId} http={http} base={base} canReview={canReview} onChanged={setData} />)}
      </ul>
    </div>
  );
}
