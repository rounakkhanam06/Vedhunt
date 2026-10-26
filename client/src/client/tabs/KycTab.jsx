import { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  Receipt, CreditCard, Fingerprint, Camera, FileSignature, ShieldCheck, CheckCircle2, Clock, AlertTriangle, CircleDashed,
  Upload, Eye, RefreshCcw, Lock,
} from 'lucide-react';
import clientService from '../../services/clientService';

const ICONS = { gst: Receipt, pan: CreditCard, aadhaar: Fingerprint, photo: Camera, brand_authorisation: FileSignature };

const STATUS = {
  'Not Submitted': { label: 'Not submitted', icon: CircleDashed, cls: 'text-[#9CA3AF] bg-white/5 border-white/10' },
  Submitted: { label: 'In review', icon: Clock, cls: 'text-[#3B82F6] bg-[#3B82F6]/10 border-[#3B82F6]/25' },
  Verified: { label: 'Verified', icon: CheckCircle2, cls: 'text-[#22C55E] bg-[#22C55E]/10 border-[#22C55E]/25' },
  Rejected: { label: 'Needs changes', icon: AlertTriangle, cls: 'text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/25' },
};

const OVERALL = {
  not_started: { tone: 'border-border-default bg-bg-surface/30', text: 'Start your verification', sub: 'Submit the items below so we can verify your business.' },
  incomplete: { tone: 'border-[#F59E0B]/30 bg-[#F59E0B]/10', text: 'Almost there', sub: 'Some items still need to be submitted.' },
  in_review: { tone: 'border-[#3B82F6]/30 bg-[#3B82F6]/10', text: 'Under review', sub: 'Our team is checking your documents. We will notify you.' },
  action_needed: { tone: 'border-[#EF4444]/30 bg-[#EF4444]/10', text: 'Action needed', sub: 'One or more documents need changes — see below.' },
  verified: { tone: 'border-[#22C55E]/30 bg-[#22C55E]/10', text: 'You are verified', sub: 'All required documents have been verified.' },
};

const MAX_BYTES = 5 * 1024 * 1024;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const fmtSize = (b) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

// Light format checks for instant feedback. The server does the real validation (check digits included).
const clean = (key, raw) => {
  if (key === 'aadhaar') return raw.replace(/\D/g, '').slice(0, 12).replace(/(\d{4})(?=\d)/g, '$1 ');
  if (key === 'gst') return raw.replace(/\s/g, '').toUpperCase().slice(0, 15);
  if (key === 'pan') return raw.replace(/\s/g, '').toUpperCase().slice(0, 10);
  return raw.slice(0, 120);
};
const quickCheck = (key, value) => {
  const v = value.replace(/\s/g, '');
  if (key === 'gst' && !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(v)) return 'A GSTIN has 15 characters, for example 27AALCV0172E1ZD.';
  if (key === 'pan' && !/^[A-Z]{5}\d{4}[A-Z]$/.test(v)) return 'A PAN has 10 characters, for example ABCDE1234F.';
  if (key === 'aadhaar' && !/^[2-9]\d{11}$/.test(v)) return 'An Aadhaar number has 12 digits.';
  return '';
};

function StatusBadge({ status }) {
  const s = STATUS[status] || STATUS['Not Submitted'];
  const Icon = s.icon;
  return <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${s.cls}`}><Icon size={12} /> {s.label}</span>;
}

function ItemCard({ item, onSaved }) {
  const Icon = ICONS[item.key] || ShieldCheck;
  const locked = !item.canSubmit; // verified
  const [editing, setEditing] = useState(item.status === 'Not Submitted' || item.status === 'Rejected');
  const [value, setValue] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  // Revoke the preview URL when it is replaced or the card goes away
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const pick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_BYTES) { setError('The file must be 5MB or smaller.'); e.target.value = ''; return; }
    setError('');
    setFile(f);
    setPreview(f.type.startsWith('image/') ? URL.createObjectURL(f) : '');
  };

  const submit = async (e) => {
    e.preventDefault();
    const problem = item.number?.required ? quickCheck(item.key, value) : '';
    if (problem) { setError(problem); return; }
    if (!file) { setError(`Choose your ${item.label} document first.`); return; }
    setBusy(true);
    setError('');
    try {
      const res = await clientService.submitKyc(item.key, { value: item.number ? value : undefined, file });
      toast.success(res.message);
      setValue(''); setFile(null); setPreview('');
      setEditing(false);
      onSaved(res.data);
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not upload. Please try again.');
    } finally { setBusy(false); }
  };

  const view = async () => {
    const w = window.open('about:blank', '_blank'); // opened first so mobile pop-up blockers allow it
    try {
      const blob = await clientService.getKycFile(item.key);
      const url = URL.createObjectURL(blob);
      if (w) { w.location.href = url; } else { window.location.href = url; }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      if (w) w.close();
      toast.error('Could not open the document.');
    }
  };

  const inputCls = 'w-full px-3.5 py-3 bg-bg-surface/50 border border-border-default rounded-xl text-white placeholder-[#4B5563] focus:outline-none focus:border-primary/60 text-sm';
  const accept = item.accept === 'image' ? 'image/jpeg,image/png,image/webp' : 'image/jpeg,image/png,image/webp,application/pdf';

  return (
    <li className="rounded-xl border border-border-default bg-bg-surface/30 p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><Icon size={18} /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="text-white text-sm font-semibold">{item.label}</h3>
            {!item.required && <span className="text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold">Optional</span>}
            <span className="ml-auto"><StatusBadge status={item.status} /></span>
          </div>
          <p className="text-[#9CA3AF] text-xs mt-1 leading-relaxed">{item.help}</p>
        </div>
      </div>

      {item.displayValue && (
        <p className="mt-3 text-sm text-white flex items-center gap-2">
          <Lock size={13} className="text-[#9CA3AF]" /> <span className="font-mono tracking-wide">{item.displayValue}</span>
        </p>
      )}

      {item.status === 'Rejected' && item.rejectionReason && (
        <div className="mt-3 rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 px-3 py-2 text-sm text-white" role="alert">
          <span className="font-semibold text-[#EF4444]">Needs changes: </span>{item.rejectionReason}
        </div>
      )}

      {item.hasFile && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#9CA3AF]">
          <span className="truncate max-w-[14rem]">{item.fileName}</span>
          {item.submittedAt && <span>Submitted {fmtDate(item.submittedAt)}</span>}
          <button type="button" onClick={view} className="flex items-center gap-1 text-primary font-medium cursor-pointer hover:underline"><Eye size={13} /> View document</button>
        </div>
      )}

      {locked && <p className="mt-3 text-xs text-[#22C55E]">Verified {fmtDate(item.reviewedAt)}. Contact support if this needs to change.</p>}

      {!locked && !editing && (
        <button type="button" onClick={() => setEditing(true)} className="mt-3 flex items-center gap-1.5 text-xs font-medium text-[#9CA3AF] hover:text-white cursor-pointer">
          <RefreshCcw size={13} /> Replace {item.status === 'Submitted' ? 'what I submitted' : 'document'}
        </button>
      )}

      {!locked && editing && (
        <form onSubmit={submit} className="mt-4 space-y-3" noValidate>
          {item.number && (
            <div>
              <label htmlFor={`kyc-${item.key}-value`} className="block text-[#E5E7EB] text-xs font-medium mb-1.5">
                {item.number.label}{item.number.required ? '' : ' (optional)'}
              </label>
              <input
                id={`kyc-${item.key}-value`} value={value} onChange={(e) => { setValue(clean(item.key, e.target.value)); setError(''); }}
                placeholder={item.number.placeholder} autoComplete="off" inputMode={item.key === 'aadhaar' ? 'numeric' : 'text'}
                autoCapitalize={item.key === 'gst' || item.key === 'pan' ? 'characters' : 'sentences'} className={`${inputCls} ${item.number.kind === 'text' ? '' : 'font-mono tracking-wide'}`}
              />
            </div>
          )}
          <div>
            <span className="block text-[#E5E7EB] text-xs font-medium mb-1.5">{item.key === 'photo' ? 'Photo' : 'Document'} (JPG, PNG, WEBP{item.accept === 'image' ? '' : ' or PDF'} · up to 5MB)</span>
            <input
              ref={inputRef} type="file" accept={accept} onChange={pick} className="sr-only" id={`kyc-${item.key}-file`}
              {...(item.key === 'photo' ? { capture: 'user' } : {})}
            />
            <label htmlFor={`kyc-${item.key}-file`} className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl border border-dashed border-border-default text-sm text-[#E5E7EB] hover:border-primary/50 hover:bg-primary/5 cursor-pointer transition-colors">
              {item.key === 'photo' ? <Camera size={16} /> : <Upload size={16} />}
              {file ? 'Choose a different file' : item.key === 'photo' ? 'Take or choose a photo' : 'Choose a file'}
            </label>
            {file && (
              <div className="mt-2 flex items-center gap-3 text-xs text-[#9CA3AF]">
                {preview && <img src={preview} alt="Selected file preview" className="w-14 h-14 rounded-lg object-cover border border-border-default" />}
                <span className="truncate">{file.name} · {fmtSize(file.size)}</span>
              </div>
            )}
          </div>
          {error && <p className="text-sm text-[#EF4444]" role="alert">{error}</p>}
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            {item.status !== 'Not Submitted' && item.status !== 'Rejected' && (
              <button type="button" onClick={() => { setEditing(false); setFile(null); setPreview(''); setError(''); }} className="px-4 py-2.5 rounded-xl border border-border-default text-sm text-[#E5E7EB] hover:bg-white/5 cursor-pointer">Cancel</button>
            )}
            <button type="submit" disabled={busy} className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 cursor-pointer">
              {busy ? 'Uploading…' : item.status === 'Rejected' ? 'Resubmit' : 'Submit for review'}
            </button>
          </div>
        </form>
      )}
    </li>
  );
}

/** Advertiser KYC: GST, PAN, Aadhaar, photo and (optional) brand authorisation. */
const KycTab = () => {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    clientService.getKyc().then((d) => { if (live) setData(d); }).catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, []);

  const saved = useCallback((next) => setData(next), []);

  if (failed) return <p className="text-[#9CA3AF] text-sm">We couldn&apos;t load your KYC just now. Please try again shortly.</p>;
  if (!data) return <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-2 border-primary/30 border-t-[#FF5A1F] rounded-full animate-spin" /></div>;

  const o = data.overall;
  const tone = OVERALL[o.status] || OVERALL.not_started;
  const pct = Math.round((o.requiredVerified / o.requiredTotal) * 100);

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h2 className="text-white text-lg font-semibold">KYC verification</h2>
        <p className="text-[#9CA3AF] text-xs mt-1">We verify your identity and business before running ads on your behalf.</p>
      </div>

      <div className={`rounded-xl border p-4 ${tone.tone}`} aria-live="polite">
        <p className="text-white text-sm font-semibold flex items-center gap-2"><ShieldCheck size={16} /> {tone.text}</p>
        <p className="text-[#C3C8D2] text-xs mt-1">{tone.sub}</p>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-1.5 flex-1 bg-white/10 rounded-full overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Required items verified">
            <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs text-[#C3C8D2] shrink-0">{o.requiredVerified} of {o.requiredTotal} verified</span>
        </div>
      </div>

      <ul className="space-y-3">
        {data.items.map((item) => <ItemCard key={item.key} item={item} onSaved={saved} />)}
      </ul>

      <p className="text-[#6B7280] text-xs leading-relaxed">
        Your documents are stored privately and are only visible to you and the Vedhunt team members who verify them. We keep only the last 4 digits of your Aadhaar number.
      </p>
    </div>
  );
};

export default KycTab;
