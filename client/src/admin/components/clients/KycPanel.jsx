import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { CheckCircle2, XCircle, Eye, AlertTriangle, ShieldCheck, Clock, CircleDashed, Search, Upload, Ban, Undo2 } from 'lucide-react';

const STATUS = {
  'Not Requested': { label: 'Not requested', icon: CircleDashed, cls: 'text-on-surface-variant bg-surface-container-low border-outline-variant' },
  'Not Submitted': { label: 'Not submitted', icon: CircleDashed, cls: 'text-on-surface-variant bg-surface-container-low border-outline-variant' },
  Submitted: { label: 'Awaiting review', icon: Clock, cls: 'text-blue-400 bg-blue-500/10 border-blue-500/25' },
  'Under Review': { label: 'Under review', icon: Search, cls: 'text-violet-400 bg-violet-500/10 border-violet-500/25' },
  Verified: { label: 'Verified', icon: CheckCircle2, cls: 'text-green-400 bg-green-500/10 border-green-500/25' },
  Rejected: { label: 'Rejected', icon: XCircle, cls: 'text-red-400 bg-red-500/10 border-red-500/25' },
  'Not Applicable': { label: 'Not applicable', icon: Ban, cls: 'text-on-surface-variant bg-surface-container-low border-outline-variant' },
};
const OVERALL_CLS = {
  verified: 'text-green-400 bg-green-500/10 border-green-500/25',
  in_review: 'text-blue-400 bg-blue-500/10 border-blue-500/25',
  action_needed: 'text-red-400 bg-red-500/10 border-red-500/25',
  incomplete: 'text-amber-400 bg-amber-500/10 border-amber-500/25',
  not_started: 'text-on-surface-variant bg-surface-container-low border-outline-variant',
};
// Where a document an admin uploaded for the client came from (server: UPLOAD_SOURCES, minus 'Client portal')
const SOURCES = ['Client WhatsApp', 'Email', 'In person', 'Other'];

const fmt = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
const fmtDay = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '');
const size = (b) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round((b || 0) / 1024))} KB`);
const today = () => new Date().toLocaleDateString('en-CA');
const field = 'w-full px-3 py-2 bg-admin-bg border border-outline-variant rounded-lg text-on-surface text-sm focus:outline-none focus:border-secondary';
const btn = 'flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold disabled:opacity-60 cursor-pointer';

function Row({ item, clientId, http, base, canReview, onChanged }) {
  const s = STATUS[item.status] || STATUS['Not Submitted'];
  const Icon = s.icon;
  // null | 'reject' | 'upload' | 'na'
  const [mode, setMode] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [up, setUp] = useState({ source: SOURCES[0], receivedAt: today(), value: '', file: null });

  const reset = () => { setMode(null); setReason(''); setUp({ source: SOURCES[0], receivedAt: today(), value: '', file: null }); };
  const call = async (fn, failMessage) => {
    setBusy(true);
    try {
      const res = await fn();
      toast.success(res.data.message);
      reset();
      onChanged(res.data.data);
    } catch (err) { toast.error(err?.response?.data?.message || failMessage); }
    finally { setBusy(false); }
  };

  const decide = (decision) => call(() => http.put(`${base}/clients/${clientId}/kyc/${item.key}/review`, { decision, reason }), 'Could not save the decision');
  const applicability = (applyMode) => call(() => http.put(`${base}/clients/${clientId}/kyc/${item.key}/applicability`, { mode: applyMode, reason }), 'Could not update the item');
  const upload = () => {
    const form = new FormData();
    form.append('source', up.source);
    form.append('receivedAt', up.receivedAt);
    if (item.number && up.value) form.append('value', up.value);
    form.append('file', up.file);
    return call(() => http.put(`${base}/clients/${clientId}/kyc/${item.key}/upload`, form, { headers: { 'Content-Type': 'multipart/form-data' } }), 'Could not upload the document');
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

  const waiting = item.status === 'Submitted' || item.status === 'Under Review';
  const hasDoc = item.hasFile && !['Not Requested', 'Not Applicable'].includes(item.status);
  const canUpload = canReview && ['Not Submitted', 'Not Requested', 'Rejected'].includes(item.status);
  const canMarkNa = canReview && ['Not Submitted', 'Not Requested', 'Rejected'].includes(item.status);
  const canRequest = canReview && ['Not Requested', 'Not Applicable'].includes(item.status);

  return (
    <li className="border border-outline-variant rounded-xl bg-admin-bg/40 p-3.5 space-y-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-on-surface text-sm font-semibold">{item.label}{!item.required && <span className="text-on-surface-variant text-[10px] uppercase font-bold tracking-wider ml-2">Optional</span>}</p>
        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${s.cls}`}><Icon size={12} /> {s.label}</span>
        {item.attempts > 1 && <span className="text-[11px] text-on-surface-variant">{item.attempts} submissions</span>}
      </div>

      {item.status === 'Not Submitted' && <p className="text-on-surface-variant text-xs">The client has not submitted this yet.</p>}
      {item.status === 'Not Requested' && <p className="text-on-surface-variant text-xs">Not asked for from this client. Request it if it is needed.</p>}
      {item.status === 'Not Applicable' && (
        <p className="text-on-surface-variant text-xs">Does not apply to this client{item.naReason ? ` — ${item.naReason}` : ''}{item.reviewerName ? ` (set by ${item.reviewerName}, ${fmtDay(item.reviewedAt)})` : ''}.</p>
      )}

      {hasDoc && (
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
          <div className="sm:col-span-2 text-xs text-on-surface-variant space-y-0.5">
            <p>
              {item.uploadedBy === 'admin'
                ? <>Uploaded by <strong className="text-on-surface">{item.uploadedByName || 'staff'}</strong> for the client · source: <strong className="text-on-surface">{item.source}</strong>{item.receivedAt && <> · received {fmtDay(item.receivedAt)}</>} · recorded {fmt(item.submittedAt)}</>
                : <>Submitted by the client {fmt(item.submittedAt)}</>}
            </p>
            {item.reviewedAt && ['Verified', 'Rejected'].includes(item.status) && <p>{item.status === 'Verified' ? 'Verified' : 'Rejected'} by {item.reviewerName || 'staff'} on {fmt(item.reviewedAt)}</p>}
            {item.status === 'Under Review' && item.reviewerName && <p>Being reviewed by {item.reviewerName}</p>}
          </div>
        </dl>
      )}

      {item.status === 'Rejected' && item.rejectionReason && (
        <p className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">Reason given to the client: {item.rejectionReason}</p>
      )}

      {/* Review: start → verify / reject. Verify needs the document on file (the server checks too) */}
      {canReview && waiting && !mode && (
        <div className="flex flex-wrap gap-2 pt-1">
          {item.status === 'Submitted' && <button type="button" disabled={busy} onClick={() => decide('start_review')} className={`${btn} border border-violet-500/40 text-violet-400 hover:bg-violet-500/10`}><Search size={14} /> Start review</button>}
          <button type="button" disabled={busy} onClick={() => decide('verify')} className={`${btn} bg-green-600 text-white hover:bg-green-700`}><CheckCircle2 size={14} /> Verify</button>
          <button type="button" disabled={busy} onClick={() => setMode('reject')} className={`${btn} border border-red-500/40 text-red-400 hover:bg-red-500/10`}><XCircle size={14} /> Reject…</button>
        </div>
      )}

      {/* Staff-side options for an item with nothing waiting */}
      {!mode && (canUpload || canRequest) && (
        <div className="flex flex-wrap gap-2 pt-1">
          {canUpload && <button type="button" onClick={() => setMode('upload')} className={`${btn} border border-secondary/40 text-secondary hover:bg-secondary/10`}><Upload size={14} /> Upload for client…</button>}
          {canMarkNa && <button type="button" onClick={() => setMode('na')} className={`${btn} border border-outline-variant text-on-surface-variant hover:text-on-surface`}><Ban size={14} /> Not applicable…</button>}
          {canMarkNa && !item.required && item.status === 'Not Submitted' && (
            <button type="button" disabled={busy} onClick={() => applicability('not_requested')} className={`${btn} border border-outline-variant text-on-surface-variant hover:text-on-surface`}>Don’t request</button>
          )}
          {canRequest && <button type="button" disabled={busy} onClick={() => applicability('request')} className={`${btn} border border-secondary/40 text-secondary hover:bg-secondary/10`}><Undo2 size={14} /> Request from client</button>}
        </div>
      )}

      {canReview && mode === 'reject' && (
        <div className="space-y-2 pt-1">
          <label className="block text-on-surface-variant text-[10px] uppercase font-bold tracking-wider" htmlFor={`kyc-reject-${item.key}`}>What should the client fix? (they will see this)</label>
          <textarea id={`kyc-reject-${item.key}`} rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. The PAN card photo is blurred — please upload a clear copy" className={`${field} resize-none`} />
          <div className="flex gap-2">
            <button type="button" disabled={busy || reason.trim().length < 5} onClick={() => decide('reject')} className={`${btn} bg-red-600 text-white hover:bg-red-700`}>Reject &amp; notify client</button>
            <button type="button" onClick={reset} className={`${btn} border border-outline-variant text-on-surface-variant`}>Cancel</button>
          </div>
        </div>
      )}

      {canReview && mode === 'na' && (
        <div className="space-y-2 pt-1">
          <label className="block text-on-surface-variant text-[10px] uppercase font-bold tracking-wider" htmlFor={`kyc-na-${item.key}`}>Why does it not apply? (staff only)</label>
          <textarea id={`kyc-na-${item.key}`} rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Below the GST threshold — no GSTIN" className={`${field} resize-none`} />
          <div className="flex gap-2">
            <button type="button" disabled={busy || reason.trim().length < 5} onClick={() => applicability('not_applicable')} className={`${btn} bg-secondary text-white hover:bg-secondary/90`}>Mark not applicable</button>
            <button type="button" onClick={reset} className={`${btn} border border-outline-variant text-on-surface-variant`}>Cancel</button>
          </div>
        </div>
      )}

      {canReview && mode === 'upload' && (
        <div className="space-y-2.5 pt-1 rounded-lg border border-secondary/30 bg-secondary/5 p-3">
          <p className="text-xs text-on-surface-variant">For a document the client sent you another way. It is recorded as uploaded by you, goes <strong>Under review</strong>, and still has to be verified.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <label className="block">
              <span className="block text-on-surface-variant text-[10px] uppercase font-bold tracking-wider mb-1">Where did it come from? *</span>
              <select value={up.source} onChange={(e) => setUp((u) => ({ ...u, source: e.target.value }))} className={field}>{SOURCES.map((x) => <option key={x}>{x}</option>)}</select>
            </label>
            <label className="block">
              <span className="block text-on-surface-variant text-[10px] uppercase font-bold tracking-wider mb-1">Date received *</span>
              <input type="date" max={today()} value={up.receivedAt} onChange={(e) => setUp((u) => ({ ...u, receivedAt: e.target.value }))} className={`${field} [color-scheme:dark]`} />
            </label>
            {item.number && (
              <label className="block sm:col-span-2">
                <span className="block text-on-surface-variant text-[10px] uppercase font-bold tracking-wider mb-1">{item.number.label}{item.number.required ? ' *' : ' (optional)'}</span>
                <input value={up.value} onChange={(e) => setUp((u) => ({ ...u, value: e.target.value }))} placeholder={item.number.placeholder} autoComplete="off" className={`${field} font-mono`} />
              </label>
            )}
            <label className="block sm:col-span-2">
              <span className="block text-on-surface-variant text-[10px] uppercase font-bold tracking-wider mb-1">Document * (JPG, PNG, WEBP{item.accept === 'image' ? '' : ' or PDF'} · up to 5MB)</span>
              <input type="file" accept={item.accept === 'image' ? 'image/jpeg,image/png,image/webp' : 'image/jpeg,image/png,image/webp,application/pdf'}
                onChange={(e) => setUp((u) => ({ ...u, file: e.target.files?.[0] || null }))} className="block w-full text-xs text-on-surface-variant file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-secondary/15 file:text-secondary file:font-semibold file:cursor-pointer" />
            </label>
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={busy || !up.file || !up.receivedAt} onClick={upload} className={`${btn} bg-secondary text-white hover:bg-secondary/90`}>{busy ? 'Uploading…' : 'Upload'}</button>
            <button type="button" onClick={reset} className={`${btn} border border-outline-variant text-on-surface-variant`}>Cancel</button>
          </div>
        </div>
      )}
    </li>
  );
}

/**
 * Staff review of a client's KYC: each item is checked on its own (start review → verify or
 * reject), marked Not Applicable / Not Requested, or uploaded on the client's behalf with its
 * source recorded. The PAN is shown in full, the Aadhaar only as its last 4 digits; opening a
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
        <span className="text-xs text-on-surface-variant">
          {o.requiredVerified} of {o.requiredTotal} required items done{o.notApplicable?.length ? ` (${o.notApplicable.length} not applicable)` : ''}{o.pending.length ? ` · ${o.pending.length} awaiting review` : ''}
        </span>
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
