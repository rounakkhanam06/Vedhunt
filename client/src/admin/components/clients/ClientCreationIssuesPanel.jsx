import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, X, RefreshCcw, UserPlus, Link2, Ban, Search } from 'lucide-react';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';

const inputCls = 'w-full px-3 py-2 bg-admin-bg border border-outline-variant rounded-lg text-on-surface text-sm focus:outline-none focus:border-secondary';
const fmt = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

function Issue({ issue, http, base, onChanged }) {
  const { lead } = issue;
  const [mode, setMode] = useState(''); // '' | 'create'
  const [form, setForm] = useState({ businessName: lead.businessName || lead.fullName || '', contactName: lead.fullName || '', email: lead.email || '', phone: lead.phone || '' });
  const [busy, setBusy] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const call = async (kind, body, doneMessage) => {
    setBusy(kind);
    try {
      const res = await http.post(`${base}/client-creation-issues/${issue._id}/${kind}`, body);
      toast[res.data.created === false ? 'error' : 'success'](doneMessage || res.data.message);
      onChanged();
    } catch (err) { toast.error(err?.response?.data?.message || 'That did not work'); }
    finally { setBusy(''); }
  };

  const dismiss = () => {
    const reason = window.prompt(`No client account is needed for ${lead.fullName}? Say why:`);
    if (reason !== null) call('dismiss', { reason });
  };

  const ex = issue.existingClient;
  const canLink = ex && !ex.deleted && !ex.linkedToLead;

  return (
    <li className="rounded-xl border border-outline-variant bg-surface p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-on-surface font-semibold">{lead.fullName}{lead.businessName && lead.businessName !== lead.fullName ? <span className="text-on-surface-variant font-normal"> · {lead.businessName}</span> : null}</p>
          <p className="text-on-surface-variant text-xs mt-0.5 break-all">{lead.email || 'no email'} · {lead.phone || 'no phone'}{lead.dealCloseValue ? ` · ₹${Number(lead.dealCloseValue).toLocaleString('en-IN')}` : ''}</p>
        </div>
        <span className="text-[11px] text-on-surface-variant">Tried {issue.attempts}× · last {fmt(issue.lastAttemptAt)}</span>
      </div>

      <ul className="space-y-1.5">
        {issue.reasons.map((r) => (
          <li key={r.code + r.message} className="flex items-start gap-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2"><AlertTriangle size={14} className="shrink-0 mt-0.5" /> {r.message}</li>
        ))}
      </ul>

      {mode === 'create' ? (
        <form onSubmit={(e) => { e.preventDefault(); call('create', form); }} className="space-y-3 rounded-xl border border-outline-variant bg-admin-bg/40 p-3">
          <p className="text-xs text-on-surface-variant">Correct the details and create the account. The lead&apos;s own record is not changed. The login details are emailed to this address.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[['businessName', 'Business name'], ['contactName', 'Contact name'], ['email', 'Email'], ['phone', 'Phone (optional, 10–15 digits)']].map(([k, label]) => (
              <label key={k} className="block"><span className="block text-on-surface-variant text-[10px] uppercase font-bold tracking-wider mb-1">{label}</span>
                <input className={inputCls} value={form[k]} onChange={set(k)} type={k === 'email' ? 'email' : 'text'} /></label>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={!!busy} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-secondary text-white text-sm font-semibold disabled:opacity-60 cursor-pointer"><UserPlus size={14} /> {busy === 'create' ? 'Creating…' : 'Create account'}</button>
            <button type="button" onClick={() => setMode('')} className="px-3.5 py-2 rounded-lg border border-outline-variant text-on-surface-variant text-sm cursor-pointer">Cancel</button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!!busy} onClick={() => call('retry')} title="Try again with the lead's current details (after correcting the lead)" className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-outline-variant text-on-surface text-sm cursor-pointer hover:bg-surface-container-low disabled:opacity-50"><RefreshCcw size={14} /> {busy === 'retry' ? 'Trying…' : 'Retry'}</button>
          <button type="button" disabled={!!busy} onClick={() => setMode('create')} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-secondary text-white text-sm font-semibold cursor-pointer disabled:opacity-50"><UserPlus size={14} /> Create with corrected details</button>
          {canLink && (
            <button type="button" disabled={!!busy} onClick={() => { if (window.confirm(`Link this lead to the existing account ${ex.clientId} (${ex.businessName})? Only do this if it is the same customer.`)) call('link', { client_id: ex._id }); }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-outline-variant text-on-surface text-sm cursor-pointer hover:bg-surface-container-low disabled:opacity-50"><Link2 size={14} /> Link to {ex.clientId}</button>
          )}
          {ex?.deleted && <span className="text-xs text-on-surface-variant self-center">Restore {ex.clientId} from the &quot;Deleted&quot; filter first.</span>}
          <button type="button" disabled={!!busy} onClick={dismiss} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-outline-variant text-on-surface-variant text-sm cursor-pointer hover:bg-surface-container-low disabled:opacity-50 ml-auto"><Ban size={14} /> No account needed</button>
        </div>
      )}
    </li>
  );
}

/**
 * Won leads that have no client account, with the exact reason for each and the ways to fix it.
 * Opens as a dialog from the banner on Client Accounts.
 */
export default function ClientCreationIssuesPanel({ http, base, onClose, onChanged }) {
  useBodyScrollLock(onClose); // the page behind stays still; Escape closes
  const [data, setData] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState(null); // result of the check run in this session
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let live = true;
    http.get(`${base}/client-creation-issues`, { params: { status: 'Open' } })
      .then((res) => { if (live) setData(res.data); })
      .catch((err) => toast.error(err?.response?.data?.message || 'Could not load the list'));
    return () => { live = false; };
  }, [http, base, reload]);

  const changed = useCallback(() => { setReload((n) => n + 1); onChanged?.(); }, [onChanged]);

  const scan = async () => {
    setScanning(true);
    try {
      const res = await http.post(`${base}/client-creation-issues/scan`);
      setLastScan({ checked: res.data.checked, withAccount: res.data.withAccount, issues: res.data.issues });
      toast.success(`Checked ${res.data.checked} Won leads: ${res.data.withAccount} have an account, ${res.data.issues} do not.`);
      changed();
    } catch (err) { toast.error(err?.response?.data?.message || 'Could not check'); }
    finally { setScanning(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto overscroll-contain" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="cci-title" className="w-full max-w-3xl bg-surface border border-outline-variant rounded-2xl shadow-2xl my-auto">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-outline-variant">
          <div>
            <h3 id="cci-title" className="text-on-surface font-semibold">Won leads without a client account</h3>
            <p className="text-on-surface-variant text-xs mt-0.5">Each one shows why the account was not created. Fix the cause, then retry — or create the account with corrected details.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-surface-container-low text-on-surface-variant cursor-pointer shrink-0"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto overscroll-contain">
          <button type="button" onClick={scan} disabled={scanning} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-outline-variant text-xs text-on-surface hover:bg-surface-container-low disabled:opacity-60 cursor-pointer"><Search size={13} /> {scanning ? 'Checking…' : 'Check all Won leads now'}</button>
          {lastScan && (
            <p className="text-xs text-on-surface-variant" role="status">
              Just checked {lastScan.checked} Won lead{lastScan.checked === 1 ? '' : 's'}: <strong className="text-on-surface">{lastScan.withAccount}</strong> already {lastScan.withAccount === 1 ? 'has' : 'have'} a client account, <strong className="text-on-surface">{lastScan.issues}</strong> {lastScan.issues === 1 ? 'does' : 'do'} not.
            </p>
          )}
          {!data ? (
            <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-secondary/30 border-t-secondary rounded-full animate-spin" /></div>
          ) : data.data.length === 0 ? (
            <p className="text-center text-on-surface-variant text-sm py-8">
              {lastScan
                ? 'Nothing needs attention — every Won lead has a client account.'
                : 'No problems are recorded yet. Press “Check all Won leads now” to look for Won leads that never got a client account.'}
            </p>
          ) : (
            <ul className="space-y-3">{data.data.map((i) => <Issue key={i._id} issue={i} http={http} base={base} onChanged={changed} />)}</ul>
          )}
        </div>
      </div>
    </div>
  );
}
